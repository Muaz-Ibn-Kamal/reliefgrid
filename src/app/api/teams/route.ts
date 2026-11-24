import { route, body, page, paged } from "@/lib/api";
import { db } from "@/lib/db";
import { teamCreate } from "@/lib/validators";
import { createTeam, teamScope } from "@/lib/services/team";

export const GET = route({}, async ({ user, sp }) => {
  const pg = page(sp);
  const where = teamScope(user);
  const [rows, total] = await Promise.all([
    db.team.findMany({ where, skip: pg.skip, take: pg.take, orderBy: { name: "asc" }, include: { incident: { select: { id: true, title: true } }, organization: { select: { name: true } }, members: { include: { user: { select: { name: true, phone: true } } } } } }),
    db.team.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, req }) => createTeam(user, await body(req, teamCreate)));
