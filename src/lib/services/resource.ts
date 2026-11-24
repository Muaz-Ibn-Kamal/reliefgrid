import { db } from "../db";
import { logActivity } from "./activity";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { resourceCreate, stockAdjust } from "../validators";

/** Relief organizations may only touch their own org's resources; admins may touch all. */
export function assertResourceAccess(user: SessionUserLike, orgId: string) {
  if (user.role === "SYSTEM_ADMIN") return;
  if (user.role === "RELIEF_ORGANIZATION" && user.organizationId === orgId) return;
  throw forbidden("You can only manage your own organization's resources");
}

export async function registerResource(user: SessionUserLike, input: z.infer<typeof resourceCreate>) {
  const orgId = user.role === "RELIEF_ORGANIZATION" ? user.organizationId : input.organizationId;
  if (!orgId) throw badRequest("organizationId is required");
  assertResourceAccess(user, orgId);
  const org = await db.organization.findFirst({ where: { id: orgId, active: true } });
  if (!org) throw badRequest("Organization not found or inactive");
  return db.$transaction(async (tx) => {
    const r = await tx.resource.create({
      data: { organizationId: orgId, name: input.name, category: input.category, unit: input.unit, quantity: input.quantity, totalReceived: input.quantity, storageLocation: input.storageLocation },
    });
    await tx.stockMovement.create({ data: { resourceId: r.id, type: "REGISTER", delta: input.quantity, balanceAfter: input.quantity, reason: "Initial registration", toLocation: input.storageLocation, userId: user.id } });
    await logActivity(tx, { userId: user.id, action: "RESOURCE_REGISTERED", entityType: "Resource", entityId: r.id, details: { name: r.name, quantity: r.quantity } });
    return r;
  });
}

/** Stock changes are atomic: the UPDATE only succeeds if the result stays >= 0, then a ledger row is written in the same transaction. */
export async function adjustStock(user: SessionUserLike, resourceId: string, input: z.infer<typeof stockAdjust>) {
  const res = await db.resource.findUnique({ where: { id: resourceId } });
  if (!res) throw notFound("Resource not found");
  assertResourceAccess(user, res.organizationId);
  if (input.type === "RESTOCK" && input.delta < 0) throw badRequest("RESTOCK delta must be positive");
  if (input.type === "TRANSFER_OUT" && input.delta > 0) throw badRequest("TRANSFER_OUT delta must be negative");
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ quantity: number }[]>`
      UPDATE "Resource"
         SET "quantity" = "quantity" + ${input.delta},
             "totalReceived" = "totalReceived" + ${Math.max(0, input.delta)},
             "updatedAt" = now()
       WHERE "id" = ${resourceId} AND "quantity" + ${input.delta} >= 0
   RETURNING "quantity"`;
    if (!rows.length) throw conflict("Adjustment would make stock negative");
    await tx.stockMovement.create({
      data: { resourceId, type: input.type, delta: input.delta, balanceAfter: rows[0].quantity, reason: input.reason, toLocation: input.toLocation, fromLocation: res.storageLocation, userId: user.id },
    });
    await logActivity(tx, { userId: user.id, action: `STOCK_${input.type}`, entityType: "Resource", entityId: resourceId, details: { delta: input.delta, balance: rows[0].quantity } });
    return { id: resourceId, quantity: rows[0].quantity };
  });
}
