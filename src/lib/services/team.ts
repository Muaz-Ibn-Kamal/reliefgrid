import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { orgIdOf } from "../scope";
import { logActivity } from "./activity";
import type { teamCreate, teamUpdate } from "../validators";
import type { SessionUserLike } from "./types";

const isOps = (u: SessionUserLike) => u.role === "SYSTEM_ADMIN" || u.role === "EMERGENCY_COORDINATOR";

/**
 * Which teams a user may see. Coordinators and admins see all; relief organizations only their own (member
 * names and phone numbers are personal data); volunteers only the team they belong to; shelter managers none.
 */
export function teamScope(user: SessionUserLike): Prisma.TeamWhereInput {
  if (isOps(user)) return {};
  if (user.role === "RELIEF_ORGANIZATION") return { organizationId: orgIdOf(user) };
  if (user.role === "VOLUNTEER") return { members: { some: { userId: user.id } } };
  return { id: { in: [] } };
}

/** Every id must be a real volunteer, and a relief organization may only move its own organization's volunteers. */
async function assertAssignable(tx: Tx, user: SessionUserLike, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return unique;
  const found = await tx.volunteer.findMany({ where: { id: { in: unique } }, select: { id: true, user: { select: { organizationId: true } } } });
  if (found.length !== unique.length) throw badRequest("One or more volunteers were not found");
  if (!isOps(user)) {
    const org = orgIdOf(user);
    if (found.some((v) => v.user.organizationId !== org)) throw forbidden("You can only add your own organization's volunteers");
  }
  return unique;
}

export async function createTeam(user: SessionUserLike, d: z.infer<typeof teamCreate>) {
  if (!isOps(user) && user.role !== "RELIEF_ORGANIZATION") throw forbidden();
  const organizationId = user.role === "RELIEF_ORGANIZATION" ? orgIdOf(user) : (d.organizationId ?? null);
  return db.$transaction(async (tx) => {
    const members = await assertAssignable(tx, user, d.memberIds);
    const t = await tx.team.create({ data: { name: d.name, organizationId } });
    if (members.length) await tx.volunteer.updateMany({ where: { id: { in: members } }, data: { teamId: t.id } });
    await logActivity(tx, { userId: user.id, action: "TEAM_CREATED", entityType: "Team", entityId: t.id, details: { name: t.name, members: members.length } });
    return t;
  });
}

export async function updateTeam(user: SessionUserLike, teamId: string, d: z.infer<typeof teamUpdate>) {
  if (!isOps(user) && user.role !== "RELIEF_ORGANIZATION") throw forbidden();
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) throw notFound("Team not found");
  if (user.role === "RELIEF_ORGANIZATION" && team.organizationId !== orgIdOf(user)) throw forbidden("Not your organization's team");
  if (d.deployToIncidentId && !isOps(user)) throw forbidden("Only coordinators can deploy teams");
  if (d.deployToIncidentId && !(await db.incident.findUnique({ where: { id: d.deployToIncidentId } }))) throw badRequest("Incident not found");
  return db.$transaction(async (tx) => {
    const add = await assertAssignable(tx, user, d.addMembers ?? []);
    if (add.length) await tx.volunteer.updateMany({ where: { id: { in: add } }, data: { teamId } });
    if (d.removeMembers?.length) await tx.volunteer.updateMany({ where: { id: { in: d.removeMembers }, teamId }, data: { teamId: null } });
    const u = await tx.team.update({
      where: { id: teamId },
      data: { name: d.name, ...(d.deployToIncidentId !== undefined ? { incidentId: d.deployToIncidentId, status: d.deployToIncidentId ? "DEPLOYED" : "STANDBY" } : {}) },
    });
    const action = d.deployToIncidentId !== undefined ? (d.deployToIncidentId ? "TEAM_DEPLOYED" : "TEAM_STANDBY") : "TEAM_UPDATED";
    await logActivity(tx, { userId: user.id, action, entityType: "Team", entityId: teamId, details: d });
    return u;
  });
}
