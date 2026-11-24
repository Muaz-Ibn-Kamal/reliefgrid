import { route, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR"] }, async ({ sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  const where: Prisma.VolunteerWhereInput = {
    availability: enumParam(sp, "availability", ["AVAILABLE", "DEPLOYED", "UNAVAILABLE"] as const),
    ...(sp.get("teamId") ? { teamId: sp.get("teamId")! } : {}),
    ...(sp.get("skill") ? { skills: { has: sp.get("skill")! } } : {}),
    ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.volunteer.findMany({ where, skip: pg.skip, take: pg.take, orderBy: { user: { name: "asc" } }, include: { user: { select: { name: true, email: true, phone: true, active: true } }, team: { select: { id: true, name: true } }, _count: { select: { tasks: true, reports: true } } } }),
    db.volunteer.count({ where }),
  ]);
  return paged(rows, total, pg);
});
