import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/geo";
import { badRequest } from "@/lib/errors";

/** Availability matching: AVAILABLE volunteers ranked by skill match (+3 each) and proximity. */
export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ sp }) => {
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest("lat and lng are required");
  const skills = (sp.get("skills") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const vols = await db.volunteer.findMany({ where: { availability: "AVAILABLE", user: { active: true }, latitude: { not: null } }, include: { user: { select: { name: true, phone: true } } }, take: 500 });
  return vols
    .map((v) => {
      const km = haversineKm({ lat, lng }, { lat: v.latitude!, lng: v.longitude! });
      const matched = v.skills.filter((s) => skills.includes(s)).length;
      return { id: v.id, name: v.user.name, phone: v.user.phone, skills: v.skills, distanceKm: Math.round(km * 10) / 10, skillMatches: matched, score: Math.round((matched * 3 - km / 25) * 100) / 100 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
});
