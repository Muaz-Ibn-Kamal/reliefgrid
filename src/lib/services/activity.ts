import type { Tx } from "../db";
import { db } from "../db";
import type { Role } from "@/generated/prisma/client";

type Client = Tx | typeof db;

export function logActivity(
  c: Client,
  e: { userId?: string | null; action: string; entityType: string; entityId?: string | null; details?: Record<string, unknown> },
) {
  return c.activityLog.create({
    data: { userId: e.userId ?? null, action: e.action, entityType: e.entityType, entityId: e.entityId ?? null, details: (e.details ?? undefined) as never },
  });
}

/** In-app notification fan-out to every active user holding one of the roles (optionally within an organization). */
export async function notifyRoles(
  c: Client,
  roles: Role[],
  n: { title: string; body: string; link?: string; organizationId?: string | null },
) {
  const users = await c.user.findMany({
    where: { active: true, role: { in: roles }, ...(n.organizationId ? { organizationId: n.organizationId } : {}) },
    select: { id: true },
    take: 200,
  });
  if (!users.length) return;
  await c.notification.createMany({ data: users.map((u) => ({ userId: u.id, title: n.title, body: n.body, link: n.link ?? null })) });
}

export function notifyUser(c: Client, userId: string, n: { title: string; body: string; link?: string }) {
  return c.notification.create({ data: { userId, title: n.title, body: n.body, link: n.link ?? null } });
}
