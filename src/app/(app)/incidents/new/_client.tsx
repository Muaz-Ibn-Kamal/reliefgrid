"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, ImageUpload, Input, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { GpsFields, LEVEL5, RISK5, fieldErrors, num, validateGps } from "@/components/rg-forms";
import { INCIDENT_CATEGORIES, label } from "@/lib/constants";
import { api, ApiErr } from "@/lib/client";
import { refreshLists } from "@/components/list";

export function NewIncidentClient() {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({ title: "", description: "", category: "FLOOD", location: "", lat: "", lng: "", severity: "3", risk: "3", affected: "0" });
  const [img, setImg] = useState<string>();
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  function validate() {
    const e: Record<string, string> = { ...validateGps(f.lat, f.lng) };
    if (f.title.trim().length < 4) e.title = "Title must be at least 4 characters";
    else if (f.title.trim().length > 160) e.title = "Title must be 160 characters or fewer";
    if (f.description.trim().length < 10) e.description = "Description must be at least 10 characters";
    else if (f.description.trim().length > 4000) e.description = "Description must be 4000 characters or fewer";
    if (!f.location.trim()) e.location = "Location is required";
    const a = num(f.affected);
    if (a === undefined || !Number.isInteger(a) || a < 0) e.affectedPopulation = "Enter a whole number, 0 or more";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault(); setFormErr(undefined);
    const e = validate(); setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/incidents", { json: {
        title: f.title.trim(), description: f.description.trim(), category: f.category, location: f.location.trim(),
        latitude: Number(f.lat), longitude: Number(f.lng), severity: Number(f.severity), locationRisk: Number(f.risk),
        affectedPopulation: Number(f.affected), ...(img ? { imageUrl: img } : {}),
      } });
      toast.ok("Incident reported. Coordinators have been notified.");
      refreshLists();
      router.push(`/incidents/${r.id}`);
    } catch (err) {
      const fe = fieldErrors(err);
      if (fe.affectedPopulation === undefined && fe.affected) fe.affectedPopulation = fe.affected;
      setErrs(fe);
      setFormErr(err instanceof ApiErr && Object.keys(fe).length ? "Please fix the highlighted fields." : err instanceof Error ? err.message : "Could not report the incident");
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Report an incident" subtitle="Priority is calculated automatically from severity, affected population, location risk and time." actions={<Link href="/incidents"><Button variant="secondary">Cancel</Button></Link>} />
      <form onSubmit={submit} noValidate className="max-w-3xl space-y-4">
        <Card title="What happened">
          <div className="space-y-3">
            <Field label="Title" error={errs.title}>{(id) => <Input id={id} value={f.title} onChange={set("title")} maxLength={160} aria-invalid={!!errs.title} placeholder="e.g. River embankment breach in Sunamganj" />}</Field>
            <Field label="Description" error={errs.description}>{(id) => <Textarea id={id} rows={5} value={f.description} onChange={set("description")} maxLength={4000} aria-invalid={!!errs.description} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category" error={errs.category}>{(id) => <Select id={id} value={f.category} onChange={set("category")}>{INCIDENT_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>}</Field>
              <Field label="Affected population" error={errs.affectedPopulation} hint="Estimated number of people">{(id) => <Input id={id} type="number" min={0} step={1} value={f.affected} onChange={set("affected")} aria-invalid={!!errs.affectedPopulation} />}</Field>
              <Field label="Severity" error={errs.severity}>{(id) => <Select id={id} value={f.severity} onChange={set("severity")}>{LEVEL5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
              <Field label="Location risk" error={errs.locationRisk} hint="Vulnerability of the area (terrain, access, density)">{(id) => <Select id={id} value={f.risk} onChange={set("risk")}>{RISK5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
            </div>
          </div>
        </Card>
        <Card title="Where">
          <div className="space-y-3">
            <Field label="Location" error={errs.location} hint="Area, village, district or street">{(id) => <Input id={id} value={f.location} onChange={set("location")} maxLength={200} aria-invalid={!!errs.location} />}</Field>
            <GpsFields lat={f.lat} lng={f.lng} onChange={(a, b) => setF((p) => ({ ...p, lat: a, lng: b }))} errors={errs} />
          </div>
        </Card>
        <Card title="Photograph (optional)"><ImageUpload value={img} onChange={setImg} />{errs.imageUrl && <p role="alert" className="mt-1 text-xs text-red-600">{errs.imageUrl}</p>}</Card>
        {formErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{formErr}</p>}
        <div className="flex gap-2"><Button type="submit" busy={busy}>Report incident</Button><Link href="/incidents"><Button type="button" variant="secondary">Cancel</Button></Link></div>
      </form>
    </>
  );
}
