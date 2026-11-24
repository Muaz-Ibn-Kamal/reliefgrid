"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, Input, Logo } from "@/components/ui";

const DEMO = [
  { role: "System Admin", email: "admin@reliefgrid.demo" },
  { role: "Emergency Coordinator", email: "coordinator@reliefgrid.demo" },
  { role: "Relief Organization", email: "org@reliefgrid.demo" },
  { role: "Volunteer", email: "volunteer@reliefgrid.demo" },
  { role: "Shelter Manager", email: "shelter@reliefgrid.demo" },
];
const DEMO_PASSWORD = "ReliefGrid@2026";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined);
    try { await api("/api/auth/login", { json: { email, password } }); router.replace("/dashboard"); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed"); setBusy(false); }
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight"><Logo />ReliefGrid</div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em]">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Coordinate incidents, relief stock, shelters and volunteers.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Button type="submit" busy={busy} className="w-full">Sign in</Button>
        </form>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">New volunteer? <Link href="/register" className="font-medium link">Create an account</Link></p>

        <section aria-labelledby="demo-heading" className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 id="demo-heading" className="text-sm font-semibold">Demo accounts</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Choose a role to fill in its credentials. Password for all: <code className="font-medium text-slate-700 dark:text-slate-300">{DEMO_PASSWORD}</code></p>
          <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); }}>
                  <span className="text-sm font-medium">{d.role}</span><span className="truncate text-xs text-slate-500 dark:text-slate-400">{d.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Need help during an emergency? <Link href="/help" className="font-medium link">Request assistance</Link> without an account.</p>
      </div>
    </main>
  );
}
