import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { profileUpdate } from "@/lib/validators";
import { createSession } from "@/lib/auth";
import { updateOwnProfile } from "@/lib/services/user";

export const GET = route({}, async ({ user }) => {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true, email: true, phone: true, role: true, organization: { select: { name: true } }, volunteer: { select: { skills: true, availability: true, team: { select: { name: true } } } } } });
  return u;
});
export const PATCH = route({}, async ({ user, req }) => {
  const { newSessionVersion } = await updateOwnProfile(user, await body(req, profileUpdate));
  if (newSessionVersion !== undefined) await createSession(user.id, newSessionVersion); // keep this device signed in
  return { ok: true };
});
