import { db } from "../db";
import { scoreRequest } from "../priority";
import { logActivity, notifyRoles } from "./activity";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { requestCreate, requestReview } from "../validators";

export const dedupeKey = (type: string, lat: number, lng: number) => `${type}:${lat.toFixed(2)}:${lng.toFixed(2)}`;

/** Possible duplicate = same type, within ~0.01° (≈1 km) of the new request, created in the last 48 h, still open. */
export async function findDuplicates(type: string, lat: number, lng: number, incidentId?: string) {
  const since = new Date(Date.now() - 48 * 3_600_000);
  return db.emergencyRequest.findMany({
    where: {
      type: type as never,
      status: { in: ["PENDING", "VERIFIED", "ASSIGNED"] },
      createdAt: { gte: since },
      latitude: { gte: lat - 0.01, lte: lat + 0.01 },
      longitude: { gte: lng - 0.01, lte: lng + 0.01 },
      ...(incidentId ? { incidentId } : {}),
    },
    select: { id: true, type: true, location: true, quantity: true, status: true, createdAt: true, requesterName: true },
    take: 5,
  });
}

export async function createRequest(user: SessionUserLike | null, input: z.infer<typeof requestCreate>) {
  const { force, ...data } = input;
  if (data.incidentId) {
    const inc = await db.incident.findUnique({ where: { id: data.incidentId }, select: { id: true } });
    if (!inc) throw badRequest("incidentId does not exist");
  }
  if (!force) {
    const dups = await findDuplicates(data.type, data.latitude, data.longitude, data.incidentId);
    if (dups.length) throw conflict("Possible duplicate request detected. Resubmit with force=true if this is a distinct need.", { duplicates: dups });
  }
  const inc = data.incidentId ? await db.incident.findUnique({ where: { id: data.incidentId } }) : null;
  const createdAt = new Date();
  const { score, level } = scoreRequest({ ...data, createdAt }, { incidentSeverity: inc?.severity, locationRisk: inc?.locationRisk });
  return db.$transaction(async (tx) => {
    const r = await tx.emergencyRequest.create({
      data: {
        ...data,
        createdAt,
        organizationId: user?.role === "RELIEF_ORGANIZATION" ? user.organizationId : null,
        dedupeKey: dedupeKey(data.type, data.latitude, data.longitude),
        priorityScore: score,
        priorityLevel: level,
      },
    });
    await logActivity(tx, { userId: user?.id, action: "REQUEST_SUBMITTED", entityType: "EmergencyRequest", entityId: r.id, details: { type: r.type, quantity: r.quantity, score, level, public: !user } });
    await notifyRoles(tx, ["EMERGENCY_COORDINATOR"], { title: `New ${level} ${r.type.toLowerCase()} request`, body: `${r.quantity} ${r.unit} — ${r.location}`, link: `/requests` });
    return r;
  });
}

export async function reviewRequest(user: SessionUserLike, id: string, input: z.infer<typeof requestReview>) {
  if (user.role !== "SYSTEM_ADMIN" && user.role !== "EMERGENCY_COORDINATOR") throw forbidden("Only coordinators can review requests");
  return db.$transaction(async (tx) => {
    const cur = await tx.emergencyRequest.findUnique({ where: { id }, include: { incident: true } });
    if (!cur) throw notFound("Request not found");
    const now = new Date();
    switch (input.action) {
      case "VERIFY":
        if (cur.status !== "PENDING") throw conflict(`Only PENDING requests can be verified (current: ${cur.status})`);
        break;
      case "REJECT":
        if (cur.status !== "PENDING" && cur.status !== "VERIFIED") throw conflict(`Cannot reject a ${cur.status} request`);
        if (!input.reason) throw badRequest("A reason is required to reject a request");
        break;
      case "COMPLETE":
        if (cur.status !== "ASSIGNED" && cur.status !== "VERIFIED") throw conflict(`Cannot complete a ${cur.status} request`);
        break;
      case "SET_URGENCY":
        if (!input.urgency) throw badRequest("urgency is required");
        if (cur.status === "COMPLETED" || cur.status === "REJECTED") throw conflict("Closed requests cannot be re-prioritised");
        break;
    }
    const urgency = input.action === "SET_URGENCY" ? input.urgency! : cur.urgency;
    const { score, level } = scoreRequest({ urgency, affectedPeople: cur.affectedPeople, createdAt: cur.createdAt }, { incidentSeverity: cur.incident?.severity, locationRisk: cur.incident?.locationRisk }, now);
    const status = input.action === "VERIFY" ? "VERIFIED" : input.action === "REJECT" ? "REJECTED" : input.action === "COMPLETE" ? "COMPLETED" : cur.status;
    const updated = await tx.emergencyRequest.update({
      where: { id },
      data: {
        status,
        urgency,
        priorityScore: score,
        priorityLevel: level,
        verifiedById: input.action === "VERIFY" ? user.id : undefined,
        rejectionReason: input.action === "REJECT" ? input.reason : undefined,
        completedAt: status === "COMPLETED" ? now : undefined,
        firstResponseAt: cur.firstResponseAt ?? (input.action === "VERIFY" || input.action === "REJECT" ? now : undefined),
      },
    });
    await logActivity(tx, { userId: user.id, action: `REQUEST_${input.action}`, entityType: "EmergencyRequest", entityId: id, details: { from: cur.status, to: status, reason: input.reason } });
    if (level !== cur.priorityLevel)
      await logActivity(tx, { userId: user.id, action: "PRIORITY_CHANGED", entityType: "EmergencyRequest", entityId: id, details: { from: cur.priorityLevel, to: level, urgency } });
    return updated;
  });
}

export async function recalculateRequests(userId: string | null, now = new Date()) {
  const open = await db.emergencyRequest.findMany({ where: { status: { in: ["PENDING", "VERIFIED", "ASSIGNED"] } }, include: { incident: true } });
  let changed = 0;
  for (const r of open) {
    const { score, level } = scoreRequest(r, { incidentSeverity: r.incident?.severity, locationRisk: r.incident?.locationRisk }, now);
    if (Math.abs(score - r.priorityScore) < 0.05 && level === r.priorityLevel) continue;
    await db.$transaction(async (tx) => {
      await tx.emergencyRequest.update({ where: { id: r.id }, data: { priorityScore: score, priorityLevel: level } });
      if (level !== r.priorityLevel) await logActivity(tx, { userId, action: "PRIORITY_CHANGED", entityType: "EmergencyRequest", entityId: r.id, details: { from: r.priorityLevel, to: level, auto: true } });
    });
    changed++;
  }
  return changed;
}
