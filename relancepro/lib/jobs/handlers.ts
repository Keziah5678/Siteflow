import "server-only";
import { system } from "../db";
import { deliverPlatformEmail, layout, queuePlatformEmail } from "../mail/platform";
import { sendMessage } from "../app/messages";
import { processEnrollmentStep, scanForgotten } from "../app/sequences";
import { refreshScores } from "../app/prospects";
import { deliverWebhook } from "../app/webhooks";
import { env } from "../server/env";
import { enqueue, runDueJobs, type JobHandler } from "./queue";

export const HANDLERS: Record<string, JobHandler> = {
  platform_email: async p => deliverPlatformEmail(Number(p.outboxId)),
  send_message: async p => { await sendMessage(String(p.messageId), { automatic: Boolean(p.automatic) }); },
  enrollment_step: async p => processEnrollmentStep({ enrollmentId: String(p.enrollmentId), position: Number(p.position) }),
  webhook_delivery: async p => deliverWebhook(p as { deliveryId: string; payload: Record<string, unknown> }),
  daily_scan: async () => {
    const orgs = await system()`select id from rp.organizations`;
    for (const o of orgs) { await scanForgotten(o.id as string); await refreshScores(o.id as string); }
  },
  onboarding_email: async p => {
    const [u] = await system()`select u.email, u.name, o.name as org, o.trial_ends_at, o.id as org_id,
      (select count(*)::int from rp.prospects pr where pr.org_id = o.id) as prospects,
      (select count(*)::int from rp.mailboxes mb where mb.org_id = o.id and mb.status = 'connected') as mailboxes,
      (select s.plan from rp.subscriptions s where s.org_id = o.id) as plan
      from rp.users u join rp.memberships m on m.user_id = u.id and m.role = 'owner' join rp.organizations o on o.id = m.org_id where u.id = ${String(p.userId)} limit 1`;
    if (!u) return;
    const first = String(u.name).split(" ")[0];
    if (p.step === "activation") {
      const todo = [Number(u.mailboxes) ? null : "connecter votre boîte d'envoi (Paramètres → Boîte d'envoi)", Number(u.prospects) ? null : "importer vos demandes en cours (Prospects → Importer un CSV)"].filter(Boolean) as string[];
      if (!todo.length) return; // already activated: no needless e-mail
      await queuePlatformEmail(system(), { to: u.email as string, kind: "onboarding", subject: "Deux minutes pour activer RelancePro",
        text: `Bonjour ${first},\n\nPour que RelancePro commence à récupérer vos demandes oubliées, il vous reste à : ${todo.join(" et ")}.\n\n${env.appUrl}/app`,
        html: layout("Deux minutes pour activer RelancePro", [`Bonjour ${first},`, `Pour que RelancePro commence à récupérer vos demandes oubliées, il vous reste à : ${todo.join(" et ")}.`], { label: "Ouvrir RelancePro", url: `${env.appUrl}/app` }) });
    } else if (p.step === "trial_ending" && !u.plan) {
      await queuePlatformEmail(system(), { to: u.email as string, kind: "trial", subject: "Votre essai RelancePro se termine bientôt",
        text: `Bonjour ${first},\n\nVotre essai gratuit se termine le ${(u.trialEndsAt as Date).toLocaleDateString("fr-FR")}. Vos données restent conservées ; choisissez une formule pour continuer : ${env.appUrl}/app/billing`,
        html: layout("Votre essai se termine bientôt", [`Bonjour ${first},`, `Votre essai gratuit se termine le ${(u.trialEndsAt as Date).toLocaleDateString("fr-FR")}. Vos données restent conservées.`], { label: "Choisir une formule", url: `${env.appUrl}/app/billing` }) });
    }
  }
};

/** One worker tick: schedules the daily scan once per day, then drains due jobs. */
export async function tick(limit = 50) {
  const day = new Date().toISOString().slice(0, 10);
  await enqueue(system(), "daily_scan", {}, { key: `daily_scan:${day}` });
  return runDueJobs(HANDLERS, limit);
}
