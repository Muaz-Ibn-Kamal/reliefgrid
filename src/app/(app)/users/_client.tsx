"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ActivityLogTable } from "@/components/activity-log-table";
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Spinner, useAction, cx } from "@/components/ui";
import { ListView, refreshLists, type Col, type FilterDef } from "@/components/list";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, ago, useApi } from "@/lib/client";
import { ROLES, ROLE_LABEL, type RoleName } from "@/lib/constants";

type U = { id: string; name: string; email: string; role: RoleName; active: boolean; createdAt: string; organization: { id: string; name: string } | null };
type Org = { id: string; name: string; type: string; region: string; contact: string | null; active: boolean; _count: { users: number; resources: number; shelters: number } };
const ORG_ROLES: RoleName[] = ["RELIEF_ORGANIZATION", "SHELTER_MANAGER", "VOLUNTEER"];

function UserModal({ user, orgs, selfId, onClose }: { user?: U; orgs: Org[]; selfId?: string; onClose: () => void }) {
  const s = useSubmit();
  const [f, setF] = useState({ name: user?.name ?? "", email: user?.email ?? "", password: "", role: (user?.role ?? "VOLUNTEER") as RoleName, orgId: user?.organization?.id ?? "" });
  const self = !!user && user.id === selfId;
  return (
    <Modal open onClose={onClose} title={user ? "Edit user" : "Create user"}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const ok = await s.run(() => user
          ? api(`/api/users/${user.id}`, { method: "PATCH", json: { name: f.name, role: f.role, organizationId: f.orgId || null } })
          : api("/api/users", { json: { name: f.name, email: f.email, password: f.password, role: f.role, organizationId: f.orgId || null } }), user ? "User updated" : "User created");
        if (ok) { refreshLists(); onClose(); }
      }}>
        <FormError message={s.error} />
        <Field label="Full name" error={s.fieldError("name")}>{(i) => <Input id={i} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />}</Field>
        {!user && <Field label="Email" error={s.fieldError("email")}>{(i) => <Input id={i} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />}</Field>}
        {!user && <Field label="Temporary password" hint="At least 8 characters" error={s.fieldError("password")}>{(i) => <Input id={i} type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />}</Field>}
        <Field label="Role" hint={self ? "You cannot change your own role." : undefined}>{(i) => <Select id={i} value={f.role} disabled={self} onChange={(e) => setF({ ...f, role: e.target.value as RoleName })}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</Field>
        {(ORG_ROLES.includes(f.role)) && <Field label={f.role === "RELIEF_ORGANIZATION" ? "Organization (required)" : "Organization"}>{(i) => <Select id={i} value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} required={f.role === "RELIEF_ORGANIZATION"}><option value="">None</option>{orgs.filter((o) => o.active).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>}</Field>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>{user ? "Save" : "Create user"}</Button></div>
      </form>
    </Modal>
  );
}

function UsersTab({ orgs, selfId }: { orgs: Org[]; selfId?: string }) {
  const [edit, setEdit] = useState<U | "new" | null>(null); const { busy, run } = useAction();
  const filters: FilterDef[] = [
    { key: "q", label: "Search name or email", type: "search" },
    { key: "role", label: "Role", options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
    { key: "organizationId", label: "Organization", options: orgs.map((o) => ({ value: o.id, label: o.name })) },
  ];
  const cols: Col<U>[] = [
    { key: "n", header: "User", render: (u) => <div><div className="font-semibold">{u.name}{u.id === selfId && <span className="ml-1 text-xs text-slate-500">(you)</span>}</div><div className="text-xs text-slate-500">{u.email}</div></div> },
    { key: "r", header: "Role", render: (u) => ROLE_LABEL[u.role] },
    { key: "o", header: "Organization", render: (u) => u.organization?.name ?? <span className="text-slate-400">—</span> },
    { key: "a", header: "Status", render: (u) => <Badge value={u.active ? "AVAILABLE" : "UNAVAILABLE"} text={u.active ? "Active" : "Deactivated"} /> },
    { key: "c", header: "Created", render: (u) => ago(u.createdAt) },
    { key: "x", header: "", render: (u) => (
      <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" onClick={() => setEdit(u)}>Edit</Button>
        <Button size="sm" variant={u.active ? "danger" : "secondary"} busy={busy} disabled={u.id === selfId} title={u.id === selfId ? "You cannot deactivate yourself" : undefined}
          onClick={async () => { if (await run(() => api(`/api/users/${u.id}`, { method: "PATCH", json: { active: !u.active } }), u.active ? "User deactivated" : "User activated")) refreshLists(); }}>{u.active ? "Deactivate" : "Activate"}</Button>
      </div>) },
  ];
  return (
    <>
      <ListView<U> endpoint="/api/users" columns={cols} filters={filters} toolbar={<Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" aria-hidden />New user</Button>} />
      {edit && <UserModal user={edit === "new" ? undefined : edit} orgs={orgs} selfId={selfId} onClose={() => setEdit(null)} />}
    </>
  );
}

function OrgModal({ org, onClose, onDone }: { org?: Org; onClose: () => void; onDone: () => void }) {
  const s = useSubmit();
  const [f, setF] = useState({ name: org?.name ?? "", type: org?.type ?? "NGO", region: org?.region ?? "", contact: org?.contact ?? "" });
  return (
    <Modal open onClose={onClose} title={org ? "Edit organization" : "New organization"}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); const json = { name: f.name, type: f.type, region: f.region, contact: f.contact || undefined };
        if (await s.run(() => org ? api(`/api/organizations/${org.id}`, { method: "PATCH", json }) : api("/api/organizations", { json }), "Organization saved")) { onDone(); onClose(); } }}>
        <FormError message={s.error} />
        <Field label="Name" error={s.fieldError("name")}>{(i) => <Input id={i} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}</Field>
        <Field label="Type" error={s.fieldError("type")}>{(i) => <Input id={i} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} required placeholder="NGO, Government, Red Crescent…" />}</Field>
        <Field label="Region" error={s.fieldError("region")}>{(i) => <Input id={i} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} required />}</Field>
        <Field label="Contact">{(i) => <Input id={i} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />}</Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" busy={s.busy}>Save</Button></div>
      </form>
    </Modal>
  );
}

