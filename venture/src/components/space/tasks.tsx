"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar, Notice } from "@/components/ui/primitives";
import { addTaskAction, deleteTaskAction, updateTaskAction } from "@/lib/actions/projects";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type Member = { user_id: string; display_name: string; avatar_url: string | null };
export type TaskRow = { id: string; title: string; status: "todo" | "doing" | "done"; assignee_id: string | null; due_date: string | null; milestone_id: string | null; created_by: string };
type MilestoneLite = { id: string; title: string };

const COLUMNS = [
  { key: "todo", label: "À faire" },
  { key: "doing", label: "En cours" },
  { key: "done", label: "Terminé" },
] as const;

export function TasksBoard({ projectId, tasks, members, milestones, viewerId, isManager }: { projectId: string; tasks: TaskRow[]; members: Member[]; milestones: MilestoneLite[]; viewerId: string; isManager: boolean }) {
  const [state, action] = useActionState(addTaskAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const byId = new Map(members.map((m) => [m.user_id, m]));

  return (
    <div className="space-y-6">
      <form ref={ref} action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Nouvelle tâche" htmlFor="task-title" error={state?.fields?.title}>
          <Input id="task-title" name="title" required maxLength={200} placeholder="Ex. : Contacter trois lieux" />
        </Field>
        <Field label="Assignée à" htmlFor="task-assignee">
          <Select id="task-assignee" name="assignee_id" defaultValue="">
            <option value="">Personne</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
          </Select>
        </Field>
        <Field label="Étape" htmlFor="task-ms">
          <Select id="task-ms" name="milestone_id" defaultValue="">
            <option value="">Aucune</option>
            {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </Select>
        </Field>
        <div className="flex items-end gap-2">
          <Field label="Échéance" htmlFor="task-due"><Input id="task-due" name="due_date" type="date" /></Field>
          <SubmitButton>Ajouter</SubmitButton>
        </div>
        {state?.error && <Notice tone="danger" className="sm:col-span-4">{state.error}</Notice>}
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <section key={col.key} aria-label={col.label} className="rounded-2xl border border-border bg-bg-2/60 p-3">
              <h3 className="mb-3 flex items-center justify-between px-1 text-[13px] font-semibold">
                {col.label} <span className="text-subtle">{items.length}</span>
              </h3>
              <ul className="space-y-2">
                {items.length === 0 && <li className="px-1 py-3 text-[12px] text-subtle">Aucune tâche</li>}
                {items.map((t) => {
                  const a = t.assignee_id ? byId.get(t.assignee_id) : null;
                  const overdue = t.due_date && t.status !== "done" && t.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <li key={t.id} className="rounded-xl border border-border bg-card p-3">
                      <p className={cn("text-sm", t.status === "done" && "text-muted line-through")}>{t.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-subtle">
                        {a && <span className="inline-flex items-center gap-1"><Avatar name={a.display_name} src={a.avatar_url} size={18} />{a.display_name}</span>}
                        {t.due_date && <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}><CalendarDays className="size-3" />{formatDate(t.due_date, { day: "numeric", month: "short" })}</span>}
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <label className="sr-only" htmlFor={`st-${t.id}`}>Statut</label>
                        <select
                          id={`st-${t.id}`}
                          value={t.status}
                          disabled={pending}
                          onChange={(e) => start(async () => void (await updateTaskAction(t.id, projectId, { status: e.target.value })))}
                          className="h-7 rounded-lg border border-border bg-bg-2 px-2 text-[12px]"
                        >
                          {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                        <label className="sr-only" htmlFor={`as-${t.id}`}>Assignation</label>
                        <select
                          id={`as-${t.id}`}
                          value={t.assignee_id ?? ""}
                          disabled={pending}
                          onChange={(e) => start(async () => void (await updateTaskAction(t.id, projectId, { assignee_id: e.target.value || null })))}
                          className="h-7 min-w-0 flex-1 rounded-lg border border-border bg-bg-2 px-2 text-[12px]"
                        >
                          <option value="">Non assignée</option>
                          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}
                        </select>
                        {(isManager || t.created_by === viewerId) && (
                          <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteTaskAction(t.id, projectId)))} className="rounded p-1 text-subtle hover:text-danger" aria-label={`Supprimer ${t.title}`}>
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
