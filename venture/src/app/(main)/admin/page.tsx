import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { can, CATEGORY_LABEL, EVENT_STAGE_LABEL, REPORT_REASONS, STATUS_LABEL, type AdminPermission } from "@/lib/constants";
import { AI_FEATURES, type AIFeature } from "@/lib/ai/schemas";
import { formatDate, formatEuros, formatNumber } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { LinkTabs } from "@/components/ui/tabs";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { ContentToggle, PlanEditor, ReportControls, SettingControl, UserControls } from "@/components/admin/controls";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

const TABS: { key: string; label: string; perm: AdminPermission }[] = [
  { key: "reports", label: "Signalements", perm: "reports" },
  { key: "overview", label: "Statistiques", perm: "stats" },
  { key: "users", label: "Utilisateurs", perm: "suspend" },
  { key: "projects", label: "Projets & événements", perm: "moderation" },
  { key: "plans", label: "Abonnements & paiements", perm: "payments" },
  { key: "ai", label: "Coûts IA", perm: "ai" },
  { key: "settings", label: "Paramètres", perm: "settings" },
  { key: "audit", label: "Journal", perm: "settings" },
];

export default async function AdminPage(props: PageProps<"/admin">) {
  const sp = await props.searchParams;
  const { profile, supabase } = await requireViewer("/admin");
  const role = profile.platform_role;
  // Hard gate: non-staff get a 404 (do not reveal the admin area).
  if (role === "user" || profile.is_suspended) notFound();
  const allowed = TABS.filter((t) => can(role, t.perm));
  const tab = allowed.find((t) => t.key === sp.tab)?.key ?? allowed[0]!.key;
  const q = typeof sp.q === "string" ? sp.q.replace(/[,()"{}*%\\]/g, " ").trim().slice(0, 80) : "";

  return (
    <Page wide>
      <PageHeader title="Administration" description={`Rôle : ${role}`} />
      <LinkTabs className="mb-6" active={tab} tabs={allowed.map((t) => ({ key: t.key, label: t.label, href: `/admin?tab=${t.key}` }))} />

      {tab === "reports" && <Reports />}
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users q={q} canAdmin={can(role, "users")} canRoles={can(role, "roles")} viewerId={profile.id} />}
      {tab === "projects" && <Projects q={q} />}
      {tab === "plans" && <Plans />}
      {tab === "ai" && <AICosts />}
      {tab === "settings" && <Settings />}
      {tab === "audit" && <Audit />}
    </Page>
  );

  async function Reports() {
    const { data: reports } = await supabase.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(display_name, username)").in("status", ["open", "reviewing"]).order("created_at").limit(100);
    if (!reports?.length) return <EmptyState title="Aucun signalement en attente" description="La file de modération est vide." />;
    // Resolve the reported content for context (service role, after role check above).
    const admin = createServiceClient();
    const preview = async (t: string, id: string): Promise<{ text: string; href: string | null; userId: string | null }> => {
      if (t === "project") { const { data } = await admin.from("projects").select("title, owner_id").eq("id", id).maybeSingle(); return { text: data?.title ?? "(supprimé)", href: `/projects/${id}`, userId: data?.owner_id ?? null }; }
      if (t === "comment") { const { data } = await admin.from("comments").select("body, project_id, author_id").eq("id", id).maybeSingle(); return { text: data?.body ?? "(supprimé)", href: data ? `/projects/${data.project_id}?tab=discussion` : null, userId: data?.author_id ?? null }; }
      if (t === "message") { const { data } = await admin.from("messages").select("body, sender_id").eq("id", id).maybeSingle(); return { text: data?.body ?? "(supprimé)", href: null, userId: data?.sender_id ?? null }; }
      if (t === "opportunity") { const { data } = await admin.from("opportunities").select("title, company_id").eq("id", id).maybeSingle(); return { text: data?.title ?? "(supprimé)", href: `/opportunities/${id}`, userId: data?.company_id ?? null }; }
      const { data } = await admin.from("profiles").select("display_name, username").eq("id", id).maybeSingle();
      return { text: data ? `${data.display_name} (@${data.username})` : "(supprimé)", href: data ? `/u/${data.username}` : null, userId: id };
    };
    const items = await Promise.all(reports.map(async (r) => ({ r, p: await preview(r.target_type, r.target_id) })));
    return (
      <ul className="space-y-3">
        {items.map(({ r, p }) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <Badge tone="danger">{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</Badge>
                <Badge tone="neutral">{r.target_type}</Badge>
                {r.status === "reviewing" && <Badge tone="warning">En cours d'examen</Badge>}
                <span className="text-subtle">par {(r.reporter as { display_name: string } | null)?.display_name} · {formatDate(r.created_at)}</span>
              </div>
              <blockquote className="mt-3 line-clamp-4 border-l-2 border-border pl-3 text-[14px]">{p.text}</blockquote>
              {p.href && <Link href={p.href} className="mt-1 inline-block text-[12px] text-primary-2 hover:underline">Voir le contenu</Link>}
              {r.details && <p className="mt-2 text-[13px] text-muted">Détails : {r.details}</p>}
              <ReportControls reportId={r.id} targetType={r.target_type} targetId={r.target_id} status={r.status} targetUserId={p.userId} />
            </Card>
          </li>
        ))}
      </ul>
    );
  }

  async function Overview() {
    const { data } = await supabase.rpc("admin_stats");
    const m = new Map((data ?? []).map((x) => [x.metric, x.value]));
    const cards: [string, string][] = [["users", "Membres"], ["users_business", "Comptes pro"], ["projects", "Projets (hors démo)"], ["projects_completed", "Projets réalisés"], ["applications", "Candidatures"], ["messages", "Messages"], ["reports_open", "Signalements ouverts"], ["subscriptions_active", "Abonnements actifs"], ["ai_credits_month", "Crédits IA (mois)"]];
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([k, label]) => (
          <Card key={k} className="p-4"><p className="text-[12px] text-subtle">{label}</p><p className="mt-1 text-2xl font-semibold">{formatNumber(Number(m.get(k) ?? 0))}</p></Card>
        ))}
      </div>
    );
  }

  async function Users({ q, canAdmin, canRoles, viewerId }: { q: string; canAdmin: boolean; canRoles: boolean; viewerId: string }) {
    let query = supabase.from("profiles").select("id, username, display_name, plan, platform_role, account_type, company_name, is_verified_organizer, is_suspended, created_at").order("created_at", { ascending: false }).limit(50);
    if (q) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%,company_name.ilike.%${q}%`);
    const { data } = await query;
    return (
      <>
        <form className="mb-4"><input type="hidden" name="tab" value="users" /><input name="q" defaultValue={q} placeholder="Rechercher un membre ou une entreprise…" aria-label="Rechercher" className="h-10 w-full max-w-sm rounded-xl border border-border bg-card px-3 text-sm" /></form>
        <ul className="space-y-2">
          {(data ?? []).map((u) => (
            <li key={u.id}>
              <Card className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <Link href={`/u/${u.username}`} className="text-sm font-medium hover:underline">{u.display_name}</Link>
                  <p className="text-[12px] text-subtle">@{u.username}{u.company_name ? ` · ${u.company_name}` : ""} · inscrit le {formatDate(u.created_at)} {u.platform_role !== "user" && `· ${u.platform_role}`}</p>
                </div>
                {u.id === viewerId ? <span className="text-[12px] text-subtle">C'est toi</span> : <UserControls userId={u.id} plan={u.plan} verified={u.is_verified_organizer} suspended={u.is_suspended} role={u.platform_role} accountType={u.account_type} canAdmin={canAdmin} canRoles={canRoles} />}
              </Card>
            </li>
          ))}
        </ul>
      </>
    );
  }

  async function Projects({ q }: { q: string }) {
    let query = supabase.from("projects").select("id, title, category, status, moderation, is_demo, interest_count, created_at, event_details(stage)").order("created_at", { ascending: false }).limit(60);
    if (q) query = query.ilike("title", `%${q}%`);
    const { data } = await query;
    return (
      <>
        <form className="mb-4"><input type="hidden" name="tab" value="projects" /><input name="q" defaultValue={q} placeholder="Rechercher un projet…" aria-label="Rechercher" className="h-10 w-full max-w-sm rounded-xl border border-border bg-card px-3 text-sm" /></form>
        <ul className="space-y-2">
          {(data ?? []).map((p) => {
            const ev = p.event_details as { stage: keyof typeof EVENT_STAGE_LABEL } | null;
            return (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:underline">{p.title}</Link>
                    <p className="text-[12px] text-subtle">{CATEGORY_LABEL[p.category]} · {STATUS_LABEL[p.status]}{ev ? ` · ${EVENT_STAGE_LABEL[ev.stage]}` : ""} · {formatNumber(p.interest_count)} intéressés{p.is_demo ? " · démo" : ""}</p>
                  </div>
                  {p.moderation === "hidden" && <Badge tone="warning">Masqué</Badge>}
                  <ContentToggle type="project" id={p.id} hidden={p.moderation === "hidden"} />
                </Card>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  async function Plans() {
    const [{ data: plans }, { data: subs }, { data: payments }] = await Promise.all([
      supabase.from("plan_settings").select("*").order("price_cents"),
      supabase.from("subscriptions").select("user_id, plan, status, current_period_end, updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    return (
      <div className="space-y-8">
        <section>
          <SectionTitle>Tarifs (modifiables, appliqués aux prochains paiements)</SectionTitle>
          <div className="grid gap-4 md:grid-cols-3">{(plans ?? []).map((p) => <Card key={p.plan} className="p-4"><PlanEditor plan={p.plan} label={p.label} priceCents={p.price_cents} credits={p.ai_monthly_credits} features={p.features} /></Card>)}</div>
        </section>
        <section>
          <SectionTitle>Abonnements</SectionTitle>
          {(subs ?? []).length === 0 ? <p className="text-sm text-muted">Aucun abonnement.</p> : <ul className="space-y-1 text-[13px]">{(subs ?? []).map((s) => <li key={s.user_id}>{s.user_id.slice(0, 8)}… · {s.plan} · {s.status}{s.current_period_end ? ` · jusqu'au ${formatDate(s.current_period_end)}` : ""}</li>)}</ul>}
        </section>
        <section>
          <SectionTitle>Paiements</SectionTitle>
          {(payments ?? []).length === 0 ? <p className="text-sm text-muted">Aucun paiement enregistré.</p> : <ul className="space-y-1 text-[13px]">{(payments ?? []).map((p) => <li key={p.id}>{formatDate(p.created_at)} · {p.kind} · {formatEuros(p.amount_cents)} · {p.status}</li>)}</ul>}
        </section>
      </div>
    );
  }

  async function AICosts() {
    const since = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [{ data: usage }, { data: setting }] = await Promise.all([
      supabase.from("ai_usage").select("feature, credits, input_tokens, output_tokens, model").gte("created_at", since).limit(10000),
      supabase.from("app_settings").select("value").eq("key", "ai_cost_per_credit_cents").single(),
    ]);
    const byFeature = new Map<string, { calls: number; credits: number; tin: number; tout: number }>();
    for (const u of usage ?? []) {
      const f = byFeature.get(u.feature) ?? { calls: 0, credits: 0, tin: 0, tout: 0 };
      f.calls++; f.credits += u.credits; f.tin += u.input_tokens; f.tout += u.output_tokens;
      byFeature.set(u.feature, f);
    }
    const totals = [...byFeature.values()].reduce((a, b) => ({ calls: a.calls + b.calls, credits: a.credits + b.credits, tin: a.tin + b.tin, tout: a.tout + b.tout }), { calls: 0, credits: 0, tin: 0, tout: 0 });
    return (
      <div className="space-y-4">
        <p className="text-[13px] text-muted">Mois en cours. Les tokens réels sont enregistrés à chaque appel ; le coût estimé utilise le paramètre « coût par crédit » ({Number(setting?.value ?? 0)} centime(s)). Comparez avec la facture du fournisseur.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[["Appels", totals.calls], ["Crédits", totals.credits], ["Tokens entrée", totals.tin], ["Tokens sortie", totals.tout]].map(([l, v]) => <Card key={l as string} className="p-4"><p className="text-[12px] text-subtle">{l}</p><p className="mt-1 text-xl font-semibold">{formatNumber(v as number)}</p></Card>)}
        </div>
        <Card className="p-4 text-sm">Coût estimé : <strong>{formatEuros(totals.credits * Number(setting?.value ?? 0))}</strong></Card>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card text-[13px]">
          {[...byFeature].map(([k, f]) => <li key={k} className="flex justify-between p-3"><span>{AI_FEATURES[k as AIFeature]?.label ?? k}</span><span className="text-muted">{f.calls} appels · {f.credits} cr. · {formatNumber(f.tin + f.tout)} tokens</span></li>)}
        </ul>
      </div>
    );
  }

  async function Settings() {
    const { data } = await supabase.from("app_settings").select("key, value, updated_at").order("key");
    const meta: Record<string, { label: string; kind: "bool" | "number" | "locked" }> = {
      show_demo_content: { label: "Afficher les données de démonstration", kind: "bool" },
      ticketing_commission_pct: { label: "Commission billetterie (%)", kind: "number" },
      services_commission_pct: { label: "Commission prestations (%)", kind: "number" },
      ai_cost_per_credit_cents: { label: "Coût estimé d'un crédit IA (centimes)", kind: "number" },
      regulated_funding_enabled: { label: "Financement réglementé", kind: "locked" },
    };
    return (
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {(data ?? []).map((s) => (
          <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span><span className="block text-sm">{meta[s.key]?.label ?? s.key}</span><span className="text-[12px] text-subtle">Modifié le {formatDate(s.updated_at)}</span></span>
            <SettingControl k={s.key} value={s.value} kind={meta[s.key]?.kind ?? "number"} />
          </li>
        ))}
      </ul>
    );
  }

  async function Audit() {
    const { data } = await supabase.from("admin_audit_log").select("*, actor:profiles(display_name)").order("created_at", { ascending: false }).limit(100);
    if (!data?.length) return <p className="text-sm text-muted">Aucune action enregistrée.</p>;
    return (
      <ul className="space-y-1 font-mono text-[12px] text-muted">
        {data.map((a) => <li key={a.id}>{formatDate(a.created_at, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions)} · {(a.actor as { display_name: string } | null)?.display_name ?? "système"} · {a.action} · {a.target_type}:{a.target_id?.slice(0, 8)}</li>)}
      </ul>
    );
  }
}
