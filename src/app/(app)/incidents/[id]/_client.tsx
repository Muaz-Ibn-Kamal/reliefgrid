"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { ActivityTimeline, type ActivityRow } from "@/components/activity-timeline";
import { LEVEL5, RISK5 } from "@/components/rg-forms";
import { api, ApiErr, dt, fmt, useApi } from "@/lib/client";
import { label } from "@/lib/constants";

type Incident = {
  id: string; title: string; description: string; category: string; location: string; latitude: number; longitude: number; severity: number; locationRisk: number;
  affectedPopulation: number; status: string; priorityLevel: string; priorityOverride: string | null; priorityScore: number; imageUrl: string | null; reportedAt: string; firstResponseAt: string | null;
  coordinator: { id: string; name: string; email: string } | null; reportedBy: { id: string; name: string } | null;
  requests: { id: string; type: string; quantity: number; unit: string; status: string; priorityLevel: string; location: string; affectedPeople: number }[];
  tasks: { id: string; title: string; status: string; volunteer: { user: { name: string } } | null }[];
  teams: { id: string; name: string; status: string }[];
  history: ActivityRow[];
};

export function IncidentDetailClient({ id }: { id: string }) {
  const me = useApi<{ user: { role: string } }>("/api/auth/me");
  const { data: inc, error, isLoading, mutate } = useApi<Incident>(`/api/incidents/${id}`, 15000);
  const canManage = me.data?.user.role === "SYSTEM_ADMIN" || me.data?.user.role === "EMERGENCY_COORDINATOR";
  const coords = useApi<{ id: string; name: string }[]>(canManage ? "/api/lookups?type=coordinators" : null);
  const { busy, run } = useAction();
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  if (isLoading) return <Spinner />;
  if (error) return error.status === 404 || error.status === 403
    ? <EmptyState title={error.status === 404 ? "Incident not found" : "You do not have access to this incident"} hint="It may have been removed, or it is outside your assignments." />
    : <ErrorState error={error} retry={() => mutate()} />;
  if (!inc) return null;

  const form = f ?? {
    status: inc.status, severity: String(inc.severity), locationRisk: String(inc.locationRisk), affected: String(inc.affectedPopulation),
    coordinatorId: inc.coordinator?.id ?? "", override: inc.priorityOverride ?? "", note: "",
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...form, [k]: e.target.value });
  const level = inc.priorityOverride ?? inc.priorityLevel;

  async function save(e: React.FormEvent) {
    e.preventDefault(); setFieldErr({});
    const body = {
      status: form.status, severity: Number(form.severity), locationRisk: Number(form.locationRisk), affectedPopulation: Number(form.affected),
      coordinatorId: form.coordinatorId || null, priorityOverride: form.override || null, note: form.note || undefined,
    };
    const r = await run(async () => {
      try { await api(`/api/incidents/${id}`, { method: "PATCH", json: body }); }
      catch (err) { if (err instanceof ApiErr && Array.isArray(err.details)) setFieldErr(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message]))); throw err; }
      return true;
    }, "Incident updated");
    if (r) { setF(null); mutate(); }
  }

  return (
    <div className="space-y-5">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline dark:text-slate-400"><ArrowLeft className="h-4 w-4" aria-hidden />All incidents</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{inc.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500"><Badge value={level} /><Badge value={inc.status} /><span>{label(inc.category)}</span><span>· Reported {dt(inc.reportedAt)}</span></div>
        </div>
        {canManage && <Button variant="secondary" busy={busy} onClick={() => run(() => api("/api/priority/recalculate", { method: "POST", json: {} }), "Priorities recalculated").then(() => mutate())}><RefreshCw className="h-4 w-4" aria-hidden />Recalculate priorities</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Details">
            <p className="whitespace-pre-line text-sm">{inc.description}</p>
            {inc.imageUrl && <img src={inc.imageUrl} alt={`Photo for ${inc.title}`} className="mt-3 max-h-72 rounded-lg object-cover" />}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Location</dt><dd>{inc.location}</dd></div>
              <div><dt className="text-xs text-slate-500">GPS</dt><dd><a className="inline-flex items-center gap-1 link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${inc.latitude}&mlon=${inc.longitude}#map=13/${inc.latitude}/${inc.longitude}`}>{inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}<ExternalLink className="h-3 w-3" aria-hidden /></a></dd></div>
              <div><dt className="text-xs text-slate-500">Affected population</dt><dd className="tabular-nums">{fmt(inc.affectedPopulation)}</dd></div>
              <div><dt className="text-xs text-slate-500">Severity / location risk</dt><dd>{inc.severity} / 5 · {inc.locationRisk} / 5</dd></div>
              <div><dt className="text-xs text-slate-500">Priority score</dt><dd className="tabular-nums">{inc.priorityScore.toFixed(1)}{inc.priorityOverride && <span className="ml-1 text-xs text-slate-500">(manual override; calculated {label(inc.priorityLevel)})</span>}</dd></div>
              <div><dt className="text-xs text-slate-500">Coordinator</dt><dd>{inc.coordinator?.name ?? "Unassigned"}</dd></div>
              <div><dt className="text-xs text-slate-500">Reported by</dt><dd>{inc.reportedBy?.name ?? "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">First response</dt><dd>{inc.firstResponseAt ? dt(inc.firstResponseAt) : "Not yet"}</dd></div>
            </dl>
          </Card>

          <Card title={`Emergency requests (${inc.requests.length})`} action={canManage || me.data ? <Link className="text-sm font-medium link" href={`/requests?new=1&incidentId=${inc.id}`}>Add request</Link> : null}>
            {!inc.requests.length ? <EmptyState title="No requests linked" /> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">{inc.requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{label(r.type)} · {fmt(r.quantity)} {r.unit} · {r.location}</span><span className="flex gap-1.5"><Badge value={r.priorityLevel} /><Badge value={r.status} /></span></li>
              ))}</ul>
            )}
          </Card>

          <Card title={`Tasks & teams`}>
            {!inc.tasks.length && !inc.teams.length ? <EmptyState title="No volunteer tasks or teams deployed" /> : (
              <div className="space-y-2 text-sm">
                {inc.teams.map((t) => <div key={t.id} className="flex justify-between"><span>Team: {t.name}</span><Badge value={t.status} /></div>)}
                {inc.tasks.map((t) => <div key={t.id} className="flex justify-between gap-2"><span>{t.title}{t.volunteer && <span className="text-slate-500"> · {t.volunteer.user.name}</span>}</span><Badge value={t.status} /></div>)}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {canManage && (
            <Card title="Coordinator controls">
              <form onSubmit={save} className="space-y-3">
                <Field label="Status" error={fieldErr.status}>{(i) => <Select id={i} value={form.status} onChange={set("status")}>{["REPORTED", "VERIFIED", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
                <Field label="Severity" error={fieldErr.severity}>{(i) => <Select id={i} value={form.severity} onChange={set("severity")}>{LEVEL5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
                <Field label="Location risk" error={fieldErr.locationRisk}>{(i) => <Select id={i} value={form.locationRisk} onChange={set("locationRisk")}>{RISK5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
                <Field label="Affected population" error={fieldErr.affectedPopulation}>{(i) => <Input id={i} type="number" min={0} value={form.affected} onChange={set("affected")} />}</Field>
                <Field label="Response coordinator">{(i) => <Select id={i} value={form.coordinatorId} onChange={set("coordinatorId")}><option value="">Unassigned</option>{coords.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
                <Field label="Priority override" hint="Leave on 'Automatic' to use the calculated priority.">{(i) => <Select id={i} value={form.override} onChange={set("override")}><option value="">Automatic</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
                <Field label="Note (recorded in history)" error={fieldErr.note}>{(i) => <Textarea id={i} rows={2} maxLength={500} value={form.note} onChange={set("note")} />}</Field>
                <Button type="submit" busy={busy} className="w-full">Save changes</Button>
              </form>
            </Card>
          )}
          <Card title="Incident history"><ActivityTimeline rows={inc.history} /></Card>
        </div>
      </div>
    </div>
  );
}
