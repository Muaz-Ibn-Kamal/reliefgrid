import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { requestCreate } from "@/lib/validators";
import { REQUEST_TYPES } from "@/lib/constants";
import { createRequest } from "@/lib/services/request";
import { forbidden } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  const where: Prisma.EmergencyRequestWhereInput = {
    type: enumParam(sp, "type", REQUEST_TYPES),
    status: enumParam(sp, "status", ["PENDING", "VERIFIED", "ASSIGNED", "COMPLETED", "REJECTED"] as const),
    priorityLevel: enumParam(sp, "priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
    ...(sp.get("incidentId") ? { incidentId: sp.get("incidentId")! } : {}),
    ...(q ? { OR: [{ description: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }, { requesterName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const sort = sp.get("sort");
  const orderBy: Prisma.EmergencyRequestOrderByWithRelationInput[] = sort === "newest" ? [{ createdAt: "desc" }] : [{ priorityScore: "desc" }, { createdAt: "asc" }];
  const [rows, total] = await Promise.all([
    db.emergencyRequest.findMany({
      where, orderBy, skip: pg.skip, take: pg.take,
      include: { incident: { select: { id: true, title: true } }, organization: { select: { name: true } }, allocations: { where: { status: { not: "CANCELLED" } }, select: { quantity: true } } },
    }),
    db.emergencyRequest.count({ where }),
  ]);
  return paged(rows.map(({ allocations, ...r }) => ({ ...r, allocatedQty: allocations.reduce((n, a) => n + a.quantity, 0) })), total, pg);
});

export const POST = route({}, async ({ user, req }) => {
  if (user.role === "VOLUNTEER" || user.role === "SHELTER_MANAGER") throw forbidden("Only coordinators, admins and relief organizations can submit requests here");
  return createRequest(user, await body(req, requestCreate));
});
