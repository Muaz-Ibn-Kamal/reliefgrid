"use client";
import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { ApiErr } from "@/lib/client";
import { Button, Field, Input } from "./ui";

export const LEVEL5 = [
  { v: 1, t: "1 - Minor / low" }, { v: 2, t: "2 - Moderate" }, { v: 3, t: "3 - Serious" }, { v: 4, t: "4 - Severe" }, { v: 5, t: "5 - Catastrophic" },
];
export const URGENCY5 = [
  { v: 1, t: "1 - Can wait" }, { v: 2, t: "2 - Low" }, { v: 3, t: "3 - Normal" }, { v: 4, t: "4 - Urgent" }, { v: 5, t: "5 - Life-threatening" },
];
export const RISK5 = [
  { v: 1, t: "1 - Very low risk" }, { v: 2, t: "2 - Low" }, { v: 3, t: "3 - Moderate" }, { v: 4, t: "4 - High" }, { v: 5, t: "5 - Extreme" },
];
export const REQUEST_UNITS: Record<string, string> = { FOOD: "packages", WATER: "litres", MEDICAL: "kits", SHELTER: "people", RESCUE: "teams", TRANSPORT: "vehicles" };

/** Convert ApiErr.details ([{path,message}]) into a path -> message map. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiErr && Array.isArray(e.details)) for (const d of e.details as { path?: string; message?: string }[]) if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
  return out;
}

/** Parse a numeric text input; returns undefined for blank and NaN for garbage. */
export const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

export function validateGps(lat: string, lng: string): { latitude?: string; longitude?: string } {
  const e: { latitude?: string; longitude?: string } = {};
  const a = num(lat), b = num(lng);
  if (a === undefined || Number.isNaN(a)) e.latitude = "Latitude is required (number)";
  else if (a < -90 || a > 90) e.latitude = "Latitude must be between -90 and 90";
  if (b === undefined || Number.isNaN(b)) e.longitude = "Longitude is required (number)";
  else if (b < -180 || b > 180) e.longitude = "Longitude must be between -180 and 180";
  return e;
}

/** Latitude + longitude inputs with a "Use my location" button. */
export function GpsFields({ lat, lng, onChange, errors }: { lat: string; lng: string; onChange: (lat: string, lng: string) => void; errors: { latitude?: string; longitude?: string } }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const locate = () => {
    if (!navigator.geolocation) { setMsg("Geolocation is not supported by this browser."); return; }
    setBusy(true); setMsg(undefined);
    navigator.geolocation.getCurrentPosition(
      (p) => { onChange(p.coords.latitude.toFixed(5), p.coords.longitude.toFixed(5)); setBusy(false); },
      (err) => { setMsg(err.code === 1 ? "Location permission denied. Enter coordinates manually." : "Could not get your location. Enter coordinates manually."); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Latitude" error={errors.latitude} hint="-90 to 90">{(id) => <Input id={id} inputMode="decimal" value={lat} onChange={(e) => onChange(e.target.value, lng)} aria-invalid={!!errors.latitude} placeholder="23.8103" />}</Field>
        <Field label="Longitude" error={errors.longitude} hint="-180 to 180">{(id) => <Input id={id} inputMode="decimal" value={lng} onChange={(e) => onChange(lat, e.target.value)} aria-invalid={!!errors.longitude} placeholder="90.4125" />}</Field>
      </div>
      <Button type="button" variant="secondary" size="sm" busy={busy} onClick={locate}><LocateFixed className="h-3.5 w-3.5" aria-hidden />Use my location</Button>
      {msg && <p role="alert" className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
