import type { z } from "zod";
import { db } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { assertDemoAccountEditable } from "../demo";
import { badRequest, notFound } from "../errors";
import { logActivity } from "./activity";
import type { profileUpdate, userUpdate } from "../validators";
import type { SessionUserLike } from "./types";

/** Admin edit of another account: role, organization, active flag and name. */
export async function updateUserByAdmin(actor: SessionUserLike, userId: string, d: z.infer<typeof userUpdate>) {
  const cur = await db.user.findUnique({ where: { id: userId } });
  if (!cur) throw notFound("User not found");
  assertDemoAccountEditable(cur.email, "Editing this account");
  if (userId === actor.id && (d.active === false || (d.role && d.role !== "SYSTEM_ADMIN"))) throw badRequest("You cannot deactivate or demote your own account");
  const role = d.role ?? cur.role;
  const organizationId = d.organizationId !== undefined ? d.organizationId : cur.organizationId;
  if (role === "RELIEF_ORGANIZATION" && !organizationId) throw badRequest("Relief organization users need an organization");
  if (d.organizationId && !(await db.organization.findUnique({ where: { id: d.organizationId } }))) throw badRequest("Organization not found");
  const u = await db.user.update({ where: { id: userId }, data: d, select: { id: true, name: true, role: true, active: true, organizationId: true } });
  if (d.role === "VOLUNTEER") await db.volunteer.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id } });
  const action = d.role && d.role !== cur.role ? "USER_ROLE_CHANGED" : d.active !== undefined ? (d.active ? "USER_ACTIVATED" : "USER_DEACTIVATED") : "USER_UPDATED";
  await logActivity(db, { userId: actor.id, action, entityType: "User", entityId: u.id, details: d });
  return u;
}

/**
 * The signed-in user's own profile. A password change needs the current password and bumps sessionVersion, which
 * signs out every other session (the caller re-issues a cookie for this one with the returned version).
 */
export async function updateOwnProfile(user: SessionUserLike & { email: string }, d: z.infer<typeof profileUpdate>) {
  const data: { name?: string; phone?: string; passwordHash?: string; sessionVersion?: { increment: number } } = {};
  if (d.name) data.name = d.name;
  if (d.phone !== undefined) data.phone = d.phone;
  if (d.newPassword) {
    assertDemoAccountEditable(user.email, "Changing the password");
    const cur = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!d.currentPassword || !(await verifyPassword(d.currentPassword, cur.passwordHash))) throw badRequest("Current password is incorrect");
    data.passwordHash = await hashPassword(d.newPassword);
    data.sessionVersion = { increment: 1 };
  }
  const updated = await db.user.update({ where: { id: user.id }, data, select: { sessionVersion: true } });
  if (user.role === "VOLUNTEER" && (d.availability || d.skills)) {
    await db.volunteer.update({ where: { userId: user.id }, data: { availability: d.availability, skills: d.skills } });
  }
  await logActivity(db, { userId: user.id, action: d.newPassword ? "PASSWORD_CHANGED" : "PROFILE_UPDATED", entityType: "User", entityId: user.id });
  return { newSessionVersion: d.newPassword ? updated.sessionVersion : undefined };
}
