import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { listMessages } from "@/lib/app/messages";
import { EmptyState, Flash, PageHeader, dateFr } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { approveAndSendAction, cancelMessageAction, saveDraftAction } from "../actions";

export const metadata: Metadata = { title: "À valider" };

const LABEL: Record<string, string> = { draft: "Prêt à valider", needs_review: "À relire", approved: "Validé", blocked: "Bloqué", failed: "Échec d'envoi" };

export default async function Messages({ searchParams }: PageProps<"/app/messages">) {
  const { ctx } = await requireContext();
  const sp = await searchParams;
  const rows = await listMessages(ctx);
  return (
    <>
      <PageHeader title="Relances à valider" subtitle="Relisez, ajustez si besoin, puis validez : le message part depuis votre boîte, avec un lien de désinscription ajouté automatiquement." />
      <Flash ok={typeof sp.ok === "string" ? sp.ok : null} error={typeof sp.error === "string" ? sp.error : null} />
      {rows.length === 0 ? <EmptyState title="Aucune relance en attente" action={<Link href="/app/prospects?forgotten=1" className="btn btn-primary">Voir les demandes sans réponse</Link>}>Préparez une relance depuis la fiche d&apos;un prospect, ou laissez vos séquences les proposer.</EmptyState> : (
        <div className="space-y-4">
          {rows.map(m => (
            <article key={m.id as string} className="card p-5" aria-label={`Relance pour ${m.firstName} ${m.lastName}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div><Link href={`/app/prospects/${m.prospectId}`} className="font-semibold hover:underline">{[m.firstName, m.lastName].filter(Boolean).join(" ") || (m.company as string)}</Link><span className="muted text-sm"> · {m.email as string}</span></div>
                <div className="flex flex-wrap gap-1.5"><span className={`badge ${m.status === "needs_review" || m.status === "blocked" || m.status === "failed" ? "badge-amber" : "badge-blue"}`}>{LABEL[m.status as string] ?? m.status as string}</span>{m.aiGenerated ? <span className="badge badge-violet">Rédigé par IA</span> : <span className="badge">Modèle RelancePro</span>}{m.stepPosition ? <span className="badge">Séquence · étape {m.stepPosition as number}</span> : null}<span className="muted text-xs">{dateFr(m.createdAt as Date, true)}</span></div>
              </div>
              {(m.reviewReasons as string[]).length > 0 && (
                <ul className="mb-3 space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{(m.reviewReasons as string[]).map(r => <li key={r}>⚠ {r}</li>)}</ul>
              )}
              {m.error && <p className="mb-3 text-sm text-red-600">Dernière erreur : {m.error as string}</p>}
              <form action={approveAndSendAction.bind(null, m.id as string)} className="space-y-3">
                <div><label className="label" htmlFor={`s-${m.id}`}>Objet</label><input id={`s-${m.id}`} name="subject" defaultValue={m.subject as string} className="input" /></div>
                <div><label className="label" htmlFor={`b-${m.id}`}>Message</label><textarea id={`b-${m.id}`} name="body" defaultValue={m.body as string} className="input min-h-48 font-[inherit]" /></div>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton pendingLabel="Envoi…">Valider et envoyer</SubmitButton>
                  <SubmitButton className="btn" formAction={saveDraftAction.bind(null, m.id as string)}>Enregistrer le brouillon</SubmitButton>
                  <SubmitButton className="btn btn-ghost" formAction={cancelMessageAction.bind(null, m.id as string)}>Abandonner</SubmitButton>
                </div>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
