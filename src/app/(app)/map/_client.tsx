"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Badge, Button, Card, ErrorState, PageHeader, Select, Spinner } from "@/components/ui";
import { api, fmt, useApi, type Paged } from "@/lib/client";
import { label } from "@/lib/constants";
import type { MapIncident, MapRequest, MapShelter, Nearest, Pin } from "./_map";
import { PRIORITY_COLOR } from "./_colors";

const LeafletMap = dynamic(() => import("./_map"), { ssr: false, loading: () => <div className="grid h-[28rem] place-items-center"><Spinner text="Loading map…" /></div> });

export function MapClient() {
  const me = useApi<{ user: { role: string } }>("/api/auth/me");
  const role = me.data?.user.role;
  const canReq = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "RELIEF_ORGANIZATION";
  const canShelters = role !== "VOLUNTEER";
  const inc = useApi<Paged<MapIncident>>("/api/incidents?open=1&pageSize=100", 20000);
  const sh = useApi<Paged<MapShelter>>(role && canShelters ? "/api/shelters?pageSize=100" : null, 20000);
  const rq = useApi<Paged<MapRequest>>(role && canReq ? "/api/requests?status=VERIFIED&pageSize=100" : null, 20000);
  const [layers, setLayers] = useState({ incidents: true, shelters: true, requests: true });
  const [prio, setPrio] = useState("");
  const [pin, setPin] = useState<Pin | null>(null); const [near, setNear] = useState<Nearest[] | null>(null); const [nErr, setNErr] = useState<string>();

  const lvl = (i: MapIncident) => i.priorityOverride ?? i.priorityLevel;
  const incidents = layers.incidents ? (inc.data?.data ?? []).filter((i) => !prio || lvl(i) === prio) : [];
  const shelters = layers.shelters ? (sh.data?.data ?? []) : [];
  const requests = layers.requests ? (rq.data?.data ?? []).filter((r) => !prio || r.priorityLevel === prio) : [];

  async function pick(p: Pin) {
    setPin(p); setNErr(undefined); setNear(null);
    if (!canShelters || role === "VOLUNTEER") return;
    try { setNear(await api<Nearest[]>(`/api/shelters/nearest?lat=${p.lat}&lng=${p.lng}&people=1`)); } catch (e) { setNErr(e instanceof Error ? e.message : "Lookup failed"); }
  }
  const locate = () => navigator.geolocation?.getCurrentPosition((g) => pick({ lat: g.coords.latitude, lng: g.coords.longitude }), () => setNErr("Could not get your location."), { timeout: 10000 });

  if (inc.error) return <ErrorState error={inc.error} retry={() => inc.mutate()} />;
  return (
    <>
      <PageHeader title="Map view" subtitle="Live incidents, shelters and verified requests. Click the map to find the nearest shelter with space." />
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        {([["incidents", "Incidents"], ["shelters", "Shelters"], ["requests", "Requests"]] as const).filter(([k]) => (k === "requests" ? canReq : k === "shelters" ? canShelters : true)).map(([k, l]) => (
          <label key={k} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />{l}</label>
        ))}
        <Select aria-label="Filter by priority" value={prio} onChange={(e) => setPrio(e.target.value)} className="w-auto!"><option value="">All priorities</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{label(p)}</option>)}</Select>
        {canShelters && <Button variant="secondary" size="sm" onClick={locate}><LocateFixed className="h-3.5 w-3.5" aria-hidden />Nearest shelter to me</Button>}
        <ul className="ml-auto flex flex-wrap gap-3 text-xs" aria-label="Legend">{Object.entries(PRIORITY_COLOR).map(([k, c]) => <li key={k} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} aria-hidden />{label(k)}</li>)}<li className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-[#2a78d6]" aria-hidden />Shelter</li></ul>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"><LeafletMap incidents={incidents} shelters={shelters} requests={requests} pin={pin} nearest={near?.[0] ?? null} onPick={pick} /></div>
      {pin && canShelters && (
        <Card title="Nearest available shelters" className="mt-4">
          {nErr ? <p role="alert" className="text-sm text-red-600">{nErr}</p> : !near ? <Spinner /> : !near.length ? <p className="text-sm text-slate-500">No open shelter has free places.</p> : (
            <ol className="space-y-1.5 text-sm">{near.map((s, i) => <li key={s.id}>{i + 1}. <Link className="font-semibold link" href={`/shelters/${s.id}`}>{s.name}</Link> · {s.distanceKm} km{i === 0 && <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">(recommended, shown on map)</span>}</li>)}</ol>
          )}
        </Card>
      )}
      <Card title={`Open incidents (${incidents.length})`} className="mt-4">
        {inc.isLoading ? <Spinner /> : !incidents.length ? <p className="text-sm text-slate-500">No incidents match the current filters.</p> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">{incidents.slice(0, 30).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm"><Link className="font-medium hover:underline" href={`/incidents/${i.id}`}>{i.title}</Link><span className="flex items-center gap-2"><span className="text-xs text-slate-500">{fmt(i.affectedPopulation)} affected · {label(i.category)}</span><Badge value={lvl(i)} /></span></li>
          ))}</ul>
        )}
      </Card>
    </>
  );
}
