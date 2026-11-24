"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { RequestForm } from "@/components/request-form";

export function HelpClient() {
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [key, setKey] = useState(0);
  if (done) return (
    <div role="status" className="space-y-3 py-6 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
      <h2 className="text-xl font-bold">Request received</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">Reference: <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{done.id}</code></p>
      <p className="text-sm">A coordinator will verify it shortly. Keep your phone nearby if you left contact details.</p>
      <Button variant="secondary" onClick={() => { setDone(null); setKey((k) => k + 1); }}>Submit another request</Button>
    </div>
  );
  return <RequestForm key={key} mode="public" onDone={setDone} />;
}
