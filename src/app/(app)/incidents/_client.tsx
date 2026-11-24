"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader, Badge, Button } from "@/components/ui";
import { ListView, type Col, type FilterDef } from "@/components/list";
import { INCIDENT_CATEGORIES, label } from "@/lib/constants";
import { useApi, ago, fmt } from "@/lib/client";

export type IncidentRow = {
  id: string; title: string; category: string; location: string; status: string; priorityLevel: string; priorityOverride: string | null; priorityScore: number;
  affectedPopulation: number; reportedAt: string; coordinator: { id: string; name: string } | null; _count: { requests: number };
};

const opts = (a: readonly string[]) => a.map((v) => ({ value: v, label: label(v) }));
const FILTERS: FilterDef[] = [
  { key: "q", label: "Search title, description, location", type: "search" },
  { key: "category", label: "Category", options: opts(INCIDENT_CATEGORIES) },
  { key: "status", label: "Status", options: opts(["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "CLOSED"]) },
  { key: "priority", label: "Priority", options: opts(["CRITICAL", "HIGH", "MEDIUM", "LOW"]) },
  { key: "sort", label: "Sort", options: [{ value: "newest", label: "Newest first" }, { value: "affected", label: "Most affected" }] },
];

export function IncidentsClient() {
  const router = useRouter();
  const me = useApi<{ user: { role: string } }>("/api/auth/me");
  const role = me.data?.user.role;
  const canCreate = role !== "VOLUNTEER";
  const canExport = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR";

  const columns: Col<IncidentRow>[] = [
    { key: "title", header: "Incident", render: (r) => (<div className="min-w-48"><Link href={`/incidents/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{r.title}</Link><div className="text-xs text-slate-500">{label(r.category)} · {r.location}</div></div>) },
    { key: "priority", header: "Priority", render: (r) => { const lvl = r.priorityOverride ?? r.priorityLevel; return (<div className="flex flex-col items-start gap-0.5"><Badge value={lvl} />{r.priorityOverride && <span className="text-[10px] text-slate-500">manual override</span>}<span className="text-xs tabular-nums text-slate-500">score {r.priorityScore.toFixed(1)}</span></div>); } },
    { key: "status", header: "Status", render: (r) => <Badge value={r.status} /> },
    { key: "affected", header: "Affected", className: "text-right tabular-nums", render: (r) => fmt(r.affectedPopulation) },
    { key: "coord", header: "Coordinator", render: (r) => r.coordinator?.name ?? <span className="text-slate-400">Unassigned</span> },
    { key: "reqs", header: "Requests", className: "text-right tabular-nums", render: (r) => r._count.requests },
    { key: "when", header: "Reported", className: "whitespace-nowrap", render: (r) => ago(r.reportedAt) },
  ];

  return (
    <>
      <PageHeader title="Incidents" subtitle="Reported emergencies, ranked by calculated priority."
        actions={canCreate && <Link href="/incidents/new"><Button><Plus className="h-4 w-4" aria-hidden />Report incident</Button></Link>} />
      <ListView<IncidentRow> endpoint="/api/incidents" columns={columns} filters={FILTERS} exportEntity={canExport ? "incidents" : undefined}
        onRow={(r) => router.push(`/incidents/${r.id}`)}
        rowClass={(r) => ((r.priorityOverride ?? r.priorityLevel) === "CRITICAL" && r.status !== "RESOLVED" && r.status !== "CLOSED" ? "bg-red-50 border-l-4 border-l-red-600 dark:bg-red-950/30" : undefined)} />
    </>
  );
}
