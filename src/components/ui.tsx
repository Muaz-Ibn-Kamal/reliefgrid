"use client";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, X } from "lucide-react";
import { label } from "@/lib/constants";
import { api } from "@/lib/client";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

/* ------------------------------------------------------------ Badge */
const TONES: Record<string, string> = {
  CRITICAL: "bg-red-600 text-white", HIGH: "bg-orange-500 text-white", MEDIUM: "bg-amber-400 text-slate-900", LOW: "bg-emerald-600 text-white",
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200", REPORTED: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  VERIFIED: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200", IN_PROGRESS: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
  ASSIGNED: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200", ALLOCATED: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
  IN_TRANSIT: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  COMPLETED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200", DELIVERED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  RESOLVED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200", OPEN: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  AVAILABLE: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200", DEPLOYED: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200",
  FULL: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200", REJECTED: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200", CANCELLED: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  CLOSED: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200", UNAVAILABLE: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200", STANDBY: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
export function Badge({ value, text }: { value: string; text?: string }) {
  return <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[value] ?? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200")}>{text ?? label(value)}</span>;
}

/* ------------------------------------------------------------ layout bits */
export const Card = ({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={cx("rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
    {(title || action) && <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800"><h2 className="text-sm font-semibold">{title}</h2>{action}</header>}
    <div className="p-4">{children}</div>
  </section>
);
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
    <div className="flex flex-wrap gap-2">{actions}</div>
  </div>
);
export function Stat({ label: l, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "amber" | "green" | "blue" }) {
  const c = { red: "text-red-600", amber: "text-amber-600", green: "text-emerald-600", blue: "text-sky-600" }[tone ?? "blue"];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{l}</div>
      <div className={cx("mt-1 text-2xl font-bold tabular-nums", c)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------ buttons & fields */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost"; busy?: boolean; size?: "sm" | "md" };
export function Button({ variant = "primary", busy, size = "md", className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-orange-700 text-white hover:bg-orange-800 disabled:bg-orange-300",
    secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
    ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
  }[variant];
  return (
    <button {...p} disabled={disabled || busy} className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-70", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm", v, className)}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}{children}
    </button>
  );
}
const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900";
export function Field({ label: l, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{l}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;

/* ------------------------------------------------------------ states */
export const Spinner = ({ text = "Loading…" }: { text?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>
);
export const EmptyState = ({ title = "Nothing here yet", hint }: { title?: string; hint?: string }) => (
  <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500"><Inbox className="h-8 w-8" aria-hidden /><p className="font-medium text-slate-700 dark:text-slate-300">{title}</p>{hint && <p className="text-sm">{hint}</p>}</div>
);
export const ErrorState = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center"><AlertTriangle className="h-8 w-8 text-red-500" aria-hidden /><p className="font-medium text-red-700 dark:text-red-400">{error.message || "Something went wrong"}</p>{retry && <Button variant="secondary" size="sm" onClick={retry}>Try again</Button>}</div>
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx("w-full rounded-xl bg-white shadow-xl dark:bg-slate-900", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800"><h2 className="font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
        <div className="p-5">{children}</div>
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
          <div key={t.id} className={cx("flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm text-white shadow-lg", t.kind === "ok" ? "bg-emerald-700" : "bg-red-700")}>
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{t.msg}</span>
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
      <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload photograph" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 dark:file:bg-slate-800"
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const fd = new FormData(); fd.append("file", f);
          const r = await run(() => api<{ url: string }>("/api/upload", { form: fd }));
          if (r) onChange(r.url);
        }} />
      {busy && <p className="text-xs text-slate-500">Uploading…</p>}
      {value && (<div className="flex items-center gap-3"><img src={value} alt="Uploaded preview" className="h-20 w-28 rounded-lg object-cover" /><Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>Remove</Button></div>)}
    </div>
  );
}
