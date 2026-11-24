"use client";
import { useSyncExternalStore } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState } from "./ui";
import { INCIDENT_CATEGORIES, label } from "@/lib/constants";

/** Shape of GET /api/analytics/dashboard (loose). */
export type Dash = {
  kpis: {
    activeIncidents: number; totalAffected: number; pendingRequests: number; availableResourceUnits: number; activeShelters: number;
    shelterCapacity: number; shelterOccupancy: number; volunteersAvailable: number; volunteersTotal: number;
    avgIncidentResponseMin: number; avgRequestResponseMin: number;
  };
  incidentsByCategory: { name: string; value: number }[];
  incidentsByPriority: { name: string; value: number }[];
  requestTrend: { day: string; count: number; critical: number }[];
  resourceDistribution: { category: string; delivered: number; pending: number }[];
  resourceStock: { category: string; quantity: number; records: number }[];
  requestsByStatus: { name: string; value: number }[];
  topIncidents: { id: string; title: string; priorityLevel: string; priorityScore: number; affectedPopulation: number; location: string }[];
  me: { myOpenTasks?: number; myShelters?: { id: string; name: string; totalCapacity: number; occupancy: number; status: string }[] };
  generatedAt: string;
};

/**
 * Chart tokens. Categorical slots are the validated reference palette (checked against these surfaces with the
 * dataviz validator: lightness band, chroma, CVD separation). Dark mode uses its own validated steps.
 * Priority uses the fixed triage/status scale, the same one shown in badges and on the map.
 */
const THEME = {
  light: { series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"], grid: "#e3e6ea", axis: "#67707b", surface: "#ffffff", border: "#e3e6ea", text: "#181b1f" },
  dark: { series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c"], grid: "#262b31", axis: "#9ba3ad", surface: "#181b1f", border: "#3b424b", text: "#eff1f3" },
};
export const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#d03b3b", HIGH: "#ec835a", MEDIUM: "#fab219", LOW: "#0ca30c" };
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};
const useChartTheme = () => THEME[useSyncExternalStore(subscribe, () => document.documentElement.classList.contains("dark"), () => false) ? "dark" : "light"];

export const humanMin = (m: number | null | undefined) => {
  const n = Math.round(m ?? 0);
  if (!n) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), r = n % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
};

function ChartCard({ title, children, empty, className }: { title: string; children: React.ReactNode; empty: boolean; className?: string }) {
  return (
    <Card title={title} className={className}>
      {empty ? <EmptyState title="No data yet" /> : <div className="h-64 w-full" role="img" aria-label={title}>{children}</div>}
    </Card>
  );
}

export function AnalyticsCharts({ d }: { d: Dash }) {
  const t = useChartTheme();
  const tick = { fontSize: 11, fill: t.axis };
  const tip = {
    contentStyle: { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, fontSize: 12, boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)" },
    labelStyle: { color: t.text, fontWeight: 600, marginBottom: 2 },
    itemStyle: { color: t.text, padding: 0 },
    cursor: { fill: t.grid, fillOpacity: 0.5 },
  };
  const legend = { iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 8 }, formatter: (v: string) => <span style={{ color: t.axis }}>{v}</span> };
  const grid = <CartesianGrid vertical={false} stroke={t.grid} />;

  // Each category keeps its color regardless of rank or filtering.
  const cat = [...d.incidentsByCategory].sort((a, b) => INCIDENT_CATEGORIES.indexOf(a.name as never) - INCIDENT_CATEGORIES.indexOf(b.name as never))
    .map((c) => ({ ...c, label: label(c.name), color: t.series[INCIDENT_CATEGORIES.indexOf(c.name as never)] ?? t.axis }));
  const pri = [...d.incidentsByPriority].sort((a, b) => PRIORITY_ORDER.indexOf(a.name) - PRIORITY_ORDER.indexOf(b.name)).map((p) => ({ ...p, label: label(p.name) }));
  const dist = d.resourceDistribution.map((r) => ({ ...r, category: label(r.category) }));
  const stock = d.resourceStock.map((r) => ({ ...r, category: label(r.category) }));
  const st = d.requestsByStatus.map((s) => ({ ...s, label: label(s.name) }));
  const total = cat.reduce((n, c) => n + c.value, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Incidents by category" empty={!cat.length}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={cat} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="82%" stroke={t.surface} strokeWidth={2} isAnimationActive={false}>
              {cat.map((c) => <Cell key={c.name} fill={c.color} />)}
              <Label position="center" content={({ viewBox }) => {
                const { cx = 0, cy = 0 } = (viewBox ?? {}) as { cx?: number; cy?: number };
                return (<text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"><tspan x={cx} dy="-0.5em" fontSize="22" fontWeight="600" fill={t.text}>{total}</tspan><tspan x={cx} dy="1.6em" fontSize="11" fill={t.axis}>incidents</tspan></text>);
              }} />
            </Pie>
            <Tooltip {...tip} formatter={(v) => [`${v} incidents`, "Count"]} />
            <Legend {...legend} iconType="square" layout="vertical" align="right" verticalAlign="middle" />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Open incidents by priority" empty={!pri.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pri} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            {grid}
            <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: t.grid }} />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name="Incidents" radius={[4, 4, 0, 0]} maxBarSize={56}>{pri.map((p) => <Cell key={p.name} fill={PRIORITY_COLOR[p.name] ?? t.axis} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Emergency requests, last 14 days" empty={!d.requestTrend.length}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={d.requestTrend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            {grid}
            <XAxis dataKey="day" tick={tick} tickLine={false} axisLine={{ stroke: t.grid }} minTickGap={16} />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
            <Tooltip {...tip} cursor={{ stroke: t.axis, strokeDasharray: "3 3" }} />
            <Legend {...legend} iconType="plainline" />
            <Line type="monotone" dataKey="count" name="All requests" stroke={t.series[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }} />
            <Line type="monotone" dataKey="critical" name="Critical" stroke={PRIORITY_COLOR.CRITICAL} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Relief distribution by category (units)" empty={!dist.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dist} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
            {grid}
            <XAxis dataKey="category" tick={{ ...tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: t.grid }} interval={0} angle={-25} textAnchor="end" height={52} />
            <YAxis tick={tick} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Legend {...legend} iconType="square" />
            <Bar dataKey="delivered" name="Delivered" stackId="a" fill={t.series[0]} stroke={t.surface} strokeWidth={1} maxBarSize={40} />
            <Bar dataKey="pending" name="Allocated or in transit" stackId="a" fill={t.series[1]} stroke={t.surface} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Available stock by category (units)" empty={!stock.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stock} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            {grid}
            <XAxis dataKey="category" tick={{ ...tick, fontSize: 10 }} tickLine={false} axisLine={{ stroke: t.grid }} interval={0} angle={-25} textAnchor="end" height={52} />
            <YAxis tick={tick} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="quantity" name="Units in stock" fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Requests by status" empty={!st.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={st} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke={t.grid} />
            <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={84} tick={tick} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name="Requests" fill={t.series[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
