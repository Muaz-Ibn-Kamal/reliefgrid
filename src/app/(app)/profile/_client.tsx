"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorState, Field, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, useApi } from "@/lib/client";
import { ROLE_LABEL, type RoleName } from "@/lib/constants";

type Profile = { id: string; name: string; email: string; phone: string | null; role: RoleName; organization: { name: string } | null; volunteer: { skills: string[]; availability: string; team: { name: string } | null } | null };

export default function ProfileClient() {
  const { data, error, isLoading, mutate } = useApi<Profile>("/api/profile");
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  return data ? <ProfileForm data={data} reload={() => mutate()} /> : null;
}

function ProfileForm({ data, reload }: { data: Profile; reload: () => void }) {
  const router = useRouter();
  const info = useSubmit(); const pw = useSubmit();
  const [f, setF] = useState({ name: data.name, phone: data.phone ?? "", skills: data.volunteer?.skills.join(", ") ?? "", availability: data.volunteer?.availability ?? "AVAILABLE" });
  const [p, setP] = useState({ current: "", next: "", confirm: "" });
  const vol = data.role === "VOLUNTEER" && data.volunteer;
  const mismatch = p.confirm !== "" && p.next !== p.confirm;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Profile settings" subtitle={`${ROLE_LABEL[data.role]}${data.organization ? ` · ${data.organization.name}` : ""}${data.volunteer?.team ? ` · Team ${data.volunteer.team.name}` : ""}`} />
      <Card title="Personal information">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault();
          if (await info.run(() => api("/api/profile", { method: "PATCH", json: { name: f.name, phone: f.phone || undefined, ...(vol ? { availability: f.availability, skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean) } : {}) } }), "Profile updated")) { reload(); router.refresh(); } }}>
          <FormError message={info.error} />
          <Field label="Email" hint="Email cannot be changed here; ask a System Admin.">{(i) => <Input id={i} value={data.email} disabled readOnly />}</Field>
          <Field label="Full name" error={info.fieldError("name")}>{(i) => <Input id={i} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />}</Field>
          <Field label="Phone">{(i) => <Input id={i} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" />}</Field>
          {vol && <>
            <Field label="Availability">{(i) => <Select id={i} value={f.availability} onChange={(e) => setF({ ...f, availability: e.target.value })}><option value="AVAILABLE">Available</option><option value="UNAVAILABLE">Unavailable</option><option value="DEPLOYED" disabled>Deployed (set automatically by tasks)</option></Select>}</Field>
            <Field label="Skills (comma separated)">{(i) => <Input id={i} value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />}</Field>
          </>}
          <Button type="submit" busy={info.busy}>Save changes</Button>
        </form>
      </Card>
      <Card title="Change password">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (mismatch) return;
          if (await pw.run(() => api("/api/profile", { method: "PATCH", json: { currentPassword: p.current, newPassword: p.next } }), "Password changed")) setP({ current: "", next: "", confirm: "" }); }}>
          <FormError message={pw.error} />
          <Field label="Current password">{(i) => <Input id={i} type="password" autoComplete="current-password" value={p.current} onChange={(e) => setP({ ...p, current: e.target.value })} required />}</Field>
          <Field label="New password" hint="At least 8 characters" error={pw.fieldError("newPassword")}>{(i) => <Input id={i} type="password" autoComplete="new-password" minLength={8} value={p.next} onChange={(e) => setP({ ...p, next: e.target.value })} required />}</Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords do not match" : undefined}>{(i) => <Input id={i} type="password" autoComplete="new-password" value={p.confirm} onChange={(e) => setP({ ...p, confirm: e.target.value })} required aria-invalid={mismatch} />}</Field>
          <Button type="submit" busy={pw.busy} disabled={mismatch || p.next.length < 8}>Update password</Button>
        </form>
      </Card>
    </div>
  );
}
