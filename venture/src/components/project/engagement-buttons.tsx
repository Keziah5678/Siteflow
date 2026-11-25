"use client";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Hand, Heart, Share2, Users, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toggleEngagementAction } from "@/lib/actions/projects";
import { ApplyDialog } from "./apply-dialog";
import { cn } from "@/lib/utils";

export type EngagementState = { interested: boolean; participating: boolean; applied: boolean; member: boolean };

export function EngagementButtons({
  projectId,
  title,
  state,
  signedIn,
  closed,
  showParticipate,
  skills,
  compact = false,
}: {
  projectId: string;
  title: string;
  state: EngagementState;
  signedIn: boolean;
  closed: boolean;
  showParticipate: boolean;
  skills: string[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [opt, setOpt] = useOptimistic(state, (s, patch: Partial<EngagementState>) => ({ ...s, ...patch }));

  function requireAuth() {
    router.push(`/login?next=${encodeURIComponent(`/projects/${projectId}`)}`);
  }

  function toggle(kind: "interested" | "participating") {
    if (!signedIn) return requireAuth();
    const on = !opt[kind];
    setError(null);
    start(async () => {
      setOpt({ [kind]: on });
      const res = await toggleEngagementAction(projectId, kind, on);
      if (res?.error === "AUTH_REQUIRED") return requireAuth();
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  async function share() {
    const url = `${window.location.origin}/projects/${projectId}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  }

  const size = compact ? "sm" : "md";
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {opt.member ? (
          <Link href={`/projects/${projectId}/space`} className="inline-flex h-8 items-center gap-2 rounded-xl bg-success-soft px-3 text-[13px] font-medium text-success md:h-10 md:px-4 md:text-sm">
            <Check className="size-4" /> Membre de l'équipe
          </Link>
        ) : (
          <>
            <Button size={size} variant={opt.interested ? "success" : "primary"} onClick={() => toggle("interested")} disabled={pending || closed} aria-pressed={opt.interested}>
              {opt.interested ? <Check /> : <Heart />}
              {opt.interested ? "Intéressé(e)" : "Je suis intéressé"}
            </Button>
            {showParticipate && (
              <Button size={size} variant={opt.participating ? "success" : "secondary"} onClick={() => toggle("participating")} disabled={pending || closed} aria-pressed={opt.participating}>
                {opt.participating ? <Check /> : <Users />}
                {opt.participating ? "Je participe" : "Je participe"}
              </Button>
            )}
            <Button size={size} variant={opt.applied ? "success" : "secondary"} onClick={() => (signedIn ? setApplyOpen(true) : requireAuth())} disabled={opt.applied || closed}>
              {opt.applied ? <Check /> : <Hand />}
              {opt.applied ? "Candidature envoyée" : "Je peux aider"}
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center">
          <Link href={`/projects/${projectId}?tab=discussion`} className="rounded-lg p-2 text-muted hover:bg-bg-2 hover:text-fg" aria-label="Commenter" title="Commenter">
            <MessageSquare className="size-[18px]" />
          </Link>
          <button type="button" onClick={share} className={cn("rounded-lg p-2 text-muted hover:bg-bg-2 hover:text-fg", shared && "text-success")} aria-label={shared ? "Lien copié" : "Partager"} title={shared ? "Lien copié" : "Partager"}>
            {shared ? <Check className="size-[18px]" /> : <Share2 className="size-[18px]" />}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-[12px] text-danger" role="alert">{error}</p>}
      {closed && <p className="mt-2 text-[12px] text-subtle">Ce projet n'accepte plus de nouvelles participations.</p>}
      <ApplyDialog open={applyOpen} onClose={() => setApplyOpen(false)} projectId={projectId} title={title} skills={skills} onDone={() => { setOpt({ applied: true }); router.refresh(); }} />
    </div>
  );
}
