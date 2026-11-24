"use client";
import Link from "next/link";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Spinner, Stat, StatGrid } from "@/components/ui";
import { AnalyticsCharts, humanMin, type Dash } from "@/components/analytics-charts";
import { useApi, fmt } from "@/lib/client";

export function DashboardClient() {
  const { data: d, error, isLoading, isValidating, mutate } = useApi<Dash>("/api/analytics/dashboard", 15000);
  const { data: me } = useApi<{ user: { role: string; name: string } }>("/api/auth/me");
  const role = me?.user.role;

  const refresh = (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
      {d && <span>Updated {new Date(d.generatedAt).toLocaleTimeString()}</span>}
      <Button variant="secondary" size="sm" onClick={() => mutate()} busy={isValidating} aria-label="Refresh dashboard"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Refresh</Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Emergency dashboard" subtitle="Live operational overview; updates automatically as teams act" actions={refresh} />
      {isLoading && !d && <Spinner text="Loading dashboard…" />}
      {error && !d && <ErrorState error={error} retry={() => mutate()} />}
      {d && (
        <div className="space-y-5">
          {error && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">Could not refresh: {error.message}. Showing last known data.</p>}

          {role === "VOLUNTEER" && d.me.myOpenTasks !== undefined && (
            <Link href="/tasks" className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600">
              <ClipboardCheck className="h-6 w-6 text-slate-400" aria-hidden />
              <div><div className="text-lg font-semibold tracking-tight">{d.me.myOpenTasks} open task{d.me.myOpenTasks === 1 ? "" : "s"}</div><div className="text-sm text-slate-600 dark:text-slate-400">View and update your assigned tasks</div></div>
            </Link>
          )}

          {role === "SHELTER_MANAGER" && (
            <Card title="My shelters" action={<Link href="/shelters" className="text-xs font-medium link">Manage shelters</Link>}>
              {d.me.myShelters?.length ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {d.me.myShelters.map((s) => {
                    const pct = s.totalCapacity ? Math.min(100, Math.round((s.occupancy / s.totalCapacity) * 100)) : 0;
                    return (
                      <li key={s.id}>
                        <Link href="/shelters" className="block rounded-md border border-slate-200 p-3 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600">
                          <div className="flex items-center justify-between gap-2"><span className="font-medium">{s.name}</span><Badge value={s.status} /></div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} occupancy`}>
                            <div className={pct >= 90 ? "h-full bg-triage-critical" : pct >= 70 ? "h-full bg-triage-medium" : "h-full bg-triage-low"} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{fmt(s.occupancy)} / {fmt(s.totalCapacity)} occupied ({pct}%), {fmt(s.totalCapacity - s.occupancy)} free</div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState title="No shelters assigned to you" />}
            </Card>
          )}

          <StatGrid className="grid-cols-2 lg:grid-cols-4">
            <Stat label="Active incidents" value={fmt(d.kpis.activeIncidents)} tone="red" />
            <Stat label="People affected" value={fmt(d.kpis.totalAffected)} hint="In open incidents" />
            <Stat label="Pending requests" value={fmt(d.kpis.pendingRequests)} hint="Pending or verified" tone="amber" />
            <Stat label="Available resources" value={fmt(d.kpis.availableResourceUnits)} hint="Units in stock" />
            <Stat label="Active shelters" value={fmt(d.kpis.activeShelters)} hint={`${d.kpis.shelterCapacity ? Math.round((d.kpis.shelterOccupancy / d.kpis.shelterCapacity) * 100) : 0}% occupied (${fmt(d.kpis.shelterOccupancy)} / ${fmt(d.kpis.shelterCapacity)})`} />
            <Stat label="Volunteers available" value={`${fmt(d.kpis.volunteersAvailable)} / ${fmt(d.kpis.volunteersTotal)}`} hint="Available / registered" />
            <Stat label="Avg incident response" value={humanMin(d.kpis.avgIncidentResponseMin)} hint="Report to first response" />
            <Stat label="Avg request response" value={humanMin(d.kpis.avgRequestResponseMin)} hint="Submission to first response" />
          </StatGrid>

          <Card title="Top priority incidents" action={<Link href="/incidents" className="text-xs font-medium link">All incidents</Link>}>
            {d.topIncidents.length ? (
              <ol className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800">
                {d.topIncidents.map((i) => (
                  <li key={i.id}>
                    <Link href={`/incidents/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <span className="w-20 shrink-0"><Badge value={i.priorityLevel} /></span>
                      <span className="min-w-0 flex-1 truncate font-medium">{i.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{i.location}</span>
                      <span className="w-28 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{fmt(i.affectedPopulation)} affected</span>
                      <span className="w-16 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">score {Math.round(i.priorityScore)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : <EmptyState title="No open incidents" />}
          </Card>

          <AnalyticsCharts d={d} />
        </div>
      )}
    </div>
  );
}
