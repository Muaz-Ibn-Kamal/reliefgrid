"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { ListView, refreshLists, type Col } from "@/components/list";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, dt, fmt, useApi } from "@/lib/client";
import { RESOURCE_CATEGORIES, label } from "@/lib/constants";

type Res = {
  id: string; name: string; category: string; unit: string; quantity: number; totalReceived: number; storageLocation: string; updatedAt: string;
  organization: { id: string; name: string };
};
type Movement = { id: string; type: string; delta: number; balanceAfter: number; reason: string | null; fromLocation: string | null; toLocation: string | null; userId: string | null; allocationId: string | null; createdAt: string };
type Detail = Res & { movements: Movement[]; allocations: { id: string; quantity: number; status: string; createdAt: string; request: { id: string; location: string; type: string } }[] };
type Me = { user: { role: string; organizationId: string | null } };
type Lookup = { id: string; name: string }[];

const availability = (q: number) => (q <= 0 ? <Badge value="UNAVAILABLE" text="Out of stock" /> : q < 100 ? <Badge value="PENDING" text="Low stock" /> : <Badge value="AVAILABLE" text="Available" />);

export default function ResourcesClient() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role;
  // Server: POST/PATCH/stock allow SYSTEM_ADMIN and RELIEF_ORGANIZATION only; coordinators are read-only here.
  const canManage = role === "SYSTEM_ADMIN" || role === "RELIEF_ORGANIZATION";
  const showOrgFilter = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR";
  const { data: orgs } = useApi<Lookup>(showOrgFilter ? "/api/lookups?type=organizations" : null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const columns: Col<Res>[] = [
    { key: "name", header: "Resource", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "cat", header: "Category", render: (r) => label(r.category) },
    { key: "org", header: "Organization", render: (r) => r.organization.name },
    { key: "loc", header: "Storage location", render: (r) => r.storageLocation },
    { key: "qty", header: "Quantity", className: "tabular-nums text-right", render: (r) => `${fmt(r.quantity)} ${r.unit}` },
    { key: "tot", header: "Total received", className: "tabular-nums text-right", render: (r) => fmt(r.totalReceived) },
    { key: "av", header: "Availability", render: (r) => availability(r.quantity) },
    { key: "upd", header: "Updated", render: (r) => <span className="whitespace-nowrap text-slate-500">{dt(r.updatedAt)}</span> },
  ];
  const filters = [
    { key: "q", label: "Search name or location", type: "search" as const },
    { key: "category", label: "Category", options: RESOURCE_CATEGORIES.map((c) => ({ value: c, label: label(c) })) },
    { key: "available", label: "Availability", options: [{ value: "1", label: "In stock only" }] },
    { key: "lowStock", label: "Stock level", options: [{ value: "1", label: "Low stock (<100)" }] },
    ...(showOrgFilter ? [{ key: "organizationId", label: "Organization", options: (orgs ?? []).map((o) => ({ value: o.id, label: o.name })) }] : []),
  ];

  return (
    <div>
      <PageHeader title="Resources" subtitle="Relief inventory, stock history and movement tracking"
        actions={canManage ? <Button onClick={() => setRegistering(true)}><Plus className="h-4 w-4" />Register resource</Button> : undefined} />
      <ListView<Res> endpoint="/api/resources" columns={columns} filters={filters} exportEntity="resources" onRow={(r) => setOpenId(r.id)} />
      <RegisterModal open={registering} onClose={() => setRegistering(false)} isAdmin={role === "SYSTEM_ADMIN"} orgs={orgs} />
      {openId && <DetailModal id={openId} canManage={canManage} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------ register */
const blank = { name: "", category: "FOOD", unit: "", quantity: "0", storageLocation: "", organizationId: "" };
function RegisterModal({ open, onClose, isAdmin, orgs }: { open: boolean; onClose: () => void; isAdmin: boolean; orgs?: Lookup }) {
  const [f, setF] = useState(blank);
  const [local, setLocal] = useState<Record<string, string>>({});
  const s = useSubmit();
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const e = (k: string) => local[k] ?? s.fieldError(k);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const l: Record<string, string> = {};
    if (!f.name.trim()) l.name = "Name is required";
    if (!f.unit.trim()) l.unit = "Unit is required (e.g. packs, litres)";
    if (!f.storageLocation.trim()) l.storageLocation = "Storage location is required";
    const q = Number(f.quantity);
    if (f.quantity === "" || !Number.isInteger(q) || q < 0) l.quantity = "Enter a whole number, 0 or more";
    if (isAdmin && !f.organizationId) l.organizationId = "Select an organization";
    setLocal(l);
    if (Object.keys(l).length) return;
    const ok = await s.run(() => api("/api/resources", { json: { name: f.name, category: f.category, unit: f.unit, quantity: q, storageLocation: f.storageLocation, ...(isAdmin ? { organizationId: f.organizationId } : {}) } }), "Resource registered");
    if (ok) { refreshLists(); setF(blank); onClose(); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Register resource">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <FormError message={s.error} />
        {isAdmin && (
          <Field label="Organization" error={e("organizationId")}>
            {(id) => <Select id={id} value={f.organizationId} onChange={(x) => set("organizationId", x.target.value)}><option value="">Select organization…</option>{orgs?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}
          </Field>
        )}
        <Field label="Name" error={e("name")}>{(id) => <Input id={id} value={f.name} onChange={(x) => set("name", x.target.value)} maxLength={120} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" error={e("category")}>{(id) => <Select id={id} value={f.category} onChange={(x) => set("category", x.target.value)}>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>}</Field>
          <Field label="Unit" error={e("unit")}>{(id) => <Input id={id} value={f.unit} onChange={(x) => set("unit", x.target.value)} placeholder="packs, litres, kits" maxLength={30} />}</Field>
          <Field label="Initial quantity" error={e("quantity")}>{(id) => <Input id={id} type="number" min={0} step={1} value={f.quantity} onChange={(x) => set("quantity", x.target.value)} />}</Field>
          <Field label="Storage location" error={e("storageLocation")}>{(id) => <Input id={id} value={f.storageLocation} onChange={(x) => set("storageLocation", x.target.value)} maxLength={200} />}</Field>
        </div>
        <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Register</Button></div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------ detail */
const MOVE_TONE: Record<string, string> = { REGISTER: "bg-sky-500", RESTOCK: "bg-emerald-500", ADJUST: "bg-amber-500", TRANSFER_OUT: "bg-violet-500", ALLOCATE: "bg-indigo-500", RELEASE: "bg-teal-500" };

function DetailModal({ id, canManage, onClose }: { id: string; canManage: boolean; onClose: () => void }) {
  const { data, error, isLoading, mutate } = useApi<Detail>(`/api/resources/${id}`, 15000);
  return (
    <Modal open onClose={onClose} title={data?.name ?? "Resource"} wide>
      {isLoading ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : data ? <DetailBody r={data} canManage={canManage} reload={async () => { await mutate(); refreshLists(); }} /> : null}
    </Modal>
  );
}

function DetailBody({ r, canManage, reload }: { r: Detail; canManage: boolean; reload: () => Promise<void> }) {
  const transfers = r.movements.filter((m) => m.type === "TRANSFER_OUT" || m.type === "ALLOCATE");
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info k="Organization" v={r.organization.name} /><Info k="Category" v={label(r.category)} />
        <Info k="Available" v={`${fmt(r.quantity)} ${r.unit}`} /><Info k="Total received" v={`${fmt(r.totalReceived)} ${r.unit}`} />
        <Info k="Storage location" v={r.storageLocation} /><Info k="Availability" v={availability(r.quantity)} /><Info k="Updated" v={dt(r.updatedAt)} />
      </dl>

      {canManage && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Stock action"><StockForm r={r} reload={reload} /></Card>
          <Card title="Edit details"><EditForm r={r} reload={reload} /></Card>
        </div>
      )}

      <Card title="Stock history">
        {!r.movements.length ? <EmptyState title="No stock movements" /> : (
          <ol className="space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
            {r.movements.map((m) => (
              <li key={m.id} className="relative text-sm">
                <span className={`absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full ${MOVE_TONE[m.type] ?? "bg-slate-400"}`} aria-hidden />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{label(m.type)}</span>
                  <span className={m.delta < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>{m.delta > 0 ? "+" : ""}{fmt(m.delta)}</span>
                  <span className="text-slate-500">balance {fmt(m.balanceAfter)} {r.unit}</span>
                </div>
                {m.reason && <p className="text-slate-600 dark:text-slate-400">{m.reason}</p>}
                <p className="text-xs text-slate-500">{dt(m.createdAt)}{m.userId ? ` · by user ${m.userId.slice(-6)}` : " · system"}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Movement tracking">
        {!transfers.length ? <EmptyState title="No outbound movements yet" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1 pr-3">When</th><th className="pr-3">Type</th><th className="pr-3">From</th><th className="pr-3">To</th><th className="text-right">Qty</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transfers.map((m) => <tr key={m.id}><td className="py-1.5 pr-3 whitespace-nowrap">{dt(m.createdAt)}</td><td className="pr-3">{label(m.type)}</td><td className="pr-3">{m.fromLocation ?? "—"}</td><td className="pr-3">{m.toLocation ?? "—"}</td><td className="text-right tabular-nums">{fmt(Math.abs(m.delta))}</td></tr>)}
            </tbody></table></div>
        )}
      </Card>

      <Card title="Recent allocations">
        {!r.allocations.length ? <EmptyState title="Never allocated" /> : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {r.allocations.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5"><span>{fmt(a.quantity)} {r.unit} to {label(a.request.type)} request at {a.request.location}</span><span className="flex items-center gap-2"><Badge value={a.status} /><span className="text-xs text-slate-500">{dt(a.createdAt)}</span></span></li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
const Info = ({ k, v }: { k: string; v: React.ReactNode }) => <div><dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>;

function StockForm({ r, reload }: { r: Detail; reload: () => Promise<void> }) {
  const [type, setType] = useState<"RESTOCK" | "ADJUST" | "TRANSFER_OUT">("RESTOCK");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [dest, setDest] = useState("");
  const [local, setLocal] = useState<Record<string, string>>({});
  const s = useSubmit();
  const e = (k: string) => local[k] ?? s.fieldError(k);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const l: Record<string, string> = {};
    const n = Number(amount);
    if (amount === "" || !Number.isInteger(n) || n === 0) l.delta = "Enter a non-zero whole number";
    else if (type === "ADJUST") { if (r.quantity + n < 0) l.delta = `Would make stock negative (available ${fmt(r.quantity)})`; }
    else if (n < 0) l.delta = "Enter a positive amount";
    else if (type === "TRANSFER_OUT" && n > r.quantity) l.delta = `Only ${fmt(r.quantity)} ${r.unit} available`;
    if (type === "TRANSFER_OUT" && !dest.trim()) l.toLocation = "Destination is required for a transfer";
    setLocal(l);
    if (Object.keys(l).length) return;
    const delta = type === "TRANSFER_OUT" ? -Math.abs(n) : n;
    const ok = await s.run(() => api(`/api/resources/${r.id}/stock`, { json: { type, delta, ...(reason.trim() ? { reason } : {}), ...(type === "TRANSFER_OUT" ? { toLocation: dest } : {}) } }), "Stock updated");
    if (ok) { setAmount(""); setReason(""); setDest(""); await reload(); }
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={s.error} />
      <Field label="Action">{(id) => <Select id={id} value={type} onChange={(x) => { setType(x.target.value as typeof type); setLocal({}); }}><option value="RESTOCK">Restock (add)</option><option value="ADJUST">Adjust (+/- correction)</option><option value="TRANSFER_OUT">Transfer out</option></Select>}</Field>
      <Field label={type === "ADJUST" ? "Change (use - to reduce)" : "Quantity"} error={e("delta")}>{(id) => <Input id={id} type="number" step={1} value={amount} onChange={(x) => setAmount(x.target.value)} />}</Field>
      {type === "TRANSFER_OUT" && <Field label="Destination" error={e("toLocation")}>{(id) => <Input id={id} value={dest} onChange={(x) => setDest(x.target.value)} maxLength={200} />}</Field>}
      <Field label="Reason (optional)" error={e("reason")}>{(id) => <Input id={id} value={reason} onChange={(x) => setReason(x.target.value)} maxLength={300} />}</Field>
      <Button type="submit" busy={s.busy}>Apply</Button>
    </form>
  );
}

function EditForm({ r, reload }: { r: Detail; reload: () => Promise<void> }) {
  const [name, setName] = useState(r.name);
  const [loc, setLoc] = useState(r.storageLocation);
  const [local, setLocal] = useState<Record<string, string>>({});
  const s = useSubmit();
  const e = (k: string) => local[k] ?? s.fieldError(k);
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const l: Record<string, string> = {};
    if (!name.trim()) l.name = "Name is required";
    if (!loc.trim()) l.storageLocation = "Storage location is required";
    setLocal(l);
    if (Object.keys(l).length) return;
    if (await s.run(() => api(`/api/resources/${r.id}`, { method: "PATCH", json: { name, storageLocation: loc } }), "Resource updated")) await reload();
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={s.error} />
      <Field label="Name" error={e("name")}>{(id) => <Input id={id} value={name} onChange={(x) => setName(x.target.value)} maxLength={120} />}</Field>
      <Field label="Storage location" error={e("storageLocation")}>{(id) => <Input id={id} value={loc} onChange={(x) => setLoc(x.target.value)} maxLength={200} />}</Field>
      <Button type="submit" variant="secondary" busy={s.busy} disabled={name === r.name && loc === r.storageLocation}>Save changes</Button>
    </form>
  );
}
