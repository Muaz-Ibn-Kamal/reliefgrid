import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { allocationCreate } from "@/lib/validators";
import { allocate } from "@/lib/services/allocation";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, sp }) => {
  const pg = page(sp);
  const where: Prisma.AllocationWhereInput = {
    ...(user.role === "RELIEF_ORGANIZATION" ? { organizationId: user.organizationId! } : {}),
    status: enumParam(sp, "status", ["ALLOCATED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const),
    ...(sp.get("requestId") ? { requestId: sp.get("requestId")! } : {}),
  };
  const [rows, total] = await Promise.all([
    db.allocation.findMany({
      where, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take,
      include: { resource: { select: { name: true, unit: true, category: true } }, organization: { select: { name: true } }, request: { select: { id: true, type: true, location: true, priorityLevel: true, quantity: true } }, distributions: { orderBy: { createdAt: "asc" } } },
    }),
    db.allocation.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user, req }) => allocate(user, await body(req, allocationCreate)));
