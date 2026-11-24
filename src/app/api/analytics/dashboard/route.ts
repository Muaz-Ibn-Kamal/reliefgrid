import { route } from "@/lib/api";
import { db } from "@/lib/db";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export const GET = route({}, async ({ user }) => {
  const since14 = new Date(Date.now() - 14 * 86_400_000);
  const [activeIncidents, affected, pendingRequests, resourcesAvail, shelters, volunteers, byCategory, bySeverity, trend, dist, rt, rtReq, byStatusReq, topIncidents] = await Promise.all([
    db.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.incident.aggregate({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, _sum: { affectedPopulation: true } }),
    db.emergencyRequest.count({ where: { status: { in: ["PENDING", "VERIFIED"] } } }),
    db.resource.groupBy({ by: ["category"], _sum: { quantity: true }, _count: true }),
    db.shelter.aggregate({ where: { status: { not: "CLOSED" } }, _count: true, _sum: { totalCapacity: true, occupancy: true } }),
    db.volunteer.groupBy({ by: ["availability"], _count: true }),
    db.incident.groupBy({ by: ["category"], _count: true }),
    db.incident.groupBy({ by: ["priorityLevel"], where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, _count: true }),
    db.$queryRaw<Row[]>`
      SELECT to_char(d::date, 'MM-DD') AS day, COALESCE(t.cnt, 0)::int AS count, COALESCE(t.crit, 0)::int AS critical
        FROM generate_series(${since14}::date, now()::date, '1 day') d
        LEFT JOIN (SELECT date_trunc('day', "createdAt")::date AS day, count(*) AS cnt, count(*) FILTER (WHERE "priorityLevel" = 'CRITICAL') AS crit
                     FROM "EmergencyRequest" WHERE "createdAt" >= ${since14} GROUP BY 1) t ON t.day = d::date
       ORDER BY d`,
    db.$queryRaw<Row[]>`
      SELECT r."category"::text AS category,
             COALESCE(SUM(a."quantity") FILTER (WHERE a."status" = 'DELIVERED'), 0)::int AS delivered,
             COALESCE(SUM(a."quantity") FILTER (WHERE a."status" IN ('ALLOCATED','IN_TRANSIT')), 0)::int AS pending
        FROM "Allocation" a JOIN "Resource" r ON r."id" = a."resourceId" GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<Row[]>`SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "reportedAt")) / 60) AS minutes FROM "Incident" WHERE "firstResponseAt" IS NOT NULL`,
    db.$queryRaw<Row[]>`SELECT AVG(EXTRACT(EPOCH FROM ("firstResponseAt" - "createdAt")) / 60) AS minutes FROM "EmergencyRequest" WHERE "firstResponseAt" IS NOT NULL`,
    db.emergencyRequest.groupBy({ by: ["status"], _count: true }),
    db.incident.findMany({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } }, orderBy: { priorityScore: "desc" }, take: 5, select: { id: true, title: true, priorityLevel: true, priorityScore: true, affectedPopulation: true, location: true } }),
  ]);
  const cap = shelters._sum.totalCapacity ?? 0;
  const occ = shelters._sum.occupancy ?? 0;
  const me =
    user.role === "VOLUNTEER"
      ? { myOpenTasks: await db.task.count({ where: { volunteer: { userId: user.id }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } }) }
      : user.role === "SHELTER_MANAGER"
        ? { myShelters: await db.shelter.findMany({ where: { managerId: user.id }, select: { id: true, name: true, totalCapacity: true, occupancy: true, status: true } }) }
        : {};
  return {
    kpis: {
      activeIncidents,
      totalAffected: affected._sum.affectedPopulation ?? 0,
      pendingRequests,
      availableResourceUnits: resourcesAvail.reduce((n, r) => n + (r._sum.quantity ?? 0), 0),
      activeShelters: shelters._count,
      shelterCapacity: cap,
      shelterOccupancy: occ,
      volunteersAvailable: volunteers.find((v) => v.availability === "AVAILABLE")?._count ?? 0,
      volunteersTotal: volunteers.reduce((n, v) => n + v._count, 0),
      avgIncidentResponseMin: Math.round(num(rt[0]?.minutes)),
      avgRequestResponseMin: Math.round(num(rtReq[0]?.minutes)),
    },
    incidentsByCategory: byCategory.map((c) => ({ name: c.category, value: c._count })),
    incidentsByPriority: bySeverity.map((c) => ({ name: c.priorityLevel, value: c._count })),
    requestTrend: trend.map((t) => ({ day: t.day, count: num(t.count), critical: num(t.critical) })),
    resourceDistribution: dist.map((d) => ({ category: d.category, delivered: num(d.delivered), pending: num(d.pending) })),
    resourceStock: resourcesAvail.map((r) => ({ category: r.category, quantity: r._sum.quantity ?? 0, records: r._count })),
    requestsByStatus: byStatusReq.map((s) => ({ name: s.status, value: s._count })),
    topIncidents,
    me,
    generatedAt: new Date().toISOString(),
  };
});
