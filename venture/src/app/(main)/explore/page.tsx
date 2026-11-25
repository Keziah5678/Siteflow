import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, CalendarDays, Compass, List, Map as MapIcon, Rocket, Users } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getAppSettings, getEngagementState, PROJECT_CARD_SELECT, type ProjectCardData } from "@/lib/queries";
import { AVAILABILITY_LABEL, EVENT_STAGES, OPPORTUNITY_KIND_LABEL, STATUSES, type ProjectCategory } from "@/lib/constants";
import { PageWithRail } from "@/components/layout/page";
import { RightRail } from "@/components/layout/right-rail";
import { FilterChips } from "@/components/ui/tabs";
import { Avatar, Badge, Card, EmptyState, SectionTitle, Tag } from "@/components/ui/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { SearchForm } from "@/components/explore/search-form";
import { ProjectMap, type MapPoint } from "@/components/explore/project-map";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Explorer" };

const UNIVERSES = [
  { key: "all", label: "Tout", icon: Compass, description: "Tous les projets de la communauté." },
  { key: "business", label: "Business", icon: Rocket, description: "Création d'entreprise, associés, collaborateurs, partenaires, validation d'idées." },
  { key: "events", label: "Events", icon: CalendarDays, description: "Festivals, soirées, tournois, expériences collectives — y compris les événements à la demande." },
  { key: "people", label: "People", icon: Users, description: "Rencontres autour d'intérêts communs, talents, compétences, communautés et activités collectives." },
  { key: "opportunities", label: "Opportunities", icon: Briefcase, description: "Missions, collaborations, appels à candidatures et partenariats proposés par des entreprises et des membres." },
] as const;
type Universe = (typeof UNIVERSES)[number]["key"];

