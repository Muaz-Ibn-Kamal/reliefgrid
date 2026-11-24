"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Field, Modal, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { ActivityTimeline, type ActivityRow } from "@/components/activity-timeline";
import { ListView, refreshLists, type Col, type FilterDef } from "@/components/list";
import { RequestForm } from "@/components/request-form";
import { URGENCY5 } from "@/components/rg-forms";
import { api, ago, dt, fmt, useApi } from "@/lib/client";
import { REQUEST_TYPES, label } from "@/lib/constants";

type Row = {
  id: string; type: string; location: string; quantity: number; unit: string; affectedPeople: number; urgency: number; description: string; status: string;
  priorityLevel: string; priorityScore: number; requesterName: string; requesterContact: string | null; createdAt: string; allocatedQty: number;
  incident: { id: string; title: string } | null; organization: { name: string } | null;
};
type Detail = Row & { history: ActivityRow[]; rejectionReason?: string | null };

const opts = (a: readonly string[]) => a.map((v) => ({ value: v, label: label(v) }));
const FILTERS: FilterDef[] = [
  { key: "q", label: "Search description, location, requester", type: "search" },
  { key: "type", label: "Type", options: opts(REQUEST_TYPES) },
  { key: "status", label: "Status", options: opts(["PENDING", "VERIFIED", "ASSIGNED", "COMPLETED", "REJECTED"]) },
  { key: "priority", label: "Priority", options: opts(["CRITICAL", "HIGH", "MEDIUM", "LOW"]) },
  { key: "sort", label: "Sort", options: [{ value: "newest", label: "Newest first" }] },
];

function ReviewModal({ id, canReview, onClose }: { id: string; canReview: boolean; onClose: () => void }) {
  const { data, isLoading, mutate } = useApi<Detail>(`/api/requests/${id}`);
  const { busy, run } = useAction();
  const [reason, setReason] = useState(""); const [urgency, setUrgency] = useState("");
  const act = async (body: Record<string, unknown>, ok: string) => { if (await run(() => api(`/api/requests/${id}`, { method: "PATCH", json: body }), ok)) { mutate(); refreshLists(); } };
  return (
    <Modal open onClose={onClose} title="Emergency request" wide>
      {isLoading || !data ? <Spinner /> : (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2"><Badge value={data.priorityLevel} /><Badge value={data.status} /><span className="text-slate-500">Score {data.priorityScore.toFixed(1)} · submitted {dt(data.createdAt)}</span></div>
          <p className="whitespace-pre-line">{data.description}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Need</dt><dd>{label(data.type)} · {fmt(data.quantity)} {data.unit} (allocated {fmt(data.allocatedQty ?? 0)})</dd></div>
            <div><dt className="text-xs text-slate-500">Affected people</dt><dd>{fmt(data.affectedPeople)}</dd></div>
            <div><dt className="text-xs text-slate-500">Location</dt><dd>{data.location}</dd></div>
            <div><dt className="text-xs text-slate-500">Requester</dt><dd>{data.requesterName}{data.requesterContact ? ` · ${data.requesterContact}` : ""}{data.organization ? ` (${data.organization.name})` : ""}</dd></div>
            {data.incident && <div><dt className="text-xs text-slate-500">Incident</dt><dd><Link className="text-orange-700 hover:underline dark:text-orange-400" href={`/incidents/${data.incident.id}`}>{data.incident.title}</Link></dd></div>}
          </dl>
          {canReview && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="font-semibold">Review</h3>
              <div className="flex flex-wrap gap-2">
                {data.status === "PENDING" && <Button size="sm" busy={busy} onClick={() => act({ action: "VERIFY" }, "Request verified")}>Verify</Button>}
                {data.status === "VERIFIED" && <Link href={`/allocations?requestId=${data.id}`}><Button size="sm" variant="secondary">Allocate resources</Button></Link>}
                {["VERIFIED", "ASSIGNED"].includes(data.status) && <Button size="sm" variant="secondary" busy={busy} onClick={() => act({ action: "COMPLETE" }, "Marked complete")}>Mark complete</Button>}
              </div>
              {["PENDING", "VERIFIED"].includes(data.status) && (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Rejection reason (required to reject)">{(i) => <Textarea id={i} rows={1} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />}</Field>
                  <Button size="sm" variant="danger" busy={busy} disabled={!reason.trim()} onClick={() => act({ action: "REJECT", reason }, "Request rejected")}>Reject</Button>
                </div>
              )}
              {!["COMPLETED", "REJECTED"].includes(data.status) && (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field label="Change urgency">{(i) => <Select id={i} value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="">Select…</option>{URGENCY5.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</Select>}</Field>
                  <Button size="sm" variant="secondary" busy={busy} disabled={!urgency} onClick={() => act({ action: "SET_URGENCY", urgency: Number(urgency) }, "Urgency updated")}>Update</Button>
                </div>
              )}
            </div>
          )}
          <div><h3 className="mb-2 font-semibold">History</h3><ActivityTimeline rows={data.history} /></div>
        </div>
      )}
    </Modal>
  );
}

function Inner() {
  const sp = useSearchParams();
  const me = useApi<{ user: { role: string } }>("/api/auth/me");
  const canReview = me.data?.user.role === "SYSTEM_ADMIN" || me.data?.user.role === "EMERGENCY_COORDINATOR";
  const [creating, setCreating] = useState(sp.get("new") === "1");
  const [openId, setOpenId] = useState<string | null>(null);
  const columns: Col<Row>[] = [
    { key: "type", header: "Request", render: (r) => <div className="min-w-40"><div className="font-semibold">{label(r.type)}</div><div className="text-xs text-slate-500">{r.location}</div></div> },
    { key: "qty", header: "Qty (allocated)", className: "tabular-nums", render: (r) => `${fmt(r.quantity)} ${r.unit} (${fmt(r.allocatedQty)})` },
    { key: "aff", header: "People", className: "text-right tabular-nums", render: (r) => fmt(r.affectedPeople) },
    { key: "prio", header: "Priority", render: (r) => <div className="flex flex-col items-start gap-0.5"><Badge value={r.priorityLevel} /><span className="text-xs text-slate-500">score {r.priorityScore.toFixed(1)}</span></div> },
    { key: "status", header: "Status", render: (r) => <Badge value={r.status} /> },
    { key: "who", header: "Requester", render: (r) => r.requesterName },
    { key: "when", header: "Submitted", className: "whitespace-nowrap", render: (r) => ago(r.createdAt) },
  ];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Emergency requests</h1><p className="text-sm text-slate-500">Verify, prioritize and assign citizen and organization requests.</p></div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />New request</Button>
      </div>
      <ListView<Row> endpoint="/api/requests" columns={columns} filters={FILTERS} exportEntity="requests" onRow={(r) => setOpenId(r.id)}
        rowClass={(r) => (r.priorityLevel === "CRITICAL" && ["PENDING", "VERIFIED"].includes(r.status) ? "bg-red-50 dark:bg-red-950/30" : undefined)} />
      <Modal open={creating} onClose={() => setCreating(false)} title="Submit emergency request" wide>
        <RequestForm mode="internal" incidentId={sp.get("incidentId") ?? undefined} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); refreshLists(); }} />
      </Modal>
      {openId && <ReviewModal id={openId} canReview={!!canReview} onClose={() => setOpenId(null)} />}
    </>
  );
}
export function RequestsClient() { return <Suspense fallback={<Spinner />}><Inner /></Suspense>; }
