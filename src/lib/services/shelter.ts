import { db } from "../db";
import { logActivity } from "./activity";
import { conflict, forbidden, notFound } from "../errors";
import type { SessionUserLike } from "./types";
import type { z } from "zod";
import type { occupancyUpdate, shelterUpdate } from "../validators";

export function assertShelterAccess(user: SessionUserLike, managerId: string | null) {
  if (user.role === "SYSTEM_ADMIN") return;
  if (user.role === "SHELTER_MANAGER" && managerId === user.id) return;
  throw forbidden("You can only manage shelters assigned to you");
}

/**
 * Occupancy changes lock the shelter row, validate 0 <= occupancy <= totalCapacity and write the log entry
 * in the same transaction. Available capacity is derived (totalCapacity - occupancy) so it can never drift.
 */
export async function setOccupancy(user: SessionUserLike, shelterId: string, input: z.infer<typeof occupancyUpdate>) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; occupancy: number; totalCapacity: number; status: string; managerId: string | null }[]>`
      SELECT "id","occupancy","totalCapacity","status","managerId" FROM "Shelter" WHERE "id" = ${shelterId} FOR UPDATE`;
    const s = rows[0];
    if (!s) throw notFound("Shelter not found");
    assertShelterAccess(user, s.managerId);
    const next = input.occupancy ?? s.occupancy + (input.delta ?? 0);
    if (next < 0) throw conflict("Occupancy cannot be negative");
    if (next > s.totalCapacity) throw conflict(`Occupancy ${next} exceeds capacity: only ${s.totalCapacity - s.occupancy} places available`);
    if (s.status === "CLOSED" && next > s.occupancy) throw conflict("Shelter is closed and cannot accept more people");
    const status = s.status === "CLOSED" ? "CLOSED" : next >= s.totalCapacity ? "FULL" : "OPEN";
    const updated = await tx.shelter.update({ where: { id: shelterId }, data: { occupancy: next, status } });
    await tx.shelterOccupancyLog.create({ data: { shelterId, previous: s.occupancy, current: next, capacity: s.totalCapacity, note: input.note, userId: user.id } });
    await logActivity(tx, { userId: user.id, action: "SHELTER_OCCUPANCY", entityType: "Shelter", entityId: shelterId, details: { from: s.occupancy, to: next } });
    return updated;
  });
}

export async function updateShelter(user: SessionUserLike, shelterId: string, input: z.infer<typeof shelterUpdate>) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; occupancy: number; totalCapacity: number; status: string; managerId: string | null }[]>`
      SELECT "id","occupancy","totalCapacity","status","managerId" FROM "Shelter" WHERE "id" = ${shelterId} FOR UPDATE`;
    const s = rows[0];
    if (!s) throw notFound("Shelter not found");
    assertShelterAccess(user, s.managerId);
    if (input.managerId !== undefined && user.role !== "SYSTEM_ADMIN") throw forbidden("Only admins can reassign shelter managers");
    const cap = input.totalCapacity ?? s.totalCapacity;
    if (cap < s.occupancy) throw conflict(`Capacity cannot drop below current occupancy (${s.occupancy})`);
    let status = input.status ?? s.status;
    if (status !== "CLOSED") status = s.occupancy >= cap ? "FULL" : "OPEN";
    const updated = await tx.shelter.update({ where: { id: shelterId }, data: { ...input, status: status as never } });
    await logActivity(tx, { userId: user.id, action: "SHELTER_UPDATED", entityType: "Shelter", entityId: shelterId, details: input as Record<string, unknown> });
    return updated;
  });
}
