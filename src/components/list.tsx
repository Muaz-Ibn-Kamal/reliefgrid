"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { useApi, type Paged } from "@/lib/client";
import { Button, EmptyState, ErrorState, Input, Select, Spinner, cx } from "./ui";

export type Col<T> = { key: string; header: string; render: (row: T) => ReactNode; className?: string };
export type FilterDef = { key: string; label: string; options?: { value: string; label: string }[]; type?: "search" };

/**
 * Server-side paginated, filterable table with loading / error / empty states and polling.
 * `rowAccent` returns a CSS color for a thin rail at the start of the row (used for priority).
 */
export function ListView<T extends { id: string }>({ endpoint, columns, filters = [], refreshMs = 30000, exportEntity, defaults = {}, onRow, extraParams, rowClass, rowAccent, toolbar }: {
  endpoint: string; columns: Col<T>[]; filters?: FilterDef[]; refreshMs?: number; exportEntity?: string; defaults?: Record<string, string>;
  onRow?: (r: T) => void; extraParams?: Record<string, string>; rowClass?: (r: T) => string | undefined; rowAccent?: (r: T) => string | undefined; toolbar?: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [vals, setVals] = useState<Record<string, string>>(defaults);
  const [draftQ, setDraftQ] = useState<Record<string, string>>({});
  const qs = new URLSearchParams({ page: String(page), pageSize: "15", ...extraParams });
  for (const [k, v] of Object.entries(vals)) if (v) qs.set(k, v);
  const { data, error, isLoading, mutate, isValidating } = useApi<Paged<T>>(`${endpoint}?${qs}`, refreshMs);
  const set = (k: string, v: string) => { setVals((p) => ({ ...p, [k]: v })); setPage(1); };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => f.type === "search" ? (
          <form key={f.key} role="search" onSubmit={(e) => { e.preventDefault(); set(f.key, draftQ[f.key] ?? ""); }} className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input aria-label={f.label} placeholder={f.label} className="h-9 py-0 pl-8" value={draftQ[f.key] ?? vals[f.key] ?? ""} onChange={(e) => setDraftQ((p) => ({ ...p, [f.key]: e.target.value }))} onBlur={() => (draftQ[f.key] ?? "") !== (vals[f.key] ?? "") && draftQ[f.key] !== undefined && set(f.key, draftQ[f.key])} />
          </form>
        ) : (
          <Select key={f.key} aria-label={f.label} value={vals[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className="h-9 w-auto! min-w-36 py-0">
            <option value="">{f.label}: All</option>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {isValidating && !isLoading && <span className="text-xs text-slate-400" aria-live="polite">Updating…</span>}
          {toolbar}
          {exportEntity && <a href={`/api/export/${exportEntity}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"><Download className="h-4 w-4" aria-hidden />CSV</a>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : !data?.data.length ? <EmptyState title="No records match" hint="Change or clear the filters to see more." /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>{columns.map((c) => <th key={c.key} scope="col" className={cx("px-4 py-2.5 font-medium", c.className)}>{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {data.data.map((r) => {
                const rail = rowAccent?.(r);
                return (
                  <tr key={r.id} onClick={onRow ? () => onRow(r) : undefined} className={cx("border-b border-slate-100 last:border-0 dark:border-slate-800", onRow && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50", rowClass?.(r))}>
                    {columns.map((c, i) => (
                      <td key={c.key} className={cx("px-4 py-3 align-top", c.className)} style={i === 0 && rail ? { boxShadow: `inset 3px 0 0 ${rail}` } : undefined}>{c.render(r)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.meta.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">{(data.meta.page - 1) * data.meta.pageSize + 1}–{Math.min(data.meta.page * data.meta.pageSize, data.meta.total)} of {data.meta.total.toLocaleString()}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="px-1 tabular-nums">Page {data.meta.page} of {data.meta.totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </nav>
      )}
      <RefetchHook mutate={mutate} />
    </div>
  );
}
// Lets pages trigger a refresh after a mutation via a window event.
function RefetchHook({ mutate }: { mutate: () => unknown }) {
  // Wrap: passing SWR's mutate straight to addEventListener would hand it the DOM Event as "new data".
  const refetch = useCallback(() => { void mutate(); }, [mutate]);
  useWindowEvent("rg:refresh", refetch);
  return null;
}
function useWindowEvent(name: string, fn: () => void) {
  useEffect(() => { window.addEventListener(name, fn); return () => window.removeEventListener(name, fn); }, [name, fn]);
}
export const refreshLists = () => window.dispatchEvent(new Event("rg:refresh"));
