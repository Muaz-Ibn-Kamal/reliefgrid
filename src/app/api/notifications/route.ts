import { z } from "zod";
import { route, body } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route({}, async ({ user }) => {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return { items, unread };
});
export const PATCH = route({}, async ({ user, req }) => {
  const { ids } = await body(req, z.object({ ids: z.array(z.string()).optional() }));
  await db.notification.updateMany({ where: { userId: user.id, read: false, ...(ids ? { id: { in: ids } } : {}) }, data: { read: true } });
  return { ok: true };
});
