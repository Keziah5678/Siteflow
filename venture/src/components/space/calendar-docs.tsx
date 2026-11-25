"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Download, FileText, Loader2, MapPin, Trash2, Upload } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/primitives";
import { addCalendarEventAction, deleteCalendarEventAction, deleteDocumentAction, registerDocumentAction } from "@/lib/actions/projects";
import { uploadPrivateFile } from "@/lib/upload";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";

export type CalendarRow = { id: string; title: string; starts_at: string; location: string | null; created_by: string };
export type DocRow = { id: string; name: string; storage_path: string; size_bytes: number; created_at: string; uploaded_by: string };

export function CalendarPanel({ projectId, events, viewerId, isManager }: { projectId: string; events: CalendarRow[]; viewerId: string; isManager: boolean }) {
  const [state, action] = useActionState(addCalendarEventAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.starts_at >= now);
  const past = events.filter((e) => e.starts_at < now).reverse();

  const row = (e: CalendarRow, muted = false) => (
    <li key={e.id} className={`flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 ${muted ? "opacity-60" : ""}`}>
      <div className="w-12 shrink-0 rounded-xl bg-primary-soft py-1.5 text-center">
        <p className="text-[11px] uppercase text-primary-2">{formatDate(e.starts_at, { month: "short" })}</p>
        <p className="text-lg font-semibold leading-none">{new Date(e.starts_at).getDate()}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{e.title}</p>
        <p className="mt-0.5 text-[12px] text-subtle">
          {formatDate(e.starts_at, { weekday: "long", hour: "2-digit", minute: "2-digit" })}
          {e.location && <span className="ml-2 inline-flex items-center gap-1"><MapPin className="size-3" />{e.location}</span>}
        </p>
      </div>
      {(isManager || e.created_by === viewerId) && (
        <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteCalendarEventAction(e.id, projectId)))} className="rounded p-1 text-subtle hover:text-danger" aria-label={`Supprimer ${e.title}`}>
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      <form ref={ref} action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Rendez-vous" htmlFor="cal-title" error={state?.fields?.title}><Input id="cal-title" name="title" required maxLength={160} placeholder="Réunion d'équipe" /></Field>
        <Field label="Date et heure" htmlFor="cal-start" error={state?.fields?.starts_at}><Input id="cal-start" name="starts_at" type="datetime-local" required /></Field>
        <Field label="Lieu ou lien" htmlFor="cal-loc"><Input id="cal-loc" name="location" maxLength={200} /></Field>
        <SubmitButton>Ajouter</SubmitButton>
        {state?.error && <Notice tone="danger" className="sm:col-span-4">{state.error}</Notice>}
      </form>
      {events.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted"><CalendarDays className="size-4" /> Aucun rendez-vous planifié.</p>
      ) : (
        <>
          <ul className="space-y-2">{upcoming.map((e) => row(e))}</ul>
          {past.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[13px] text-subtle">Passés ({past.length})</summary>
              <ul className="mt-2 space-y-2">{past.map((e) => row(e, true))}</ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

export function DocumentsPanel({ projectId, docs, viewerId, isManager }: { projectId: string; docs: DocRow[]; viewerId: string; isManager: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const up = await uploadPrivateFile("project-files", projectId, file, 25 * 1048576);
    if (up.error) {
      setErr(up.error);
      setBusy(false);
      return;
    }
    const res = await registerDocumentAction({ project_id: projectId, name: file.name.slice(0, 200), storage_path: up.path!, size_bytes: file.size, mime_type: file.type || null });
    if (res?.error) setErr(res.error);
    setBusy(false);
    router.refresh();
  }

  async function download(d: DocRow) {
    // Short-lived signed URL: files stay private to the team.
    const { data, error } = await createClient().storage.from("project-files").createSignedUrl(d.storage_path, 60, { download: d.name });
    if (error || !data) return setErr("Téléchargement impossible.");
    window.location.assign(data.signedUrl);
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-6 text-sm text-muted hover:border-primary-2 hover:text-fg">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Envoi…" : "Ajouter un document (25 Mo max.)"}
        <input type="file" className="sr-only" disabled={busy} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {err && <Notice tone="danger">{err}</Notice>}
      {docs.length === 0 ? (
        <p className="text-sm text-muted">Aucun document partagé. Les fichiers ne sont accessibles qu'aux membres de l'équipe.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3.5">
              <FileText className="size-5 shrink-0 text-primary-2" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{d.name}</p>
                <p className="text-[12px] text-subtle">{(d.size_bytes / 1024 < 1024 ? `${Math.max(1, Math.round(d.size_bytes / 1024))} Ko` : `${(d.size_bytes / 1048576).toFixed(1)} Mo`)} · {formatDate(d.created_at)}</p>
              </div>
              <button type="button" onClick={() => download(d)} className="rounded p-1.5 text-muted hover:text-fg" aria-label={`Télécharger ${d.name}`}><Download className="size-4" /></button>
              {(isManager || d.uploaded_by === viewerId) && (
                <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteDocumentAction(d.id, projectId)))} className="rounded p-1.5 text-subtle hover:text-danger" aria-label={`Supprimer ${d.name}`}><Trash2 className="size-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
