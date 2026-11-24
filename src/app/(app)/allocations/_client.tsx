"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { ListView, refreshLists, type Col, type FilterDef } from "@/components/list";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, dt, fmt, ago, useApi } from "@/lib/client";
import { REQUEST_RESOURCE_MAP, label, type RoleName } from "@/lib/constants";

type Dist = { id: string; status: string; deliveredQty: number; notes: string | null; createdAt: string };
type Alloc = {
  id: string; quantity: number; status: string; qrToken: string; notes: string | null; createdAt: string;
  resource: { name: string; unit: string; category: string }; organization: { name: string };
  request: { id: string; type: string; location: string; priorityLevel: string; quantity: number }; distributions: Dist[];
};
type ReqLookup = { id: string; type: string; location: string; quantity: number; unit: string; priorityLevel: string };
type ReqDetail = { id: string; type: string; quantity: number; unit: string; status: string; allocations: { quantity: number; status: string }[] };
type Res = { id: string; name: string; category: string; quantity: number; unit: string; storageLocation: string; organization: { name: string } };

const FILTERS: FilterDef[] = [{ key: "status", label: "Status", options: ["ALLOCATED", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map((v) => ({ value: v, label: label(v) })) }];

async function fetchCompatible(type: string): Promise<Res[]> {
  const cats = REQUEST_RESOURCE_MAP[type as keyof typeof REQUEST_RESOURCE_MAP] ?? [];
  const pages = await Promise.all(cats.map((c) => api<{ data: Res[] }>(`/api/resources?category=${c}&available=1&pageSize=100`)));
  return pages.flatMap((p) => p.data).sort((a, b) => b.quantity - a.quantity);
}

function AllocatePanel() {
  const sp = useSearchParams();
  const reqs = useApi<ReqLookup[]>("/api/lookups?type=requests");
  const [reqId, setReqId] = useState(sp.get("requestId") ?? "");
  const detail = useApi<ReqDetail>(reqId ? `/api/requests/${reqId}` : null);
  const [loaded, setLoaded] = useState<{ type: string; list: Res[] } | null>(null);
  const [resId, setResId] = useState(""); const [qty, setQty] = useState(""); const [notes, setNotes] = useState("");
  const s = useSubmit();
  const d = detail.data;
  const allocated = d ? d.allocations.filter((a) => a.status !== "CANCELLED").reduce((n, a) => n + a.quantity, 0) : 0;
  const remaining = d ? Math.max(0, d.quantity - allocated) : 0;

  // Resources are keyed by the request type they were loaded for, so a stale list is never shown for another request.
  const resources = loaded && d && loaded.type === d.type ? loaded.list : null;
  const reqType = d?.type; const reqKey = d?.id;
  useEffect(() => {
    if (!reqType) return;
    let cancelled = false;
    fetchCompatible(reqType).catch(() => [] as Res[]).then((list) => { if (!cancelled) setLoaded({ type: reqType, list }); });
    return () => { cancelled = true; };
  }, [reqType, reqKey]);
  const loadResources = async (type: string) => setLoaded({ type, list: await fetchCompatible(type) });

  const res = resources?.find((r) => r.id === resId);
  const max = res ? Math.min(res.quantity, remaining) : 0;
  const n = Number(qty);
  const clientErr = res && qty !== "" && (!Number.isInteger(n) || n < 1 ? "Enter a whole number of at least 1" : n > res.quantity ? `Only ${fmt(res.quantity)} ${res.unit} available` : n > remaining ? `Request only needs ${fmt(remaining)} more` : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reqId || !resId || clientErr || !qty) return;
    const ok = await s.run(() => api("/api/allocations", { json: { requestId: reqId, resourceId: resId, quantity: n, notes: notes || undefined } }), "Resources allocated");
    if (ok) { setQty(""); setNotes(""); detail.mutate(); loadResources(d!.type); refreshLists(); }
  }

  return (
    <Card title="Allocate resources to a verified request">
      <form onSubmit={submit} className="space-y-3">
        <FormError message={s.error} />
        <Field label="Verified request">{(id) => (
          <Select id={id} value={reqId} onChange={(e) => { setReqId(e.target.value); setResId(""); setQty(""); }}>
            <option value="">Select a request…</option>
            {reqs.data?.map((r) => <option key={r.id} value={r.id}>[{r.priorityLevel}] {label(r.type)} · {fmt(r.quantity)} {r.unit} · {r.location}</option>)}
          </Select>)}
        </Field>
        {reqId && detail.isLoading && <Spinner />}
        {d && (
          <>
            <p className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">Needs <b>{fmt(d.quantity)} {d.unit}</b> · already allocated <b>{fmt(allocated)}</b> · remaining <b className={remaining ? "text-orange-700" : "text-emerald-700"}>{fmt(remaining)}</b> · <Link className="text-orange-700 hover:underline dark:text-orange-400" href="/requests">view request</Link></p>
            {!remaining ? <EmptyState title="This request is fully allocated" /> : (
              <>
                <Field label="Compatible resource (highest stock first)">{(id) => (
                  <Select id={id} value={resId} onChange={(e) => { setResId(e.target.value); setQty(""); }} disabled={!resources}>
                    <option value="">{resources ? (resources.length ? "Select a resource…" : "No compatible stock available") : "Loading…"}</option>
                    {resources?.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.organization.name} · {fmt(r.quantity)} {r.unit} · {r.storageLocation}</option>)}
                  </Select>)}
                </Field>
                {res && (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Field label={`Quantity (max ${fmt(max)} ${res.unit})`} error={clientErr || s.fieldError("quantity") || undefined}>{(id) => <Input id={id} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} aria-invalid={!!clientErr} />}</Field>
                    <Button type="button" variant="secondary" onClick={() => setQty(String(max))}>Use max</Button>
                  </div>
                )}
                <Field label="Notes (optional)">{(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}</Field>
                <Button type="submit" busy={s.busy} disabled={!res || !qty || !!clientErr}>Allocate</Button>
              </>
            )}
          </>
        )}
      </form>
    </Card>
  );
}

