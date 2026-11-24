"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ListView, refreshLists, type Col } from "@/components/list";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { MapLink, SkillChips, fieldErr } from "@/components/volteam-bits";
import { api, ago, dt, useApi, type Paged } from "@/lib/client";
import { label } from "@/lib/constants";

type Vol = {
  id: string; skills: string[]; availability: string; latitude: number | null; longitude: number | null;
  user: { name: string; email: string; phone: string | null; active: boolean };
  team: { id: string; name: string } | null; _count: { tasks: number; reports: number };
};
type Match = { id: string; name: string; phone: string | null; skills: string[]; distanceKm: number; skillMatches: number; score: number };
type TaskRow = {
  id: string; title: string; status: string; location: string; createdAt: string; updatedAt: string; completedAt: string | null;
  volunteer: { id: string } | null; incident: { title: string } | null; reports: { id: string; content: string; photoUrl: string | null; createdAt: string }[];
};
type Lookup = { id: string; title?: string; name?: string; user?: { name: string } };
type Prefill = { volunteerId?: string; teamId?: string; latitude?: string; longitude?: string };

const AVAIL = ["AVAILABLE", "DEPLOYED", "UNAVAILABLE"].map((v) => ({ value: v, label: label(v) }));

export default function Client() {
  const [sel, setSel] = useState<Vol | null>(null);
  const [assign, setAssign] = useState<Prefill | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [skillOpts] = useState<{ value: string; label: string }[]>(["First Aid", "Medical", "Rescue", "Driving", "Logistics", "Boat Operation", "Cooking", "Communication"].map((s) => ({ value: s, label: s })));

  const cols: Col<Vol>[] = [
    { key: "name", header: "Volunteer", render: (v) => <div><div className="font-medium">{v.user.name}</div><div className="text-xs text-slate-500">{v.user.email}</div></div> },
    { key: "skills", header: "Skills", render: (v) => <SkillChips skills={v.skills} /> },
    { key: "av", header: "Availability", render: (v) => <Badge value={v.availability} /> },
    { key: "team", header: "Team", render: (v) => v.team?.name ?? <span className="text-slate-400">—</span> },
    { key: "org", header: "Organization", render: () => <span className="text-slate-400" title="Volunteers are not bound to an organization by the API">—</span> },
    { key: "tasks", header: "Tasks / Reports", className: "tabular-nums", render: (v) => `${v._count.tasks} / ${v._count.reports}` },
    { key: "act", header: "Last activity", render: () => <span className="text-xs text-slate-400">Open for history</span> },
  ];

  return (
    <>
      <PageHeader title="Volunteers" subtitle="Find, match and assign volunteers to field tasks."
        actions={<><Button variant="secondary" onClick={() => setShowMatch((s) => !s)} aria-expanded={showMatch}><Sparkles className="h-4 w-4" />Best-matching volunteers</Button><Button onClick={() => setAssign({})}>Assign task</Button></>} />
      {showMatch && <MatchPanel onAssign={setAssign} />}
      <ListView<Vol> endpoint="/api/volunteers" columns={cols} onRow={setSel} refreshMs={15000}
        filters={[
          { key: "q", label: "Search name or email", type: "search" },
          { key: "availability", label: "Availability", options: AVAIL },
          { key: "skill", label: "Skill", options: skillOpts },
        ]} />
      {sel && <DetailModal v={sel} onClose={() => setSel(null)} onAssign={(p) => setAssign(p)} />}
      {assign && <AssignModal prefill={assign} onClose={() => setAssign(null)} />}
    </>
  );
}

