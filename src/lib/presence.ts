"use client";

/**
 * Tracks whether this tab is in active use. Live updates (SSE) and SWR polling pause while the tab is hidden or the
 * user has been idle for IDLE_MS, so a forgotten tab stops holding a serverless function open and keeping the
 * database awake. Any input, or coming back to the tab, resumes them.
 */
const IDLE_MS = 10 * 60_000;

let lastInput = Date.now();
const subscribers = new Set<(active: boolean) => void>();

export function isActive(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden" && Date.now() - lastInput < IDLE_MS;
}

let active = isActive();

function update() {
  const next = isActive();
  if (next === active) return;
  active = next;
  subscribers.forEach((fn) => fn(next));
}

function touch() {
  lastInput = Date.now();
  update();
}

if (typeof window !== "undefined") {
  // Capture phase, so this runs before SWR's own focus and visibility listeners, which consult isActive().
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll", "focus"]) {
    window.addEventListener(type, touch, opts);
  }
  document.addEventListener("visibilitychange", () => (document.visibilityState === "visible" ? touch() : update()), opts);
  setInterval(update, 30_000);
}

/** Calls `fn` whenever the tab switches between active and inactive. Returns an unsubscribe function. */
export function onActiveChange(fn: (active: boolean) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
