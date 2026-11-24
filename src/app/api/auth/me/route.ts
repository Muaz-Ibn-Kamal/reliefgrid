import { route } from "@/lib/api";
import { db } from "@/lib/db";
export const GET = route({}, async ({ user }) => {
  const org = user.organizationId ? await db.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, name: true } }) : null;
  const unread = await db.notification.count({ where: { userId: user.id, read: false } });
  return { user: { ...user, organization: org }, unread };
});
