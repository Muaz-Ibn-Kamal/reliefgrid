import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { resourceCreate } from "@/lib/validators";
import { RESOURCE_CATEGORIES } from "@/lib/constants";
import { registerResource } from "@/lib/services/resource";
import { forbidden } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

const READ = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] as const;

export const GET = route({ roles: READ }, async ({ user, sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  // Relief orgs see only their own inventory; coordinators/admins see all (needed for allocation)
  const scope: Prisma.ResourceWhereInput = user.role === "RELIEF_ORGANIZATION" ? { organizationId: user.organizationId! } : sp.get("organizationId") ? { organizationId: sp.get("organizationId")! } : {};
  const where: Prisma.ResourceWhereInput = {
    ...scope,
    category: enumParam(sp, "category", RESOURCE_CATEGORIES),
    ...(sp.get("available") === "1" ? { quantity: { gt: 0 } } : {}),
    ...(sp.get("lowStock") === "1" ? { quantity: { lt: 100 } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { storageLocation: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.resource.findMany({ where, orderBy: [{ category: "asc" }, { name: "asc" }], skip: pg.skip, take: pg.take, include: { organization: { select: { id: true, name: true } } } }),
    db.resource.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "RELIEF_ORGANIZATION"] }, async ({ user, req }) => {
  if (user.role === "EMERGENCY_COORDINATOR") throw forbidden();
  return registerResource(user, await body(req, resourceCreate));
});
