import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { isAIConfigured } from "@/lib/env";
import { getQuota } from "@/lib/ai/service";
import { AI_FEATURES, type AIFeature } from "@/lib/ai/schemas";
import { formatDate } from "@/lib/utils";
import { Page, PageHeader } from "@/components/layout/page";
import { Card, Notice, Progress, SectionTitle } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "VENTURE AI" };

export default async function AIPage() {
  const { user, supabase } = await requireViewer("/ai");
  const [quota, { data: usage }, { data: mine }] = await Promise.all([
    getQuota(supabase),
    supabase.from("ai_usage").select("id, feature, credits, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("project_members").select("project:projects(id, title)").eq("user_id", user.id).limit(30),
  ]);
  const configured = isAIConfigured();
  const projects = (mine ?? []).map((m) => m.project as { id: string; title: string } | null).filter(Boolean) as { id: string; title: string }[];
  return (
    <Page>
      <PageHeader title="VENTURE AI" description="Un assistant qui transforme les idées en plans d'action, à partir des données réelles de tes projets." />
      {!configured && <Notice tone="warning" className="mb-6" title="VENTURE AI n'est pas activé sur cette instance">Un administrateur doit configurer le fournisseur d'IA. La création de projet reste possible avec les suggestions automatiques ou manuellement.</Notice>}
      {quota && (
        <Card className="v-glow p-5">
          <div className="flex items-center justify-between text-sm"><span className="font-medium">Crédits du mois</span><span className="text-subtle">{quota.used}/{quota.monthly_credits} utilisés</span></div>
          <Progress value={quota.monthly_credits ? (quota.used / quota.monthly_credits) * 100 : 0} className="mt-2" label="Crédits utilisés" />
          <p className="mt-2 text-[13px] text-muted">{quota.remaining} crédit{quota.remaining > 1 ? "s" : ""} restant{quota.remaining > 1 ? "s" : ""}. <Link href="/pricing" className="text-primary-2 hover:underline">Plus de crédits avec VENTURE Plus</Link></p>
        </Card>
      )}
      <div className="mt-8 space-y-8">
        <section>
          <SectionTitle>Ce que VENTURE AI peut faire</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(Object.entries(AI_FEATURES) as [AIFeature, { credits: number; label: string }][]).map(([k, f]) => (
              <li key={k} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">{f.label}<span className="text-[12px] text-subtle">{f.credits} crédit{f.credits > 1 ? "s" : ""}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">L'assistant ne publie rien, n'envoie aucun message et n'engage aucune dépense : il propose, tu décides. Il n'invente ni partenaires, ni utilisateurs, ni financements.</p>
        </section>
        <section>
          <SectionTitle>Commencer</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Link href="/create" className={buttonClass("primary")}><Sparkles /> Structurer une nouvelle idée</Link>
          </div>
          {projects.length > 0 && (
            <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-card">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 p-3.5 text-sm">
                  <span className="truncate">{p.title}</span>
                  <Link href={`/projects/${p.id}/space?tab=ai`} className="shrink-0 text-[13px] text-primary-2 hover:underline">Ouvrir l'assistant</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {(usage ?? []).length > 0 && (
          <section>
            <SectionTitle>Historique</SectionTitle>
            <ul className="space-y-1 text-[13px] text-muted">
              {(usage ?? []).map((u) => <li key={u.id}>{formatDate(u.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} — {AI_FEATURES[u.feature as AIFeature]?.label ?? u.feature} ({u.credits} cr.)</li>)}
            </ul>
          </section>
        )}
      </div>
    </Page>
  );
}
