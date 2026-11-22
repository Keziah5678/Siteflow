import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { listProspects, STATUS_LABEL, STATUSES, BASIS_LABEL, type Status } from "@/lib/app/prospects";
import { EmptyState, Flash, PageHeader, dateFr, euros } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { importCsvAction } from "../actions";

export const metadata: Metadata = { title: "Prospects" };

const tone: Record<string, string> = { new: "badge-blue", to_contact: "badge-blue", waiting: "", to_follow_up: "badge-amber", meeting: "badge-violet", won: "badge-green", lost: "", opposed: "badge-red" };

export default async function Prospects({ searchParams }: PageProps<"/app/prospects">) {
  const { ctx } = await requireContext();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : undefined;
  const qText = typeof sp.q === "string" ? sp.q : "";
  const forgotten = sp.forgotten === "1";
  const rows = await listProspects(ctx, { q: qText, status, forgotten, sort: sp.sort === "recent" ? "recent" : sp.sort === "name" ? "name" : "score" });
  return (
    <>
      <PageHeader title="Prospects" subtitle={`${rows.length} affiché(s) · limite de votre formule : ${ctx.limits.prospects.toLocaleString("fr-FR")}`} actions={<>
        <a href="/api/prospects/export" className="btn">Exporter (CSV)</a>
        <Link href="/app/prospects/new" className="btn btn-primary">Ajouter un prospect</Link>
      </>} />
      <Flash ok={typeof sp.ok === "string" ? sp.ok : null} error={typeof sp.error === "string" ? sp.error : null} />

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_160px_auto]" role="search">
        <div><label className="label" htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={qText} className="input" placeholder="Nom, entreprise, e-mail" /></div>
        <div><label className="label" htmlFor="status">Statut</label><select id="status" name="status" defaultValue={status ?? ""} className="input"><option value="">Tous</option>{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
        <div><label className="label" htmlFor="sort">Tri</label><select id="sort" name="sort" defaultValue={typeof sp.sort === "string" ? sp.sort : "score"} className="input"><option value="score">Priorité</option><option value="recent">Plus récents</option><option value="name">Nom</option></select></div>
        <div className="flex items-end gap-3"><label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" name="forgotten" value="1" defaultChecked={forgotten} />Sans réponse</label><button className="btn">Filtrer</button></div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Aucun prospect ici" action={<Link href="/app/prospects/new" className="btn btn-primary">Ajouter un prospect</Link>}>Ajoutez vos demandes une à une, importez un fichier CSV ou branchez le formulaire de votre site (Paramètres).</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Prospect</th><th>Besoin</th><th>Statut</th><th>Dernier échange</th><th className="text-right">Valeur</th><th className="text-right">Priorité</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id as string}>
                  <td><Link href={`/app/prospects/${p.id}`} className="font-semibold hover:underline">{[p.firstName, p.lastName].filter(Boolean).join(" ") || (p.company as string) || (p.email as string)}</Link><div className="muted text-xs">{p.company as string}{p.company && p.email ? " · " : ""}{p.email as string}</div></td>
                  <td className="max-w-xs"><span className="line-clamp-2 text-sm">{(p.need as string) || "—"}</span></td>
                  <td><div className="flex flex-wrap gap-1"><span className={`badge ${tone[p.status as string] ?? ""}`}>{STATUS_LABEL[p.status as Status]}</span>{p.forgotten && <span className="badge badge-amber">Oublié</span>}{p.aiUrgency && <span className="badge badge-red">Urgent</span>}{!p.lawfulBasis && p.status !== "opposed" && <span className="badge" title="Aucune base légale enregistrée">Base légale ?</span>}{p.enrollmentId && <span className="badge badge-violet">Séquence</span>}</div></td>
                  <td className="muted whitespace-nowrap text-sm">{dateFr((p.lastInboundAt as Date) && (p.lastOutboundAt as Date) ? ((p.lastInboundAt as Date) > (p.lastOutboundAt as Date) ? p.lastInboundAt as Date : p.lastOutboundAt as Date) : (p.lastInboundAt as Date) ?? (p.lastOutboundAt as Date) ?? (p.createdAt as Date))}</td>
                  <td className="text-right tabular-nums">{p.estimatedValueCents ? euros(p.estimatedValueCents as string) : "—"}</td>
                  <td className="text-right tabular-nums">{(p.aiScore as number) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="card mt-6 p-5" id="import">
        <summary className="cursor-pointer font-semibold">Importer un fichier CSV</summary>
        <form action={importCsvAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2"><label className="label" htmlFor="file">Fichier (CSV, 5 Mo max.)</label><input id="file" name="file" type="file" accept=".csv,text/csv" required className="input" /><p className="hint">En-têtes reconnus : prénom, nom, entreprise, email, téléphone, besoin, montant, statut. Séparateur ; ou ,</p></div>
          <div><label className="label" htmlFor="lawfulBasis">Base légale pour ces contacts</label><select id="lawfulBasis" name="lawfulBasis" className="input" required defaultValue=""><option value="" disabled>Choisir…</option>{Object.entries(BASIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><p className="hint">Sans base légale valable, ne les importez pas : aucune relance ne serait possible.</p></div>
          <div><label className="label" htmlFor="evidence">Provenance</label><input id="evidence" name="evidence" className="input" required placeholder="Ex. : demandes de devis reçues par e-mail en 2026" /></div>
          <div className="md:col-span-2"><SubmitButton>Importer</SubmitButton></div>
        </form>
      </details>
    </>
  );
}
