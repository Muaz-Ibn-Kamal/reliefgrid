"use client";
import { Download, Printer } from "lucide-react";
import { ActivityLogTable } from "@/components/activity-log-table";
import { AnalyticsCharts, humanMin, type Dash } from "@/components/analytics-charts";
import { Button, Card, ErrorState, PageHeader, Spinner, Stat } from "@/components/ui";
import { dt, fmt, useApi } from "@/lib/client";

// Mirrors the server rules in /api/export/[entity]: organizations export only requests and their own stock/allocations.
const EXPORTS = [
  { entity: "incidents", label: "Incidents", org: false }, { entity: "requests", label: "Emergency requests", org: true }, { entity: "resources", label: "Resources", org: true },
  { entity: "allocations", label: "Allocations", org: true }, { entity: "shelters", label: "Shelters", org: false }, { entity: "activity", label: "Activity log", org: false, adminOnly: true },
];

export function ReportsClient() {
  const me = useApi<{ user: { role: string } }>("/api/auth/me");
  const { data: d, error, isLoading, mutate } = useApi<Dash>("/api/analytics/dashboard", 30000);
  const role = me.data?.user.role;
  const ops = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR";
  const exports = EXPORTS.filter((e) => (e.adminOnly ? role === "SYSTEM_ADMIN" : ops || e.org));
  return (
    <div className="space-y-5">
      <PageHeader title="Reports & analytics" subtitle={d ? `Generated ${dt(d.generatedAt)}` : "Operational reporting and data export."} actions={<Button variant="secondary" className="print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print / Save as PDF</Button>} />
      {isLoading ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Active incidents" value={fmt(d.kpis.activeIncidents)} tone="red" />
            <Stat label="People affected" value={fmt(d.kpis.totalAffected)} tone="amber" />
            <Stat label="Pending requests" value={fmt(d.kpis.pendingRequests)} tone="amber" />
            <Stat label="Avg. response" value={humanMin(d.kpis.avgIncidentResponseMin)} hint={`Requests: ${humanMin(d.kpis.avgRequestResponseMin)}`} tone="green" />
            <Stat label="Resource units" value={fmt(d.kpis.availableResourceUnits)} />
            <Stat label="Shelter occupancy" value={d.kpis.shelterCapacity ? `${Math.round((d.kpis.shelterOccupancy / d.kpis.shelterCapacity) * 100)}%` : "—"} hint={`${fmt(d.kpis.shelterOccupancy)} / ${fmt(d.kpis.shelterCapacity)} places`} />
            <Stat label="Active shelters" value={fmt(d.kpis.activeShelters)} />
            <Stat label="Volunteers available" value={`${fmt(d.kpis.volunteersAvailable)} / ${fmt(d.kpis.volunteersTotal)}`} tone="green" />
          </div>
          <AnalyticsCharts d={d} />
        </>
      )}
      <Card title="Data export (CSV)" className="print:hidden">
        <div className="flex flex-wrap gap-2">{exports.map((e) => (
          <a key={e.entity} href={`/api/export/${e.entity}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Download className="h-4 w-4" aria-hidden />{e.label}</a>
        ))}</div>
        <p className="mt-2 text-xs text-slate-500">Exports are scoped to your role and organization and are recorded in the activity log.</p>
      </Card>
      {ops && <div className="print:hidden"><h2 className="mb-2 text-lg font-semibold">Activity log</h2><ActivityLogTable canExport={role === "SYSTEM_ADMIN"} /></div>}
    </div>
  );
}
