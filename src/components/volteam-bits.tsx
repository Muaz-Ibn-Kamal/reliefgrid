"use client";
import { MapPin } from "lucide-react";
import { ApiErr } from "@/lib/client";

/** Per-field server validation message from an ApiErr (zod details: [{path,message}]). */
export function fieldErr(e: unknown, path: string): string | undefined {
  if (!(e instanceof ApiErr) || !Array.isArray(e.details)) return undefined;
  const d = (e.details as { path?: string | (string | number)[]; message?: string }[]).find((x) => (Array.isArray(x.path) ? x.path.join(".") : x.path) === path);
  return d?.message;
}

/** OpenStreetMap link with coordinates. */
export function MapLink({ lat, lng, text }: { lat: number; lng: number; text?: string }) {
  return (
    <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-700 underline-offset-2 hover:underline dark:text-sky-400">
      <MapPin className="h-3.5 w-3.5" aria-hidden />{text ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`}<span className="sr-only"> (opens OpenStreetMap)</span>
    </a>
  );
}

export const SkillChips = ({ skills }: { skills: string[] }) => (
  <div className="flex flex-wrap gap-1">{skills.length ? skills.map((s) => <span key={s} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{s}</span>) : <span className="text-xs text-slate-400">none</span>}</div>
);
