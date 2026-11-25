"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice, Progress } from "@/components/ui/primitives";
import { addMilestoneAction, deleteMilestoneAction, toggleMilestoneAction } from "@/lib/actions/projects";
import { formatDate, progressFromMilestones } from "@/lib/utils";

export type MilestoneRow = { id: string; title: string; description: string | null; done: boolean; due_date: string | null; done_at: string | null };

export function StepsManager({ projectId, milestones, isManager }: { projectId: string; milestones: MilestoneRow[]; isManager: boolean }) {
  const [state, action] = useActionState(addMilestoneAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const done = milestones.filter((m) => m.done).length;
  const pct = progressFromMilestones(done, milestones.length);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex justify-between text-[13px]"><span className="font-medium">Progression : {pct}%</span><span className="text-subtle">{done}/{milestones.length} étapes terminées</span></div>
        <Progress value={pct} label="Progression du projet" />
      </div>
      {milestones.length === 0 && <p className="text-sm text-muted">Aucune étape. {isManager ? "Ajoute la première ou demande une feuille de route à VENTURE AI." : ""}</p>}
      <ol className="space-y-2">
        {milestones.map((m, i) => (
          <li key={m.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { const r = await toggleMilestoneAction(m.id, !m.done, projectId); setErr(r?.error ?? null); })}
              aria-pressed={m.done}
              aria-label={m.done ? `Rouvrir l'étape ${m.title}` : `Marquer l'étape ${m.title} comme terminée`}
              className="mt-0.5 shrink-0"
            >
              {m.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-subtle hover:text-primary-2" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${m.done ? "text-muted line-through" : ""}`}>{i + 1}. {m.title}</p>
              {m.description && <p className="mt-0.5 text-[13px] text-muted">{m.description}</p>}
              <p className="mt-1 text-[12px] text-subtle">{m.done && m.done_at ? `Terminée le ${formatDate(m.done_at)}` : m.due_date ? `Échéance : ${formatDate(m.due_date)}` : ""}</p>
            </div>
            {isManager && (
              <button type="button" disabled={pending} onClick={() => start(async () => { const r = await deleteMilestoneAction(m.id, projectId); setErr(r?.error ?? null); })} className="rounded p-1 text-subtle hover:text-danger" aria-label={`Supprimer l'étape ${m.title}`}>
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {err && <Notice tone="danger">{err}</Notice>}
      {isManager && (
        <form ref={ref} action={action} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <input type="hidden" name="project_id" value={projectId} />
          <Field label="Nouvelle étape" htmlFor="ms-title" error={state?.fields?.title}><Input id="ms-title" name="title" required maxLength={160} /></Field>
          <Field label="Échéance" htmlFor="ms-due"><Input id="ms-due" name="due_date" type="date" /></Field>
          <SubmitButton>Ajouter</SubmitButton>
          {state?.error && <Notice tone="danger" className="sm:col-span-3">{state.error}</Notice>}
        </form>
      )}
    </div>
  );
}
