"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Spinner, Stat, StatGrid, useAction } from "@/components/ui";
import { CapacityBar } from "@/components/capacity-bar";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, dt, fmt, useApi } from "@/lib/client";
import { label, type RoleName } from "@/lib/constants";

type Log = { id: string; previous: number; current: number; capacity: number; note: string | null; createdAt: string };
type Shelter = { id: string; name: string; location: string; latitude: number; longitude: number; totalCapacity: number; occupancy: number; availableCapacity: number; status: string; facilities: string[]; manager: { id: string; name: string; phone: string | null } | null; managerId: string | null; occupancyLogs: Log[] };

export function ShelterDetailClient({ id }: { id: string }) {
  const me = useApi<{ user: { id: string; role: RoleName } }>("/api/auth/me");
  const { data: sh, error, isLoading, mutate } = useApi<Shelter>(`/api/shelters/${id}`, 15000);
  const occ = useSubmit(); const edit = useSubmit(); const { busy: statusBusy, run } = useAction();
  const [mode, setMode] = useState<"set" | "delta">("set"); const [val, setVal] = useState(""); const [note, setNote] = useState("");
  const [ef, setEf] = useState<{ name: string; location: string; cap: string; fac: string } | null>(null);

  if (isLoading) return <Spinner />;
  if (error) return error.status === 404 ? <EmptyState title="Shelter not found" /> : <ErrorState error={error} retry={() => mutate()} />;
  if (!sh) return null;
  const role = me.data?.user.role;
  const canManage = role === "SYSTEM_ADMIN" || (role === "SHELTER_MANAGER" && sh.managerId === me.data?.user.id);
  const n = Number(val);
  const next = mode === "set" ? n : sh.occupancy + n;
  const occErr = val !== "" && (!Number.isInteger(n) ? "Enter a whole number" : next < 0 ? "Occupancy cannot be negative" : next > sh.totalCapacity ? `Would exceed capacity (${fmt(sh.totalCapacity)})` : undefined);
  const chart = [...sh.occupancyLogs].reverse().map((l) => ({ t: new Date(l.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }), occupancy: l.current }));
  const form = ef ?? { name: sh.name, location: sh.location, cap: String(sh.totalCapacity), fac: sh.facilities.join(", ") };

  return (
    <div className="space-y-5">
      <Link href="/shelters" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline print:hidden dark:text-slate-400"><ArrowLeft className="h-4 w-4" aria-hidden />All shelters</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">{sh.name}</h1><p className="text-sm text-slate-500">{sh.location} · {sh.latitude.toFixed(4)}, {sh.longitude.toFixed(4)} · Manager: {sh.manager?.name ?? "Unassigned"}{sh.manager?.phone ? ` (${sh.manager.phone})` : ""}</p></div>
        <div className="flex items-center gap-2"><Badge value={sh.status} /><Button variant="secondary" className="print:hidden" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print report</Button></div>
      </div>
      <StatGrid className="sm:grid-cols-3"><Stat label="Total capacity" value={fmt(sh.totalCapacity)} /><Stat label="Current occupancy" value={fmt(sh.occupancy)} /><Stat label="Available" value={fmt(sh.availableCapacity)} tone={sh.availableCapacity ? "green" : "red"} /></StatGrid>
      <Card title="Occupancy"><CapacityBar occupancy={sh.occupancy} total={sh.totalCapacity} /><div className="mt-3 flex flex-wrap gap-1.5">{sh.facilities.length ? sh.facilities.map((x) => <span key={x} className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{x}</span>) : <span className="text-sm text-slate-500">No facilities listed.</span>}</div></Card>

      {canManage && (
        <div className="grid gap-5 lg:grid-cols-2 print:hidden">
          <Card title="Update occupancy">
            <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (occErr || val === "") return; if (await occ.run(() => api(`/api/shelters/${id}/occupancy`, { json: mode === "set" ? { occupancy: n, note: note || undefined } : { delta: n, note: note || undefined } }), "Occupancy updated")) { setVal(""); setNote(""); mutate(); } }}>
              <FormError message={occ.error} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Method">{(i) => <Select id={i} value={mode} onChange={(e) => { setMode(e.target.value as "set" | "delta"); setVal(""); }}><option value="set">Set exact count</option><option value="delta">Add / remove (+/−)</option></Select>}</Field>
                <Field label={mode === "set" ? "New occupancy" : "Change (e.g. 12 or -5)"} error={occErr || undefined}>{(i) => <Input id={i} inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} aria-invalid={!!occErr} />}</Field>
              </div>
              <Field label="Note (kept in history)">{(i) => <Input id={i} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}</Field>
              <Button type="submit" busy={occ.busy} disabled={val === "" || !!occErr}>Save occupancy</Button>
            </form>
          </Card>
          <Card title="Shelter information">
            <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await edit.run(() => api(`/api/shelters/${id}`, { method: "PATCH", json: { name: form.name, location: form.location, totalCapacity: Number(form.cap), facilities: form.fac.split(",").map((x) => x.trim()).filter(Boolean) } }), "Shelter updated")) { setEf(null); mutate(); } }}>
              <FormError message={edit.error} />
              <Field label="Name" error={edit.fieldError("name")}>{(i) => <Input id={i} value={form.name} onChange={(e) => setEf({ ...form, name: e.target.value })} />}</Field>
              <Field label="Location" error={edit.fieldError("location")}>{(i) => <Input id={i} value={form.location} onChange={(e) => setEf({ ...form, location: e.target.value })} />}</Field>
              <Field label="Total capacity" error={edit.fieldError("totalCapacity")}>{(i) => <Input id={i} inputMode="numeric" value={form.cap} onChange={(e) => setEf({ ...form, cap: e.target.value })} />}</Field>
              <Field label="Facilities (comma separated)">{(i) => <Input id={i} value={form.fac} onChange={(e) => setEf({ ...form, fac: e.target.value })} />}</Field>
              <div className="flex flex-wrap gap-2"><Button type="submit" busy={edit.busy}>Save</Button>
                {sh.status !== "CLOSED" ? <Button type="button" variant="danger" busy={statusBusy} onClick={() => run(() => api(`/api/shelters/${id}`, { method: "PATCH", json: { status: "CLOSED" } }), "Shelter closed").then(() => mutate())}>Close shelter</Button> : <Button type="button" variant="secondary" busy={statusBusy} onClick={() => run(() => api(`/api/shelters/${id}`, { method: "PATCH", json: { status: "OPEN" } }), "Shelter reopened").then(() => mutate())}>Reopen</Button>}</div>
            </form>
          </Card>
        </div>
      )}

      <Card title="Occupancy history">
        {chart.length < 2 ? <EmptyState title="Not enough history to chart yet" /> : (
          <div className="h-56" role="img" aria-label="Occupancy over time"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><CartesianGrid vertical={false} stroke="#e3e6ea" /><XAxis dataKey="t" fontSize={11} /><YAxis fontSize={11} domain={[0, sh.totalCapacity]} /><Tooltip /><Area type="monotone" dataKey="occupancy" stroke="#2a78d6" fill="#2a78d6" fillOpacity={0.25} /></AreaChart></ResponsiveContainer></div>
        )}
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1.5 pr-3">When</th><th className="pr-3">Change</th><th className="pr-3">Capacity</th><th>Note</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{sh.occupancyLogs.map((l) => <tr key={l.id}><td className="py-1.5 pr-3 whitespace-nowrap">{dt(l.createdAt)}</td><td className="pr-3 tabular-nums">{fmt(l.previous)} → {fmt(l.current)}</td><td className="pr-3 tabular-nums">{fmt(l.capacity)}</td><td className="text-slate-600 dark:text-slate-400">{l.note ?? ""}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-slate-500">Status: {label(sh.status)}. History is append-only.</p>
      </Card>
    </div>
  );
}
