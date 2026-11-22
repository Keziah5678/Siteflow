import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { getProspect, STATUS_LABEL, STATUSES, BASIS_LABEL, type Status } from "@/lib/app/prospects";
import { listSequences } from "@/lib/app/sequences";
import { analyzeMessage } from "@/lib/ai/engine";
import { Flash, dateFr, euros } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { ProspectForm } from "../form";
import { addNoteAction, addQuoteAction, draftAction, enrollAction, eraseProspectAction, recordInboundAction, setStatusAction, stopEnrollmentAction, updateProspectAction } from "../../actions";

export const metadata: Metadata = { title: "Prospect" };

const INTENT: Record<string, string> = { request: "Demande", positive: "Réponse positive", question: "Question", refusal: "Refus", unsubscribe: "Désinscription", out_of_office: "Absence", unknown: "Incertain" };
const MSG: Record<string, string> = { draft: "Brouillon", needs_review: "À relire", approved: "Validé", sending: "Envoi…", sent: "Envoyé", failed: "Échec", cancelled: "Abandonné", blocked: "Bloqué" };

export default async function ProspectPage({ params, searchParams }: PageProps<"/app/prospects/[id]">) {
  const { ctx } = await requireContext();
  const { id } = await params;
  const sp = await searchParams;
  const d = await getProspect(ctx, id);
  if (!d) notFound();
  const p = d.prospect;
  const sequences = (await listSequences(ctx)).filter(s => s.active);
  const lastInbound = d.interactions.find(i => i.direction === "inbound");
  const reading = lastInbound ? analyzeMessage(lastInbound.body as string, { inbound: true }) : null;
  const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || (p.company as string) || (p.email as string);
  const opposed = p.status === "opposed";
  return (
    <>
      <Link href="/app/prospects" className="muted text-sm hover:underline">← Prospects</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{name}</h1>
          <p className="muted text-sm">{[p.company, p.email, p.phone].filter(Boolean).join(" · ")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5"><span className="badge badge-blue">{STATUS_LABEL[p.status as Status]}</span>{p.aiUrgency && <span className="badge badge-red">Urgent</span>}<span className="badge">Score {p.aiScore as number ?? "—"}</span><span className="badge">Source : {p.source as string}</span></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!opposed && <form action={draftAction.bind(null, id)}><SubmitButton pendingLabel="Rédaction…">✦ Préparer une relance</SubmitButton></form>}
          <a href={`/api/prospects/${id}/export`} className="btn">Exporter ses données</a>
        </div>
      </div>
      <Flash ok={typeof sp.ok === "string" ? sp.ok : null} error={typeof sp.error === "string" ? sp.error : null} />
      {opposed && <div role="status" className="mb-5 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">Ce prospect s&apos;est opposé aux communications. Aucune relance n&apos;est possible ; seule une nouvelle demande de sa part (formulaire, consentement) permettra de reprendre contact.</div>}
      {!p.lawfulBasis && !opposed && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Aucune base légale enregistrée : renseignez-la dans la fiche avant toute relance.</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5" aria-labelledby="ai-h">
            <h2 id="ai-h" className="font-semibold">RelancePro AI</h2>
            <p className="muted mt-2 text-sm">{(p.aiSummary as string) || "Aucune demande à analyser pour l'instant."}</p>
            {reading && <div className="mt-3 flex flex-wrap gap-1.5"><span className="badge badge-violet">Intention : {INTENT[reading.intent]}</span>{reading.humanReasons.map(r => <span key={r} className="badge badge-amber">{r}</span>)}</div>}
            {p.need && <p className="mt-3 text-sm"><strong>Besoin :</strong> {p.need as string}</p>}
          </section>

          <section className="card p-5" aria-labelledby="reply-h">
            <h2 id="reply-h" className="font-semibold">Enregistrer une réponse ou un échange</h2>
            <p className="muted mt-1 text-sm">Collez la réponse du prospect (e-mail, appel, rendez-vous). Une demande de désinscription est appliquée immédiatement ; toute réponse arrête la séquence en cours.</p>
            <form action={recordInboundAction.bind(null, id)} className="mt-3 space-y-3">
              <textarea name="text" required className="input min-h-24" aria-label="Réponse du prospect" />
              <div className="flex flex-wrap items-center gap-2"><select name="channel" className="input w-auto" aria-label="Canal"><option value="email">E-mail</option><option value="phone">Téléphone</option><option value="meeting">Rendez-vous</option><option value="form">Formulaire</option></select><SubmitButton>Analyser et enregistrer</SubmitButton></div>
            </form>
          </section>

          <section className="card p-5" aria-labelledby="timeline-h">
            <h2 id="timeline-h" className="font-semibold">Historique</h2>
            <ol className="mt-3 space-y-3">
              {d.interactions.length === 0 && <li className="muted text-sm">Aucun échange.</li>}
              {d.interactions.map(i => (
                <li key={i.id as string} className={`rounded-xl border line p-3 ${i.direction === "inbound" ? "border-l-4 border-l-brand-500" : i.direction === "outbound" ? "border-l-4 border-l-violet-brand" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold">{i.direction === "inbound" ? "Prospect" : i.direction === "outbound" ? "Envoyé" : "Interne"} · {i.subject as string}{i.aiIntent ? ` · ${INTENT[i.aiIntent as string] ?? ""}` : ""}</span><span className="muted">{dateFr(i.occurredAt as Date, true)}{i.author ? ` · ${i.author as string}` : ""}</span></div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{i.body as string}</p>
                </li>
              ))}
            </ol>
            <form action={addNoteAction.bind(null, id)} className="mt-4 flex gap-2"><input name="note" required className="input" placeholder="Ajouter une note interne" aria-label="Note interne" /><SubmitButton className="btn">Ajouter</SubmitButton></form>
          </section>

          {d.messages.length > 0 && (
            <section className="card p-5" aria-labelledby="msg-h">
              <h2 id="msg-h" className="font-semibold">Relances</h2>
              <ul className="mt-3 divide-y line text-sm">{d.messages.map(m => <li key={m.id as string} className="flex justify-between gap-3 py-2"><span className="truncate">{m.subject as string}</span><span className="flex shrink-0 gap-2"><span className="badge">{MSG[m.status as string]}</span><span className="muted">{dateFr((m.sentAt ?? m.createdAt) as Date)}</span></span></li>)}</ul>
              <Link href="/app/messages" className="mt-2 inline-block text-sm text-brand-600 underline dark:text-brand-400">Ouvrir « À valider »</Link>
            </section>
          )}

          <details className="card p-5"><summary className="cursor-pointer font-semibold">Modifier la fiche</summary><div className="mt-4"><ProspectForm action={updateProspectAction.bind(null, id)} p={p} submitLabel="Enregistrer" /></div></details>
        </div>

        <aside className="space-y-4">
          <section className="card p-5" aria-labelledby="status-h">
            <h2 id="status-h" className="font-semibold">Statut</h2>
            <form action={setStatusAction.bind(null, id)} className="mt-3 space-y-3">
              <select name="status" defaultValue={p.status as string} className="input" aria-label="Statut">{STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
              <input name="wonValue" className="input" inputMode="decimal" placeholder="Montant gagné (€ HT), si « gagné »" aria-label="Montant gagné" />
              <input name="note" className="input" placeholder="Commentaire (facultatif)" aria-label="Commentaire" />
              <SubmitButton className="btn w-full">Mettre à jour</SubmitButton>
            </form>
          </section>

          <section className="card p-5" aria-labelledby="seq-h">
            <h2 id="seq-h" className="font-semibold">Séquence</h2>
            {d.enrollment && d.enrollment.status === "active" ? (
              <div className="mt-2 space-y-2 text-sm">
                <p><strong>{d.enrollment.sequenceName as string}</strong> ({d.enrollment.mode === "automatic" ? "automatique" : "assistée"}) — étape {Number(d.enrollment.currentPosition) + 1}, prochaine action le {dateFr(d.enrollment.nextRunAt as Date, true)}.</p>
                <form action={stopEnrollmentAction.bind(null, id, d.enrollment.id as string)}><SubmitButton className="btn btn-danger btn-sm">Arrêter la séquence</SubmitButton></form>
              </div>
            ) : opposed ? <p className="muted mt-2 text-sm">Impossible : opposition.</p> : (
              <form action={enrollAction.bind(null, id)} className="mt-3 space-y-2">
                {d.enrollment && <p className="muted text-xs">Dernière séquence : {d.enrollment.status === "completed" ? "terminée" : `arrêtée (${d.enrollment.stoppedReason as string})`}.</p>}
                <select name="sequenceId" className="input" aria-label="Séquence">{sequences.map(s => <option key={s.id as string} value={s.id as string}>{s.name as string} — {s.mode === "automatic" ? "automatique" : "assistée"}</option>)}</select>
                <SubmitButton className="btn w-full" disabled={!sequences.length}>Inscrire</SubmitButton>
              </form>
            )}
          </section>

          <section className="card p-5" aria-labelledby="quote-h">
            <h2 id="quote-h" className="font-semibold">Devis</h2>
            <ul className="mt-2 space-y-1 text-sm">{d.quotes.map(q => <li key={q.id as string} className="flex justify-between"><span>{q.reference as string} · {dateFr(q.sentAt as Date)}</span><span>{euros(q.amountCents as string)}</span></li>)}{!d.quotes.length && <li className="muted">Aucun devis associé.</li>}</ul>
            <form action={addQuoteAction.bind(null, id)} className="mt-3 grid gap-2">
              <input name="reference" required className="input" placeholder="Référence (ex. D-2026-041)" aria-label="Référence du devis" />
              <div className="grid grid-cols-2 gap-2"><input name="amount" inputMode="decimal" className="input" placeholder="Montant € HT" aria-label="Montant du devis" /><input name="sentAt" type="date" className="input" aria-label="Date d'envoi" /></div>
              <SubmitButton className="btn">Associer un devis</SubmitButton>
            </form>
          </section>

          <section className="card p-5" aria-labelledby="basis-h">
            <h2 id="basis-h" className="font-semibold">Base légale et consentements</h2>
            <p className="mt-2 text-sm">{p.lawfulBasis ? BASIS_LABEL[p.lawfulBasis as string] : "Non renseignée"}</p>
            <ul className="muted mt-2 space-y-1 text-xs">{d.consents.map(c => <li key={c.id as string}>{dateFr(c.recordedAt as Date, true)} — {c.basis === "withdrawn" ? "retrait / opposition" : BASIS_LABEL[c.basis as string] ?? c.basis as string}{c.source ? ` (${c.source as string})` : ""}</li>)}</ul>
          </section>

          <section className="card p-5" aria-labelledby="rgpd-h">
            <h2 id="rgpd-h" className="font-semibold">Droit à l&apos;effacement</h2>
            <form action={eraseProspectAction.bind(null, id)} className="mt-3 space-y-3">
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="keepOpposition" defaultChecked={opposed} className="mt-1" />Conserver son opposition (empreinte non réversible de l&apos;adresse) pour ne jamais la recontacter</label>
              <ConfirmButton message="Supprimer définitivement ce prospect et son historique ?">Supprimer le prospect</ConfirmButton>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
