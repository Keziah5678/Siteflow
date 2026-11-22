import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { listSequences } from "@/lib/app/sequences";
import { Flash, PageHeader } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/client";
import { saveSequenceAction, toggleAutomationAction } from "../actions";

export const metadata: Metadata = { title: "Séquences" };

type Step = { delayDays: number; action: string; subject: string; body: string; useAi: boolean };

function SequenceForm({ id, name, mode, active, steps, canAuto, canEdit }: { id: string | null; name: string; mode: string; active: boolean; steps: Step[]; canAuto: boolean; canEdit: boolean }) {
  const rows = [...steps, ...Array.from({ length: Math.max(0, 6 - steps.length) }, () => ({ delayDays: 0, action: "", subject: "", body: "", useAi: true }))];
  return (
    <form action={saveSequenceAction.bind(null, id)} className="space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <div><label className="label" htmlFor={`n-${id}`}>Nom</label><input id={`n-${id}`} name="name" defaultValue={name} required className="input" /></div>
          <div><label className="label" htmlFor={`m-${id}`}>Mode</label><select id={`m-${id}`} name="mode" defaultValue={mode} className="input"><option value="assisted">Assisté — je valide chaque message</option><option value="automatic" disabled={!canAuto}>Automatique{canAuto ? "" : " (Pro)"}</option></select></div>
          <label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" name="active" defaultChecked={active} />Active</label>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Jour</th><th>Action</th><th>Objet (facultatif)</th><th>Message personnalisé (facultatif)</th><th>IA</th></tr></thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={i}>
                  <td><input name={`delay_${i}`} type="number" min={0} max={365} defaultValue={s.action ? s.delayDays : ""} className="input w-20" aria-label={`Délai étape ${i + 1}`} /></td>
                  <td><select name={`action_${i}`} defaultValue={s.action} className="input w-36" aria-label={`Action étape ${i + 1}`}><option value="">—</option><option value="alert">Alerte</option><option value="email">Relance e-mail</option><option value="close">Clôture</option></select></td>
                  <td><input name={`subject_${i}`} defaultValue={s.subject} className="input min-w-40" placeholder="Auto" aria-label={`Objet étape ${i + 1}`} /></td>
                  <td><textarea name={`body_${i}`} defaultValue={s.body} className="input min-h-10 min-w-56" placeholder="Auto (variables : {{prenom}}, {{besoin}}, {{devis_reference}}…)" aria-label={`Message étape ${i + 1}`} /></td>
                  <td><input type="checkbox" name={`ai_${i}`} defaultChecked={s.useAi} aria-label={`IA étape ${i + 1}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted text-xs">Les délais comptent à partir de l&apos;inscription du prospect et doivent être croissants. Toute réponse du prospect arrête la séquence. En mode automatique, un message ne part seul que si toutes les règles de conformité sont respectées et qu&apos;aucun signal d&apos;alerte n&apos;a été relevé ; sinon il attend votre validation.</p>
        <SubmitButton>{id ? "Enregistrer" : "Créer la séquence"}</SubmitButton>
      </fieldset>
    </form>
  );
}

export default async function Sequences({ searchParams }: PageProps<"/app/sequences">) {
  const { ctx } = await requireContext();
  const sp = await searchParams;
  const seqs = await listSequences(ctx);
  const canEdit = ctx.role !== "member";
  return (
    <>
      <PageHeader title="Séquences de relance" subtitle={`Votre formule : ${ctx.limits.sequences} séquence(s), envoi automatique ${ctx.limits.automaticSending ? "inclus" : "non inclus"}.`} />
      <Flash ok={typeof sp.ok === "string" ? sp.ok : null} error={typeof sp.error === "string" ? sp.error : null} />
      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-4 p-5 ${ctx.org.automationPaused ? "ring-2 ring-red-400" : ""}`} aria-labelledby="kill-h">
        <div><h2 id="kill-h" className="font-semibold">Arrêt d&apos;urgence</h2><p className="muted text-sm">{ctx.org.automationPaused ? "Toutes les automatisations sont arrêtées : aucune étape ne s'exécute, aucun envoi automatique ne part." : "Suspend immédiatement toutes les étapes et tous les envois automatiques de l'entreprise."}</p></div>
        {canEdit && (ctx.org.automationPaused
          ? <form action={toggleAutomationAction}><input type="hidden" name="paused" value="false" /><SubmitButton>Réactiver les automatisations</SubmitButton></form>
          : <form action={toggleAutomationAction}><input type="hidden" name="paused" value="true" /><ConfirmButton message="Arrêter immédiatement toutes les automatisations ?">Arrêter toutes les automatisations</ConfirmButton></form>)}
      </section>
      <div className="space-y-6">
        {seqs.map(s => (
          <section key={s.id as string} className="card p-5" aria-label={s.name as string}>
            <div className="mb-4 flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{s.name as string}</h2><span className={`badge ${s.mode === "automatic" ? "badge-violet" : "badge-blue"}`}>{s.mode === "automatic" ? "Automatique" : "Assisté"}</span>{!s.active && <span className="badge">Inactive</span>}<span className="muted text-sm">{s.activeCount as number} prospect(s) en cours</span></div>
            <SequenceForm id={s.id as string} name={s.name as string} mode={s.mode as string} active={Boolean(s.active)} canAuto={ctx.limits.automaticSending} canEdit={canEdit}
              steps={(s.steps as Array<Record<string, unknown>>).map(st => ({ delayDays: Number(st.delayDays), action: st.action as string, subject: st.subject as string, body: st.body as string, useAi: Boolean(st.useAi) }))} />
          </section>
        ))}
        {canEdit && seqs.length < ctx.limits.sequences && (
          <details className="card p-5"><summary className="cursor-pointer font-semibold">Nouvelle séquence</summary><div className="mt-4"><SequenceForm id={null} name="" mode="assisted" active steps={[{ delayDays: 1, action: "alert", subject: "", body: "", useAi: false }, { delayDays: 3, action: "email", subject: "", body: "", useAi: true }]} canAuto={ctx.limits.automaticSending} canEdit /></div></details>
        )}
      </div>
    </>
  );
}
