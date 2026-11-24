import { db } from "../db";
import type { Tx } from "../db";
import { logActivity, notifyUser } from "./activity";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { taskCreate, taskUpdate } from "../validators";

const isOps = (u: SessionUserLike) => u.role === "SYSTEM_ADMIN" || u.role === "EMERGENCY_COORDINATOR";

async function refreshAvailability(tx: Tx, volunteerId: string | null) {
  if (!volunteerId) return;
  const v = await tx.volunteer.findUnique({ where: { id: volunteerId } });
  if (!v || v.availability === "UNAVAILABLE") return;
  const active = await tx.task.count({ where: { volunteerId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } });
  await tx.volunteer.update({ where: { id: volunteerId }, data: { availability: active ? "DEPLOYED" : "AVAILABLE" } });
}

export async function createTask(user: SessionUserLike, input: z.infer<typeof taskCreate>) {
  if (!isOps(user)) throw forbidden("Only coordinators can assign tasks");
  if (!input.volunteerId && !input.teamId) throw badRequest("Assign the task to a volunteer or a team");
  return db.$transaction(async (tx) => {
    const volunteerId = input.volunteerId ?? null;
    if (volunteerId) {
      const v = await tx.volunteer.findUnique({ where: { id: volunteerId }, include: { user: true } });
      if (!v || !v.user.active) throw badRequest("Volunteer not found or inactive");
      if (v.availability === "UNAVAILABLE") throw conflict("Volunteer is marked unavailable");
    }
    if (input.teamId && !(await tx.team.findUnique({ where: { id: input.teamId } }))) throw badRequest("Team not found");
    const t = await tx.task.create({ data: { ...input, volunteerId, createdById: user.id } });
    await logActivity(tx, { userId: user.id, action: "TASK_ASSIGNED", entityType: "Task", entityId: t.id, details: { volunteerId, teamId: input.teamId } });
    if (volunteerId) {
      const v = await tx.volunteer.findUniqueOrThrow({ where: { id: volunteerId } });
      await notifyUser(tx, v.userId, { title: "New task assigned", body: t.title, link: "/tasks" });
      await refreshAvailability(tx, volunteerId);
    }
    return t;
  });
}

/** Volunteers can only progress their OWN tasks, forward only; completed tasks are frozen and keep reports. */
export async function updateTask(user: SessionUserLike, taskId: string, input: z.infer<typeof taskUpdate>) {
  return db.$transaction(async (tx) => {
    const t = await tx.task.findUnique({ where: { id: taskId }, include: { volunteer: true } });
    if (!t) throw notFound("Task not found");
    if (user.role !== "VOLUNTEER") throw forbidden("Only the assigned volunteer can update task status");
    if (!t.volunteer || t.volunteer.userId !== user.id) throw forbidden("This task is not assigned to you");
    if (t.status === "COMPLETED" || t.status === "CANCELLED") throw conflict(`Task is ${t.status} and can no longer be modified`);
    if (input.status === "IN_PROGRESS" && t.status !== "ASSIGNED") throw conflict("Task is already in progress");
    if (input.status === "COMPLETED" && !input.report) {
      const n = await tx.fieldReport.count({ where: { taskId } });
      if (!n) throw badRequest("Submit a field report when completing a task");
    }
    if (input.report) await tx.fieldReport.create({ data: { taskId, volunteerId: t.volunteerId!, content: input.report, photoUrl: input.photoUrl } });
    const updated = await tx.task.update({ where: { id: taskId }, data: { status: input.status, completedAt: input.status === "COMPLETED" ? new Date() : undefined } });
    await logActivity(tx, { userId: user.id, action: `TASK_${input.status}`, entityType: "Task", entityId: taskId });
    if (input.status === "COMPLETED") await refreshAvailability(tx, t.volunteerId);
    return updated;
  });
}

export async function submitFieldReport(user: SessionUserLike, taskId: string, data: { content: string; photoUrl?: string }) {
  const t = await db.task.findUnique({ where: { id: taskId }, include: { volunteer: true } });
  if (!t) throw notFound("Task not found");
  if (user.role !== "VOLUNTEER" || t.volunteer?.userId !== user.id) throw forbidden("This task is not assigned to you");
  if (t.status === "COMPLETED" || t.status === "CANCELLED") throw conflict("Completed tasks are locked");
  const r = await db.fieldReport.create({ data: { taskId, volunteerId: t.volunteerId!, ...data } });
  await logActivity(db, { userId: user.id, action: "FIELD_REPORT_SUBMITTED", entityType: "Task", entityId: taskId });
  return r;
}

export async function cancelTask(user: SessionUserLike, taskId: string) {
  if (!isOps(user)) throw forbidden();
  return db.$transaction(async (tx) => {
    const t = await tx.task.findUnique({ where: { id: taskId } });
    if (!t) throw notFound("Task not found");
    if (t.status === "COMPLETED") throw conflict("Completed tasks are preserved and cannot be cancelled");
    const u = await tx.task.update({ where: { id: taskId }, data: { status: "CANCELLED" } });
    await logActivity(tx, { userId: user.id, action: "TASK_CANCELLED", entityType: "Task", entityId: taskId });
    await refreshAvailability(tx, t.volunteerId);
    return u;
  });
}
