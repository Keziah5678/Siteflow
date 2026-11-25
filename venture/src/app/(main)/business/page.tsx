import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { CATEGORY_LABEL, OPPORTUNITY_KIND_LABEL, type ProjectCategory } from "@/lib/constants";
import { formatDate, formatNumber } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { LinkTabs } from "@/components/ui/tabs";
import { Avatar, Badge, Card, EmptyState, Notice, SectionTitle } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { OpportunityForm, OpportunityToggle } from "@/components/business/opportunity-form";

export const metadata: Metadata = { title: "Espace pro" };

export default async function BusinessPage(props: PageProps<"/business">) {
  const sp = await props.searchParams;
  const tab = ["opportunities", "responses"].includes(sp.tab as string) ? (sp.tab as string) : "demand";
  const { user, profile, supabase } = await requireViewer("/business");

  if (profile.account_type !== "business") {
    return (
      <Page>
        <PageHeader title="Espace pro" />
        <EmptyState title="Active ton compte professionnel" description="Les entreprises découvrent les besoins exprimés par la communauté, publient des opportunités et soutiennent des projets." action={<Link href="/settings#business" className={buttonClass("primary")}>Activer dans les paramètres</Link>} />
      </Page>
    );
  }
  const hasPlan = profile.plan === "business" || profile.platform_role === "admin" || profile.platform_role === "superadmin";

  const { data: opps } = await supabase.from("opportunities").select("id, title, kind, is_open, created_at, moderation").eq("company_id", user.id).order("created_at", { ascending: false });
  let stats: { dimension: string; label: string; count: number }[] = [];
  let statsError = false;
  if (tab === "demand" && hasPlan) {
    const { data, error } = await supabase.rpc("community_demand_stats");
    statsError = !!error;
    stats = data ?? [];
  }
  let responses: { id: string; message: string; created_at: string; opportunity: { title: string } | null; user: { username: string; display_name: string; avatar_url: string | null } | null }[] = [];
  if (tab === "responses" && (opps ?? []).length) {
    const { data } = await supabase
      .from("opportunity_responses")
      .select("id, message, created_at, opportunity:opportunities(title), user:profiles(username, display_name, avatar_url)")
      .in("opportunity_id", (opps ?? []).map((o) => o.id))
      .order("created_at", { ascending: false });
    responses = (data ?? []) as unknown as typeof responses;
  }
  const by = (d: string) => stats.filter((s) => s.dimension === d).sort((a, b) => b.count - a.count);

  return (
    <Page wide>
      <PageHeader title="Espace pro" description={profile.company_name ?? undefined} />
      {!hasPlan && <Notice tone="primary" className="mb-6" title="Offre VENTURE Business requise">Les statistiques agrégées et la publication d'opportunités sont incluses dans l'offre Business. <Link href="/pricing" className="font-medium text-primary-2 hover:underline">Voir les offres</Link></Notice>}
      <LinkTabs
        className="mb-6"
        active={tab}
        tabs={[
          { key: "demand", label: "Besoins de la communauté", href: "/business" },
          { key: "opportunities", label: "Mes opportunités", href: "/business?tab=opportunities", count: (opps ?? []).length },
          { key: "responses", label: "Réponses", href: "/business?tab=responses" },
        ]}
      />

      {tab === "demand" && (
        hasPlan ? (
          statsError ? <Notice tone="danger">Statistiques indisponibles.</Notice> : (
            <div className="space-y-6">
              <p className="text-[13px] text-muted">Statistiques agrégées et anonymes sur les projets actifs (hors données de démonstration). Aucune donnée personnelle n'est exposée ; les villes n'apparaissent qu'à partir de 3 projets.</p>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-5"><SectionTitle>Par univers</SectionTitle>
                  {by("category").length === 0 ? <p className="text-sm text-muted">Pas encore de données.</p> : <ul className="space-y-1.5 text-sm">{by("category").map((s) => <li key={s.label} className="flex justify-between"><span>{CATEGORY_LABEL[s.label as ProjectCategory] ?? s.label}</span><span className="text-muted">{s.count}</span></li>)}</ul>}
                </Card>
                <Card className="p-5"><SectionTitle>Compétences les plus recherchées</SectionTitle>
                  {by("skill").length === 0 ? <p className="text-sm text-muted">Pas encore de données.</p> : <ul className="space-y-1.5 text-sm">{by("skill").slice(0, 10).map((s) => <li key={s.label} className="flex justify-between"><span className="capitalize">{s.label}</span><span className="text-muted">{s.count}</span></li>)}</ul>}
                </Card>
                <Card className="p-5"><SectionTitle>Villes actives</SectionTitle>
                  {by("city").length === 0 ? <p className="text-sm text-muted">Aucune ville n'atteint encore le seuil d'anonymat.</p> : <ul className="space-y-1.5 text-sm">{by("city").map((s) => <li key={s.label} className="flex justify-between"><span>{s.label}</span><span className="text-muted">{s.count}</span></li>)}</ul>}
                </Card>
              </div>
              <Card className="flex items-center gap-3 p-5"><BarChart3 className="size-5 text-primary-2" /><p className="text-sm">Intérêt cumulé pour les événements proposés : <strong>{formatNumber(by("event_interest")[0]?.count ?? 0)}</strong> manifestations d'intérêt.</p></Card>
              <p className="text-[13px] text-muted">Recherche de talents : utilise <Link href="/explore?u=people" className="text-primary-2 hover:underline">Explorer → People</Link> (seuls les membres ayant accepté d'être découverts apparaissent).</p>
            </div>
          )
        ) : <EmptyState icon={<BarChart3 />} title="Statistiques réservées à l'offre Business" />
      )}

      {tab === "opportunities" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="p-5">
            <SectionTitle>Publier une opportunité</SectionTitle>
            {hasPlan ? <OpportunityForm /> : <p className="text-sm text-muted">Disponible avec l'offre VENTURE Business.</p>}
          </Card>
          <div>
            <SectionTitle>Publiées</SectionTitle>
            {(opps ?? []).length === 0 ? <p className="text-sm text-muted">Aucune opportunité publiée.</p> : (
              <ul className="space-y-2">
                {(opps ?? []).map((o) => (
                  <li key={o.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/opportunities/${o.id}`} className="block truncate text-sm font-medium hover:underline">{o.title}</Link>
                      <p className="text-[12px] text-subtle">{OPPORTUNITY_KIND_LABEL[o.kind]} · {formatDate(o.created_at)}{o.moderation === "hidden" ? " · masquée par la modération" : ""}</p>
                    </div>
                    <Badge tone={o.is_open ? "success" : "neutral"}>{o.is_open ? "Ouverte" : "Clôturée"}</Badge>
                    <OpportunityToggle id={o.id} open={o.is_open} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "responses" && (
        responses.length === 0 ? <EmptyState title="Aucune réponse pour l'instant" /> : (
          <ul className="space-y-3">
            {responses.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-[13px]">
                  <Avatar name={r.user?.display_name ?? "?"} src={r.user?.avatar_url} size={28} />
                  <Link href={`/u/${r.user?.username}`} className="font-medium hover:underline">{r.user?.display_name}</Link>
                  <span className="text-subtle">· {r.opportunity?.title} · {formatDate(r.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[14px]">{r.message}</p>
                <Link href={`/u/${r.user?.username}?contact=1`} className="mt-2 inline-block text-[13px] text-primary-2 hover:underline">Répondre via une demande de contact</Link>
              </li>
            ))}
          </ul>
        )
      )}
    </Page>
  );
}