/** Strips characters that have meaning in PostgREST filter syntax. */
const clean = (s: string) => s.replace(/[,()"{}*\\%]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);

export default async function ExplorePage(props: PageProps<"/explore">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const u = (UNIVERSES.some((x) => x.key === sp.u) ? sp.u : "all") as Universe;
  const q = clean(str("q"));
  const view = str("view") === "map" ? "map" : "list";
  const status = STATUSES.some((s) => s.value === str("status")) ? str("status") : "";
  const stage = EVENT_STAGES.some((s) => s.value === str("stage")) ? str("stage") : "";
  const remote = str("remote") === "1";

  const { user, supabase } = await getViewer();
  const { showDemo } = await getAppSettings();
  const universe = UNIVERSES.find((x) => x.key === u)!;

  const categories: Record<Universe, ProjectCategory | null> = { all: null, business: "business", events: "event", people: "people", opportunities: "opportunity" };
  const category = categories[u];

  // Projects (smart search: full-text + fuzzy title + skills)
  let projects: ProjectCardData[] = [];
  {
    let ids: string[] | null = null;
    if (q) {
      const { data } = await supabase.rpc("search_projects", { p_query: q, p_category: category ?? undefined, p_limit: 60 });
      ids = (data ?? []).map((p) => p.id);
    }
    if (ids === null || ids.length > 0) {
      let query = supabase.from("projects").select(PROJECT_CARD_SELECT).eq("moderation", "visible");
      if (ids) query = query.in("id", ids);
      if (category) query = query.eq("category", category);
      if (status) query = query.eq("status", status as ProjectCardData["status"]);
      if (remote) query = query.eq("is_remote", true);
      if (!showDemo) query = query.eq("is_demo", false);
      const { data } = await query.order("created_at", { ascending: false }).limit(60);
      projects = (data ?? []) as unknown as ProjectCardData[];
      if (ids) {
        const order = new Map(ids.map((id, i) => [id, i]));
        projects.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      }
      if (stage) projects = projects.filter((p) => p.event_details?.stage === stage);
    }
  }

  // People (only discoverable members; RLS enforces profile visibility)
  let people: { id: string; username: string; display_name: string; avatar_url: string | null; city: string | null; skills: string[]; availability: keyof typeof AVAILABILITY_LABEL }[] = [];
  if (u === "people" || (u === "all" && q)) {
    let pq = supabase.from("profiles").select("id, username, display_name, avatar_url, city, skills, availability").eq("is_discoverable", true).eq("onboarded", true).eq("is_suspended", false);
    if (q) {
      const cap = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
      pq = pq.or(`display_name.ilike.%${q}%,username.ilike.%${q}%,city.ilike.%${q}%,skills.ov.{"${q}","${cap}","${q.toLowerCase()}"},interests.ov.{"${q}","${cap}"}`);
    }
    if (user) pq = pq.neq("id", user.id);
    const { data } = await pq.order("updated_at", { ascending: false }).limit(u === "people" ? 30 : 6);
    people = data ?? [];
  }

  // Opportunities
  let opportunities: { id: string; title: string; kind: keyof typeof OPPORTUNITY_KIND_LABEL; city: string | null; is_remote: boolean; is_sponsored: boolean; skills: string[]; company: { company_name: string | null; display_name: string } | null }[] = [];
  if (u === "opportunities" || (u === "all" && q)) {
    let oq = supabase.from("opportunities").select("id, title, kind, city, is_remote, is_sponsored, skills, company:profiles!opportunities_company_id_fkey(company_name, display_name)").eq("is_open", true).eq("moderation", "visible");
    if (q) oq = oq.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    if (remote) oq = oq.eq("is_remote", true);
    const { data } = await oq.order("created_at", { ascending: false }).limit(30);
    opportunities = (data ?? []) as unknown as typeof opportunities;
  }

  const states = await getEngagementState(supabase, user?.id ?? null, projects.map((p) => p.id));
  const points: MapPoint[] = [];
  if (view === "map") {
    const { data } = await supabase.from("projects").select("id, title, category, lat, lng").in("id", projects.map((p) => p.id)).not("lat", "is", null);
    for (const p of data ?? []) points.push({ id: p.id, title: p.title, category: p.category, lat: p.lat!, lng: p.lng!, href: `/projects/${p.id}` });
  }

  const params = (patch: Record<string, string>) => {
    const base: Record<string, string> = { u, ...(q ? { q } : {}), ...(view === "map" ? { view } : {}), ...(status ? { status } : {}), ...(stage ? { stage } : {}), ...(remote ? { remote: "1" } : {}) };
    const merged = { ...base, ...patch };
    const s = new URLSearchParams(Object.entries(merged).filter(([, v]) => v !== ""));
    return `/explore?${s.toString()}`;
  };
  const extra: Record<string, string> = { ...(view === "map" ? { view } : {}), ...(status ? { status } : {}), ...(stage ? { stage } : {}), ...(remote ? { remote: "1" } : {}) };

  return (
    <PageWithRail rail={<RightRail />}>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Explorer</h1>
      <p className="mb-5 text-sm text-muted">Un monde d'opportunités, à rejoindre ou à créer.</p>
      <SearchForm universe={u} q={q} autoFocus={sp.focus === "search"} extra={extra} />

      <nav className="scrollbar-none -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0" aria-label="Univers">
        {UNIVERSES.map((x) => (
          <Link key={x.key} href={`/explore?u=${x.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={u === x.key ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors", u === x.key ? "border-primary bg-primary-soft" : "border-border text-muted hover:border-border-strong hover:text-fg")}>
            <x.icon className="size-4 shrink-0" /> <span className="truncate">{x.label}</span>
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-[13px] text-subtle">{universe.description}</p>

      {/* Filters */}
      {u !== "people" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {u !== "opportunities" && (
            <FilterChips
              active={status || "any"}
              items={[{ key: "any", label: "Tous statuts", href: params({ status: "" }) }, ...STATUSES.filter((s) => s.value !== "cancelled").map((s) => ({ key: s.value, label: s.label, href: params({ status: s.value }) }))]}
            />
          )}
          {u === "events" && (
            <FilterChips active={stage || "any"} items={[{ key: "any", label: "Toutes étapes", href: params({ stage: "" }) }, ...EVENT_STAGES.map((s) => ({ key: s.value, label: s.label.replace("Événement ", ""), href: params({ stage: s.value }) }))]} />
          )}
          <Link href={params({ remote: remote ? "" : "1" })} className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-medium", remote ? "border-primary bg-primary-soft" : "border-border text-muted hover:text-fg")}>À distance</Link>
          {u !== "opportunities" && (
            <div className="ml-auto flex rounded-xl border border-border p-0.5">
              <Link href={params({ view: "" })} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px]", view === "list" ? "bg-card text-fg" : "text-muted")} aria-current={view === "list" ? "page" : undefined}><List className="size-3.5" /> Liste</Link>
              <Link href={params({ view: "map" })} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px]", view === "map" ? "bg-card text-fg" : "text-muted")} aria-current={view === "map" ? "page" : undefined}><MapIcon className="size-3.5" /> Carte</Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 space-y-8">
        {people.length > 0 && (
          <section>
            <SectionTitle>Personnes</SectionTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Link href={`/u/${p.username}`} className="flex gap-3 rounded-2xl border border-border bg-card p-4 hover:border-border-strong">
                    <Avatar name={p.display_name} src={p.avatar_url} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.display_name}</span>
                      <span className="block text-[12px] text-subtle">{[p.city, AVAILABILITY_LABEL[p.availability]].filter(Boolean).join(" · ")}</span>
                      {p.skills.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{p.skills.slice(0, 4).map((s) => <Tag key={s} className="py-0.5">{s}</Tag>)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {u === "people" && people.length === 0 && <EmptyState icon={<Users />} title={q ? "Aucune personne trouvée" : "Aucun membre découvrable pour l'instant"} description="Seuls les membres ayant choisi d'apparaître dans les recommandations sont listés." />}

        {opportunities.length > 0 && (
          <section>
            <SectionTitle>Opportunités d'entreprises</SectionTitle>
            <ul className="space-y-2">
              {opportunities.map((o) => (
                <li key={o.id}>
                  <Link href={`/opportunities/${o.id}`} className="block rounded-2xl border border-border bg-card p-4 hover:border-border-strong">
                    <span className="flex flex-wrap items-center gap-2 text-[12px] text-subtle">
                      <Badge tone="primary">{OPPORTUNITY_KIND_LABEL[o.kind]}</Badge>
                      {o.company?.company_name ?? o.company?.display_name}
                      {o.is_sponsored && <Badge tone="outline">Sponsorisé</Badge>}
                    </span>
                    <span className="mt-2 block text-[15px] font-medium">{o.title}</span>
                    <span className="mt-1 block text-[13px] text-muted">{[o.city, o.is_remote ? "À distance" : null].filter(Boolean).join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {u === "opportunities" && opportunities.length === 0 && (
          <Card className="p-5 text-sm text-muted">Aucune opportunité d'entreprise publiée{q ? " pour cette recherche" : ""}. Les comptes professionnels peuvent en publier depuis l'espace pro.</Card>
        )}

        <section>
          {(people.length > 0 || opportunities.length > 0) && <SectionTitle>Projets</SectionTitle>}
          {view === "map" ? (
            <>
              <ProjectMap points={points} />
              <p className="mt-2 text-[12px] text-subtle">{points.length} projet{points.length > 1 ? "s" : ""} localisé{points.length > 1 ? "s" : ""} sur {projects.length}. Les positions correspondent au centre des villes.</p>
            </>
          ) : projects.length === 0 ? (
            <EmptyState icon={<Compass />} title="Aucun projet trouvé" description={q ? "Essaie d'autres mots-clés ou un autre univers." : "Aucun projet dans cet univers pour l'instant."} action={<Link href="/create" className="text-sm font-medium text-primary-2 hover:underline">Lancer le premier</Link>} />
          ) : (
            <div className="space-y-4">{projects.map((p) => <ProjectCard key={p.id} project={p} state={states.get(p.id)!} signedIn={!!user} />)}</div>
          )}
        </section>
      </div>
    </PageWithRail>
  );
}
