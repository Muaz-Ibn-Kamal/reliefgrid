"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiErr } from "@/lib/client";
import { Button, Field, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", skills: "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(undefined); setFieldErr({});
    try {
      await api("/api/auth/register", { json: { name: f.name, email: f.email, password: f.password, phone: f.phone || undefined, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean) } });
      router.replace("/dashboard"); router.refresh();
    } catch (err) {
      if (err instanceof ApiErr && Array.isArray(err.details)) setFieldErr(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      setError(err instanceof Error ? err.message : "Registration failed"); setBusy(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div><h1 className="text-2xl font-bold">Volunteer registration</h1><p className="text-sm text-slate-500">Coordinators, organizations and shelter managers are provisioned by a System Admin.</p></div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        <Field label="Full name" error={fieldErr.name}>{(id) => <Input id={id} required minLength={2} value={f.name} onChange={set("name")} autoComplete="name" />}</Field>
        <Field label="Email" error={fieldErr.email}>{(id) => <Input id={id} type="email" required value={f.email} onChange={set("email")} autoComplete="email" />}</Field>
        <Field label="Password" hint="At least 8 characters" error={fieldErr.password}>{(id) => <Input id={id} type="password" required minLength={8} value={f.password} onChange={set("password")} autoComplete="new-password" />}</Field>
        <Field label="Phone (optional)">{(id) => <Input id={id} value={f.phone} onChange={set("phone")} autoComplete="tel" />}</Field>
        <Field label="Skills (comma separated)" hint="e.g. First aid, Boat operation, Logistics">{(id) => <Input id={id} value={f.skills} onChange={set("skills")} />}</Field>
        <Button type="submit" busy={busy} className="w-full">Create volunteer account</Button>
        <p className="text-center text-sm text-slate-500">Already registered? <Link href="/login" className="font-medium text-orange-700 hover:underline dark:text-orange-400">Sign in</Link></p>
      </form>
    </main>
  );
}
