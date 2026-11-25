import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BadgeCheck, Building2, Clock, ExternalLink, MapPin, Settings, Sparkles } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AVAILABILITY_LABEL, CATEGORY_LABEL, EXPERIENCE_LABEL, STATUS_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Page } from "@/components/layout/page";
import { Avatar, Badge, Card, EmptyState, SectionTitle, Tag } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { ContactActions, EndorseForm } from "@/components/profile/profile-actions";
import { BlockButton } from "@/components/profile/block-button";
import { ReportButton } from "@/components/report-button";

export async function generateMetadata(props: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name, bio").eq("username", username.toLowerCase()).maybeSingle();
  return data ? { title: data.display_name, description: data.bio.slice(0, 160) || undefined } : { title: "Profil" };
}

type ProjLite = { id: string; title: string; category: keyof typeof CATEGORY_LABEL; status: keyof typeof STATUS_LABEL; is_demo: boolean };

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const { user, profile: viewer, supabase } = await getViewer();
  const { data: p } = await supabase.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  if (!p) notFound(); // also covers "members only" profiles for visitors (RLS)
  const isMe = user?.id === p.id;

  const [{ data: memberships }, { data: endorsements }] = await Promise.all([
    supabase.from("project_members").select("role, project:projects(id, title, category, status, is_demo)").eq("user_id", p.id).order("joined_at", { ascending: false }),
    supabase.from("endorsements").select("id, body, created_at, author:profiles!endorsements_author_id_fkey(username, display_name, avatar_url), project:projects(id, title)").eq("recipient_id", p.id).order("created_at", { ascending: false }),
  ]);
  const rows = (memberships ?? []).filter((m) => m.project) as unknown as { role: string; project: ProjLite }[];
  const created = rows.filter((r) => r.role === "owner").map((r) => r.project);
  const joined = rows.filter((r) => r.role !== "owner").map((r) => r.project);
  const completed = rows.filter((r) => r.project.status === "completed").map((r) => r.project);

  // Relationship with the viewer
  let canMessage = false;
  let pendingRequest = false;
  let blocked = false;
  let sharedProjects: { id: string; title: string }[] = [];
  if (user && !isMe) {
    const [{ data: mine }, { data: req }, { data: blk }] = await Promise.all([
      supabase.from("project_members").select("project_id, project:projects(title)").eq("user_id", user.id),
      supabase.from("contact_requests").select("status, from_id").or(`and(from_id.eq.${user.id},to_id.eq.${p.id}),and(from_id.eq.${p.id},to_id.eq.${user.id})`),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id).eq("blocked_id", p.id).maybeSingle(),
    ]);
    const theirIds = new Set(rows.map((r) => r.project.id));
    sharedProjects = (mine ?? []).filter((m) => theirIds.has(m.project_id)).map((m) => ({ id: m.project_id, title: (m.project as { title: string } | null)?.title ?? "" }));
    canMessage = sharedProjects.length > 0 || (req ?? []).some((r) => r.status === "accepted");
    pendingRequest = (req ?? []).some((r) => r.status === "pending" && r.from_id === user.id);
    blocked = !!blk;
  }

  const projectList = (items: ProjLite[], empty: string) =>
    items.length === 0 ? (
      <p className="text-sm text-muted">{empty}</p>
    ) : (
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((pr) => (
          <li key={pr.id}>
            <Link href={`/projects/${pr.id}`} className="block rounded-2xl border border-border bg-card p-3.5 hover:border-border-strong">
              <span className="line-clamp-1 text-sm font-medium">{pr.title}</span>
              <span className="mt-1 block text-[12px] text-subtle">{CATEGORY_LABEL[pr.category]} · {STATUS_LABEL[pr.status]}{pr.is_demo ? " · démo" : ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <Page>
      <Card className="v-glow p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={p.display_name} src={p.avatar_url} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {p.display_name}
              {p.is_verified_organizer && <BadgeCheck className="size-5 text-primary-2" aria-label="Organisateur vérifié" />}
            </h1>
            <p className="text-[14px] text-subtle">@{p.username}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              {p.account_type === "business" && p.company_name && <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" />{p.company_name}</span>}
              {p.city && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{p.city}</span>}
              <span className="inline-flex items-center gap-1.5"><Clock className="size-3.5" />{AVAILABILITY_LABEL[p.availability]}</span>
              <span>{EXPERIENCE_LABEL[p.experience]}</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {isMe ? (
              <Link href="/settings" className={buttonClass("secondary")}><Settings /> Modifier le profil</Link>
            ) : (
              <ContactActions userId={p.id} name={p.display_name} canMessage={canMessage && !blocked} pendingRequest={pendingRequest} signedIn={!!user} autoOpen={sp.contact === "1"} />
            )}
          </div>
        </div>
        {p.bio && <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{p.bio}</p>}
        {p.is_suspended && <Badge tone="danger" className="mt-3">Compte suspendu</Badge>}

        {/* Reputation = contributions & achievements, not followers */}
        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            ["Projets créés", created.length],
            ["Projets rejoints", joined.length],
            ["Réalisations", p.completed_projects_count],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl bg-bg-2 py-3">
              <dd className="text-xl font-semibold">{n}</dd>
              <dt className="text-[12px] text-subtle">{label}</dt>
            </div>
          ))}
        </dl>
      </Card>

      <div className="mt-8 space-y-8">
        {(p.skills.length > 0 || p.interests.length > 0 || p.ambitions.length > 0) && (
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              ["Compétences", p.skills],
              ["Centres d'intérêt", p.interests],
              ["Ambitions", p.ambitions],
            ].map(([label, list]) => (
              <section key={label as string}>
                <SectionTitle>{label as string}</SectionTitle>
                {(list as string[]).length ? <div className="flex flex-wrap gap-1.5">{(list as string[]).map((s) => <Tag key={s}>{s}</Tag>)}</div> : <p className="text-[13px] text-subtle">—</p>}
              </section>
            ))}
          </div>
        )}
        {p.portfolio_url && (
          <a href={p.portfolio_url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1.5 text-sm text-primary-2 hover:underline">
            <ExternalLink className="size-4" /> Portfolio
          </a>
        )}

        <section>
          <SectionTitle>Projets créés</SectionTitle>
          {projectList(created, isMe ? "Tu n'as pas encore publié de projet." : "Aucun projet publié.")}
        </section>
        {(isMe || p.show_joined_projects) && (
          <section>
            <SectionTitle>Projets rejoints</SectionTitle>
            {projectList(joined, "Aucun projet rejoint pour l'instant.")}
          </section>
        )}
        {completed.length > 0 && (
          <section>
            <SectionTitle>Réalisations terminées</SectionTitle>
            {projectList(completed, "")}
          </section>
        )}

        <section>
          <SectionTitle action={!isMe && sharedProjects.length > 0 ? <EndorseForm recipientId={p.id} name={p.display_name} projects={sharedProjects} /> : undefined}>Recommandations reçues</SectionTitle>
          {(endorsements ?? []).length === 0 ? (
            <EmptyState icon={<Award />} title="Aucune recommandation" description="Les recommandations sont laissées par des personnes ayant collaboré sur un projet." className="py-8" />
          ) : (
            <ul className="space-y-3">
              {(endorsements ?? []).map((e) => {
                const a = e.author as { username: string; display_name: string; avatar_url: string | null } | null;
                const pr = e.project as { id: string; title: string } | null;
                return (
                  <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 text-[13px]">
                      <Avatar name={a?.display_name ?? "?"} src={a?.avatar_url} size={24} />
                      <Link href={`/u/${a?.username}`} className="font-medium hover:underline">{a?.display_name}</Link>
                      <span className="text-subtle">· {pr && <Link href={`/projects/${pr.id}`} className="hover:underline">{pr.title}</Link>} · {formatDate(e.created_at)}</span>
                    </div>
                    <p className="mt-2 text-[14px] leading-relaxed">{e.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {isMe && !viewer?.onboarded && (
          <Link href="/onboarding" className={buttonClass("primary")}><Sparkles /> Compléter mon profil</Link>
        )}
        {user && !isMe && (
          <div className="flex gap-5 border-t border-border pt-4">
            <BlockButton userId={p.id} blocked={blocked} />
            <ReportButton targetType="profile" targetId={p.id} label="Signaler ce profil" />
          </div>
        )}
      </div>
    </Page>
  );
}
