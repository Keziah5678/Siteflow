"use client";
import { useActionState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar, Notice } from "@/components/ui/primitives";
import { postUpdateAction } from "@/lib/actions/projects";
import { formatDate } from "@/lib/utils";

export type UpdateRow = { id: string; body: string; created_at: string; author: { display_name: string; avatar_url: string | null } | null };

export function Updates({ projectId, updates, canPost }: { projectId: string; updates: UpdateRow[]; canPost: boolean }) {
  const [state, action] = useActionState(postUpdateAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <div className="space-y-4">
      {canPost && (
        <form ref={ref} action={action} className="space-y-2">
          <input type="hidden" name="project_id" value={projectId} />
          <label htmlFor="update" className="sr-only">Nouvelle actualité</label>
          <Textarea id="update" name="body" rows={2} maxLength={3000} placeholder="Partage une avancée avec les membres et les personnes intéressées…" />
          {state?.error && <Notice tone="danger">{state.error}</Notice>}
          <div className="flex justify-end">
            <SubmitButton size="sm" variant="secondary">Publier l'actualité</SubmitButton>
          </div>
        </form>
      )}
      {updates.length === 0 ? (
        <p className="text-sm text-muted">Aucune actualité pour le moment.</p>
      ) : (
        <ol className="relative space-y-5 border-l border-border pl-5">
          {updates.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
              <div className="flex items-center gap-2 text-[12px] text-subtle">
                <Avatar name={u.author?.display_name ?? "?"} src={u.author?.avatar_url} size={20} />
                {u.author?.display_name} · {formatDate(u.created_at)}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{u.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
