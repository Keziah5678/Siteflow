import Link from "next/link";
import { CalendarDays, FlaskConical, Globe2, MapPin, Megaphone, Target } from "lucide-react";
import { Avatar, Badge, Card, Progress, Tag } from "@/components/ui/primitives";
import { CATEGORY_LABEL, EVENT_STAGE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatEuros, formatNumber, progressFromMilestones, timeAgo } from "@/lib/utils";
import type { ProjectCardData } from "@/lib/queries";
import { EngagementButtons, type EngagementState } from "./engagement-buttons";

export function DemoBadge() {
  return (
    <Badge tone="warning" title="Ce projet et ses chiffres sont fictifs, à des fins de démonstration.">
      <FlaskConical /> Donnée de démonstration
    </Badge>
  );
}

export function ProjectCard({ project, state, signedIn, reason }: { project: ProjectCardData; state: EngagementState; signedIn: boolean; reason?: string | null }) {
  const isEvent = project.category === "event";
  const interestPct = project.interest_goal ? Math.min(100, Math.round((project.interest_count / project.interest_goal) * 100)) : null;
  const stepsPct = progressFromMilestones(project.milestones_done, project.milestones_total);
  const closed = project.status === "completed" || project.status === "cancelled";
  const ev = project.event_details;

  return (
    <Card className="animate-rise overflow-hidden transition-colors hover:border-border-strong">
      {project.cover_url && (
        <Link href={`/projects/${project.id}`} tabIndex={-1} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover from Supabase Storage */}
          <img src={project.cover_url} alt="" className="aspect-[2.4/1] w-full object-cover" loading="lazy" />
        </Link>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {project.owner && (
            <Link href={`/u/${project.owner.username}`} className="flex min-w-0 items-center gap-2.5">
              <Avatar name={project.owner.display_name} src={project.owner.avatar_url} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{project.owner.display_name}</span>
                <span className="block text-[12px] text-subtle">{timeAgo(project.created_at)}</span>
              </span>
            </Link>
          )}
          <div className="ml-auto flex flex-wrap justify-end gap-1.5">
            <Badge tone="primary">{CATEGORY_LABEL[project.category]}</Badge>
          </div>
        </div>

        {(project.is_demo || project.sponsor_id || reason) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.is_demo && <DemoBadge />}
            {project.sponsor_id && (
              <Badge tone="outline">
                <Megaphone /> Sponsorisé
              </Badge>
            )}
            {reason && <Badge tone="neutral">{reason}</Badge>}
          </div>
        )}

        <Link href={`/projects/${project.id}`} className="group mt-3 block">
          <h3 className="text-[17px] font-semibold leading-snug tracking-tight group-hover:text-primary-2">{project.title}</h3>
          <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-muted">{project.description}</p>
        </Link>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-muted">
          {(project.city || project.is_remote) && (
            <span className="inline-flex items-center gap-1.5">
              {project.is_remote ? <Globe2 className="size-3.5" /> : <MapPin className="size-3.5" />}
              {[project.city, project.is_remote ? "À distance" : null].filter(Boolean).join(" · ")}
            </span>
          )}
          {project.goal && (
            <span className="inline-flex items-center gap-1.5">
              <Target className="size-3.5" /> {project.goal}
            </span>
          )}
          {isEvent && ev && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" /> {EVENT_STAGE_LABEL[ev.stage]}
              {ev.price_min_cents != null && ` · dès ${formatEuros(ev.price_min_cents)} (indicatif)`}
            </span>
          )}
          {!isEvent && <span>{STATUS_LABEL[project.status]}</span>}
        </div>

        {/* Progress: interest towards goal (events) or completed steps */}
        <div className="mt-4 space-y-3 rounded-xl bg-bg-2 p-3.5">
          {interestPct != null && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span>
                  <strong className="font-semibold">{formatNumber(project.interest_count)}</strong> <span className="text-muted">personnes intéressées</span>
                </span>
                <span className="text-subtle">Objectif : {formatNumber(project.interest_goal!)}</span>
              </div>
              <Progress value={interestPct} label="Intérêt par rapport à l'objectif" />
            </div>
          )}
          {project.milestones_total > 0 && (
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                <span className="text-muted">Progression</span>
                <span className="text-subtle">
                  {project.milestones_done}/{project.milestones_total} étapes
                </span>
              </div>
              <Progress value={stepsPct} label="Étapes terminées" />
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 text-[13px] text-muted">
            {interestPct == null && (
              <span>
                <strong className="font-semibold text-fg">{formatNumber(project.interest_count)}</strong> intéressé{project.interest_count > 1 ? "s" : ""}
              </span>
            )}
            {(isEvent || project.participant_count > 0) && (
              <span>
                <strong className="font-semibold text-fg">{formatNumber(project.participant_count)}</strong> participant{project.participant_count > 1 ? "s" : ""} confirmé{project.participant_count > 1 ? "s" : ""}
              </span>
            )}
            <span>
              <strong className="font-semibold text-fg">{project.member_count}</strong> dans l'équipe
            </span>
          </div>
        </div>

        {project.skills_needed.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-subtle">Compétences recherchées</p>
            <div className="flex flex-wrap gap-1.5">
              {project.skills_needed.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <EngagementButtons
            projectId={project.id}
            title={project.title}
            state={state}
            signedIn={signedIn}
            closed={closed}
            showParticipate={isEvent || project.category === "people"}
            skills={project.skills_needed}
            compact
          />
        </div>
      </div>
    </Card>
  );
}