function MatchPanel({ onAssign }: { onAssign: (p: Prefill) => void }) {
  const [lat, setLat] = useState(""); const [lng, setLng] = useState(""); const [skills, setSkills] = useState("");
  const [res, setRes] = useState<Match[] | null>(null);
  const { busy, run } = useAction();
  const valid = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
  async function search(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams({ lat, lng, skills });
    const r = await run(() => api<Match[]>(`/api/volunteers/match?${qs}`));
    if (r) setRes(r);
  }
  return (
    <Card title="Best-matching volunteers" className="mb-4">
      <form onSubmit={search} className="grid gap-3 sm:grid-cols-4">
        <Field label="Latitude">{(id) => <Input id={id} type="number" step="any" required value={lat} onChange={(e) => setLat(e.target.value)} />}</Field>
        <Field label="Longitude">{(id) => <Input id={id} type="number" step="any" required value={lng} onChange={(e) => setLng(e.target.value)} />}</Field>
        <Field label="Skills" hint="Comma separated">{(id) => <Input id={id} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="First Aid, Driving" />}</Field>
        <div className="flex items-end"><Button type="submit" busy={busy} disabled={!valid} className="w-full">Find matches</Button></div>
      </form>
      {res && (res.length === 0 ? <EmptyState title="No available volunteers found" hint="Only available volunteers with a known location are matched." /> : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {res.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.distanceKm} km away · {m.skillMatches} skill match{m.skillMatches === 1 ? "" : "es"} · score {m.score}</div><SkillChips skills={m.skills} /></div>
              <Button size="sm" onClick={() => onAssign({ volunteerId: m.id, latitude: lat, longitude: lng })}>Assign</Button>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  );
}

function DetailModal({ v, onClose, onAssign }: { v: Vol; onClose: () => void; onAssign: (p: Prefill) => void }) {
  // The tasks API has no volunteer filter for coordinators, so fetch a page and filter client-side.
  const { data, error, isLoading, mutate } = useApi<Paged<TaskRow>>("/api/tasks?pageSize=100", 15000);
  const tasks = (data?.data ?? []).filter((t) => t.volunteer?.id === v.id);
  const reports = tasks.flatMap((t) => t.reports.map((r) => ({ ...r, task: t.title })));
  const last = [...tasks.map((t) => t.updatedAt), ...reports.map((r) => r.createdAt)].sort().pop();
  return (
    <Modal open onClose={onClose} title={v.user.name} wide>
      <div className="space-y-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-slate-500">Email</dt><dd>{v.user.email}</dd></div>
          <div><dt className="text-xs text-slate-500">Phone</dt><dd>{v.user.phone ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Availability</dt><dd><Badge value={v.availability} /></dd></div>
          <div><dt className="text-xs text-slate-500">Team</dt><dd>{v.team?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Location</dt><dd>{v.latitude != null && v.longitude != null ? <MapLink lat={v.latitude} lng={v.longitude} /> : "Unknown"}</dd></div>
          <div><dt className="text-xs text-slate-500">Last activity</dt><dd>{last ? ago(last) : "—"}</dd></div>
          <div className="sm:col-span-2"><dt className="mb-1 text-xs text-slate-500">Skills</dt><dd><SkillChips skills={v.skills} /></dd></div>
        </dl>
        <div className="flex justify-end">
          <Button disabled={!v.user.active || v.availability === "UNAVAILABLE"} onClick={() => onAssign({ volunteerId: v.id, latitude: v.latitude?.toString(), longitude: v.longitude?.toString() })}>Assign task</Button>
        </div>
        <section aria-labelledby="hist"><h3 id="hist" className="mb-2 text-sm font-semibold">Activity history</h3>
          {isLoading ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : !tasks.length ? <EmptyState title="No tasks yet" hint="Showing the most recent 100 tasks system-wide." /> : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium">{t.title}</span><Badge value={t.status} /></div>
                  <div className="text-xs text-slate-500">{t.location}{t.incident ? ` · ${t.incident.title}` : ""} · assigned {dt(t.createdAt)}{t.completedAt ? ` · completed ${dt(t.completedAt)}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        {reports.length > 0 && (
          <section aria-labelledby="fr"><h3 id="fr" className="mb-2 text-sm font-semibold">Field reports</h3>
            <ul className="space-y-2">{reports.map((r) => (
              <li key={r.id} className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60"><div className="text-xs text-slate-500">{r.task} · {dt(r.createdAt)}</div><p className="mt-1 whitespace-pre-wrap">{r.content}</p>{r.photoUrl && <img src={r.photoUrl} alt="Field report photograph" className="mt-2 h-24 rounded object-cover" />}</li>
            ))}</ul>
          </section>
        )}
      </div>
    </Modal>
  );
}

function AssignModal({ prefill, onClose }: { prefill: Prefill; onClose: () => void }) {
  const { busy, run } = useAction();
  const incidents = useApi<Lookup[]>("/api/lookups?type=incidents");
  const vols = useApi<Lookup[]>("/api/lookups?type=volunteers");
  const teams = useApi<Lookup[]>("/api/lookups?type=teams");
  const [f, setF] = useState({ title: "", description: "", location: "", latitude: prefill.latitude ?? "", longitude: prefill.longitude ?? "", incidentId: "", volunteerId: prefill.volunteerId ?? "", teamId: prefill.teamId ?? "" });
  const [err, setErr] = useState<unknown>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const noTarget = !f.volunteerId && !f.teamId;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const json = { title: f.title, description: f.description || undefined, location: f.location, latitude: Number(f.latitude), longitude: Number(f.longitude), incidentId: f.incidentId || undefined, volunteerId: f.volunteerId || undefined, teamId: f.teamId || undefined };
    try {
      await run(async () => { try { return await api("/api/tasks", { json }); } catch (x) { setErr(x); throw x; } }, "Task assigned");
      // run swallows errors; detect success by absence of err state via re-check
    } catch { /* handled */ }
  }
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    const json = { title: f.title, description: f.description || undefined, location: f.location, latitude: Number(f.latitude), longitude: Number(f.longitude), incidentId: f.incidentId || undefined, volunteerId: f.volunteerId || undefined, teamId: f.teamId || undefined };
    const r = await run(async () => { try { return await api("/api/tasks", { json }); } catch (x) { setErr(x); throw x; } }, "Task assigned");
    if (r) { refreshLists(); onClose(); }
  }
  void submit;
  return (
    <Modal open onClose={onClose} title="Assign task" wide>
      <form onSubmit={go} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2"><Field label="Title" error={fieldErr(err, "title")}>{(id) => <Input id={id} required value={f.title} onChange={set("title")} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Description" error={fieldErr(err, "description")}>{(id) => <Textarea id={id} value={f.description} onChange={set("description")} />}</Field></div>
        <div className="sm:col-span-2"><Field label="Location" error={fieldErr(err, "location")}>{(id) => <Input id={id} required value={f.location} onChange={set("location")} />}</Field></div>
        <Field label="Latitude" error={fieldErr(err, "latitude")}>{(id) => <Input id={id} type="number" step="any" required value={f.latitude} onChange={set("latitude")} />}</Field>
        <Field label="Longitude" error={fieldErr(err, "longitude")}>{(id) => <Input id={id} type="number" step="any" required value={f.longitude} onChange={set("longitude")} />}</Field>
        <div className="sm:col-span-2"><Field label="Incident (optional)">{(id) => (
          <Select id={id} value={f.incidentId} onChange={set("incidentId")}><option value="">None</option>{incidents.data?.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</Select>
        )}</Field></div>
        <Field label="Volunteer">{(id) => (
          <Select id={id} value={f.volunteerId} onChange={set("volunteerId")}><option value="">None</option>{vols.data?.map((v) => <option key={v.id} value={v.id}>{v.user?.name}</option>)}</Select>
        )}</Field>
        <Field label="Team">{(id) => (
          <Select id={id} value={f.teamId} onChange={set("teamId")}><option value="">None</option>{teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        )}</Field>
        {noTarget && <p className="text-xs text-slate-500 sm:col-span-2">Choose a volunteer or a team.</p>}
        {err instanceof Error && !fieldErr(err, "title") && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{err.message}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={busy} disabled={noTarget}>Assign task</Button></div>
      </form>
    </Modal>
  );
}
