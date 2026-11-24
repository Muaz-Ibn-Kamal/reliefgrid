import { route, body, page, paged } from "@/lib/api";
import { db } from "@/lib/db";
import { teamCreate } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";

export const GET = route({}, async ({ user, sp }) => {
  const pg = page(sp);
  const where = user.role === "VOLUNTEER" ? { members: { some: { userId: user.id } } } : user.role === "SHELTER_MANAGER" ? { id: "none" } : {};
  const [rows, total] = await Promise.all([
    db.team.findMany({ where, skip: pg.skip, take: pg.take, orderBy: { name: "asc" }, include: { incident: { select: { id: true, title: true } }, organization: { select: { name: true } }, members: { include: { user: { select: { name: true, phone: true } } } } } }),
    db.team.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, req }) => {
  const d = await body(req, teamCreate);
  const organizationId = user.role === "RELIEF_ORGANIZATION" ? user.organizationId : (d.organizationId ?? null);
  return db.$transaction(async (tx) => {
    const t = await tx.team.create({ data: { name: d.name, organizationId } });
    if (d.memberIds.length) await tx.volunteer.updateMany({ where: { id: { in: d.memberIds } }, data: { teamId: t.id } });
    await logActivity(tx, { userId: user.id, action: "TEAM_CREATED", entityType: "Team", entityId: t.id, details: { name: t.name, members: d.memberIds.length } });
    return t;
  });
});
