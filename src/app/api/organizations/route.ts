import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { orgSchema } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async () =>
  db.organization.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true, resources: true, shelters: true } } } }),
);
export const POST = route({ roles: ["SYSTEM_ADMIN"] }, async ({ user, req }) => {
  const o = await db.organization.create({ data: await body(req, orgSchema) });
  await logActivity(db, { userId: user.id, action: "ORGANIZATION_CREATED", entityType: "Organization", entityId: o.id });
  return o;
});
