"use client";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { isActive, onActiveChange } from "@/lib/presence";
import { cx } from "./ui";

/** Which cached API responses depend on which entity types (see logActivity entityType values). */
const DEPENDS: Record<string, string[]> = {
  Incident: ["/api/incidents", "/api/analytics", "/api/lookups", "/api/teams", "/api/tasks"],
  EmergencyRequest: ["/api/requests", "/api/incidents", "/api/analytics", "/api/lookups", "/api/allocations"],
  Allocation: ["/api/allocations", "/api/resources", "/api/requests", "/api/analytics", "/api/lookups"],
  Resource: ["/api/resources", "/api/analytics"],
  Shelter: ["/api/shelters", "/api/analytics"],
  Task: ["/api/tasks", "/api/volunteers", "/api/incidents", "/api/analytics", "/api/teams"],
  Team: ["/api/teams", "/api/volunteers", "/api/tasks", "/api/incidents"],
  User: ["/api/users", "/api/volunteers", "/api/lookups"],
  Organization: ["/api/organizations", "/api/users", "/api/lookups"],
};
const ALWAYS = ["/api/notifications", "/api/activity"];

type State = "connecting" | "live" | "offline" | "paused";
const LABEL: Record<State, string> = { connecting: "Connecting", live: "Live", offline: "Reconnecting", paused: "Paused" };
const TITLE: Record<State, string> = {
  connecting: "Connecting to live updates",
  live: "Receiving live updates",
  offline: "Live updates interrupted; reconnecting automatically",
  paused: "Live updates pause while this tab is idle or hidden, and resume when you're back",
};
const DOT: Record<State, string> = {
  connecting: "bg-slate-400",
  live: "bg-triage-low",
  offline: "bg-triage-medium",
  paused: "bg-slate-300 dark:bg-slate-600",
};

/**
 * Subscribes to /api/events and revalidates only the SWR keys affected by each change, so every open page reflects
 * other users' actions within seconds. The stream closes while the tab is hidden or idle and catches up on return.
 * Renders a small connection indicator. Polling stays on as a fallback.
 */
export function LiveUpdates() {
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<State>("connecting");
  useEffect(() => {
    let es: EventSource | null = null;
    const onChange = (e: Event) => {
      let entities: string[] = [];
      try { entities = (JSON.parse((e as MessageEvent<string>).data) as { entities: string[] }).entities; } catch { return; }
      const prefixes = new Set(ALWAYS);
      for (const ent of entities) (DEPENDS[ent] ?? ["/api/"]).forEach((p) => prefixes.add(p));
      void mutate((key) => typeof key === "string" && key !== "/api/auth/me" && [...prefixes].some((p) => key.startsWith(p)));
    };
    const connect = () => {
      es = new EventSource("/api/events");
      es.onopen = () => setState("live");
      es.onerror = () => setState("offline"); // the browser retries automatically
      es.addEventListener("change", onChange);
    };
    const unsubscribe = onActiveChange((active) => {
      if (!active) {
        es?.close();
        es = null;
        setState("paused");
        return;
      }
      if (es) return;
      setState("connecting");
      connect();
      // Catch up on anything that changed while paused.
      void mutate((key) => typeof key === "string" && key.startsWith("/api/") && key !== "/api/auth/me");
    });
    if (isActive()) connect();
    return () => {
      unsubscribe();
      es?.close();
    };
  }, [mutate]);
  return (
    <span className="mr-2 hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex dark:text-slate-400" role="status" aria-live="polite" title={TITLE[state]}>
      <span className={cx("h-1.5 w-1.5 rounded-full", DOT[state])} aria-hidden />{LABEL[state]}
    </span>
  );
}
