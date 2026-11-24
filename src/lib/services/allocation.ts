import { randomBytes } from "node:crypto";
import { db } from "../db";
import { logActivity, notifyRoles } from "./activity";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { REQUEST_RESOURCE_MAP } from "../constants";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { allocationCreate, distributionUpdate } from "../validators";

type AllocInput = z.infer<typeof allocationCreate>;

/**
 * Allocate stock to a verified request. Everything happens in ONE transaction so a failure leaves inventory untouched:
 *   1. lock the request row (serialises concurrent allocations to the same request)
 *   2. validate status, category compatibility and remaining need
 *   3. atomically decrement stock with a guarded UPDATE (quantity >= requested) - the race-free check
 *   4. write allocation + stock movement + activity log
 */
export async function allocate(user: SessionUserLike, input: AllocInput) {
  if (user.role !== "SYSTEM_ADMIN" && user.role !== "EMERGENCY_COORDINATOR") throw forbidden("Only coordinators can allocate resources");
  try {
    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "EmergencyRequest" WHERE "id" = ${input.requestId} FOR UPDATE`;
      if (!locked.length) throw notFound("Request not found");
      const req = await tx.emergencyRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      if (req.status !== "VERIFIED" && req.status !== "ASSIGNED") throw conflict(`Request must be VERIFIED before allocation (current: ${req.status})`);

      const res = await tx.resource.findUnique({ where: { id: input.resourceId }, include: { organization: true } });
      if (!res) throw notFound("Resource not found");
      if (!res.organization.active) throw conflict("Resource's organization is inactive");
      if (!REQUEST_RESOURCE_MAP[req.type].includes(res.category as never))
        throw badRequest(`${res.category} resources cannot satisfy a ${req.type} request`);

      const agg = await tx.allocation.aggregate({ where: { requestId: req.id, status: { not: "CANCELLED" } }, _sum: { quantity: true } });
      const remaining = req.quantity - (agg._sum.quantity ?? 0);
      if (input.quantity > remaining) throw conflict(`Allocation exceeds remaining request need (${remaining} ${req.unit} left)`);

      const updated = await tx.$queryRaw<{ quantity: number }[]>`
        UPDATE "Resource" SET "quantity" = "quantity" - ${input.quantity}, "updatedAt" = now()
         WHERE "id" = ${res.id} AND "quantity" >= ${input.quantity}
     RETURNING "quantity"`;
      if (!updated.length) throw conflict(`Insufficient stock: only ${res.quantity} ${res.unit} available`);

      const alloc = await tx.allocation.create({
        data: { requestId: req.id, resourceId: res.id, organizationId: res.organizationId, quantity: input.quantity, allocatedById: user.id, notes: input.notes, qrToken: randomBytes(18).toString("base64url") },
      });
      await tx.stockMovement.create({
        data: { resourceId: res.id, type: "ALLOCATE", delta: -input.quantity, balanceAfter: updated[0].quantity, reason: `Allocated to request ${req.id}`, allocationId: alloc.id, userId: user.id, toLocation: req.location },
      });
      await tx.distributionRecord.create({ data: { allocationId: alloc.id, status: "ALLOCATED", notes: "Allocation created", submittedById: user.id } });
      await tx.emergencyRequest.update({ where: { id: req.id }, data: { status: "ASSIGNED", firstResponseAt: req.firstResponseAt ?? new Date() } });
      await logActivity(tx, { userId: user.id, action: "RESOURCE_ALLOCATED", entityType: "Allocation", entityId: alloc.id, details: { requestId: req.id, resourceId: res.id, quantity: input.quantity, balanceAfter: updated[0].quantity } });
      await notifyRoles(tx, ["RELIEF_ORGANIZATION"], { organizationId: res.organizationId, title: "New allocation to fulfil", body: `${input.quantity} ${res.unit} of ${res.name} → ${req.location}`, link: "/allocations" });
      return alloc;
    });
  } catch (e) {
    // Failed allocations roll back (inventory untouched) but the attempt itself is auditable.
    await logActivity(db, { userId: user.id, action: "ALLOCATION_REJECTED", entityType: "EmergencyRequest", entityId: input.requestId, details: { resourceId: input.resourceId, quantity: input.quantity, reason: e instanceof Error ? e.message : "error" } }).catch(() => {});
    throw e;
  }
}

const NEXT: Record<string, string[]> = {
  ALLOCATED: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export async function updateDistribution(user: SessionUserLike, allocationId: string, input: z.infer<typeof distributionUpdate>, viaToken = false) {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Allocation" WHERE "id" = ${allocationId} FOR UPDATE`;
    if (!locked.length) throw notFound("Allocation not found");
    const a = await tx.allocation.findUniqueOrThrow({ where: { id: allocationId }, include: { resource: true, request: true } });
    const ok = user.role === "SYSTEM_ADMIN" || user.role === "EMERGENCY_COORDINATOR" || (user.role === "RELIEF_ORGANIZATION" && user.organizationId === a.organizationId);
    if (!ok && !viaToken) throw forbidden("Not your organization's allocation");
    if (!NEXT[a.status].includes(input.status)) throw conflict(`Cannot move allocation from ${a.status} to ${input.status}`);

    const delivered = input.status === "DELIVERED" ? Math.min(input.deliveredQty ?? a.quantity, a.quantity) : 0;
    if (input.status === "CANCELLED") {
      const r = await tx.$queryRaw<{ quantity: number }[]>`UPDATE "Resource" SET "quantity" = "quantity" + ${a.quantity}, "updatedAt" = now() WHERE "id" = ${a.resourceId} RETURNING "quantity"`;
      await tx.stockMovement.create({ data: { resourceId: a.resourceId, type: "RELEASE", delta: a.quantity, balanceAfter: r[0].quantity, reason: `Allocation ${a.id} cancelled`, allocationId: a.id, userId: user.id } });
    } else if (input.status === "DELIVERED" && delivered < a.quantity) {
      const back = a.quantity - delivered; // undelivered remainder returns to stock
      const r = await tx.$queryRaw<{ quantity: number }[]>`UPDATE "Resource" SET "quantity" = "quantity" + ${back}, "updatedAt" = now() WHERE "id" = ${a.resourceId} RETURNING "quantity"`;
      await tx.stockMovement.create({ data: { resourceId: a.resourceId, type: "RELEASE", delta: back, balanceAfter: r[0].quantity, reason: `Undelivered remainder of allocation ${a.id}`, allocationId: a.id, userId: user.id } });
    }
    const updated = await tx.allocation.update({ where: { id: a.id }, data: { status: input.status, quantity: input.status === "DELIVERED" ? delivered || a.quantity : undefined } });
    await tx.distributionRecord.create({ data: { allocationId: a.id, status: input.status, deliveredQty: delivered, notes: input.notes, submittedById: user.id } });
    await logActivity(tx, { userId: user.id, action: `DISTRIBUTION_${input.status}`, entityType: "Allocation", entityId: a.id, details: { delivered, via: viaToken ? "qr" : "ui" } });

    if (input.status === "DELIVERED" || input.status === "CANCELLED") {
      const sums = await tx.allocation.groupBy({ by: ["status"], where: { requestId: a.requestId }, _sum: { quantity: true } });
      const deliveredTotal = sums.find((s) => s.status === "DELIVERED")?._sum.quantity ?? 0;
      const active = sums.filter((s) => s.status === "ALLOCATED" || s.status === "IN_TRANSIT").reduce((n, s) => n + (s._sum.quantity ?? 0), 0);
      if (deliveredTotal >= a.request.quantity) await tx.emergencyRequest.update({ where: { id: a.requestId }, data: { status: "COMPLETED", completedAt: new Date() } });
      else if (active === 0 && deliveredTotal === 0 && a.request.status === "ASSIGNED") await tx.emergencyRequest.update({ where: { id: a.requestId }, data: { status: "VERIFIED" } });
    }
    return updated;
  });
}
