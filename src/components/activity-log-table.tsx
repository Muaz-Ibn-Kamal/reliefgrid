"use client";
import { ListView, type Col, type FilterDef } from "./list";
import { ago, dt } from "@/lib/client";
import { label } from "@/lib/constants";

type Row = { id: string; action: string; entityType: string; entityId: string | null; details: unknown; createdAt: string; user: { name: string; role: string } | null };
const ENTITIES = ["Incident", "EmergencyRequest", "Resource", "Allocation", "Shelter", "Task", "Team", "User", "Organization"];
const FILTERS: FilterDef[] = [
  { key: "action", label: "Search action (e.g. PRIORITY)", type: "search" },
  { key: "entityType", label: "Entity", options: ENTITIES.map((e) => ({ value: e, label: label(e.replace(/([A-Z])/g, "_$1").replace(/^_/, "")) })) },
];
const COLS: Col<Row>[] = [
  { key: "when", header: "When", className: "whitespace-nowrap", render: (r) => <span title={dt(r.createdAt)}>{ago(r.createdAt)}</span> },
  { key: "who", header: "User", render: (r) => r.user ? <span>{r.user.name}<span className="block text-xs text-slate-500">{label(r.user.role)}</span></span> : <span className="text-slate-400">System / public</span> },
  { key: "action", header: "Action", render: (r) => <span className="font-medium">{label(r.action)}</span> },
  { key: "entity", header: "Entity", render: (r) => <span>{r.entityType}{r.entityId && <code className="ml-1 text-xs text-slate-500">{r.entityId.slice(0, 8)}</code>}</span> },
  { key: "details", header: "Details", render: (r) => <code className="block max-w-sm truncate text-xs text-slate-600 dark:text-slate-400" title={JSON.stringify(r.details)}>{r.details ? JSON.stringify(r.details) : ""}</code> },
];

/** System-wide activity log (ADMIN / COORD), server-paginated and filterable. CSV export is admin-only (server-enforced). */
export function ActivityLogTable({ canExport = false }: { canExport?: boolean }) {
  return <ListView<Row> endpoint="/api/activity" columns={COLS} filters={FILTERS} exportEntity={canExport ? "activity" : undefined} refreshMs={20000} />;
}
