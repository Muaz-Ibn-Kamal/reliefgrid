"use client";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import Link from "next/link";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { label } from "@/lib/constants";
import { PRIORITY_COLOR } from "./_colors";

export type MapIncident = { id: string; title: string; category: string; latitude: number; longitude: number; priorityLevel: string; priorityOverride: string | null; affectedPopulation: number; status: string };
export type MapShelter = { id: string; name: string; latitude: number; longitude: number; occupancy: number; totalCapacity: number; availableCapacity: number; status: string };
export type MapRequest = { id: string; type: string; location: string; latitude: number; longitude: number; priorityLevel: string; quantity: number; unit: string };
export type Pin = { lat: number; lng: number };
export type Nearest = { id: string; name: string; latitude: number; longitude: number; distanceKm: number };


function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fit to the data once on mount; later polls must not move the user's view
  useEffect(() => { if (points.length) map.fitBounds(points, { padding: [30, 30], maxZoom: 9 }); }, [map]);
  return null;
}
function Clicks({ onPick }: { onPick: (p: Pin) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export default function LeafletMap({ incidents, shelters, requests, pin, nearest, onPick }: {
  incidents: MapIncident[]; shelters: MapShelter[]; requests: MapRequest[]; pin: Pin | null; nearest: Nearest | null; onPick: (p: Pin) => void;
}) {
  const pts: [number, number][] = [...incidents.map((i) => [i.latitude, i.longitude] as [number, number]), ...shelters.map((s) => [s.latitude, s.longitude] as [number, number])];
  return (
    <MapContainer center={[23.8, 90.4]} zoom={6} scrollWheelZoom className="h-[28rem] w-full lg:h-[34rem]" aria-label="Map of incidents, shelters and requests">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={pts} />
      <Clicks onPick={onPick} />
      {requests.map((r) => (
        <CircleMarker key={`r${r.id}`} center={[r.latitude, r.longitude]} radius={4} pathOptions={{ color: "#444", weight: 1, fillColor: PRIORITY_COLOR[r.priorityLevel], fillOpacity: 0.7 }}>
          <Popup><b>{label(r.type)} request</b><br />{r.quantity.toLocaleString()} {r.unit} · {label(r.priorityLevel)}<br />{r.location}<br /><Link href="/requests">Open requests</Link></Popup>
        </CircleMarker>
      ))}
      {incidents.map((i) => { const lvl = i.priorityOverride ?? i.priorityLevel; return (
        <CircleMarker key={`i${i.id}`} center={[i.latitude, i.longitude]} radius={lvl === "CRITICAL" ? 13 : lvl === "HIGH" ? 11 : 9} pathOptions={{ color: "#111", weight: 2, fillColor: PRIORITY_COLOR[lvl], fillOpacity: 0.85 }}>
          <Popup><b>{i.title}</b><br />{label(i.category)} · {label(lvl)} · {label(i.status)}<br />{i.affectedPopulation.toLocaleString()} affected<br /><Link href={`/incidents/${i.id}`}>View incident</Link></Popup>
        </CircleMarker>); })}
      {shelters.map((s) => (
        <CircleMarker key={`s${s.id}`} center={[s.latitude, s.longitude]} radius={8} pathOptions={{ color: "#fff", weight: 2, fillColor: s.status === "OPEN" && s.availableCapacity > 0 ? "#2563eb" : "#64748b", fillOpacity: 0.95 }}>
          <Popup><b>{s.name}</b><br />{s.occupancy.toLocaleString()} / {s.totalCapacity.toLocaleString()} occupied<br />{s.availableCapacity.toLocaleString()} places free · {label(s.status)}<br /><Link href={`/shelters/${s.id}`}>View shelter</Link></Popup>
        </CircleMarker>
      ))}
      {pin && <CircleMarker center={[pin.lat, pin.lng]} radius={6} pathOptions={{ color: "#7c3aed", weight: 3, fillColor: "#fff", fillOpacity: 1 }}><Popup>Selected point</Popup></CircleMarker>}
      {pin && nearest && <Polyline positions={[[pin.lat, pin.lng], [nearest.latitude, nearest.longitude]]} pathOptions={{ color: "#7c3aed", weight: 3, dashArray: "6 6" }} />}
    </MapContainer>
  );
}
