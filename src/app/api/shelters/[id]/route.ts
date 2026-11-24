import { route, body } from "@/lib/api";
import { db } from "@/lib/db";
import { shelterUpdate } from "@/lib/validators";
import { updateShelter } from "@/lib/services/shelter";
import { notFound } from "@/lib/errors";

const READ = ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "SHELTER_MANAGER"] as const;
export const GET = route<{ id: string }>({ roles: READ }, async ({ params }) => {
  const s = await db.shelter.findUnique({ where: { id: params.id }, include: { manager: { select: { id: true, name: true, phone: true } }, occupancyLogs: { orderBy: { createdAt: "desc" }, take: 60 } } });
  if (!s) throw notFound();
  return { ...s, availableCapacity: s.totalCapacity - s.occupancy };
});
export const PATCH = route<{ id: string }>({ roles: ["SYSTEM_ADMIN", "SHELTER_MANAGER"] }, async ({ user, params, req }) => updateShelter(user, params.id, await body(req, shelterUpdate)));
