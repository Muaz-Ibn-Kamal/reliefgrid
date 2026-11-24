import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { badRequest } from "@/lib/errors";

/** Nearest OPEN shelters with spare capacity for a coordinate (and optional minimum places needed). */
export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION", "SHELTER_MANAGER"] }, async ({ sp }) => {
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng")), need = Number(sp.get("people") ?? 1);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw badRequest("lat and lng are required");
  const shelters = await db.shelter.findMany({ where: { status: "OPEN" }, select: { id: true, name: true, location: true, latitude: true, longitude: true, totalCapacity: true, occupancy: true, facilities: true } });
  return shelters
    .map((s) => ({ ...s, availableCapacity: s.totalCapacity - s.occupancy, distanceKm: Math.round(haversineKm({ lat, lng }, { lat: s.latitude, lng: s.longitude }) * 10) / 10 }))
    .filter((s) => s.availableCapacity >= need)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);
});
