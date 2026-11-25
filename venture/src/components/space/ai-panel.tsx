"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Briefcase, Calculator, CalendarCheck2, Compass, Handshake, Loader2, ListChecks, Map as MapIcon, Plus, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Notice, SectionTitle, Avatar } from "@/components/ui/primitives";
import { addMilestonesBulkAction } from "@/lib/actions/projects";
import { formatEuros } from "@/lib/utils";
import type { AIFeature, BusinessPlan, CostEstimate, EventPlan, NextActions, Partners, PeopleRecommendation, Roadmap } from "@/lib/ai/schemas";

const FEATURES: { key: AIFeature; label: string; icon: React.ComponentType<{ className?: string }>; credits: number; managerOnly?: boolean; eventOnly?: boolean }[] = [
  { key: "next_actions", label: "Analyser la progression", icon: Compass, credits: 1 },
  { key: "roadmap", label: "Feuille de route", icon: MapIcon, credits: 2 },
  { key: "recommend_people", label: "Profils compatibles", icon: Users, credits: 2, managerOnly: true },
  { key: "cost_estimate", label: "Estimer les coûts", icon: Calculator, credits: 2 },
  { key: "partners", label: "Trouver des partenaires", icon: Handshake, credits: 2 },
  { key: "event_plan", label: "Organiser l'événement", icon: CalendarCheck2, credits: 3, eventOnly: true },
  { key: "business_plan", label: "Business plan", icon: Briefcase, credits: 5 },
];

type Result = { feature: AIFeature; data: unknown };

export function AIPanel({ projectId, configured, remaining, isManager, isEvent }: { projectId: string; configured: boolean; remaining: number | null; isManager: boolean; isEvent: boolean }) {
  const [loading, setLoading] = useState<AIFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [credits, setCredits] = useState(remaining);
  const [added, setAdded] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!configured) {
    return (
      <Notice tone="neutral" title="VENTURE AI n'est pas activé sur cette instance">
        L'administrateur doit configurer un fournisseur d'IA (variable ANTHROPIC_API_KEY). En attendant, toutes les autres fonctionnalités de l'espace projet restent disponibles.
      </Notice>
    );
  }

  async function run(feature: AIFeature) {
    setLoading(feature);
    setError(null);
    setResult(null);
    setAdded(null);
    try {
      const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feature, projectId }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setResult({ feature, data: json.data });
      if (typeof json.remaining === "number") setCredits(json.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="v-glow p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles className="size-4 text-primary-2" /> VENTURE AI</h2>
          {credits != null && <span className="text-[12px] text-subtle">{credits} crédit{credits > 1 ? "s" : ""} restant{credits > 1 ? "s" : ""} ce mois-ci · <Link href="/pricing" className="hover:text-fg">en obtenir plus</Link></span>}
        </div>
        <p className="mt-1 text-[13px] text-muted">L'assistant s'appuie uniquement sur les données réelles du projet. Il propose ; c'est toi qui décides et agis.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {FEATURES.filter((f) => (!f.managerOnly || isManager) && (!f.eventOnly || isEvent)).map((f) => (
            <Button key={f.key} variant="secondary" className="justify-start" disabled={!!loading || (credits != null && credits < f.credits)} onClick={() => run(f.key)}>
              {loading === f.key ? <Loader2 className="animate-spin" /> : <f.icon />}
              <span className="flex-1 text-left">{f.label}</span>
              <span className="text-[11px] text-subtle">{f.credits} cr.</span>
            </Button>
          ))}
        </div>
      </Card>
      {error && <Notice tone="danger">{error}</Notice>}
      {added && <Notice tone="success">{added}</Notice>}
      {result && <ResultView result={result} isManager={isManager} pending={pending} onAddSteps={(titles) => start(async () => { const r = await addMilestonesBulkAction(projectId, titles); if (r?.error) setError(r.error); else setAdded(r?.message ?? "Étapes ajoutées."); })} />}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-fg/90">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
}

