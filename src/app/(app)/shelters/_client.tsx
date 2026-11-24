"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Navigation, Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, useAction } from "@/components/ui";
import { CapacityBar } from "@/components/capacity-bar";
import { ListView, refreshLists, type Col, type FilterDef } from "@/components/list";
import { GpsFields, num, validateGps } from "@/components/rg-forms";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, fmt, useApi } from "@/lib/client";
import { label, type RoleName } from "@/lib/constants";

export type ShelterRow = { id: string; name: string; location: string; totalCapacity: number; occupancy: number; availableCapacity: number; status: string; facilities: string[]; manager: { id: string; name: string } | null };
type Near = { id: string; name: string; location: string; availableCapacity: number; distanceKm: number; facilities: string[] };

const FILTERS: FilterDef[] = [
  { key: "q", label: "Search name or location", type: "search" },
  { key: "status", label: "Status", options: ["OPEN", "FULL", "CLOSED"].map((v) => ({ value: v, label: label(v) })) },
];

function NearestFinder() {
  const router = useRouter();
  const [lat, setLat] = useState(""); const [lng, setLng] = useState(""); const [people, setPeople] = useState("1");
  const [results, setResults] = useState<Near[] | null>(null);
  const { busy, run } = useAction();
  const err = validateGps(lat, lng);
  return (
    <Card title="Find nearest available shelter">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (err.latitude || err.longitude) return; const r = await run(() => api<Near[]>(`/api/shelters/nearest?lat=${lat}&lng=${lng}&people=${Math.max(1, Number(people) || 1)}`)); if (r) setResults(r); }}>
        <GpsFields lat={lat} lng={lng} onChange={(a, b) => { setLat(a); setLng(b); }} errors={lat || lng ? err : {}} />
        <div className="flex flex-wrap items-end gap-2"><div className="w-40"><Field label="People to place">{(id) => <Input id={id} inputMode="numeric" value={people} onChange={(e) => setPeople(e.target.value)} />}</Field></div><Button type="submit" busy={busy} disabled={!!(err.latitude || err.longitude)}><Navigation className="h-4 w-4" aria-hidden />Find shelters</Button></div>
      </form>
      {results && (!results.length ? <p className="mt-3 text-sm text-slate-500">No open shelter has enough free places.</p> : (
        <ol className="mt-3 space-y-2">{results.map((s, i) => (
          <li key={s.id}><button className="w-full rounded-lg border border-slate-200 p-2.5 text-left text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => router.push(`/shelters/${s.id}`)}>
            <span className="font-semibold">{i + 1}. {s.name}</span> <span className="text-slate-500">· {s.distanceKm} km · {fmt(s.availableCapacity)} places free</span><div className="text-xs text-slate-500">{s.location}{s.facilities.length ? ` · ${s.facilities.join(", ")}` : ""}</div>
          </button></li>
        ))}</ol>
      ))}
    </Card>
  );
}

