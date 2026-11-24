"use client";
import { cx } from "./ui";

/** Occupancy bar with text alternative; turns amber >= 80% and red >= 95%. */
export function CapacityBar({ occupancy, total }: { occupancy: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((occupancy / total) * 100)) : 0;
  return (
    <div className="min-w-32">
      <div className="mb-0.5 flex justify-between text-xs tabular-nums"><span>{occupancy.toLocaleString()} / {total.toLocaleString()}</span><span>{pct}%</span></div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Shelter occupancy" className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cx("h-full rounded-full", pct >= 95 ? "bg-triage-critical" : pct >= 80 ? "bg-triage-medium" : "bg-triage-low")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
