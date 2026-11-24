import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { profileUpdate } from "@/lib/validators";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/services/activity";
import { badRequest } from "@/lib/errors";

export const GET = route({}, async ({ user }) => {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, role: true, organization: { select: { name: true } }, volunteer: { select: { skills: true, availability: true, team: { select: { name: true } } } } } });
  return u;
});
export const PATCH = route({}, async ({ user, req }) => {
  const d = await body(req, profileUpdate);
  const data: Record<string, unknown> = {};
  if (d.name) data.name = d.name;
  if (d.phone !== undefined) data.phone = d.phone;
  if (d.newPassword) {
    const cur = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!d.currentPassword || !(await verifyPassword(d.currentPassword, cur.passwordHash))) throw badRequest("Current password is incorrect");
    data.passwordHash = await hashPassword(d.newPassword);
  }
  await db.user.update({ where: { id: user.id }, data });
  if (user.role === "VOLUNTEER" && (d.availability || d.skills)) {
    await db.volunteer.update({ where: { userId: user.id }, data: { availability: d.availability, skills: d.skills } });
  }
  await logActivity(db, { userId: user.id, action: d.newPassword ? "PASSWORD_CHANGED" : "PROFILE_UPDATED", entityType: "User", entityId: user.id });
  return { ok: true };
});
