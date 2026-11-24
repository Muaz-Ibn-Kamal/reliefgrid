import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { taskCreate } from "@/lib/validators";
import { createTask } from "@/lib/services/volunteer";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "VOLUNTEER"] }, async ({ user, sp }) => {
  const pg = page(sp);
  const where: Prisma.TaskWhereInput = {
    ...(user.role === "VOLUNTEER" ? { volunteer: { userId: user.id } } : {}),
    status: enumParam(sp, "status", ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const),
    ...(sp.get("incidentId") ? { incidentId: sp.get("incidentId")! } : {}),
  };
  const [rows, total] = await Promise.all([
    db.task.findMany({
      where, skip: pg.skip, take: pg.take, orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { incident: { select: { id: true, title: true, priorityLevel: true } }, volunteer: { select: { id: true, user: { select: { name: true } } } }, team: { select: { id: true, name: true, members: { select: { user: { select: { name: true, phone: true } } } } } }, reports: { orderBy: { createdAt: "desc" } } },
    }),
    db.task.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ user, req }) => createTask(user, await body(req, taskCreate)));