function OrgsTab({ orgs, error, loading, reload }: { orgs: Org[]; error?: Error; loading: boolean; reload: () => void }) {
  const [edit, setEdit] = useState<Org | "new" | null>(null); const { busy, run } = useAction();
  if (loading) return <Spinner />; if (error) return <ErrorState error={error} retry={reload} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setEdit("new")}><Plus className="h-4 w-4" aria-hidden />New organization</Button></div>
      {!orgs.length ? <EmptyState title="No organizations" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60"><tr>{["Organization", "Region", "Users", "Resources", "Shelters", "Status", ""].map((h) => <th key={h} scope="col" className="px-3 py-2.5">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{orgs.map((o) => (
            <tr key={o.id}><td className="px-3 py-2.5"><div className="font-semibold">{o.name}</div><div className="text-xs text-slate-500">{o.type}{o.contact ? ` · ${o.contact}` : ""}</div></td><td className="px-3">{o.region}</td><td className="px-3 tabular-nums">{o._count.users}</td><td className="px-3 tabular-nums">{o._count.resources}</td><td className="px-3 tabular-nums">{o._count.shelters}</td>
              <td className="px-3"><Badge value={o.active ? "AVAILABLE" : "UNAVAILABLE"} text={o.active ? "Active" : "Deactivated"} /></td>
              <td className="px-3"><div className="flex gap-1.5"><Button size="sm" variant="secondary" onClick={() => setEdit(o)}>Edit</Button><Button size="sm" variant={o.active ? "danger" : "secondary"} busy={busy} onClick={async () => { if (await run(() => api(`/api/organizations/${o.id}`, { method: "PATCH", json: { active: !o.active } }), o.active ? "Organization deactivated" : "Organization activated")) reload(); }}>{o.active ? "Deactivate" : "Activate"}</Button></div></td></tr>
          ))}</tbody></table></div>
      )}
      {edit && <OrgModal org={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} onDone={reload} />}
    </div>
  );
}

export default function UsersClient() {
  const [tab, setTab] = useState<"users" | "orgs" | "activity">("users");
  const me = useApi<{ user: { id: string } }>("/api/auth/me");
  const orgs = useApi<Org[]>("/api/organizations");
  const tabs = [["users", "Users"], ["orgs", "Organizations"], ["activity", "Activity log"]] as const;
  return (
    <>
      <PageHeader title="User management" subtitle="Provision accounts, manage organizations and monitor system activity." />
      <div role="tablist" aria-label="Administration sections" className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === k ? "border-orange-700 text-orange-800 dark:text-orange-300" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400")}>{l}</button>)}
      </div>
      {tab === "users" && <UsersTab orgs={orgs.data ?? []} selfId={me.data?.user.id} />}
      {tab === "orgs" && <OrgsTab orgs={orgs.data ?? []} error={orgs.error} loading={orgs.isLoading} reload={() => orgs.mutate()} />}
      {tab === "activity" && <ActivityLogTable canExport />}
    </>
  );
}
