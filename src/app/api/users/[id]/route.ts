import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { userUpdate } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";
import { badRequest, notFound } from "@/lib/errors";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN"] }, async ({ user, params, req }) => {
  const d = await body(req, userUpdate);
  const cur = await db.user.findUnique({ where: { id: params.id } });
  if (!cur) throw notFound();
  if (params.id === user.id && (d.active === false || (d.role && d.role !== "SYSTEM_ADMIN"))) throw badRequest("You cannot deactivate or demote your own account");
  const u = await db.user.update({ where: { id: params.id }, data: d, select: { id: true, name: true, role: true, active: true, organizationId: true } });
  if (d.role === "VOLUNTEER") await db.volunteer.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
  await logActivity(db, { userId: user.id, action: d.role && d.role !== cur.role ? "USER_ROLE_CHANGED" : d.active !== undefined ? (d.active ? "USER_ACTIVATED" : "USER_DEACTIVATED") : "USER_UPDATED", entityType: "User", entityId: u.id, details: d });
  return u;
});
