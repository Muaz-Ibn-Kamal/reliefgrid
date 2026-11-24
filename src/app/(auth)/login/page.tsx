"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Button, Field, Input } from "@/components/ui";

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
    <main className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-orange-700 text-xl font-extrabold text-white">R</div><h1 className="text-2xl font-bold">Sign in to ReliefGrid</h1><p className="text-sm text-slate-500">Disaster response &amp; resource coordination</p></div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
          <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          <Button type="submit" busy={busy} className="w-full">Sign in</Button>
          <p className="text-center text-sm text-slate-500">Want to volunteer? <Link href="/register" className="font-medium text-orange-700 hover:underline dark:text-orange-400">Create an account</Link></p>
        </form>
        <section aria-label="Demo accounts" className="rounded-xl border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">
          <h2 className="mb-2 font-semibold">Demo accounts <span className="font-normal text-slate-500">(password: <code>{DEMO_PASSWORD}</code>)</span></h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {DEMO.map((d) => (<li key={d.email}><button type="button" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); }}><span className="block text-xs font-semibold">{d.role}</span><span className="block truncate text-xs text-slate-500">{d.email}</span></button></li>))}
          </ul>
        </section>
      </div>
    </main>
  );
}
