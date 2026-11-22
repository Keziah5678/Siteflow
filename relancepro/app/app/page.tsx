import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { dashboard } from "@/lib/app/dashboard";
import { STATUS_LABEL, type Status } from "@/lib/app/prospects";
import { system } from "@/lib/db";
import { BarChart, EmptyState, PageHeader, Stat, euros } from "@/components/ui";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const { ctx } = await requireContext();
  const sp = await searchParams;
  const period = [7, 30, 90].includes(Number(sp.p)) ? Number(sp.p) : 30;
  const d = await dashboard(ctx, period);
  const c = d.counts;
  const [setup] = await system()`select (select count(*)::int from rp.mailboxes where org_id = ${ctx.orgId} and status = 'connected') as mailbox`;
  const needsSetup = !Number(setup.mailbox) || !c.total;
  return (
    <>
      <PageHeader title="Tableau de bord" subtitle={`${ctx.org.name} — chiffres calculés sur vos données, ${period} derniers jours`} actions={
        <nav aria-label="Période" className="flex gap-1">{[7, 30, 90].map(p => <Link key={p} href={`/app?p=${p}`} aria-current={p === period ? "true" : undefined} className={`btn btn-sm ${p === period ? "btn-primary" : ""}`}>{p} j</Link>)}</nav>
      } />

      {needsSetup && (
        <div className="card mb-6 p-5">
          <h2 className="font-semibold">Pour bien démarrer</h2>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <li className={Number(setup.mailbox) ? "muted line-through" : ""}>1. <Link href="/app/settings#boite" className="underline">Connecter votre boîte d&apos;envoi</Link></li>
            <li className={c.total ? "muted line-through" : ""}>2. <Link href="/app/prospects" className="underline">Importer ou ajouter vos demandes</Link></li>
            <li>3. <Link href="/app/messages" className="underline">Valider vos premières relances</Link></li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Prospects" value={c.total} hint={`${c.newInPeriod} nouveaux sur la période`} />
        <Stat label="Sans réponse" value={c.forgotten} hint="demandes oubliées détectées" accent />
        <Stat label="Devis en attente" value={c.quotesPending} />
        <Stat label="À valider" value={c.toReview} hint={`${c.scheduled} relance(s) validée(s) en attente d'envoi`} />
        <Stat label="Relances envoyées" value={c.sent} />
        <Stat label="Réponses reçues" value={c.replies} hint="après une relance" />
        <Stat label="Rendez-vous" value={c.meetings} hint={`${c.activeSequences} séquence(s) active(s)`} />
        <Stat label="Opportunités récupérées" value={c.recovered} hint="rendez-vous ou gagnés après relance" accent />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Activité</h2>
          <BarChart label="Nouveaux prospects et relances envoyées par jour" data={d.series} series={[{ key: "prospects", label: "Nouveaux prospects", color: "#2f6bff" }, { key: "sent", label: "Relances envoyées", color: "#6d28d9" }]} />
        </div>
        <div className="card space-y-4 p-5">
          <div><h2 className="font-semibold">Chiffre d&apos;affaires confirmé</h2><p className="mt-1 text-2xl font-bold">{euros(c.wonCents)}</p><p className="muted text-xs">dont {euros(c.recoveredCents)} après une relance RelancePro (montants saisis lors du passage en « gagné »)</p></div>
          <div><h2 className="font-semibold">Activité de RelancePro AI</h2><p className="muted mt-1 text-sm">{c.aiAnalyses} message(s) analysé(s), {c.aiDrafts} relance(s) préparée(s) sur la période ; {c.aiActionsMonth} / {ctx.limits.aiActionsPerMonth} rédactions par modèle de langage ce mois-ci.</p></div>
          <div><h2 className="font-semibold">Répartition</h2>
            <ul className="mt-2 space-y-1 text-sm">{(Object.keys(STATUS_LABEL) as Status[]).filter(k => d.byStatus[k]).map(k => <li key={k} className="flex justify-between"><Link href={`/app/prospects?status=${k}`} className="hover:underline">{STATUS_LABEL[k]}</Link><span className="tabular-nums">{d.byStatus[k]}</span></li>)}</ul>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h2 className="mb-3 font-semibold">Priorités du jour</h2>
        {d.priorities.length === 0 ? <EmptyState title="Rien d'urgent">Aucune demande ouverte. Ajoutez des prospects ou branchez le formulaire de votre site.</EmptyState> : (
          <div className="card divide-y line">
            {d.priorities.map(p => (
              <Link key={p.id as string} href={`/app/prospects/${p.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-[var(--surface-2)]">
                <div className="min-w-0"><p className="truncate font-semibold">{[p.firstName, p.lastName].filter(Boolean).join(" ") || (p.company as string)}{p.company && (p.firstName || p.lastName) ? <span className="muted font-normal"> · {p.company as string}</span> : null}</p><p className="muted truncate text-sm">{p.aiSummary as string}</p></div>
                <div className="flex shrink-0 items-center gap-2">{p.aiUrgency && <span className="badge badge-red">Urgent</span>}<span className="badge">{STATUS_LABEL[p.status as Status]}</span><span className="muted w-8 text-right text-sm tabular-nums" title="Score de priorité">{p.aiScore as number}</span></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