function ResultView({ result, isManager, pending, onAddSteps }: { result: Result; isManager: boolean; pending: boolean; onAddSteps: (t: string[]) => void }) {
  const { feature, data } = result;
  return (
    <Card className="animate-rise space-y-5 p-5">
      {feature === "next_actions" && (() => {
        const d = data as NextActions;
        return (
          <>
            <p className="text-[14px] leading-relaxed">{d.progress_analysis}</p>
            <div><SectionTitle>Prochaines actions</SectionTitle>
              <ol className="space-y-2">{d.next_actions.map((a, i) => <li key={i} className="rounded-xl bg-bg-2 p-3 text-[14px]"><p className="font-medium">{i + 1}. {a.action}</p><p className="mt-0.5 text-[13px] text-muted">{a.why}{a.owner_hint ? ` — ${a.owner_hint}` : ""}</p></li>)}</ol>
            </div>
            {d.missing_resources.length > 0 && <div><SectionTitle>Ressources manquantes</SectionTitle><List items={d.missing_resources} /></div>}
            {d.blockers.length > 0 && <div><SectionTitle>Points de blocage</SectionTitle><List items={d.blockers} /></div>}
          </>
        );
      })()}
      {feature === "roadmap" && (() => {
        const d = data as Roadmap;
        return (
          <>
            <p className="text-[14px] leading-relaxed">{d.summary}</p>
            <ol className="space-y-3">{d.milestones.map((m, i) => <li key={i} className="rounded-xl bg-bg-2 p-3"><p className="text-sm font-medium">{i + 1}. {m.title}{m.suggested_weeks_from_now != null && <span className="font-normal text-subtle"> · semaine {m.suggested_weeks_from_now}</span>}</p><p className="mt-1 text-[13px] text-muted">{m.description}</p>{m.tasks.length > 0 && <ul className="mt-2 space-y-0.5 text-[13px] text-muted">{m.tasks.map((t, j) => <li key={j}><ListChecks className="mr-1 inline size-3" />{t}</li>)}</ul>}</li>)}</ol>
            {d.risks.length > 0 && <div><SectionTitle>Risques</SectionTitle><List items={d.risks} /></div>}
            {isManager && <Button size="sm" disabled={pending} onClick={() => onAddSteps(d.milestones.map((m) => m.title.slice(0, 160)))}><Plus /> Ajouter ces étapes au projet</Button>}
          </>
        );
      })()}
      {feature === "cost_estimate" && (() => {
        const d = data as CostEstimate;
        return (
          <>
            <table className="w-full text-[14px]"><thead><tr className="text-left text-[12px] text-subtle"><th className="pb-2 font-medium">Poste</th><th className="pb-2 text-right font-medium">Fourchette</th></tr></thead>
              <tbody className="divide-y divide-border">{d.items.map((it, i) => <tr key={i}><td className="py-2 pr-3">{it.label}{it.note && <span className="block text-[12px] text-subtle">{it.note}</span>}</td><td className="whitespace-nowrap py-2 text-right">{formatEuros(it.low_eur * 100)} – {formatEuros(it.high_eur * 100)}</td></tr>)}</tbody>
              <tfoot><tr className="font-semibold"><td className="pt-3">Total</td><td className="pt-3 text-right">{formatEuros(d.total_low_eur * 100)} – {formatEuros(d.total_high_eur * 100)}</td></tr></tfoot></table>
            <div><SectionTitle>Hypothèses</SectionTitle><List items={d.assumptions} /></div>
            <Notice>{d.disclaimer}</Notice>
          </>
        );
      })()}
      {feature === "business_plan" && (() => {
        const d = data as BusinessPlan;
        const sections: [string, string | string[]][] = [["Résumé", d.executive_summary], ["Problème", d.problem], ["Solution", d.solution], ["Clients cibles", d.target_customers], ["Proposition de valeur", d.value_proposition], ["Modèle économique", d.business_model], ["Mise sur le marché", d.go_to_market], ["Besoins de l'équipe", d.team_needs], ["Indicateurs clés", d.key_metrics], ["Risques", d.risks], ["Prochaines étapes", d.next_steps]];
        return sections.map(([t, v]) => <div key={t}><SectionTitle>{t}</SectionTitle>{Array.isArray(v) ? <List items={v} /> : <p className="text-[14px] leading-relaxed">{v}</p>}</div>);
      })()}
      {feature === "event_plan" && (() => {
        const d = data as EventPlan;
        return (
          <>
            <p className="text-[14px]">{d.format}</p>
            {d.checklist.map((c) => <div key={c.phase}><SectionTitle>{c.phase}</SectionTitle><List items={c.items} /></div>)}
            <div><SectionTitle>Autorisations et sécurité</SectionTitle><List items={d.permits_and_safety} /></div>
            <div><SectionTitle>Types de partenaires</SectionTitle><List items={d.partner_types} /></div>
            <div><SectionTitle>Tarification</SectionTitle><p className="text-[14px]">{d.pricing_advice}</p></div>
            <Notice>{d.disclaimer}</Notice>
          </>
        );
      })()}
      {feature === "partners" && (() => {
        const d = data as Partners & { opportunities?: { id: string; title: string }[] };
        return (
          <>
            <ul className="space-y-2">{d.partner_types.map((p, i) => <li key={i} className="rounded-xl bg-bg-2 p-3 text-[14px]"><p className="font-medium">{p.type}</p><p className="mt-0.5 text-[13px] text-muted">{p.why}</p><p className="mt-1 text-[13px]">{p.how_to_approach}</p></li>)}</ul>
            <div><SectionTitle>Opportunités VENTURE correspondantes</SectionTitle>
              {d.opportunities && d.opportunities.length > 0 ? <ul className="space-y-1">{d.opportunities.map((o) => <li key={o.id}><Link className="text-[14px] text-primary-2 hover:underline" href={`/opportunities/${o.id}`}>{o.title}</Link></li>)}</ul> : <p className="text-[13px] text-muted">Aucune opportunité publiée ne correspond pour l'instant.</p>}
            </div>
            <div><SectionTitle>Modèle de message (à envoyer toi-même)</SectionTitle><pre className="whitespace-pre-wrap rounded-xl bg-bg-2 p-3 font-sans text-[13px]">{d.outreach_message_template}</pre></div>
          </>
        );
      })()}
      {feature === "recommend_people" && (() => {
        const d = data as PeopleRecommendation & { profiles: { id: string; username: string; display_name: string; avatar_url: string | null }[] };
        const byId = new Map(d.profiles.map((p) => [p.id, p]));
        return (
          <>
            {d.recommendations.length === 0 ? <p className="text-[14px] text-muted">Aucun membre découvrable ne correspond suffisamment pour l'instant.</p> : (
              <ul className="space-y-2">{d.recommendations.map((r) => { const p = byId.get(r.user_id); if (!p) return null; return (
                <li key={r.user_id} className="flex gap-3 rounded-xl bg-bg-2 p-3"><Avatar name={p.display_name} src={p.avatar_url} size={32} /><div className="text-[14px]"><Link href={`/u/${p.username}?contact=1`} className="font-medium hover:underline">{p.display_name}</Link> <span className="text-subtle">· {r.role_for_project}</span><p className="mt-0.5 text-[13px] text-muted">{r.explanation}</p></div></li>
              ); })}</ul>
            )}
            {d.uncovered_needs.length > 0 && <div><SectionTitle>Besoins non couverts</SectionTitle><List items={d.uncovered_needs} /></div>}
            <p className="text-[12px] text-subtle">Une recommandation n'est pas une garantie de réussite.</p>
          </>
        );
      })()}
      <p className="border-t border-border pt-3 text-[12px] text-subtle">Généré par VENTURE AI à partir des données du projet. Vérifie les informations avant d'agir.</p>
    </Card>
  );
}
