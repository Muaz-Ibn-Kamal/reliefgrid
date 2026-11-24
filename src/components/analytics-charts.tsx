"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState } from "./ui";
import { label } from "@/lib/constants";

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

/** Okabe-Ito colorblind-safe palette. */
export const PAL = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#F0E442", "#7A7A7A"];
export const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#D55E00", HIGH: "#E69F00", MEDIUM: "#56B4E9", LOW: "#009E73" };
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export const humanMin = (m: number | null | undefined) => {
  const n = Math.round(m ?? 0);
  if (!n) return "—";
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60), r = n % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} d ${hh} h` : `${d} d`;
};

const tooltipStyle = { borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 };
const tick = { fontSize: 11, fill: "#64748b" };

function ChartCard({ title, children, empty, className }: { title: string; children: React.ReactNode; empty: boolean; className?: string }) {
  return (
    <Card title={title} className={className}>
      {empty ? <EmptyState title="No data yet" /> : <div className="h-72 w-full" role="img" aria-label={title}>{children}</div>}
    </Card>
  );
}

export function AnalyticsCharts({ d }: { d: Dash }) {
  const cat = d.incidentsByCategory.map((c) => ({ ...c, name: label(c.name) }));
  const pri = [...d.incidentsByPriority].sort((a, b) => PRIORITY_ORDER.indexOf(a.name) - PRIORITY_ORDER.indexOf(b.name)).map((p) => ({ ...p, label: label(p.name) }));
  const dist = d.resourceDistribution.map((r) => ({ ...r, category: label(r.category) }));
  const stock = d.resourceStock.map((r) => ({ ...r, category: label(r.category) }));
  const st = d.requestsByStatus.map((s) => ({ ...s, label: label(s.name) }));
  const total = cat.reduce((n, c) => n + c.value, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Incident category distribution" empty={!cat.length}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={cat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={({ value }) => `${Math.round(((value as number) / (total || 1)) * 100)}%`}>
              {cat.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} incidents`, "Count"]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Open incidents by priority" empty={!pri.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pri} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="label" tick={tick} label={{ value: "Priority level", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748b" }} />
            <YAxis allowDecimals={false} tick={tick} label={{ value: "Incidents", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.1 }} />
            <Bar dataKey="value" name="Incidents" radius={[4, 4, 0, 0]}>{pri.map((p) => <Cell key={p.name} fill={PRIORITY_COLOR[p.name] ?? PAL[7]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Emergency requests, last 14 days" empty={!d.requestTrend.length}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={d.requestTrend} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="day" tick={tick} />
            <YAxis allowDecimals={false} tick={tick} label={{ value: "Requests", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="count" name="All requests" stroke="#0072B2" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="critical" name="Critical" stroke="#D55E00" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Resource distribution: delivered vs pending" empty={!dist.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dist} margin={{ top: 8, right: 8, left: 0, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="category" tick={{ ...tick, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} />
            <YAxis tick={tick} label={{ value: "Units", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.1 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="delivered" name="Delivered" stackId="a" fill="#009E73" />
            <Bar dataKey="pending" name="Allocated / in transit" stackId="a" fill="#E69F00" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Available stock by category" empty={!stock.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stock} margin={{ top: 8, right: 8, left: 0, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="category" tick={{ ...tick, fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={55} />
            <YAxis tick={tick} label={{ value: "Units in stock", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.1 }} />
            <Bar dataKey="quantity" name="Units in stock" fill="#0072B2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Requests by status" empty={!st.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={st} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis type="number" allowDecimals={false} tick={tick} label={{ value: "Requests", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748b" }} />
            <YAxis type="category" dataKey="label" width={80} tick={tick} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fillOpacity: 0.1 }} />
            <Bar dataKey="value" name="Requests" radius={[0, 4, 4, 0]}>{st.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
