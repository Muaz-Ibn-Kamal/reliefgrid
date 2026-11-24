import { route, body, page, paged, enumParam } from "@/lib/api";
import { db } from "@/lib/db";
import { incidentCreate } from "@/lib/validators";
import { INCIDENT_CATEGORIES } from "@/lib/constants";
import { createIncident } from "@/lib/services/incident";
import { forbidden } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

export const GET = route({}, async ({ user, sp }) => {
  const pg = page(sp);
  const q = sp.get("q")?.trim();
  const where: Prisma.IncidentWhereInput = {
    category: enumParam(sp, "category", INCIDENT_CATEGORIES),
    status: enumParam(sp, "status", ["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const),
    priorityLevel: enumParam(sp, "priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const),
    ...(sp.get("open") === "1" ? { status: { notIn: ["RESOLVED", "CLOSED"] } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }] } : {}),
    // volunteers only see incidents they have tasks in
    ...(user.role === "VOLUNTEER" ? { tasks: { some: { volunteer: { userId: user.id } } } } : {}),
  };
  const sort = sp.get("sort");
  const orderBy: Prisma.IncidentOrderByWithRelationInput[] =
    sort === "newest" ? [{ reportedAt: "desc" }] : sort === "affected" ? [{ affectedPopulation: "desc" }] : [{ priorityScore: "desc" }, { reportedAt: "desc" }];
  const [rows, total] = await Promise.all([
    db.incident.findMany({ where, orderBy, skip: pg.skip, take: pg.take, include: { coordinator: { select: { id: true, name: true } }, _count: { select: { requests: true } } } }),
    db.incident.count({ where }),
  ]);
  return paged(rows, total, pg);
});

export const POST = route({}, async ({ user, req }) => {
  if (user.role === "VOLUNTEER") throw forbidden("Volunteers submit field reports against tasks instead");
  const input = await body(req, incidentCreate);
  return createIncident(user, input);
});
