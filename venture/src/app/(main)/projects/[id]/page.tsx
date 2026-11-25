import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, Globe2, LayoutDashboard, MapPin, Megaphone, Pencil, Target, Wallet } from "lucide-react";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEngagementState, PROJECT_CARD_SELECT, type ProjectCardData } from "@/lib/queries";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/constants";
import { missingSkills } from "@/lib/matching";
import { formatDate, formatEuros, formatNumber, progressFromMilestones } from "@/lib/utils";
import { Page } from "@/components/layout/page";
import { Avatar, Badge, Card, Notice, Progress, SectionTitle, Tag } from "@/components/ui/primitives";
import { LinkTabs } from "@/components/ui/tabs";
import { buttonClass } from "@/components/ui/button";
import { EngagementButtons } from "@/components/project/engagement-buttons";
import { DemoBadge } from "@/components/project/project-card";
import { Comments, type CommentRow } from "@/components/project/comments";
import { Updates, type UpdateRow } from "@/components/project/updates";
import { EventBlock, type EventInfo, type Proposal } from "@/components/project/event-block";
import { ReportButton } from "@/components/report-button";

const TABS = ["overview", "team", "steps", "discussion"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(props: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("title, description").eq("id", id).maybeSingle();
  return data ? { title: data.title, description: data.description.slice(0, 160) } : {};
}

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const { user, profile, supabase } = await getViewer();

  const { data: raw } = await supabase.from("projects").select(`${PROJECT_CARD_SELECT}, resources_needed, budget_estimate_cents, moderation, updated_at`).eq("id", id).maybeSingle();
  if (!raw) notFound();
  const project = raw as unknown as ProjectCardData & { resources_needed: string[]; budget_estimate_cents: number | null; moderation: string };

  const [{ data: members }, { data: milestones }, { data: updates }, { count: commentCount }, { data: eventDetails }] = await Promise.all([
    supabase.from("project_members").select("user_id, role, responsibility, joined_at, profile:profiles(id, username, display_name, avatar_url, skills)").eq("project_id", id).order("joined_at"),
    supabase.from("milestones").select("id, title, description, done, done_at, due_date").eq("project_id", id).order("position"),
    supabase.from("project_updates").select("id, body, created_at, author:profiles(display_name, avatar_url)").eq("project_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("project_id", id),
    project.category === "event" ? supabase.from("event_details").select("*").eq("project_id", id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const states = await getEngagementState(supabase, user?.id ?? null, [id]);
  const state = states.get(id)!;
  const myRole = members?.find((m) => m.user_id === user?.id)?.role ?? null;
  const isManager = myRole === "owner" || myRole === "admin";
  const isStaff = profile?.platform_role != null && profile.platform_role !== "user";

  let comments: CommentRow[] = [];
  if (tab === "discussion") {
    const { data } = await supabase.from("comments").select("id, body, created_at, moderation, author:profiles(id, username, display_name, avatar_url)").eq("project_id", id).order("created_at", { ascending: true }).limit(200);
    comments = (data ?? []) as unknown as CommentRow[];
  }

  let proposals: Proposal[] = [];
  let hasProposed = false;
  if (project.category === "event" && user) {
    const { data } = await supabase.from("organizer_proposals").select("id, message, proposed_date, proposed_venue, proposed_price_cents, status, organizer_id, organizer:profiles!organizer_proposals_organizer_id_fkey(display_name, username)").eq("project_id", id).order("created_at");
    proposals = (data ?? []) as unknown as Proposal[];
    hasProposed = (data ?? []).some((p) => p.organizer_id === user.id);
  }

  const teamSkills = (members ?? []).flatMap((m) => (m.profile as { skills: string[] } | null)?.skills ?? []);
  const missing = missingSkills(project.skills_needed, teamSkills);
  const stepsPct = progressFromMilestones(project.milestones_done, project.milestones_total);
  const interestPct = project.interest_goal ? Math.min(100, Math.round((project.interest_count / project.interest_goal) * 100)) : null;
  const closed = project.status === "completed" || project.status === "cancelled";
  const base = `/projects/${id}`;

  return (
    <Page wide className="max-w-[880px]">
      {sp.created === "1" && isManager && (
        <Notice tone="success" title="Ton projet est publié" className="mb-5">
          Il apparaît maintenant dans le fil et la recherche. Ouvre l'<Link href={`${base}/space`} className="font-medium text-primary-2 hover:underline">espace projet</Link> pour organiser l'équipe, les tâches et utiliser VENTURE AI.
        </Notice>
      )}
      {project.moderation === "hidden" && <Notice tone="warning" title="Projet masqué par la modération" className="mb-5">Il n'est visible que par toi et l'équipe de modération.</Notice>}

      {project.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover
        <img src={project.cover_url} alt="" className="mb-6 aspect-[2.6/1] w-full rounded-2xl border border-border object-cover" />
      ) : (
        <div className="v-glow mb-6 h-24 rounded-2xl border border-border bg-card sm:h-32" aria-hidden="true" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{CATEGORY_LABEL[project.category]}</Badge>
        <Badge tone={project.status === "completed" ? "success" : project.status === "cancelled" ? "danger" : "neutral"}>{STATUS_LABEL[project.status]}</Badge>
        {project.is_demo && <DemoBadge />}
        {project.sponsor_id && <Badge tone="outline"><Megaphone /> Sponsorisé</Badge>}
      </div>
      <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">{project.title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        {project.owner && (
          <Link href={`/u/${project.owner.username}`} className="flex items-center gap-2.5">
            <Avatar name={project.owner.display_name} src={project.owner.avatar_url} size={36} />
            <span>
              <span className="block text-sm font-medium">{project.owner.display_name}</span>
              <span className="block text-[12px] text-subtle">Créé le {formatDate(project.created_at)}</span>
            </span>
          </Link>
        )}
        {(project.city || project.is_remote) && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
            {project.is_remote ? <Globe2 className="size-3.5" /> : <MapPin className="size-3.5" />}
            {[project.city, project.is_remote ? "À distance" : null].filter(Boolean).join(" · ")}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {myRole && (
            <Link href={`${base}/space`} className={buttonClass("secondary", "sm")}>
              <LayoutDashboard /> Espace projet
            </Link>
          )}
          {isManager && (
            <Link href={`${base}/edit`} className={buttonClass("ghost", "sm")} aria-label="Modifier le projet">
              <Pencil /> Modifier
            </Link>
          )}
        </div>
      </div>

      <Card className="mt-6 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span><strong className="text-[20px] font-semibold">{formatNumber(project.interest_count)}</strong> <span className="text-muted">intéressé{project.interest_count > 1 ? "s" : ""}</span></span>
              {project.interest_goal && <span className="text-subtle">Objectif : {formatNumber(project.interest_goal)}</span>}
            </div>
            {interestPct != null && <Progress value={interestPct} label="Intérêt par rapport à l'objectif" />}
            <p className="mt-2 text-[13px] text-muted">
              {formatNumber(project.participant_count)} participant{project.participant_count > 1 ? "s" : ""} confirmé{project.participant_count > 1 ? "s" : ""} · {project.member_count} dans l'équipe
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span><strong className="text-[20px] font-semibold">{stepsPct}%</strong> <span className="text-muted">réalisé</span></span>
              <span className="text-subtle">{project.milestones_done}/{project.milestones_total} étapes</span>
            </div>
            <Progress value={stepsPct} label="Étapes terminées" />
            <p className="mt-2 text-[13px] text-muted">La progression dépend des étapes réellement terminées.</p>
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <EngagementButtons projectId={id} title={project.title} state={state} signedIn={!!user} closed={closed} showParticipate={project.category === "event" || project.category === "people"} skills={project.skills_needed} />
        </div>
      </Card>

      <LinkTabs
        className="mt-8"
        active={tab}
        tabs={[
          { key: "overview", label: "Présentation", href: base },
          { key: "team", label: "Équipe", href: `${base}?tab=team`, count: project.member_count },
          { key: "steps", label: "Étapes", href: `${base}?tab=steps`, count: project.milestones_total },
          { key: "discussion", label: "Discussion", href: `${base}?tab=discussion`, count: commentCount ?? 0 },
        ]}
      />

      <div className="mt-6 space-y-6">
        {tab === "overview" && (
          <>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-fg/90">{project.description}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {project.goal && (
                <Card className="p-4">
                  <p className="flex items-center gap-2 text-[13px] text-subtle"><Target className="size-3.5" /> Objectif</p>
                  <p className="mt-1.5 text-sm font-medium">{project.goal}</p>
                </Card>
              )}
              {project.budget_estimate_cents != null && (
                <Card className="p-4">
                  <p className="flex items-center gap-2 text-[13px] text-subtle"><Wallet className="size-3.5" /> Budget estimatif</p>
                  <p className="mt-1.5 text-sm font-medium">{formatEuros(project.budget_estimate_cents)} <span className="font-normal text-subtle">(indicatif)</span></p>
                </Card>
              )}
            </div>
            {project.skills_needed.length > 0 && (
              <section>
                <SectionTitle>Compétences recherchées</SectionTitle>
                <div className="flex flex-wrap gap-1.5">{project.skills_needed.map((s) => <Tag key={s}>{s}</Tag>)}</div>
              </section>
            )}
            {project.resources_needed.length > 0 && (
              <section>
                <SectionTitle>Ressources nécessaires</SectionTitle>
                <div className="flex flex-wrap gap-1.5">{project.resources_needed.map((s) => <Tag key={s}>{s}</Tag>)}</div>
              </section>
            )}
            {eventDetails && (
              <EventBlock projectId={id} event={eventDetails as EventInfo} proposals={proposals} isManager={isManager} isVerifiedOrganizer={!!profile?.is_verified_organizer} hasProposed={hasProposed} signedIn={!!user} />
            )}
            <section>
              <SectionTitle>Actualités</SectionTitle>
              <Updates projectId={id} updates={(updates ?? []) as unknown as UpdateRow[]} canPost={isManager} />
            </section>
          </>
        )}

        {tab === "team" && (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {(members ?? []).map((m) => {
                const pr = m.profile as { id: string; username: string; display_name: string; avatar_url: string | null } | null;
                if (!pr) return null;
                return (
                  <li key={m.user_id}>
                    <Link href={`/u/${pr.username}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 hover:border-border-strong">
                      <Avatar name={pr.display_name} src={pr.avatar_url} size={40} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{pr.display_name}</span>
                        <span className="block truncate text-[12px] text-subtle">
                          {m.role === "owner" ? "Créateur" : m.role === "admin" ? "Administrateur" : "Membre"}
                          {m.responsibility ? ` · ${m.responsibility}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {missing.length > 0 && !closed && (
              <Card className="p-4">
                <p className="text-sm font-medium">Compétences encore recherchées</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{missing.map((s) => <Tag key={s}>{s}</Tag>)}</div>
                <p className="mt-3 text-[13px] text-muted">Tu as l'une de ces compétences ? Clique sur « Je peux aider » pour candidater.</p>
              </Card>
            )}
            {isManager && (
              <Link href={`${base}/space?tab=team`} className={buttonClass("secondary", "sm")}>Gérer l'équipe et les candidatures</Link>
            )}
          </>
        )}

        {tab === "steps" && (
          <>
            {(milestones ?? []).length === 0 ? (
              <p className="text-sm text-muted">Aucune étape définie pour le moment.</p>
            ) : (
              <ol className="space-y-2">
                {(milestones ?? []).map((m, i) => (
                  <li key={m.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                    {m.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-subtle" />}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${m.done ? "text-muted line-through decoration-subtle" : ""}`}>{i + 1}. {m.title}</p>
                      {m.description && <p className="mt-1 text-[13px] text-muted">{m.description}</p>}
                      <p className="mt-1 text-[12px] text-subtle">
                        {m.done && m.done_at ? `Terminée le ${formatDate(m.done_at)}` : m.due_date ? `Échéance : ${formatDate(m.due_date)}` : "À venir"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {myRole && <Link href={`${base}/space?tab=steps`} className={buttonClass("secondary", "sm")}>Gérer les étapes</Link>}
          </>
        )}

        {tab === "discussion" && <Comments projectId={id} comments={comments} viewerId={user?.id ?? null} canModerate={isManager || isStaff} />}
      </div>

      {user && !myRole && (
        <div className="mt-10 border-t border-border pt-4">
          <ReportButton targetType="project" targetId={id} label="Signaler ce projet" />
        </div>
      )}
    </Page>
  );
}
