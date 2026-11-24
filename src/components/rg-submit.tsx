"use client";
import { useCallback, useState } from "react";
import { ApiErr } from "@/lib/client";
import { useToast } from "./ui";

/** Form submit helper: tracks busy state, keeps the server error (banner + per-field details) and toasts success. */
export function useSubmit() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{ path: string; message: string }[]>([]);
  const run = useCallback(async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(true); setError(null); setDetails([]);
    try { await fn(); if (success) toast.ok(success); return true; }
    catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      if (e instanceof ApiErr && Array.isArray(e.details)) setDetails(e.details as { path: string; message: string }[]);
      return false;
    } finally { setBusy(false); }
  }, [toast]);
  const reset = useCallback(() => { setError(null); setDetails([]); }, []);
  const fieldError = (path: string) => details.find((d) => d.path === path)?.message;
  return { busy, error, run, reset, fieldError };
}

export function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{message}</p> : null;
}
