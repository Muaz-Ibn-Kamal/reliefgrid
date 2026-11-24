"use client"; // Error boundaries must be Client Components
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";

/** Catches rendering errors inside any authenticated page; the shell (navigation) stays usable. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-red-200 bg-white p-6 text-center dark:border-red-900 dark:bg-slate-900">
      <AlertTriangle className="mx-auto h-10 w-10 text-red-600" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">This view hit an unexpected error</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your data is safe: every change is validated and saved on the server. Try again, or return to the dashboard.</p>
      <div className="mt-4 flex justify-center gap-2"><Button onClick={() => retry()}>Try again</Button><Link href="/dashboard"><Button variant="secondary">Dashboard</Button></Link></div>
    </div>
  );
}
