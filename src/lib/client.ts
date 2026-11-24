"use client";
import useSWR, { type SWRConfiguration } from "swr";
import { isActive } from "./presence";

export class ApiErr extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function api<T = unknown>(url: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? (opts.json || opts.form ? "POST" : "GET"),
    headers: opts.json ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.json ? JSON.stringify(opts.json) : undefined),
  });
  const text = await res.text();
  type ErrBody = { error?: string; details?: unknown };
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const body: ErrBody = typeof data === "object" && data ? (data as ErrBody) : {};
    const d0 = Array.isArray(body.details) ? (body.details[0] as { path?: string; message?: string } | undefined) : undefined;
    const first = d0?.message ? ` — ${d0.path}: ${d0.message}` : "";
    throw new ApiErr(res.status, (body.error ?? res.statusText) + first, body.details);
  }
  return data as T;
}

/**
 * SWR with a polling interval gives near-real-time status updates across users. Polling and focus revalidation pause
 * while the tab is hidden or idle (see presence.ts).
 */
export function useApi<T>(url: string | null, refreshMs = 0, cfg: SWRConfiguration = {}) {
  return useSWR<T, ApiErr>(url, (u: string) => api<T>(u), { refreshInterval: refreshMs, keepPreviousData: true, revalidateOnFocus: true, isVisible: isActive, ...cfg });
}

export type Paged<T> = { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString();
export const ago = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const dt = (d: string | Date) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
