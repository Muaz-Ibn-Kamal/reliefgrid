"use client";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, MapPin, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, ImageUpload, Modal, PageHeader, Select, Spinner, Textarea, useAction } from "@/components/ui";
import { FormError, useSubmit } from "@/components/rg-submit";
import { api, ago, dt, useApi, type Paged } from "@/lib/client";
import { label } from "@/lib/constants";

type Report = { id: string; content: string; photoUrl: string | null; createdAt: string };
type Task = {
  id: string; title: string; description: string | null; location: string; latitude: number; longitude: number; status: string; createdAt: string;
  incident: { id: string; title: string; priorityLevel: string } | null;
  team: { id: string; name: string; members: { user: { name: string; phone: string | null } }[] } | null;
  reports: Report[];
};

function TaskModal({ task, onClose, onChanged }: { task: Task; onClose: () => void; onChanged: () => void }) {
  const s = useSubmit(); const { busy, run } = useAction();
  const [content, setContent] = useState(""); const [photo, setPhoto] = useState<string | undefined>();
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";
  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await s.run(() => api(`/api/tasks/${task.id}/reports`, { json: { content, photoUrl: photo } }), "Field report submitted")) { setContent(""); setPhoto(undefined); onChanged(); }
  };
  return (
    <Modal open onClose={onClose} title={task.title} wide>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge value={task.status} />{task.incident && <Link className="link" href={`/incidents/${task.incident.id}`}>{task.incident.title}</Link>}</div>
        {task.description && <p className="whitespace-pre-line">{task.description}</p>}
        <p className="flex flex-wrap items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{task.location} ·{" "}
          <a className="inline-flex items-center gap-1 link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${task.latitude}&mlon=${task.longitude}#map=15/${task.latitude}/${task.longitude}`}>{task.latitude.toFixed(4)}, {task.longitude.toFixed(4)}<ExternalLink className="h-3 w-3" aria-hidden /></a></p>
        {task.team && <p className="flex flex-wrap items-center gap-1.5"><Users className="h-4 w-4" aria-hidden /><b>{task.team.name}:</b> {task.team.members.map((m) => m.user.name).join(", ")}</p>}

        {!done && (
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            {task.status === "ASSIGNED" && <Button busy={busy} onClick={async () => { if (await run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", json: { status: "IN_PROGRESS" } }), "Task started")) onChanged(); }}>Start task</Button>}
            {task.status === "IN_PROGRESS" && <p className="text-slate-600 dark:text-slate-400">Submit a field report below, then complete the task. Completion requires a report.</p>}
          </div>
        )}

        <div><h3 className="mb-2 font-semibold">Field reports ({task.reports.length})</h3>
          {!task.reports.length ? <p className="text-slate-500">No reports yet.</p> : <ul className="space-y-2">{task.reports.map((r) => <li key={r.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50"><p className="whitespace-pre-line">{r.content}</p>{r.photoUrl && <img src={r.photoUrl} alt="Field photograph" className="mt-2 max-h-48 rounded" />}<div className="mt-1 text-xs text-slate-500">{dt(r.createdAt)}</div></li>)}</ul>}
        </div>

        {task.status === "IN_PROGRESS" && (
          <form onSubmit={submitReport} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <h3 className="font-semibold">New field report</h3><FormError message={s.error} />
            <Field label="What happened on site?" error={s.fieldError("content")}>{(i) => <Textarea id={i} rows={3} value={content} onChange={(e) => setContent(e.target.value)} maxLength={4000} />}</Field>
            <Field label="Photograph (optional)">{() => <ImageUpload value={photo} onChange={setPhoto} />}</Field>
            <div className="flex flex-wrap gap-2"><Button type="submit" busy={s.busy} disabled={content.trim().length < 3}>Submit report</Button>
              <Button type="button" variant="secondary" busy={busy} disabled={!task.reports.length && content.trim().length < 3} onClick={async () => {
                const ok = await run(() => api(`/api/tasks/${task.id}`, { method: "PATCH", json: { status: "COMPLETED", report: task.reports.length ? undefined : content, photoUrl: task.reports.length ? undefined : photo } }), "Task completed");
                if (ok) onChanged();
              }}>Complete task</Button></div>
          </form>
        )}
        {done && <p className="text-xs text-slate-500">This task is {label(task.status).toLowerCase()}; its reports are preserved and read-only.</p>}
      </div>
    </Modal>
  );
}

export default function TasksClient() {
  const [status, setStatus] = useState("");
  const { data, error, isLoading, mutate } = useApi<Paged<Task>>(`/api/tasks?pageSize=50${status ? `&status=${status}` : ""}`, 15000);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.data.find((t) => t.id === openId);
  return (
    <>
      <PageHeader title="My tasks" subtitle="Tasks assigned to you. Update progress and file field reports from site." actions={
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto!"><option value="">All statuses</option>{["ASSIGNED", "IN_PROGRESS", "COMPLETED"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>} />
      {isLoading ? <Spinner /> : error ? <ErrorState error={error} retry={() => mutate()} /> : !data?.data.length ? <EmptyState title="No tasks assigned" hint="A coordinator will assign you tasks when help is needed." /> : (
        <ul className="grid gap-3 md:grid-cols-2">{data.data.map((t) => (
          <li key={t.id}><button className="w-full text-left" onClick={() => setOpenId(t.id)}><Card className="transition-colors hover:border-slate-400 dark:hover:border-slate-600">
            <div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{t.title}</h2><Badge value={t.status} /></div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.location}</p>
            <p className="mt-2 text-xs text-slate-500">{t.incident?.title ?? "No incident"} · {t.reports.length} report{t.reports.length === 1 ? "" : "s"} · assigned {ago(t.createdAt)}</p>
          </Card></button></li>
        ))}</ul>
      )}
      {open && <TaskModal task={open} onClose={() => setOpenId(null)} onChanged={() => mutate()} />}
    </>
  );
}
