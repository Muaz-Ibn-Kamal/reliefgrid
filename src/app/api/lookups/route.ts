import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";

/** Small id/name lists that feed form <select>s. Gated by role per type. */
export const GET = route({}, async ({ user, sp }) => {
  const type = sp.get("type");
  const ops = user.role === "SYSTEM_ADMIN" || user.role === "EMERGENCY_COORDINATOR";
  switch (type) {
    case "incidents":
      return db.incident.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, orderBy: { priorityScore: "desc" }, take: 100, select: { id: true, title: true } });
    case "organizations":
      if (!ops && user.role !== "RELIEF_ORGANIZATION") throw forbidden();
      return db.organization.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    case "coordinators":
      if (!ops) throw forbidden();
      return db.user.findMany({ where: { role: "EMERGENCY_COORDINATOR", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    case "shelterManagers":
      if (user.role !== "SYSTEM_ADMIN") throw forbidden();
      return db.user.findMany({ where: { role: "SHELTER_MANAGER", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
    case "teams":
      if (!ops) throw forbidden();
      return db.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
    case "volunteers":
      if (!ops) throw forbidden();
      return db.volunteer.findMany({ where: { availability: { not: "UNAVAILABLE" }, user: { active: true } }, take: 200, orderBy: { user: { name: "asc" } }, select: { id: true, user: { select: { name: true } } } });
    case "requests":
      if (!ops) throw forbidden();
      return db.emergencyRequest.findMany({ where: { status: { in: ["VERIFIED", "ASSIGNED"] } }, orderBy: { priorityScore: "desc" }, take: 100, select: { id: true, type: true, location: true, quantity: true, unit: true, priorityLevel: true } });
    default:
      throw badRequest("Unknown lookup type");
  }
});
