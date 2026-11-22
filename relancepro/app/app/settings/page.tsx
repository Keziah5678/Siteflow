import type { Metadata } from "next";
import { requireContext } from "@/lib/auth/session";
import { settingsWithDefaults } from "@/lib/app/context";
import { listTeam } from "@/lib/app/team";
import { listEndpoints, WEBHOOK_EVENTS } from "@/lib/app/webhooks";
import { oauthConfigured } from "@/lib/mail/mailbox";
import { withTenant } from "@/lib/db";
import { env } from "@/lib/server/env";
import { Flash, PageHeader, dateFr } from "@/components/ui";
import { ConfirmButton, CopyField, SubmitButton } from "@/components/client";
import { connectSmtpAction, createWebhookAction, deleteWebhookAction, disconnectMailboxAction, inviteAction, removeMemberAction, saveSettingsAction, supportRequestAction, testMailboxAction } from "../actions";

export const metadata: Metadata = { title: "Paramètres" };

export default async function Settings({ searchParams }: PageProps<"/app/settings">) {
  const { user, ctx } = await requireContext();
  const sp = await searchParams;
  const st = settingsWithDefaults(ctx.org.settings);
  const admin = ctx.role !== "member";
  const [mailbox] = await withTenant(user.id, tx => tx`select provider, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, status, last_error, last_tested_at, daily_limit from rp.mailboxes where org_id = ${ctx.orgId}`);
  const [orgRow] = await withTenant(user.id, tx => tx`select siret from rp.organizations where id = ${ctx.orgId}`);
  const team = await listTeam(ctx);
  const hooks = await listEndpoints(ctx);
  const referrals = await withTenant(user.id, tx => tx`select status, count(*)::int as n from rp.referrals where referrer_org = ${ctx.orgId} group by status`);
  const formUrl = `${env.appUrl}/api/inbound/form/${ctx.org.inboundToken}`;
  const example = `<form action="${formUrl}" method="POST">\n  <input name="name" required placeholder="Nom">\n  <input name="email" type="email" required placeholder="E-mail">\n  <input name="phone" placeholder="Téléphone">\n  <input name="company" placeholder="Entreprise">\n  <textarea name="message" required placeholder="Votre demande"></textarea>\n  <input name="website" style="display:none" tabindex="-1" autocomplete="off">\n  <input type="hidden" name="redirect" value="https://votre-site.fr/merci">\n  <button>Envoyer</button>\n</form>`;
  return (
    <>
      <PageHeader title="Paramètres" subtitle={admin ? undefined : "Seuls les administrateurs peuvent modifier ces réglages."} />
      <Flash ok={typeof sp.ok === "string" ? sp.ok : null} error={typeof sp.error === "string" ? sp.error : null} />
      <nav aria-label="Sections" className="mb-6 flex flex-wrap gap-2 text-sm">{[["entreprise", "Entreprise"], ["boite", "Boîte d'envoi"], ["conformite", "Relances"], ["formulaire", "Formulaire web"], ["webhooks", "Webhooks"], ["equipe", "Équipe"], ["parrainage", "Parrainage"], ["support", "Support"]].map(([a, l]) => <a key={a} href={`#${a}`} className="btn btn-sm">{l}</a>)}</nav>

      <form action={saveSettingsAction} className="space-y-6">
        <fieldset disabled={!admin} className="space-y-6">
          <section id="entreprise" className="card scroll-mt-6 p-5"><h2 className="mb-4 font-semibold">Entreprise et signature</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="name">Nom de l&apos;entreprise</label><input id="name" name="name" defaultValue={ctx.org.name} className="input" /></div>
              <div><label className="label" htmlFor="siret">SIRET</label><input id="siret" name="siret" defaultValue={(orgRow?.siret as string) ?? ""} className="input" inputMode="numeric" /></div>
              <div><label className="label" htmlFor="senderName">Signataire des relances</label><input id="senderName" name="senderName" defaultValue={st.senderName} className="input" /></div>
              <div><label className="label" htmlFor="bookingUrl">Lien de prise de rendez-vous (facultatif)</label><input id="bookingUrl" name="bookingUrl" defaultValue={st.bookingUrl} className="input" placeholder="https://…" /><p className="hint">Calendly, Google Agenda, Microsoft Bookings… Inséré dans les relances.</p></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="signature">Signature</label><textarea id="signature" name="signature" defaultValue={st.signature} className="input min-h-24" placeholder={"Paul Durand\nGarage du Centre — 01 23 45 67 89"} /></div>
            </div>
          </section>
          <section id="conformite" className="card scroll-mt-6 p-5"><h2 className="mb-1 font-semibold">Règles de relance</h2><p className="muted mb-4 text-sm">Ces garde-fous s&apos;appliquent à chaque envoi, manuel ou automatique.</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label" htmlFor="followUpAfterDays">Demande « oubliée » après (jours)</label><input id="followUpAfterDays" name="followUpAfterDays" type="number" min={1} max={60} defaultValue={st.followUpAfterDays} className="input" /></div>
              <div><label className="label" htmlFor="maxTouchesPer30Days">Relances max. / prospect / 30 j</label><input id="maxTouchesPer30Days" name="maxTouchesPer30Days" type="number" min={1} max={10} defaultValue={st.maxTouchesPer30Days} className="input" /></div>
              <div><label className="label" htmlFor="quietStart">Repos à partir de (h)</label><input id="quietStart" name="quietStart" type="number" min={0} max={23} defaultValue={st.quietHours.start} className="input" /></div>
              <div><label className="label" htmlFor="quietEnd">Jusqu&apos;à (h)</label><input id="quietEnd" name="quietEnd" type="number" min={0} max={23} defaultValue={st.quietHours.end} className="input" /></div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="allowWeekends" defaultChecked={st.allowWeekends} />Autoriser l&apos;envoi automatique le week-end</label>
          </section>
          {admin && <SubmitButton>Enregistrer les paramètres</SubmitButton>}
        </fieldset>
      </form>

      <section id="boite" className="card mt-6 scroll-mt-6 p-5"><h2 className="font-semibold">Boîte d&apos;envoi</h2>
        <p className="muted mt-1 text-sm">Vos relances partent depuis votre adresse ; les réponses arrivent dans votre messagerie. Le mot de passe est chiffré et n&apos;est jamais réaffiché.</p>
        {mailbox && <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className={`badge ${mailbox.status === "connected" ? "badge-green" : "badge-red"}`}>{mailbox.status === "connected" ? "Connectée" : "Erreur"}</span><span>{mailbox.fromEmail as string} via {mailbox.provider === "smtp" ? `${mailbox.smtpHost}:${mailbox.smtpPort}` : mailbox.provider as string}</span><span className="muted">testée le {dateFr(mailbox.lastTestedAt as Date, true)}</span>{mailbox.lastError && <span className="text-red-600">{mailbox.lastError as string}</span>}</div>}
        {mailbox && <div className="mt-4 flex flex-wrap gap-2">
          <form action={testMailboxAction} className="flex gap-2"><input name="to" type="email" defaultValue={user.email} className="input w-64" aria-label="Destinataire du test" /><SubmitButton className="btn">Envoyer un e-mail de test</SubmitButton></form>
          {admin && <form action={disconnectMailboxAction}><ConfirmButton message="Déconnecter la boîte d'envoi ?">Déconnecter</ConfirmButton></form>}
        </div>}
        {admin && (
          <details className="mt-5" open={!mailbox}><summary className="cursor-pointer text-sm font-semibold">{mailbox ? "Modifier la connexion SMTP" : "Connecter par SMTP"}</summary>
            <form action={connectSmtpAction} className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="fromName">Nom d&apos;expéditeur</label><input id="fromName" name="fromName" defaultValue={(mailbox?.fromName as string) ?? ctx.org.name} className="input" /></div>
              <div><label className="label" htmlFor="fromEmail">Adresse d&apos;expédition</label><input id="fromEmail" name="fromEmail" type="email" required defaultValue={(mailbox?.fromEmail as string) ?? ""} className="input" /></div>
              <div><label className="label" htmlFor="host">Serveur SMTP</label><input id="host" name="host" required defaultValue={(mailbox?.smtpHost as string) ?? ""} className="input" placeholder="ssl0.ovh.net" /></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="port">Port</label><input id="port" name="port" type="number" required defaultValue={(mailbox?.smtpPort as number) ?? 465} className="input" /></div><label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" name="secure" defaultChecked={mailbox ? Boolean(mailbox.smtpSecure) : true} />SSL/TLS (465)</label></div>
              <div><label className="label" htmlFor="user">Identifiant</label><input id="user" name="user" required defaultValue={(mailbox?.smtpUser as string) ?? ""} className="input" autoComplete="off" /></div>
              <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" required className="input" autoComplete="new-password" /></div>
              <div><label className="label" htmlFor="dailyLimit">Envois max. par jour</label><input id="dailyLimit" name="dailyLimit" type="number" min={1} max={2000} defaultValue={(mailbox?.dailyLimit as number) ?? 80} className="input" /><p className="hint">Restez sous la limite de votre messagerie. Votre formule plafonne à {ctx.limits.emailsPerDay}.</p></div>
              <div className="flex items-end"><SubmitButton pendingLabel="Vérification…">Tester et enregistrer</SubmitButton></div>
            </form>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              {(["gmail", "outlook"] as const).map(p => oauthConfigured(p)
                ? <a key={p} href={`/api/oauth/${p}/start`} className="btn">Connecter {p === "gmail" ? "Gmail / Google Workspace" : "Outlook / Microsoft 365"}</a>
                : <span key={p} className="badge" title="Nécessite la configuration de l'application OAuth par RelancePro">{p === "gmail" ? "Gmail" : "Outlook"} (OAuth) : bientôt disponible</span>)}
            </div>
          </details>
        )}
      </section>

      <section id="formulaire" className="card mt-6 scroll-mt-6 space-y-4 p-5"><h2 className="font-semibold">Formulaire web</h2>
        <p className="muted text-sm">Chaque envoi depuis votre site crée un prospect avec la base légale « demande du prospect » et l&apos;historique de la demande.</p>
        <CopyField label="Adresse de réception (POST)" value={formUrl} />
        <div><span className="label">Exemple HTML</span><pre className="overflow-x-auto rounded-xl bg-[var(--surface-2)] p-4 text-xs">{example}</pre></div>
      </section>

      <section id="webhooks" className="card mt-6 scroll-mt-6 p-5"><h2 className="font-semibold">Webhooks</h2>
        <p className="muted mt-1 text-sm">Recevez les événements dans votre CRM ou un outil d&apos;automatisation. Chaque requête est signée : en-tête <code>X-RelancePro-Signature</code> (HMAC-SHA256 de « horodatage.corps »).</p>
        {!ctx.limits.webhooks ? <p className="mt-3 text-sm">Disponible à partir de la formule Pro.</p> : <>
          <ul className="mt-4 divide-y line text-sm">{hooks.map(h => <li key={h.id as string} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="break-all">{h.url as string}<span className="muted"> · {(h.events as string[]).join(", ")} · {h.delivered as number} livré(s), {h.failed as number} échec(s)</span></span>{admin && <form action={deleteWebhookAction.bind(null, h.id as string)}><button className="btn btn-sm btn-danger">Supprimer</button></form>}</li>)}{!hooks.length && <li className="muted py-2">Aucun webhook.</li>}</ul>
          {admin && <form action={createWebhookAction} className="mt-4 space-y-3"><input name="url" type="url" required className="input" placeholder="https://…" aria-label="URL du webhook" /><div className="flex flex-wrap gap-3 text-sm">{WEBHOOK_EVENTS.map(e => <label key={e} className="flex items-center gap-1.5"><input type="checkbox" name="events" value={e} defaultChecked />{e}</label>)}</div><SubmitButton className="btn">Ajouter</SubmitButton></form>}
        </>}
      </section>

      <section id="equipe" className="card mt-6 scroll-mt-6 p-5"><h2 className="font-semibold">Équipe</h2>
        <ul className="mt-3 divide-y line text-sm">{team.members.map(m => <li key={m.userId as string} className="flex items-center justify-between gap-2 py-2"><span>{m.name as string} <span className="muted">· {m.email as string}</span></span><span className="flex items-center gap-2"><span className="badge">{m.role === "owner" ? "Propriétaire" : m.role === "admin" ? "Administrateur" : "Membre"}</span>{admin && m.role !== "owner" && m.userId !== user.id && <form action={removeMemberAction.bind(null, m.userId as string)}><button className="btn btn-sm btn-ghost">Retirer</button></form>}</span></li>)}
          {team.invitations.map(i => <li key={i.id as string} className="muted flex justify-between py-2"><span>{i.email as string}</span><span>invitation en attente</span></li>)}</ul>
        {admin && <form action={inviteAction} className="mt-4 flex flex-wrap gap-2"><input name="email" type="email" required className="input w-64" placeholder="collegue@entreprise.fr" aria-label="E-mail à inviter" /><select name="role" className="input w-auto" aria-label="Rôle"><option value="member">Membre</option><option value="admin">Administrateur</option></select><SubmitButton className="btn">Inviter</SubmitButton></form>}
        <p className="muted mt-2 text-xs">Votre formule : {ctx.limits.users} utilisateur(s).</p>
      </section>

      <section id="parrainage" className="card mt-6 scroll-mt-6 space-y-3 p-5"><h2 className="font-semibold">Parrainage</h2>
        <CopyField label="Votre lien personnel" value={`${env.appUrl}/signup?ref=${ctx.org.referralCode}`} />
        <p className="muted text-sm">Inscriptions : {referrals.reduce((n, r) => n + Number(r.n), 0)} · abonnées : {referrals.filter(r => r.status !== "signed_up").reduce((n, r) => n + Number(r.n), 0)}. Les récompenses sont attribuées manuellement par RelancePro selon les conditions du programme.</p>
      </section>

      <section id="support" className="card mt-6 scroll-mt-6 p-5"><h2 className="font-semibold">Support</h2>
        <form action={supportRequestAction} className="mt-3 space-y-3"><textarea name="message" required className="input min-h-24" aria-label="Votre demande" placeholder="Décrivez votre question ou votre problème." /><SubmitButton className="btn">Envoyer au support</SubmitButton></form>
      </section>
    </>
  );
}