function VerifyPanel() {
  const [token, setToken] = useState(""); const { busy, run } = useAction();
  return (
    <Card title="Verify delivery by QR code">
      <form className="flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run(() => api("/api/allocations/verify", { json: { token: token.trim() } }), "Delivery verified")) { setToken(""); refreshLists(); } }}>
        <div className="min-w-56 flex-1"><Field label="Scanned or typed token" hint="Paste the text decoded from the package QR code.">{(id) => <Input id={id} value={token} onChange={(e) => setToken(e.target.value)} placeholder="reliefgrid:…" />}</Field></div>
        <Button type="submit" busy={busy} disabled={token.trim().length < 8}>Confirm delivery</Button>
      </form>
    </Card>
  );
}

function DetailModal({ a, canUpdate, onClose }: { a: Alloc; canUpdate: boolean; onClose: () => void }) {
  const [qr, setQr] = useState<string>();
  const [status, setStatus] = useState(""); const [delivered, setDelivered] = useState(String(a.quantity)); const [notes, setNotes] = useState("");
  const { busy, run } = useAction();
  useEffect(() => { QRCode.toDataURL(`reliefgrid:${a.qrToken}`, { margin: 1, width: 180 }).then(setQr).catch(() => setQr(undefined)); }, [a.qrToken]);
  const final = a.status === "DELIVERED" || a.status === "CANCELLED";
  const next = a.status === "ALLOCATED" ? ["IN_TRANSIT", "DELIVERED", "CANCELLED"] : a.status === "IN_TRANSIT" ? ["DELIVERED", "CANCELLED"] : [];
  return (
    <Modal open onClose={onClose} title="Allocation" wide>
      <div className="space-y-4 text-sm">
        <ol className="grid gap-2 sm:grid-cols-3">
          <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">Request</div><Link className="font-semibold text-orange-700 hover:underline dark:text-orange-400" href="/requests">{label(a.request.type)}</Link><div>{a.request.location}</div><Badge value={a.request.priorityLevel} /></li>
          <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">Resource</div><div className="font-semibold">{a.resource.name}</div><div>{fmt(a.quantity)} {a.resource.unit} allocated</div></li>
          <li className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs text-slate-500">Responsible organization</div><div className="font-semibold">{a.organization.name}</div><Badge value={a.status} /></li>
        </ol>
        <div className="flex flex-wrap items-start gap-4">
          {qr && <div className="text-center"><img src={qr} alt="QR code for delivery verification" className="h-36 w-36 rounded border" /><div className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"><QrCode className="h-3 w-3" aria-hidden />Scan on delivery</div><code data-testid="qr-token" className="mt-1 block max-w-36 select-all break-all text-[10px] text-slate-500">reliefgrid:{a.qrToken}</code></div>}
          <div className="min-w-60 flex-1"><h3 className="mb-2 font-semibold">Distribution records (immutable)</h3>
            {!a.distributions.length ? <p className="text-slate-500">No distribution updates yet.</p> : <ul className="space-y-1.5">{a.distributions.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2"><Badge value={d.status} /><span>{fmt(d.deliveredQty)} delivered</span><span className="text-xs text-slate-500">{dt(d.createdAt)}{d.notes ? ` · ${d.notes}` : ""}</span></li>)}</ul>}
          </div>
        </div>
        {canUpdate && !final && (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="font-semibold">Update distribution</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="New status">{(i) => <Select id={i} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Select…</option>{next.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
              {status === "DELIVERED" && <Field label="Delivered quantity">{(i) => <Input id={i} inputMode="numeric" value={delivered} onChange={(e) => setDelivered(e.target.value)} />}</Field>}
              <Field label="Notes">{(i) => <Input id={i} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />}</Field>
            </div>
            <Button busy={busy} disabled={!status} onClick={async () => { if (await run(() => api(`/api/allocations/${a.id}`, { method: "PATCH", json: { status, ...(status === "DELIVERED" ? { deliveredQty: Number(delivered) } : {}), notes: notes || undefined } }), "Distribution updated")) { refreshLists(); onClose(); } }}>Save update</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Inner() {
  const me = useApi<{ user: { role: RoleName } }>("/api/auth/me");
  const role = me.data?.user.role;
  const [open, setOpen] = useState<Alloc | null>(null);
  const columns: Col<Alloc>[] = [
    { key: "req", header: "Request", render: (a) => <div><div className="font-semibold">{label(a.request.type)}</div><div className="text-xs text-slate-500">{a.request.location}</div></div> },
    { key: "res", header: "Resource", render: (a) => a.resource.name },
    { key: "org", header: "Organization", render: (a) => a.organization.name },
    { key: "qty", header: "Quantity", className: "text-right tabular-nums", render: (a) => `${fmt(a.quantity)} ${a.resource.unit}` },
    { key: "st", header: "Distribution", render: (a) => <Badge value={a.status} /> },
    { key: "when", header: "Allocated", className: "whitespace-nowrap", render: (a) => ago(a.createdAt) },
  ];
  return (
    <>
      <PageHeader title="Resource allocation" subtitle="Match verified requests with available stock and track distribution to delivery." />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        {(role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR") && <AllocatePanel />}
        <VerifyPanel />
      </div>
      <h2 className="mb-2 text-lg font-semibold">Allocation history</h2>
      <ListView<Alloc> endpoint="/api/allocations" columns={columns} filters={FILTERS} exportEntity="allocations" onRow={setOpen} />
      {open && <DetailModal a={open} canUpdate={!!role} onClose={() => setOpen(null)} />}
    </>
  );
}
export function AllocationsClient() { return <Suspense fallback={<Spinner />}><Inner /></Suspense>; }
