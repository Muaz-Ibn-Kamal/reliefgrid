import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { orgIdOf } from "@/lib/scope";

const MAX = 5000;
/** Neutralise spreadsheet formula injection (=,+,-,@) and quote CSV fields. */
const cell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString() : v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
};

export const GET = route<{ entity: string }>({ roles: ["SYSTEM_ADMIN", "EMERGENCY_COORDINATOR", "RELIEF_ORGANIZATION"] }, async ({ user, params }) => {
  const orgScope = user.role === "RELIEF_ORGANIZATION" ? orgIdOf(user) : undefined;
  let rows: Record<string, unknown>[];
  switch (params.entity) {
    case "incidents":
      if (orgScope) throw forbidden();
      rows = (await db.incident.findMany({ orderBy: { priorityScore: "desc" }, take: MAX })).map(({ imageUrl: _i, ...r }) => r);
      break;
    case "requests":
      rows = (await db.emergencyRequest.findMany({ orderBy: { priorityScore: "desc" }, take: MAX })).map(({ requesterContact: _c, ...r }) => r);
      break;
    case "resources":
      rows = (await db.resource.findMany({ where: orgScope ? { organizationId: orgScope } : {}, orderBy: { name: "asc" }, take: MAX })) as never;
      break;
    case "allocations":
      rows = (await db.allocation.findMany({ where: orgScope ? { organizationId: orgScope } : {}, orderBy: { createdAt: "desc" }, take: MAX })) as never;
      break;
    case "shelters":
      if (orgScope) throw forbidden();
      rows = (await db.shelter.findMany({ orderBy: { name: "asc" }, take: MAX })).map((s) => ({ ...s, availableCapacity: s.totalCapacity - s.occupancy }));
      break;
    case "activity":
      if (user.role !== "SYSTEM_ADMIN") throw forbidden();
      rows = (await db.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: MAX })) as never;
      break;
    default:
      throw notFound("Unknown export");
  }
  await db.activityLog.create({ data: { userId: user.id, action: "DATA_EXPORTED", entityType: params.entity, details: { rows: rows.length } } });
  return new Response(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="reliefgrid-${params.entity}-${new Date().toISOString().slice(0, 10)}.csv"` } });
});
