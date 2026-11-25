"use client";
import { useActionState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Avatar, Notice } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ReportButton } from "@/components/report-button";
import { commentAction, deleteCommentAction } from "@/lib/actions/projects";
import { timeAgo } from "@/lib/utils";

export type CommentRow = { id: string; body: string; created_at: string; moderation: string; author: { id: string; username: string; display_name: string; avatar_url: string | null } | null };

export function Comments({ projectId, comments, viewerId, canModerate }: { projectId: string; comments: CommentRow[]; viewerId: string | null; canModerate: boolean }) {
  const [state, action] = useActionState(commentAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <div className="space-y-5">
      {viewerId ? (
        <form ref={formRef} action={action} className="space-y-2">
          <input type="hidden" name="project_id" value={projectId} />
          <label htmlFor="comment" className="sr-only">Ton commentaire</label>
          <Textarea id="comment" name="body" rows={3} maxLength={2000} required placeholder="Pose une question, encourage, propose une idée…" />
          {state?.error && <Notice tone="danger">{state.error}</Notice>}
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingLabel="Envoi…">Commenter</SubmitButton>
          </div>
        </form>
      ) : (
        <Notice>
          <Link href={`/login?next=/projects/${projectId}?tab=discussion`} className="text-primary-2 hover:underline">Connecte-toi</Link> pour participer à la discussion.
        </Notice>
      )}
      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Pas encore de commentaire. Lance la discussion.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author?.display_name ?? "?"} src={c.author?.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[13px]">
                  {c.author && <Link href={`/u/${c.author.username}`} className="font-medium hover:underline">{c.author.display_name}</Link>}
                  <span className="text-subtle">{timeAgo(c.created_at)}</span>
                  {c.moderation === "hidden" && <span className="text-warning">· masqué par la modération</span>}
                  <span className="ml-auto flex items-center gap-2">
                    {viewerId && c.author?.id !== viewerId && <ReportButton targetType="comment" targetId={c.id} iconOnly />}
                    {(c.author?.id === viewerId || canModerate) && (
                      <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteCommentAction(c.id, projectId)))} className="text-subtle hover:text-danger" aria-label="Supprimer le commentaire">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-fg/90">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
