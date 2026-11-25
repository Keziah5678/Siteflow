import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle, Target } from "lucide-react";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { isAIConfigured } from "@/lib/env";
import { getQuota } from "@/lib/ai/service";
import { missingSkills, rankCandidates, type MatchCandidate } from "@/lib/matching";
import { STATUS_LABEL } from "@/lib/constants";
import { progressFromMilestones } from "@/lib/utils";
import { Page } from "@/components/layout/page";
import { LinkTabs } from "@/components/ui/tabs";
import { Card, Progress, SectionTitle } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { TasksBoard, type TaskRow } from "@/components/space/tasks";
import { StepsManager, type MilestoneRow } from "@/components/space/steps";
import { TeamPanel, type ApplicationRow, type TeamMember } from "@/components/space/team";
import { CalendarPanel, DocumentsPanel, type CalendarRow, type DocRow } from "@/components/space/calendar-docs";
import { AIPanel } from "@/components/space/ai-panel";
import { StatusSelect } from "@/components/space/status-select";

export const metadata: Metadata = { title: "Espace projet" };

const TABS = ["overview", "tasks", "steps", "team", "calendar", "docs", "ai"] as const;
type Tab = (typeof TABS)[number];

export default async function SpacePage(props: PageProps<"/projects/[id]/space">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "overview";
  const { user, supabase } = await requireViewer(`/projects/${id}/space`);

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();
  const { data: me } = await supabase.from("project_members").select("role").eq("project_id", id).eq("user_id", user.id).maybeSingle();
  if (!me) redirect(`/projects/${id}`); // not a member: no access to the collaborative space
  const isManager = me.role === "owner" || me.role === "admin";

  const [{ data: membersRaw }, { data: milestones }, { data: tasks }, { data: conv }, { count: pendingCount }] = await Promise.all([
    supabase.from("project_members").select("user_id, role, responsibility, profile:profiles(display_name, username, avatar_url, skills)").eq("project_id", id).order("joined_at"),
    supabase.from("milestones").select("id, title, description, done, due_date, done_at").eq("project_id", id).order("position"),
    supabase.from("tasks").select("id, title, status, assignee_id, due_date, milestone_id, created_by").eq("project_id", id).order("created_at"),
    supabase.from("conversations").select("id").eq("project_id", id).maybeSingle(),
    isManager ? supabase.from("applications").select("id", { count: "exact", head: true }).eq("project_id", id).eq("status", "pending") : Promise.resolve({ count: 0 }),
  ]);

  const members: TeamMember[] = (membersRaw ?? []).map((m) => {
    const p = m.profile as { display_name: string; username: string; avatar_url: string | null; skills: string[] } | null;
    return { user_id: m.user_id, role: m.role, responsibility: m.responsibility, display_name: p?.display_name ?? "?", username: p?.username ?? "", avatar_url: p?.avatar_url ?? null, skills: p?.skills ?? [] };
  });
  const missing = missingSkills(project.skills_needed, members.flatMap((m) => m.skills));

  let applications: ApplicationRow[] = [];
  let matches = null;
  if (tab === "team" && isManager) {
    const [{ data: apps }, { data: cands }] = await Promise.all([
      supabase.from("applications").select("id, skill, message, created_at, applicant:profiles!applications_applicant_id_fkey(id, username, display_name, avatar_url, skills)").eq("project_id", id).eq("status", "pending").order("created_at"),
      supabase.rpc("matching_candidates", { p_project: id, p_limit: 200 }),
    ]);
    applications = (apps ?? []) as unknown as ApplicationRow[];
    matches = rankCandidates(
      { title: project.title, description: project.description, category: project.category, skills_needed: project.skills_needed, is_remote: project.is_remote, has_location: project.lat != null },
      (cands ?? []) as MatchCandidate[],
      8,
    );
  }

  let events: CalendarRow[] = [];
  let docs: DocRow[] = [];
  if (tab === "calendar" || tab === "overview") {
    const { data } = await supabase.from("calendar_events").select("id, title, starts_at, location, created_by").eq("project_id", id).order("starts_at");
    events = data ?? [];
  }
  if (tab === "docs") {
    const { data } = await supabase.from("project_documents").select("id, name, storage_path, size_bytes, created_at, uploaded_by").eq("project_id", id).order("created_at", { ascending: false });
    docs = data ?? [];
  }
  const ai = isAIConfigured();
  const quota = tab === "ai" && ai ? await getQuota(supabase) : null;

  const base = `/projects/${id}/space`;
  const ms = (milestones ?? []) as MilestoneRow[];
  const pct = progressFromMilestones(ms.filter((m) => m.done).length, ms.length);
  const myTasks = (tasks ?? []).filter((t) => t.assignee_id === user.id && t.status !== "done");
  const nextStep = ms.find((m) => !m.done);
  const nextEvent = events.find((e) => e.starts_at >= new Date().toISOString());

  return (
    <Page wide>
      <Link href={`/projects/${id}`} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg"><ArrowLeft className="size-3.5" /> Page publique du projet</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary-2">Espace projet</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isManager ? <StatusSelect projectId={id} status={project.status} /> : <span className="text-[13px] text-muted">{STATUS_LABEL[project.status]}</span>}
          {conv && <Link href={`/messages/${conv.id}`} className={buttonClass("primary", "sm")}><MessageCircle /> Discussion d'équipe</Link>}
        </div>
      </div>

      <LinkTabs
        className="mt-6"
        active={tab}
        tabs={[
          { key: "overview", label: "Objectifs", href: base },
          { key: "tasks", label: "Tâches", href: `${base}?tab=tasks`, count: (tasks ?? []).filter((t) => t.status !== "done").length },
          { key: "steps", label: "Étapes", href: `${base}?tab=steps` },
          { key: "team", label: "Équipe", href: `${base}?tab=team`, count: isManager ? (pendingCount ?? 0) : undefined },
          { key: "calendar", label: "Calendrier", href: `${base}?tab=calendar` },
          { key: "docs", label: "Documents", href: `${base}?tab=docs` },
          { key: "ai", label: "VENTURE AI", href: `${base}?tab=ai` },
        ]}
      />

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5 md:col-span-2">
              <p className="flex items-center gap-2 text-[13px] text-subtle"><Target className="size-3.5" /> Objectif</p>
              <p className="mt-1.5 text-[15px] font-medium">{project.goal ?? "Aucun objectif défini."}</p>
              <div className="mt-4"><div className="mb-1.5 flex justify-between text-[13px]"><span>{pct}% réalisé</span><span className="text-subtle">{ms.filter((m) => m.done).length}/{ms.length} étapes</span></div><Progress value={pct} label="Progression" /></div>
            </Card>
            <Card className="p-5">
              <SectionTitle>Prochaine étape</SectionTitle>
              <p className="text-sm">{nextStep ? nextStep.title : ms.length ? "Toutes les étapes sont terminées." : "Aucune étape définie."}</p>
              <Link href={`${base}?tab=steps`} className="mt-3 inline-block text-[13px] text-primary-2 hover:underline">Gérer les étapes</Link>
            </Card>
            <Card className="p-5">
              <SectionTitle>Mes tâches</SectionTitle>
              {myTasks.length === 0 ? <p className="text-sm text-muted">Aucune tâche ouverte qui t'est assignée.</p> : <ul className="space-y-1 text-sm">{myTasks.slice(0, 5).map((t) => <li key={t.id}>• {t.title}</li>)}</ul>}
              <Link href={`${base}?tab=tasks`} className="mt-3 inline-block text-[13px] text-primary-2 hover:underline">Voir toutes les tâches</Link>
            </Card>
            <Card className="p-5">
              <SectionTitle>Prochain rendez-vous</SectionTitle>
              <p className="text-sm">{nextEvent ? `${nextEvent.title} — ${new Date(nextEvent.starts_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}` : "Aucun rendez-vous planifié."}</p>
            </Card>
            <Card className="p-5">
              <SectionTitle>Équipe</SectionTitle>
              <p className="text-sm">{members.length} membre{members.length > 1 ? "s" : ""}{isManager && pendingCount ? ` · ${pendingCount} candidature${pendingCount > 1 ? "s" : ""} en attente` : ""}</p>
              {missing.length > 0 && <p className="mt-1 text-[13px] text-muted">Encore recherché : {missing.join(", ")}</p>}
              <Link href={`${base}?tab=team`} className="mt-3 inline-block text-[13px] text-primary-2 hover:underline">Voir l'équipe</Link>
            </Card>
          </div>
        )}
        {tab === "tasks" && <TasksBoard projectId={id} tasks={(tasks ?? []) as TaskRow[]} members={members} milestones={ms.map((m) => ({ id: m.id, title: m.title }))} viewerId={user.id} isManager={isManager} />}
        {tab === "steps" && <StepsManager projectId={id} milestones={ms} isManager={isManager} />}
        {tab === "team" && <TeamPanel projectId={id} members={members} applications={applications} viewerId={user.id} viewerRole={me.role} matches={matches} missing={missing} />}
        {tab === "calendar" && <CalendarPanel projectId={id} events={events} viewerId={user.id} isManager={isManager} />}
        {tab === "docs" && <DocumentsPanel projectId={id} docs={docs} viewerId={user.id} isManager={isManager} />}
        {tab === "ai" && <AIPanel projectId={id} configured={ai} remaining={quota?.remaining ?? null} isManager={isManager} isEvent={project.category === "event"} />}
      </div>
    </Page>
  );
}
