import { db } from "../db";
import { scoreIncident, levelFor } from "../priority";
import { logActivity, notifyRoles, notifyUser } from "./activity";
import { badRequest, forbidden, notFound } from "../errors";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { incidentCreate, incidentUpdate } from "../validators";

export async function createIncident(user: SessionUserLike, input: z.infer<typeof incidentCreate>) {
  const reportedAt = new Date();
  const { score, level } = scoreIncident({ ...input, reportedAt });
  return db.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: { ...input, reportedById: user.id, reportedAt, priorityScore: score, priorityLevel: level },
    });
    await logActivity(tx, { userId: user.id, action: "INCIDENT_REPORTED", entityType: "Incident", entityId: inc.id, details: { title: inc.title, score, level } });
    await notifyRoles(tx, ["EMERGENCY_COORDINATOR", "SYSTEM_ADMIN"], {
      title: `New ${level} incident`,
      body: `${inc.title} (${inc.location})`,
      link: `/incidents/${inc.id}`,
    });
    return inc;
  });
}

export async function updateIncident(user: SessionUserLike, id: string, input: z.infer<typeof incidentUpdate>) {
  if (user.role !== "SYSTEM_ADMIN" && user.role !== "EMERGENCY_COORDINATOR") throw forbidden();
  return db.$transaction(async (tx) => {
    const cur = await tx.incident.findUnique({ where: { id } });
    if (!cur) throw notFound("Incident not found");
    const { note, ...changes } = input;
    if (changes.coordinatorId) {
      const c = await tx.user.findFirst({ where: { id: changes.coordinatorId, role: "EMERGENCY_COORDINATOR", active: true } });
      if (!c) throw badRequest("coordinatorId must reference an active emergency coordinator");
    }
    const next = {
      severity: changes.severity ?? cur.severity,
      affectedPopulation: changes.affectedPopulation ?? cur.affectedPopulation,
      locationRisk: changes.locationRisk ?? cur.locationRisk,
      reportedAt: cur.reportedAt,
    };
    const { score, level } = scoreIncident(next);
    const override = changes.priorityOverride === undefined ? cur.priorityOverride : changes.priorityOverride;
    const effectiveBefore = cur.priorityOverride ?? cur.priorityLevel;
    const effectiveAfter = override ?? level;

    const now = new Date();
    const updated = await tx.incident.update({
      where: { id },
      data: {
        ...changes,
        priorityScore: score,
        priorityLevel: level,
        resolvedAt: changes.status === "RESOLVED" || changes.status === "CLOSED" ? (cur.resolvedAt ?? now) : undefined,
        firstResponseAt: cur.firstResponseAt ?? (changes.status && changes.status !== "REPORTED" ? now : changes.coordinatorId ? now : undefined),
      },
    });
    if (changes.status && changes.status !== cur.status)
      await logActivity(tx, { userId: user.id, action: "INCIDENT_STATUS_CHANGED", entityType: "Incident", entityId: id, details: { from: cur.status, to: changes.status, note } });
    if (effectiveAfter !== effectiveBefore)
      await logActivity(tx, { userId: user.id, action: "PRIORITY_CHANGED", entityType: "Incident", entityId: id, details: { from: effectiveBefore, to: effectiveAfter, manual: changes.priorityOverride !== undefined, note } });
    if (changes.coordinatorId && changes.coordinatorId !== cur.coordinatorId) {
      await logActivity(tx, { userId: user.id, action: "COORDINATOR_ASSIGNED", entityType: "Incident", entityId: id, details: { coordinatorId: changes.coordinatorId } });
      await notifyUser(tx, changes.coordinatorId, { title: "Incident assigned to you", body: cur.title, link: `/incidents/${id}` });
    }
    return updated;
  });
}

/** Re-scores every open incident/request (time-since-reported grows). Logs a PRIORITY_CHANGED entry when the level moves. */
export async function recalculatePriorities(userId: string | null) {
  const now = new Date();
  let changed = 0;
  const incs = await db.incident.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } });
  for (const i of incs) {
    const { score, level } = scoreIncident(i, now);
    if (Math.abs(score - i.priorityScore) < 0.05 && level === i.priorityLevel) continue;
    await db.$transaction(async (tx) => {
      await tx.incident.update({ where: { id: i.id }, data: { priorityScore: score, priorityLevel: level } });
      if (level !== i.priorityLevel && !i.priorityOverride)
        await logActivity(tx, { userId, action: "PRIORITY_CHANGED", entityType: "Incident", entityId: i.id, details: { from: i.priorityLevel, to: level, auto: true } });
    });
    changed++;
  }
  const { recalculateRequests } = await import("./request");
  changed += await recalculateRequests(userId, now);
  return { changed };
}
export { levelFor };
