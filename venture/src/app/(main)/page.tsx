import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getAppSettings, getEngagementState, PROJECT_CARD_SELECT, type ProjectCardData } from "@/lib/queries";
import { FEED_FILTERS, type FeedFilter } from "@/lib/constants";
import { scoreProjectForViewer } from "@/lib/matching";
import { PageWithRail } from "@/components/layout/page";
import { RightRail } from "@/components/layout/right-rail";
import { Composer } from "@/components/feed/composer";
import { Intro } from "@/components/feed/intro";
import { FilterChips } from "@/components/ui/tabs";
import { ProjectCard } from "@/components/project/project-card";
import { EmptyState, Notice } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

export default async function HomePage(props: PageProps<"/">) {
  const sp = await props.searchParams;
  const filter = (FEED_FILTERS.some((f) => f.value === sp.f) ? sp.f : "for_you") as FeedFilter;
  const { user, profile, supabase } = await getViewer();
  const { showDemo } = await getAppSettings();

  let projects: ProjectCardData[] = [];
  const reasons = new Map<string, string | null>();
  let nearbyMissingLocation = false;
  let loadError = false;

  let q = supabase.from("projects").select(PROJECT_CARD_SELECT).eq("moderation", "visible").order("created_at", { ascending: false });
  if (!showDemo) q = q.eq("is_demo", false);

  if (filter === "nearby") {
    if (!user) {
      nearbyMissingLocation = true;
    } else {
      const { data: near, error } = await supabase.rpc("projects_near_me", { p_radius_km: 60, p_limit: 50 });
      if (error) loadError = true;
      if (!near || near.length === 0) {
        const { data: priv } = await supabase.from("profile_private").select("lat").eq("id", user.id).maybeSingle();
        nearbyMissingLocation = priv?.lat == null;
      } else {
        const { data, error: e2 } = await q.in("id", near.map((n) => n.project_id));
        if (e2) loadError = true;
        const order = new Map(near.map((n, i) => [n.project_id, i]));
        const dist = new Map(near.map((n) => [n.project_id, n.distance_km]));
        projects = ((data ?? []) as unknown as ProjectCardData[]).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
        for (const p of projects) reasons.set(p.id, `À ${dist.get(p.id)} km`);
      }
    }
  } else {
    if (filter !== "for_you") q = q.eq("category", filter);
    const { data, error } = await q.limit(filter === "for_you" ? 120 : 40);
    if (error) loadError = true;
    projects = (data ?? []) as unknown as ProjectCardData[];
    if (filter === "for_you" && profile?.onboarded) {
      const scored = projects.map((p) => ({ p, ...scoreProjectForViewer(profile, p) }));
      scored.sort((a, b) => b.score - a.score);
      projects = scored.map((s) => s.p).slice(0, 40);
      for (const s of scored) if (s.reason) reasons.set(s.p.id, s.reason);
    } else {
      projects = projects.slice(0, 40);
    }
  }

  // Hide content from people the viewer has blocked.
  if (user) {
    const { data: blocks } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id);
    const blocked = new Set((blocks ?? []).map((b) => b.blocked_id));
    if (blocked.size) projects = projects.filter((p) => !p.owner || !blocked.has(p.owner.id));
  }

  const states = await getEngagementState(supabase, user?.id ?? null, projects.map((p) => p.id));

  return (
    <PageWithRail rail={<RightRail />}>
      {!user && <Intro />}
      {user && profile && !profile.onboarded && (
        <Notice tone="primary" title="Complète ton profil" className="mb-4">
          Ajoute tes compétences et centres d'intérêt pour recevoir des projets et des recommandations pertinents.{" "}
          <Link href="/onboarding" className="font-medium text-primary-2 hover:underline">Compléter mon profil</Link>
        </Notice>
      )}
      {user && <Composer name={profile?.display_name ?? null} avatar={profile?.avatar_url ?? null} />}

      <FilterChips
        className="mb-5 mt-5"
        active={filter}
        items={FEED_FILTERS.map((f) => ({ key: f.value, label: f.label, href: f.value === "for_you" ? "/" : `/?f=${f.value}` }))}
      />

      {loadError && <Notice tone="danger" title="Impossible de charger le fil" className="mb-4">Vérifie ta connexion puis recharge la page.</Notice>}

      {filter === "nearby" && nearbyMissingLocation ? (
        <EmptyState
          icon={<MapPin />}
          title="Active la localisation approximative"
          description="Choisis ta ville et autorise son utilisation dans tes paramètres de confidentialité. Ta position exacte n'est jamais demandée."
          action={<Link href={user ? "/settings#privacy" : "/login?next=/?f=nearby"} className={buttonClass("secondary")}>{user ? "Paramètres" : "Se connecter"}</Link>}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title={filter === "nearby" ? "Aucun projet à moins de 60 km" : "Aucun projet ici pour l'instant"}
          description="Sois la première personne à lancer quelque chose."
          action={<Link href="/create" className={buttonClass("primary")}>Publier un projet</Link>}
        />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} state={states.get(p.id)!} signedIn={!!user} reason={reasons.get(p.id)} />
          ))}
        </div>
      )}
    </PageWithRail>
  );
}
