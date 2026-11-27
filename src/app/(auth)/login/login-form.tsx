"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { AuthHero } from "@/components/auth/scene";
import { AgField, GOOGLE_ERRORS, GoogleButton } from "@/components/auth/parts";

const DEMO = [
  { role: "System Admin", initial: "A", email: "admin@reliefgrid.demo", color: "#5aa2ff" },
  { role: "Emergency Coordinator", initial: "C", email: "coordinator@reliefgrid.demo", color: "#ff9a6b" },
  { role: "Relief Organization", initial: "O", email: "org@reliefgrid.demo", color: "#fab219" },
  { role: "Volunteer", initial: "V", email: "volunteer@reliefgrid.demo", color: "#3ddc84" },
  { role: "Shelter Manager", initial: "S", email: "shelter@reliefgrid.demo", color: "#2dd4ff" },
];
const DEMO_PASSWORD = "ReliefGrid@2026";

export function LoginForm({ google }: { google: boolean }) {
  const router = useRouter();
  const fromGoogle = GOOGLE_ERRORS[useSearchParams().get("error") ?? ""];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/auth/login", { json: { email, password } });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  }

  const message = error ?? fromGoogle;
  return (
    <div className="ag-page">
      <div className="ag-split">
        <AuthHero title="Get help to the people who need it first." text="One shared picture of incidents, shelters, supplies and volunteers, so every organization works from the same facts." />
        <section className="ag-panel">
          <div className="ag-card">
            <div>
              <h2 className="ag-h2">Sign in</h2>
              <p className="ag-sub">Use your organization account to continue.</p>
            </div>
            {message && <div role="alert" className="ag-alert">{message}</div>}
            {google && (
              <>
                <GoogleButton label="Continue with Google" />
                <div className="ag-or">or use your email</div>
              </>
            )}
            <form onSubmit={submit} className="ag-form">
              <AgField label="Email">
                {(id) => <input id={id} className="ag-input" type="email" autoComplete="username" required placeholder="you@organization.org" value={email} onChange={(e) => setEmail(e.target.value)} />}
              </AgField>
              <AgField label="Password">
                {(id) => <input id={id} className="ag-input" type="password" autoComplete="current-password" required placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />}
              </AgField>
              <button type="submit" className="ag-btn" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Sign in
              </button>
            </form>
            <div className="ag-links">
              <span>New volunteer? <Link href="/register">Register</Link></span>
              <span>Need help now? <Link href="/help">Request assistance</Link></span>
            </div>
          </div>
        </section>
      </div>
      <section className="ag-demos" aria-labelledby="demo-heading">
        <p id="demo-heading">Try a demo account. Pick a role to fill the form; the password is <code>{DEMO_PASSWORD}</code>.</p>
        <div className="ag-demo-row">
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="ag-demo" onClick={() => { setEmail(d.email); setPassword(DEMO_PASSWORD); setError(undefined); }}>
              <span className="ag-av" style={{ background: d.color }}>{d.initial}</span>
              <span className="ag-who"><b>{d.role}</b><span>{d.email}</span></span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
