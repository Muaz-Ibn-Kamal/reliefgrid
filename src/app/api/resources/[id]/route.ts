import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { resourceUpdate } from "@/lib/validators";
import { assertResourceAccess } from "@/lib/services/resource";
import { logActivity } from "@/lib/services/activity";
import { notFound, forbidden } from "@/lib/errors";

export const GET = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, params }) => {
  const r = await db.resource.findUnique({ where: { id: params.id }, include: { organization: { select: { id: true, name: true } }, movements: { orderBy: { createdAt: "desc" }, take: 100 }, allocations: { orderBy: { createdAt: "desc" }, take: 25, select: { id: true, quantity: true, status: true, createdAt: true, request: { select: { id: true, location: true, type: true } } } } } });
  if (!r) throw notFound();
  if (user.role === "RELIEF_ORGANIZATION" && r.organizationId !== user.organizationId) throw forbidden();
  return r;
});

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "RELIEF_ORGANIZATION"] }, async ({ user, params, req }) => {
  const cur = await db.resource.findUnique({ where: { id: params.id } });
  if (!cur) throw notFound();
  assertResourceAccess(user, cur.organizationId);
  const data = await body(req, resourceUpdate);
  const u = await db.resource.update({ where: { id: params.id }, data });
  await logActivity(db, { userId: user.id, action: "RESOURCE_UPDATED", entityType: "Resource", entityId: params.id, details: data });
  return u;
});
