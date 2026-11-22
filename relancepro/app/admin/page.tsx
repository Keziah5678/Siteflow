import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { adminMetrics } from "@/lib/admin/metrics";
import { system } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Logo, Stat, dateFr } from "@/components/ui";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };
export const dynamic = "force-dynamic";

async function resolveError(id: string) {
  "use server";
  const u = await requireUser();
  if (!u.isPlatformAdmin) notFound();
  await system()`update rp.error_log set resolved_at = now() where id = ${id}`;
  revalidatePath("/admin");
}

async function handleRequest(id: string) {
  "use server";
  const u = await requireUser();
  if (!u.isPlatformAdmin) notFound();
  await system()`update rp.contact_requests set handled_at = now() where id = ${id}`;
  revalidatePath("/admin");
}

const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export default async function Admin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound(); // never reveal that this page exists
  const a = await adminMetrics();
  const m = a.m;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between"><div className="flex items-center gap-3"><Logo /><span className="badge badge-violet">Administration</span></div><Link href="/app" className="btn btn-sm">Retour à l&apos;application</Link></div>
      {a.alerts.length > 0 && <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><strong>Alertes</strong><ul className="mt-1 list-disc pl-5">{a.alerts.map(x => <li key={x}>{x}</li>)}</ul></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Revenu mensuel récurrent" value={eur(a.mrr)} hint={`ARR ${eur(a.arr)}`} accent />
        <Stat label="Abonnements actifs" value={m.activeSubs} hint={Object.entries(a.plans).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} />
        <Stat label="Entreprises inscrites" value={m.orgs} hint={`${m.newOrgs30d} sur 30 jours`} />
        <Stat label="Essais en cours" value={m.trials} />
        <Stat label="Conversion essai → payant" value={a.conversion == null ? "—" : `${a.conversion} %`} hint={`${m.converted} / ${m.trialsEnded} essais terminés`} />
        <Stat label="Résiliations (30 j)" value={m.churned30d} hint={`${m.pastDue} paiement(s) en échec`} />
        <Stat label="Coût IA du mois" value={eur(a.aiCostEuros)} hint={`${m.aiCalls} appels · ${a.aiCostPerPayingOrg == null ? "—" : eur(a.aiCostPerPayingOrg)} / client payant`} />
        <Stat label="Marge brute estimée" value={a.grossMarginEstimate == null ? "—" : `${a.grossMarginEstimate} %`} hint="MRR moins coût IA (hors hébergement, Stripe, TVA)" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-5"><h2 className="font-semibold">État des intégrations</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">{Object.entries(a.integrations).map(([k, v]) => <li key={k} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${v ? "bg-emerald-500" : "bg-zinc-400"}`} />{k}</li>)}</ul>
          <p className="muted mt-3 text-xs">Exploitation : {m.sent30d} relances envoyées sur 30 jours · {m.deadJobs} tâche(s) en échec · {m.lateJobs} en retard · {m.mailboxErrors} boîte(s) client en erreur.</p>
        </section>
        <section className="card p-5"><h2 className="font-semibold">Coût IA par entreprise (mois)</h2>
          <table className="table mt-2"><tbody>{a.costPerOrg.map(c => <tr key={c.name}><td>{c.name}</td><td className="text-right tabular-nums">{c.calls}</td><td className="text-right tabular-nums">{eur(c.euros)}</td></tr>)}</tbody></table>
        </section>
        <section className="card p-5 lg:col-span-2"><h2 className="font-semibold">Erreurs techniques non résolues</h2>
          {a.errors.length === 0 ? <p className="muted mt-2 text-sm">Aucune.</p> : <table className="table mt-2"><tbody>{a.errors.map(e => <tr key={e.id as string}><td className="muted whitespace-nowrap text-xs">{dateFr(e.createdAt as Date, true)}</td><td className="text-xs font-semibold">{e.source as string}</td><td className="text-sm">{e.message as string}</td><td><form action={resolveError.bind(null, String(e.id))}><button className="btn btn-sm">Résolu</button></form></td></tr>)}</tbody></table>}
        </section>
        <section className="card p-5 lg:col-span-2"><h2 className="font-semibold">Demandes (contact, démo, support)</h2>
          {a.requests.length === 0 ? <p className="muted mt-2 text-sm">Aucune demande en attente.</p> : <div className="mt-2 space-y-3">{a.requests.map(r => <div key={r.id as string} className="rounded-xl border line p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span><span className="badge">{r.kind as string}</span> <strong>{r.name as string}</strong> · <a className="underline" href={`mailto:${r.email}`}>{r.email as string}</a>{r.company ? ` · ${r.company}` : ""}</span><span className="muted text-xs">{dateFr(r.createdAt as Date, true)}</span></div><p className="mt-2 whitespace-pre-wrap">{r.message as string}</p><form action={handleRequest.bind(null, String(r.id))} className="mt-2"><button className="btn btn-sm">Marquer comme traitée</button></form></div>)}</div>}
        </section>
      </div>
    </div>
  );
}
