"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, ApiErr, ago, useApi } from "@/lib/client";
import { REQUEST_TYPES, label } from "@/lib/constants";
import { Button, Field, Input, Select, Textarea } from "./ui";
import { GpsFields, REQUEST_UNITS, URGENCY5, num, validateGps } from "./rg-forms";
import { FormError, useSubmit } from "./rg-submit";

type Dup = { id: string; type: string; location: string; quantity: number; status: string; createdAt: string; requesterName: string };

/** Emergency request form. `mode="public"` posts anonymously to the citizen endpoint (no incident link, no duplicate override). */
export function RequestForm({ mode, incidentId, onDone, onCancel }: { mode: "internal" | "public"; incidentId?: string; onDone: (r: { id: string }) => void; onCancel?: () => void }) {
  const pub = mode === "public";
  const incidents = useApi<{ id: string; title: string }[]>(pub ? null : "/api/lookups?type=incidents");
  const s = useSubmit();
  const [f, setF] = useState({ type: "FOOD", quantity: "", unit: REQUEST_UNITS.FOOD, location: "", lat: "", lng: "", urgency: "3", affected: "", description: "", name: "", contact: "", incidentId: incidentId ?? "" });
  const [dups, setDups] = useState<Dup[]>([]);
  const [clientErr, setClientErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value, ...(k === "type" ? { unit: REQUEST_UNITS[e.target.value] ?? p.unit } : {}) }));

  function validate() {
    const e: Record<string, string> = { ...validateGps(f.lat, f.lng) };
    const q = num(f.quantity), a = num(f.affected);
    if (q === undefined || !Number.isInteger(q) || q < 1) e.quantity = "Enter a whole number of at least 1";
    if (a === undefined || !Number.isInteger(a) || a < 1) e.affectedPeople = "Enter the number of affected people (at least 1)";
    if (f.location.trim().length < 1) e.location = "Location is required";
    if (f.description.trim().length < 5) e.description = "Describe the need (at least 5 characters)";
    if (f.name.trim().length < 1) e.requesterName = "Your name is required";
    setClientErr(e);
    return Object.keys(e).length === 0;
  }

  async function submit(force = false) {
    if (!validate()) return;
    setDups([]);
    const payload = {
      type: f.type, quantity: Number(f.quantity), unit: f.unit || "units", location: f.location, latitude: Number(f.lat), longitude: Number(f.lng), urgency: Number(f.urgency),
      affectedPeople: Number(f.affected), description: f.description, requesterName: f.name, requesterContact: f.contact || undefined,
      ...(pub ? {} : { incidentId: f.incidentId || undefined, ...(force ? { force: true } : {}) }),
    };
    let created: { id: string } | undefined;
    const ok = await s.run(async () => {
      try { created = await api<{ id: string }>(pub ? "/api/public/requests" : "/api/requests", { json: payload }); }
      catch (err) { if (err instanceof ApiErr && err.status === 409) setDups(((err.details as { duplicates?: Dup[] } | undefined)?.duplicates) ?? []); throw err; }
    }, pub ? undefined : "Request submitted");
    if (ok && created) onDone(created);
  }
  const err = (k: string, serverKey = k) => clientErr[k] ?? s.fieldError(serverKey);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4" noValidate>
      <FormError message={dups.length ? null : s.error} />
      {dups.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          <p className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200"><AlertTriangle className="h-4 w-4" aria-hidden />Possible duplicate{dups.length > 1 ? "s" : ""} nearby</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-900 dark:text-amber-200">{dups.map((d) => <li key={d.id}>{label(d.type)} · {d.quantity.toLocaleString()} · {d.location} · {label(d.status)} · {ago(d.createdAt)} (by {d.requesterName})</li>)}</ul>
          {pub ? <p className="mt-2">A similar request is already open for this area, so help is likely already on the way. If yours is a different need, change the details and send again.</p> : (
            <div className="mt-2 flex gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setDups([])}>Cancel</Button><Button type="button" size="sm" busy={s.busy} onClick={() => submit(true)}>Submit anyway (distinct need)</Button></div>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What is needed?">{(id) => <Select id={id} value={f.type} onChange={set("type")}>{REQUEST_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>}</Field>
        <Field label="Urgency">{(id) => <Select id={id} value={f.urgency} onChange={set("urgency")}>{URGENCY5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
        <Field label="Quantity" error={err("quantity")}>{(id) => <Input id={id} inputMode="numeric" value={f.quantity} onChange={set("quantity")} aria-invalid={!!err("quantity")} />}</Field>
        <Field label="Unit">{(id) => <Input id={id} value={f.unit} onChange={set("unit")} maxLength={30} />}</Field>
        <Field label="Number of affected people" error={err("affectedPeople")}>{(id) => <Input id={id} inputMode="numeric" value={f.affected} onChange={set("affected")} aria-invalid={!!err("affectedPeople")} />}</Field>
        {!pub && <Field label="Related incident (optional)">{(id) => <Select id={id} value={f.incidentId} onChange={set("incidentId")}><option value="">None</option>{incidents.data?.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</Select>}</Field>}
      </div>
      <Field label="Location (address or landmark)" error={err("location")}>{(id) => <Input id={id} value={f.location} onChange={set("location")} aria-invalid={!!err("location")} maxLength={200} />}</Field>
      <GpsFields lat={f.lat} lng={f.lng} onChange={(lat, lng) => setF((p) => ({ ...p, lat, lng }))} errors={{ latitude: err("latitude"), longitude: err("longitude") }} />
      <Field label="Description" error={err("description")}>{(id) => <Textarea id={id} value={f.description} onChange={set("description")} maxLength={2000} aria-invalid={!!err("description")} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name" error={err("requesterName")}>{(id) => <Input id={id} value={f.name} onChange={set("name")} autoComplete="name" aria-invalid={!!err("requesterName")} />}</Field>
        <Field label="Phone or email (optional)">{(id) => <Input id={id} value={f.contact} onChange={set("contact")} autoComplete="tel" />}</Field>
      </div>
      <div className="flex justify-end gap-2">{onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}<Button type="submit" busy={s.busy}>{pub ? "Send request for help" : "Submit request"}</Button></div>
    </form>
  );
}
