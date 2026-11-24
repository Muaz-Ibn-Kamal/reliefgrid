import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { teamUpdate } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";
import { forbidden, notFound, badRequest } from "@/lib/errors";

export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, params, req }) => {
  const d = await body(req, teamUpdate);
  const team = await db.team.findUnique({ where: { id: params.id } });
  if (!team) throw notFound("Team not found");
  if (user.role === "RELIEF_ORGANIZATION" && team.organizationId !== user.organizationId) throw forbidden("Not your organization's team");
  if (d.deployToIncidentId && user.role === "RELIEF_ORGANIZATION") throw forbidden("Only coordinators can deploy teams");
  if (d.deployToIncidentId && !(await db.incident.findUnique({ where: { id: d.deployToIncidentId } }))) throw badRequest("Incident not found");
  return db.$transaction(async (tx) => {
    if (d.addMembers?.length) await tx.volunteer.updateMany({ where: { id: { in: d.addMembers } }, data: { teamId: params.id } });
    if (d.removeMembers?.length) await tx.volunteer.updateMany({ where: { id: { in: d.removeMembers }, teamId: params.id }, data: { teamId: null } });
    const u = await tx.team.update({
      where: { id: params.id },
      data: { name: d.name, ...(d.deployToIncidentId !== undefined ? { incidentId: d.deployToIncidentId, status: d.deployToIncidentId ? "DEPLOYED" : "STANDBY" } : {}) },
    });
    await logActivity(tx, { userId: user.id, action: d.deployToIncidentId !== undefined ? (d.deployToIncidentId ? "TEAM_DEPLOYED" : "TEAM_STANDBY") : "TEAM_UPDATED", entityType: "Team", entityId: params.id, details: d });
    return u;
  });
});