function RegisterModal({ role, onClose }: { role: RoleName; onClose: () => void }) {
  const managers = useApi<{ id: string; name: string }[]>(role === "SYSTEM_ADMIN" ? "/api/lookups?type=shelterManagers" : null);
  const s = useSubmit();
  const [f, setF] = useState({ name: "", location: "", lat: "", lng: "", cap: "", occ: "0", fac: "", mgr: "" });
  const [ce, setCe] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v: Record<string, string> = { ...validateGps(f.lat, f.lng) };
    const cap = num(f.cap), occ = num(f.occ) ?? 0;
    if (!f.name.trim()) v.name = "Name is required"; if (!f.location.trim()) v.location = "Location is required";
    if (cap === undefined || !Number.isInteger(cap) || cap < 1) v.totalCapacity = "Capacity must be a whole number of at least 1";
    else if (!Number.isInteger(occ) || occ < 0) v.occupancy = "Occupancy must be 0 or more"; else if (occ > cap) v.occupancy = "Occupancy cannot exceed capacity";
    setCe(v); if (Object.keys(v).length) return;
    const ok = await s.run(() => api("/api/shelters", { json: { name: f.name, location: f.location, latitude: Number(f.lat), longitude: Number(f.lng), totalCapacity: cap, occupancy: occ, facilities: f.fac.split(",").map((x) => x.trim()).filter(Boolean), managerId: f.mgr || null } }), "Shelter registered");
    if (ok) { refreshLists(); onClose(); }
  }
  const er = (k: string) => ce[k] ?? s.fieldError(k);
  return (
    <Modal open onClose={onClose} title="Register shelter" wide>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <FormError message={s.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Shelter name" error={er("name")}>{(i) => <Input id={i} value={f.name} onChange={set("name")} maxLength={120} />}</Field>
          <Field label="Location" error={er("location")}>{(i) => <Input id={i} value={f.location} onChange={set("location")} maxLength={200} />}</Field>
          <Field label="Total capacity" error={er("totalCapacity")}>{(i) => <Input id={i} inputMode="numeric" value={f.cap} onChange={set("cap")} />}</Field>
          <Field label="Current occupancy" error={er("occupancy")}>{(i) => <Input id={i} inputMode="numeric" value={f.occ} onChange={set("occ")} />}</Field>
        </div>
        <GpsFields lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} errors={{ latitude: er("latitude"), longitude: er("longitude") }} />
        <Field label="Facilities (comma separated)" hint="e.g. Clean water, Medical post, Kitchen">{(i) => <Input id={i} value={f.fac} onChange={set("fac")} />}</Field>
        {role === "SYSTEM_ADMIN" && <Field label="Shelter manager">{(i) => <Select id={i} value={f.mgr} onChange={set("mgr")}><option value="">Unassigned</option>{managers.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>}</Field>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Register</Button></div>
      </form>
    </Modal>
  );
}

export function SheltersClient() {
  const router = useRouter();
  const me = useApi<{ user: { role: RoleName } }>("/api/auth/me");
  const role = me.data?.user.role;
  const [reg, setReg] = useState(false);
  const canRegister = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "SHELTER_MANAGER";
  const canFind = role && role !== "SHELTER_MANAGER";
  const columns: Col<ShelterRow>[] = [
    { key: "name", header: "Shelter", render: (r) => <div className="min-w-40"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-500">{r.location}</div></div> },
    { key: "cap", header: "Occupancy", render: (r) => <CapacityBar occupancy={r.occupancy} total={r.totalCapacity} /> },
    { key: "avail", header: "Available", className: "text-right tabular-nums", render: (r) => fmt(r.availableCapacity) },
    { key: "st", header: "Status", render: (r) => <Badge value={r.status} /> },
    { key: "fac", header: "Facilities", render: (r) => <div className="flex max-w-60 flex-wrap gap-1">{r.facilities.slice(0, 4).map((x) => <span key={x} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{x}</span>)}{r.facilities.length > 4 && <span className="text-xs text-slate-500">+{r.facilities.length - 4}</span>}</div> },
    { key: "mgr", header: "Manager", render: (r) => r.manager?.name ?? <span className="text-slate-400">Unassigned</span> },
  ];
  return (
    <>
      <PageHeader title="Shelters" subtitle="Capacity, occupancy and facilities across all emergency shelters." actions={canRegister && <Button onClick={() => setReg(true)}><Plus className="h-4 w-4" aria-hidden />Register shelter</Button>} />
      {canFind && <div className="mb-5"><NearestFinder /></div>}
      <ListView<ShelterRow> endpoint="/api/shelters" columns={columns} filters={FILTERS} exportEntity={role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" ? "shelters" : undefined} onRow={(r) => router.push(`/shelters/${r.id}`)} extraParams={role === "SHELTER_MANAGER" ? { mine: "1" } : undefined} />
      {reg && role && <RegisterModal role={role} onClose={() => setReg(false)} />}
    </>
  );
}
