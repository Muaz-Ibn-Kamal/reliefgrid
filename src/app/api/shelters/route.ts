import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { shelterCreate } from "@/lib/validators";
import { logActivity } from "@/lib/services/activity";
import { forbidden, badRequest, conflict } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "SHELTER_MANAGER"] }, async ({ user, sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  const where: Prisma.ShelterWhereInput = {
    status: enumParam(sp, "status", ["OPEN", "FULL", "CLOSED"] as const),
    ...(sp.get("mine") === "1" && user.role === "SHELTER_MANAGER" ? { managerId: user.id } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.shelter.findMany({ where, orderBy: { name: "asc" }, skip: pg.skip, take: pg.take, include: { manager: { select: { id: true, name: true } } } }),
    db.shelter.count({ where }),
  ]);
  return paged(rows.map((s) => ({ ...s, availableCapacity: s.totalCapacity - s.occupancy })), total, pg);
});

export const POST = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "SHELTER_MANAGER"] }, async ({ user, req }) => {
  const d = await body(req, shelterCreate);
  if (d.occupancy > d.totalCapacity) throw conflict("Initial occupancy exceeds total capacity");
  let managerId = d.managerId ?? null;
  if (user.role === "SHELTER_MANAGER") managerId = user.id;
  else if (managerId && !(await db.user.findFirst({ where: { id: managerId, role: "SHELTER_MANAGER", active: true } }))) throw badRequest("managerId must be an active shelter manager");
  if (user.role !== "SYSTEM_ADMIN" && user.role !== "SHELTER_MANAGER" && user.role !== "EMERGENCY_COORDINATOR") throw forbidden();
  const s = await db.$transaction(async (tx) => {
    const s = await tx.shelter.create({ data: { ...d, managerId, status: d.occupancy >= d.totalCapacity ? "FULL" : "OPEN" } });
    await tx.shelterOccupancyLog.create({ data: { shelterId: s.id, previous: 0, current: s.occupancy, capacity: s.totalCapacity, note: "Shelter registered", userId: user.id } });
    await logActivity(tx, { userId: user.id, action: "SHELTER_REGISTERED", entityType: "Shelter", entityId: s.id, details: { name: s.name } });
    return s;
  });
  return s;
});
