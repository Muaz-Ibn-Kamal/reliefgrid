"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiErr } from "@/lib/client";
import { AuthHero } from "@/components/auth/scene";
import { AgField, GOOGLE_ERRORS, GoogleButton } from "@/components/auth/parts";

export function RegisterForm({ google }: { google: boolean }) {
  const router = useRouter();
  const fromGoogle = GOOGLE_ERRORS[useSearchParams().get("error") ?? ""];
  const [f, setF] = useState({ name: "", email: "", password: "", phone: "", skills: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setFieldErr({});
    try {
      await api("/api/auth/register", { json: { name: f.name, email: f.email, password: f.password, phone: f.phone || undefined, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean) } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiErr && Array.isArray(err.details)) setFieldErr(Object.fromEntries((err.details as { path: string; message: string }[]).map((d) => [d.path, d.message])));
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  const message = error ?? fromGoogle;
  return (
    <div className="ag-page">
      <div className="ag-split">
        <AuthHero title="Join the people on the ground." text="Register as a volunteer to see the tasks assigned to you, report from the field and keep coordinators informed." />
        <section className="ag-panel">
          <div className="ag-card">
            <div>
              <h2 className="ag-h2">Volunteer registration</h2>
              <p className="ag-sub">Coordinators, organizations and shelter managers are set up by a System Admin.</p>
            </div>
            {message && <div role="alert" className="ag-alert">{message}</div>}
            {google && (
              <>
                <GoogleButton label="Register with Google" />
                <div className="ag-or">or fill in the form</div>
              </>
            )}
            <form onSubmit={submit} className="ag-form">
              <AgField label="Full name" error={fieldErr.name}>
                {(id) => <input id={id} className="ag-input" required minLength={2} autoComplete="name" value={f.name} onChange={set("name")} />}
              </AgField>
              <AgField label="Email" error={fieldErr.email}>
                {(id) => <input id={id} className="ag-input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} />}
              </AgField>
              <AgField label="Password" hint="At least 8 characters" error={fieldErr.password}>
                {(id) => <input id={id} className="ag-input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} />}
              </AgField>
              <AgField label="Phone (optional)">
                {(id) => <input id={id} className="ag-input" autoComplete="tel" value={f.phone} onChange={set("phone")} />}
              </AgField>
              <AgField label="Skills (comma separated)" hint="For example: First aid, Boat operation, Logistics">
                {(id) => <input id={id} className="ag-input" value={f.skills} onChange={set("skills")} />}
              </AgField>
              <button type="submit" className="ag-btn" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Create volunteer account
              </button>
            </form>
            <div className="ag-links">
              <span>Already registered? <Link href="/login">Sign in</Link></span>
              <span>Need help now? <Link href="/help">Request assistance</Link></span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
