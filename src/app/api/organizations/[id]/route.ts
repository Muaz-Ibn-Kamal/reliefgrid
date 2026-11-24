import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { orgSchema } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN"] }, async ({ user, params, req }) => {
  const o = await db.organization.update({ where: { id: params.id }, data: (await body(req, orgSchema.partial())) });
  await logActivity(db, { userId: user.id, action: o.active ? "ORGANIZATION_UPDATED" : "ORGANIZATION_DEACTIVATED", entityType: "Organization", entityId: o.id });
  return o;
});
