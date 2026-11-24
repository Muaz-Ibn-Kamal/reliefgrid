"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, UserMinus } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, useAction } from "@/components/ui";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, useApi, type Paged } from "@/lib/client";
import type { RoleName } from "@/lib/constants";

type Member = { id: string; availability: string; user: { name: string; phone: string | null } };
type Team = { id: string; name: string; status: string; incident: { id: string; title: string } | null; organization: { name: string } | null; members: Member[] };

function CreateModal({ role, onClose, onDone }: { role: RoleName; onClose: () => void; onDone: () => void }) {
  const ops = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR";
  const orgs = useApi<{ id: string; name: string }[]>(ops ? "/api/lookups?type=organizations" : null);
  const vols = useApi<{ id: string; user: { name: string } }[]>(ops ? "/api/lookups?type=volunteers" : null);
  const s = useSubmit();
  const [name, setName] = useState(""); const [orgId, setOrgId] = useState(""); const [members, setMembers] = useState<string[]>([]);
  return (
    <Modal open onClose={onClose} title="Create team">
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await s.run(() => api("/api/teams", { json: { name, organizationId: orgId || undefined, memberIds: members } }), "Team created")) { onDone(); onClose(); } }}>
        <FormError message={s.error} />
        <Field label="Team name" error={s.fieldError("name")}>{(i) => <Input id={i} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />}</Field>
        {ops && <Field label="Organization (optional)">{(i) => <Select id={i} value={orgId} onChange={(e) => setOrgId(e.target.value)}><option value="">None</option>{orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>}
        {ops && <Field label="Initial members" hint="Hold Ctrl/Cmd to select several. Only available volunteers are listed.">{(i) => <select id={i} multiple size={6} value={members} onChange={(e) => setMembers(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900">{vols.data?.map((v) => <option key={v.id} value={v.id}>{v.user.name}</option>)}</select>}</Field>}
        {!ops && <p className="text-xs text-slate-500">Members can be added by a coordinator after the team is created.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Create</Button></div>
      </form>
    </Modal>
  );
}

function TeamModal({ team, role, onClose, onChanged }: { team: Team; role: RoleName; onClose: () => void; onChanged: () => void }) {
  const ops = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR";
  const canEdit = ops || role === "RELIEF_ORGANIZATION";
  const incidents = useApi<{ id: string; title: string }[]>(ops ? "/api/lookups?type=incidents" : null);
  const vols = useApi<{ id: string; user: { name: string } }[]>(ops ? "/api/lookups?type=volunteers" : null);
  const { busy, run } = useAction();
  const [inc, setInc] = useState(""); const [add, setAdd] = useState("");
  const patch = async (json: Record<string, unknown>, ok: string) => { if (await run(() => api(`/api/teams/${team.id}`, { method: "PATCH", json }), ok)) onChanged(); };
  const candidates = vols.data?.filter((v) => !team.members.some((m) => m.id === v.id));
  return (
    <Modal open onClose={onClose} title={team.name} wide>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge value={team.status} />{team.incident ? <>Deployed to <Link className="link" href={`/incidents/${team.incident.id}`}>{team.incident.title}</Link></> : <span className="text-slate-500">On standby</span>}{team.organization && <span className="text-slate-500">· {team.organization.name}</span>}</div>
        <div><h3 className="mb-2 font-semibold">Members ({team.members.length})</h3>
          {!team.members.length ? <p className="text-slate-500">No members yet.</p> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{team.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-1.5"><span>{m.user.name}{m.user.phone && <span className="text-slate-500"> · {m.user.phone}</span>}</span>
              <span className="flex items-center gap-2"><Badge value={m.availability} />{canEdit && <Button size="sm" variant="ghost" aria-label={`Remove ${m.user.name}`} busy={busy} onClick={() => patch({ removeMembers: [m.id] }, "Member removed")}><UserMinus className="h-3.5 w-3.5" /></Button>}</span></li>
          ))}</ul>}
        </div>
        {ops && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-end gap-2"><div className="flex-1"><Field label="Add member">{(i) => <Select id={i} value={add} onChange={(e) => setAdd(e.target.value)}><option value="">Select volunteer…</option>{candidates?.map((v) => <option key={v.id} value={v.id}>{v.user.name}</option>)}</Select>}</Field></div><Button busy={busy} disabled={!add} onClick={async () => { await patch({ addMembers: [add] }, "Member added"); setAdd(""); }}>Add</Button></div>
            <div className="flex items-end gap-2"><div className="flex-1"><Field label="Deploy to incident">{(i) => <Select id={i} value={inc} onChange={(e) => setInc(e.target.value)}><option value="">Select incident…</option>{incidents.data?.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</Select>}</Field></div><Button busy={busy} disabled={!inc} onClick={() => patch({ deployToIncidentId: inc }, "Team deployed")}>Deploy</Button></div>
            {team.incident && <Button variant="secondary" busy={busy} onClick={() => patch({ deployToIncidentId: null }, "Team recalled")}>Recall to standby</Button>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function TeamsClient() {
  const me = useApi<{ user: { role: RoleName } }>("/api/auth/me");
  const role = me.data?.user.role;
  const { data, error, isLoading, mutate } = useApi<Paged<Team>>("/api/teams?pageSize=100", 20000);
  const [creating, setCreating] = useState(false); const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.data.find((t) => t.id === openId);
  const canCreate = role === "SYSTEM_ADMIN" || role === "EMERGENCY_COORDINATOR" || role === "RELIEF_ORGANIZATION";
  return (
    <>
      <PageHeader title="Teams" subtitle={role === "VOLUNTEER" ? "Your assigned team and teammates." : "Organize volunteers into teams and deploy them to incidents."} actions={canCreate && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden />Create team</Button>} />
      {isLoading || !role ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : !data?.data.length ? <EmptyState title="No teams yet" hint={role === "VOLUNTEER" ? "You are not on a team yet." : "Create a team to coordinate volunteers."} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.data.map((t) => (
          <li key={t.id}><button className="w-full text-left" onClick={() => setOpenId(t.id)}><Card className="transition-colors hover:border-slate-400 dark:hover:border-slate-600">
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{t.name}</h2><Badge value={t.status} /></div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.members.length} member{t.members.length === 1 ? "" : "s"}{t.organization ? ` · ${t.organization.name}` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">{t.incident ? `Deployed: ${t.incident.title}` : "On standby"}</p>
          </Card></button></li>
        ))}</ul>
      )}
      {creating && role && <CreateModal role={role} onClose={() => setCreating(false)} onDone={() => mutate()} />}
      {open && role && <TeamModal team={open} role={role} onClose={() => setOpenId(null)} onChanged={() => mutate()} />}
    </>
  );
}
