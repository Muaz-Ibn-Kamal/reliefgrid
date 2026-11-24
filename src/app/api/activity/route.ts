import { route, page, paged } from "@/lib/api";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ sp }) => {
  const pg = page(sp);
  const where: Prisma.ActivityLogWhereInput = {
    ...(sp.get("entityType") ? { entityType: sp.get("entityType")! } : {}),
    ...(sp.get("action") ? { action: { contains: sp.get("action")!, mode: "insensitive" } } : {}),
    ...(sp.get("entityId") ? { entityId: sp.get("entityId")! } : {}),
  };
  const [rows, total] = await Promise.all([
    db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: pg.skip, take: pg.take, include: { user: { select: { name: true, role: true } } } }),
    db.activityLog.count({ where }),
  ]);
  return paged(rows, total, pg);
});
