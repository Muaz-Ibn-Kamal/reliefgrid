"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { AlertTriangle, Inbox, Loader2, X } from "lucide-react";
import { label } from "@/lib/constants";
import { api } from "@/lib/client";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ------------------------------------------------------------ brand */
/** An operations board with one cell that needs attention. */
export function Logo({ className }: { className?: string }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    cells.push(<rect key={`${r}${c}`} x={c * 6.5} y={r * 6.5} width="5" height="5" rx="1" className={r === 0 && c === 2 ? "fill-triage-critical" : "fill-current"} />);
  return <svg viewBox="0 0 18 18" className={cx("h-[18px] w-[18px]", className)} aria-hidden>{cells}</svg>;
}

/* ------------------------------------------------------------ badges: squares carry priority, dots carry state */
const PRIORITY: Record<string, string> = { CRITICAL: "bg-triage-critical", HIGH: "bg-triage-high", MEDIUM: "bg-triage-medium", LOW: "bg-triage-low" };
const STATE: Record<string, string> = {
  PENDING: "bg-triage-medium", REPORTED: "bg-triage-medium",
  VERIFIED: "bg-signal-info", ASSIGNED: "bg-signal-info", ALLOCATED: "bg-signal-info", IN_PROGRESS: "bg-signal-info", IN_TRANSIT: "bg-signal-info", DEPLOYED: "bg-signal-info",
  COMPLETED: "bg-triage-low", DELIVERED: "bg-triage-low", RESOLVED: "bg-triage-low", OPEN: "bg-triage-low", AVAILABLE: "bg-triage-low",
  FULL: "bg-triage-critical", REJECTED: "bg-triage-critical",
  CANCELLED: "bg-slate-400", CLOSED: "bg-slate-400", UNAVAILABLE: "bg-slate-400", STANDBY: "bg-slate-400",
};
export function Badge({ value, text }: { value: string; text?: string }) {
  const priority = PRIORITY[value];
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", priority ? "font-semibold text-slate-900 dark:text-slate-100" : "font-medium text-slate-600 dark:text-slate-300")}>
      <span aria-hidden className={cx("shrink-0", priority ? "h-2.5 w-2.5 rounded-[2px]" : "h-1.5 w-1.5 rounded-full", priority ?? STATE[value] ?? "bg-slate-400")} />
      {text ?? label(value)}
    </span>
  );
}
/** CSS color for the thin priority rail at the start of a table row. */
export const priorityRail = (level?: string | null) => (level && PRIORITY[level] ? `var(--color-triage-${level.toLowerCase()})` : undefined);

/* ------------------------------------------------------------ layout */
export const Card = ({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={cx("rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900", className)}>
    {(title || action) && <header className="flex items-center justify-between gap-3 px-5 pt-4"><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>{action}</header>}
    <div className={title || action ? "px-5 pb-5 pt-3" : "p-5"}>{children}</div>
  </section>
);
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em]">{title}</h1>
      {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">{actions}</div>
  </div>
);
/** Key figures share one hairline grid instead of a row of separate cards. */
export const StatGrid = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx("grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800", className)}>{children}</div>
);
export function Stat({ label: l, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "amber" | "green" | "blue" }) {
  const marker = tone && { red: "bg-triage-critical", amber: "bg-triage-medium", green: "bg-triage-low", blue: "bg-signal-info" }[tone];
  return (
    <div className="bg-white px-5 py-4 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">{marker && <span aria-hidden className={cx("h-2 w-2 rounded-[2px]", marker)} />}{l}</div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ buttons & fields */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; busy?: boolean; size?: "sm" | "md" };
export function Button({ variant = "primary", busy, size = "md", className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
  }[variant];
  return (
    <button {...p} disabled={disabled || busy} className={cx("inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm", v, className)}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}{children}
    </button>
  );
}
const inputCls = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-300 dark:disabled:bg-slate-800";
export function Field({ label: l, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-700 dark:text-slate-300">{l}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, "pr-8", p.className)} />;

/* ------------------------------------------------------------ states */
export const Spinner = ({ text = "Loading…" }: { text?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{text}</div>
);
export const EmptyState = ({ title = "Nothing here yet", hint }: { title?: string; hint?: string }) => (
  <div className="flex flex-col items-center gap-1.5 py-12 text-center"><Inbox className="mb-1 h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden /><p className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>{hint && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{hint}</p>}</div>
);
export const ErrorState = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center"><AlertTriangle className="h-6 w-6 text-red-600" aria-hidden /><p className="max-w-md text-sm font-medium text-slate-800 dark:text-slate-200">{error.message || "The request failed."}</p>{retry && <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>}</div>
);

/* ------------------------------------------------------------ modal */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4 sm:p-10" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx("w-full rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4"><h2 className="text-base font-semibold tracking-tight">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"><X className="h-4 w-4" /></button></div>
        <div className="px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ toast */
type Toast = { id: number; kind: "ok" | "err"; msg: string };
const ToastCtx = createContext<{ ok: (m: string) => void; err: (m: string) => void }>({ ok() {}, err() {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], msg: string) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, kind, msg }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={{ ok: (m) => push("ok", m), err: (m) => push("err", m) }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "err" ? "alert" : "status"} className="flex items-start gap-2.5 rounded-md bg-slate-900 px-3.5 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            <span aria-hidden className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-[2px]", t.kind === "ok" ? "bg-triage-low" : "bg-triage-critical")} /><span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------ mutation helper */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    try { const r = await fn(); if (success) toast.ok(success); return r; }
    catch (e) { toast.err(e instanceof Error ? e.message : "Action failed"); return undefined; }
    finally { setBusy(false); }
  }, [toast]);
  return { busy, run };
}

/* ------------------------------------------------------------ image upload */
export function ImageUpload({ value, onChange }: { value?: string; onChange: (url?: string) => void }) {
  const { busy, run } = useAction();
  return (
    <div className="space-y-2">
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload photograph" className="block w-full text-sm text-slate-600 file:mr-3 file:h-8 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-50 dark:text-slate-300 dark:file:border-slate-700 dark:file:bg-slate-900 dark:file:text-slate-100"
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const fd = new FormData(); fd.append("file", f);
          const r = await run(() => api<{ url: string }>("/api/upload", { form: fd }));
          if (r) onChange(r.url);
        }} />
      {busy && <p className="text-xs text-slate-500">Uploading…</p>}
      {value && (<div className="flex items-center gap-3"><img src={value} alt="Uploaded preview" className="h-20 w-28 rounded-md border border-slate-200 object-cover dark:border-slate-700" /><Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>Remove</Button></div>)}
    </div>
  );
}
