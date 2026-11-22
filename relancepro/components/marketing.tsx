import Link from "next/link";
import { PLANS, TRIAL_LIMITS, type PlanId } from "@/lib/billing/plans";
import { FAQ } from "@/lib/content";

/** Static, clearly fictional product preview used on the marketing pages. */
export function DashboardPreview() {
  const rows = [
    { name: "Julie M.", need: "Révision Clio IV", tag: "À relancer", tone: "badge-amber", score: 82 },
    { name: "SARL Petit", need: "Devis toiture 120 m²", tag: "Urgent", tone: "badge-red", score: 91 },
    { name: "Marc D.", need: "Entretien chaudière", tag: "En attente", tone: "badge-blue", score: 64 },
    { name: "Agence Nord", need: "Nettoyage bureaux", tag: "Rendez-vous", tone: "badge-green", score: 70 }
  ];
  return (
    <div className="card relative overflow-hidden p-0 text-left shadow-2xl shadow-brand-500/10" aria-label="Aperçu du tableau de bord avec des données fictives">
      <div className="flex items-center gap-1.5 border-b line px-4 py-2.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="muted ml-3 text-xs">Aperçu — données fictives</span></div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {[["À relancer", "7"], ["Réponses reçues", "3"], ["Rendez-vous", "2"]].map(([k, v], i) => (
          <div key={k} className="rounded-xl border line p-3 animate-float-up" style={{ animationDelay: `${i * 120}ms` }}><div className="muted text-[11px] font-semibold uppercase tracking-wider">{k}</div><div className="mt-1 text-xl font-bold">{v}</div></div>
        ))}
      </div>
      <div className="px-4 pb-4">
        {rows.map((r, i) => (
          <div key={r.name} className="flex items-center justify-between gap-3 border-t line py-2.5 animate-slide-in" style={{ animationDelay: `${300 + i * 120}ms` }}>
            <div className="min-w-0"><div className="truncate text-sm font-semibold">{r.name}</div><div className="muted truncate text-xs">{r.need}</div></div>
            <div className="flex shrink-0 items-center gap-2"><span className={`badge ${r.tone}`}>{r.tag}</span><span className="muted w-8 text-right text-xs tabular-nums">{r.score}</span></div>
          </div>
        ))}
        <div className="mt-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-brand-600 dark:text-brand-400"><span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse-dot" />RelancePro AI — relance prête</div>
          <p className="muted text-xs">« Bonjour Julie, je reviens vers vous au sujet du devis D-2026-041 envoyé le 12 mars… »</p>
        </div>
      </div>
    </div>
  );
}

export function PricingCards({ highlight = "pro" as PlanId }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {(Object.keys(PLANS) as PlanId[]).map(id => {
        const p = PLANS[id];
        const hot = id === highlight;
        return (
          <div key={id} className={`card relative flex flex-col p-6 ${hot ? "ring-2 ring-brand-500" : ""}`}>
            {hot && <span className="gradient-bg absolute -top-3 left-6 rounded-full px-3 py-0.5 text-xs font-semibold text-white">Le plus complet pour démarrer</span>}
            <h3 className="text-lg font-bold">{p.name}</h3>
            <p className="muted mt-1 text-sm">{p.tagline}</p>
            <p className="mt-5"><span className="text-4xl font-bold">{p.priceEuros} €</span><span className="muted text-sm"> HT / mois</span></p>
            <ul className="mt-5 flex-1 space-y-2 text-sm">{p.features.map(f => <li key={f} className="flex gap-2"><span className="text-brand-500" aria-hidden>✓</span>{f}</li>)}</ul>
            <p className="muted mt-4 text-xs">{p.limits.aiActionsPerMonth} actions IA rédactionnelles / mois · {p.limits.prospects.toLocaleString("fr-FR")} prospects · {p.limits.emailsPerDay} e-mails / jour</p>
            <Link href={`/signup?plan=${id}`} className={`btn mt-5 ${hot ? "btn-primary" : ""}`}>Essayer 7 jours gratuitement</Link>
          </div>
        );
      })}
    </div>
  );
}

export function TrialNote() {
  return <p className="muted mt-6 text-center text-sm">Essai gratuit de 7 jours, sans carte bancaire : fonctionnalités Pro, jusqu&apos;à {TRIAL_LIMITS.prospects} prospects et {TRIAL_LIMITS.emailsPerDay} e-mails par jour. Tarifs hors taxes, sans engagement.</p>;
}

export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y line rounded-2xl border line bg-[var(--surface)]">
      {FAQ.map(f => (
        <details key={f.q} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span className="muted transition group-open:rotate-45" aria-hidden>+</span></summary>
          <p className="muted mt-3 text-sm leading-relaxed">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Section({ eyebrow, title, intro, children, id }: { eyebrow?: string; title: string; intro?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 pt-24">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        {eyebrow && <p className="text-sm font-semibold text-brand-500">{eyebrow}</p>}
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="muted mt-4 text-base leading-relaxed">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** Minimal Markdown-ish renderer for help articles (## headings, - lists, **bold**). */
export function Prose({ blocks }: { blocks: string[] }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <strong key={i} className="text-[var(--text)]">{part.slice(2, -2)}</strong> : part);
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`ul${out.length}`}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  blocks.forEach((b, i) => {
    if (b.startsWith("- ")) { list.push(b.slice(2)); return; }
    flush();
    if (b.startsWith("## ")) out.push(<h2 key={i}>{b.slice(3)}</h2>);
    else out.push(<p key={i}>{inline(b)}</p>);
  });
  flush();
  return <div className="prose-rp">{out}</div>;
}
