"use client";
import { ago, dt } from "@/lib/client";
import { label } from "@/lib/constants";

export type ActivityRow = { id: string; action: string; details: unknown; createdAt: string; user?: { name: string } | null };

const summarize = (d: unknown): string => {
  if (!d || typeof d !== "object") return "";
  return Object.entries(d as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${label(k.replace(/([A-Z])/g, "_$1"))}: ${String(v)}`)
    .join(" · ");
};

/** Read-only audit timeline (newest first). */
export function ActivityTimeline({ rows }: { rows: ActivityRow[] }) {
  if (!rows.length) return <p className="py-4 text-center text-sm text-slate-500">No history recorded yet.</p>;
  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="relative border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm"><span className="font-semibold">{label(r.action)}</span><span className="text-xs text-slate-500" title={dt(r.createdAt)}>{ago(r.createdAt)} · {r.user?.name ?? "System"}</span></div>
          {summarize(r.details) && <p className="break-words text-xs text-slate-600 dark:text-slate-400">{summarize(r.details)}</p>}
        </li>
      ))}
    </ol>
  );
}
