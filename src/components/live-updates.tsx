"use client";
import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
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

/**
 * Subscribes to /api/events and revalidates only the SWR keys affected by each change, so every open page reflects
 * other users' actions within seconds. Renders a small connection indicator. Polling stays on as a fallback.
 */
export function LiveUpdates() {
  const { mutate } = useSWRConfig();
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");
  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setState("live");
    es.onerror = () => setState("offline"); // the browser retries automatically
    es.addEventListener("change", (e) => {
      let entities: string[] = [];
      try { entities = (JSON.parse((e as MessageEvent<string>).data) as { entities: string[] }).entities; } catch { return; }
      const prefixes = new Set(ALWAYS);
      for (const ent of entities) (DEPENDS[ent] ?? ["/api/"]).forEach((p) => prefixes.add(p));
      void mutate((key) => typeof key === "string" && key !== "/api/auth/me" && [...prefixes].some((p) => key.startsWith(p)));
    });
    return () => es.close();
  }, [mutate]);
  const text = state === "live" ? "Live" : state === "connecting" ? "Connecting" : "Reconnecting";
  return (
    <span className="mr-2 hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex dark:text-slate-400" role="status" aria-live="polite" title={state === "live" ? "Receiving live updates" : "Live updates paused; pages still refresh periodically"}>
      <span className={cx("h-1.5 w-1.5 rounded-full", state === "live" ? "bg-triage-low" : state === "connecting" ? "bg-slate-400" : "bg-triage-medium")} aria-hidden />{text}
    </span>
  );
}
