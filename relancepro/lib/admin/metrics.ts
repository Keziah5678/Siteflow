import "server-only";
import { system } from "../db";
import { stripeConfigured } from "../billing/stripe";
import { llmAvailable } from "../ai/llm";
import { env } from "../server/env";

/** Business and health metrics for RelancePro's owner. Computed from the database only. */
export async function adminMetrics() {
  const sql = system();
  const [m] = await sql`
    select
      (select count(*)::int from rp.organizations) as orgs,
      (select count(*)::int from rp.organizations where created_at > now() - interval '30 days') as new_orgs_30d,
      (select count(*)::int from rp.subscriptions where status in ('active','past_due') and plan is not null) as active_subs,
      (select count(*)::int from rp.subscriptions where status = 'past_due') as past_due,
      (select coalesce(sum(monthly_amount_cents), 0)::bigint from rp.subscriptions where status in ('active','past_due')) as mrr_cents,
      (select count(*)::int from rp.organizations o where o.trial_ends_at > now() and not exists (select 1 from rp.subscriptions s where s.org_id = o.id and s.plan is not null and s.status in ('active','past_due','trialing'))) as trials,
      (select count(*)::int from rp.subscriptions where status = 'canceled' and updated_at > now() - interval '30 days') as churned_30d,
      (select count(*)::int from rp.organizations where trial_ends_at < now()) as trials_ended,
      (select count(*)::int from rp.organizations o where trial_ends_at < now() and exists (select 1 from rp.subscriptions s where s.org_id = o.id and s.plan is not null)) as converted,
      (select coalesce(sum(cost_micros), 0)::bigint from rp.ai_usage where created_at >= date_trunc('month', now())) as ai_cost_micros,
      (select count(*)::int from rp.ai_usage where created_at >= date_trunc('month', now())) as ai_calls,
      (select count(*)::int from rp.messages where status = 'sent' and sent_at > now() - interval '30 days') as sent_30d,
      (select count(*)::int from rp.jobs where status = 'dead') as dead_jobs,
      (select count(*)::int from rp.jobs where status = 'queued' and run_at < now() - interval '15 minutes') as late_jobs,
      (select count(*)::int from rp.error_log where resolved_at is null and created_at > now() - interval '7 days') as open_errors,
      (select count(*)::int from rp.mailboxes where status = 'error') as mailbox_errors,
      (select count(*)::int from rp.outbox_emails where status = 'failed') as platform_mail_failures,
      (select count(*)::int from rp.contact_requests where handled_at is null) as open_requests`;
  const n = (k: string) => Number(m[k] ?? 0);
  const conversion = n("trialsEnded") ? Math.round((n("converted") / n("trialsEnded")) * 100) : null;
  const aiCostEuros = n("aiCostMicros") / 1_000_000;
  const plans = await sql`select plan, count(*)::int as n from rp.subscriptions where status in ('active','past_due') and plan is not null group by plan`;
  const costPerOrg = await sql`select o.name, coalesce(sum(a.cost_micros), 0)::bigint as micros, count(a.id)::int as calls
    from rp.organizations o left join rp.ai_usage a on a.org_id = o.id and a.created_at >= date_trunc('month', now())
    group by o.id order by micros desc limit 10`;
  const errors = await sql`select id, source, message, created_at from rp.error_log where resolved_at is null order by created_at desc limit 30`;
  const requests = await sql`select id, kind, name, email, company, message, created_at from rp.contact_requests where handled_at is null order by created_at desc limit 30`;
  const integrations = {
    database: true,
    platformEmail: Boolean(env.platformSmtpUrl),
    stripe: stripeConfigured() && Boolean(env.stripeWebhookSecret),
    ai: llmAvailable(),
    gmailOAuth: Boolean(env.googleClientId),
    outlookOAuth: Boolean(env.microsoftClientId),
    cronSecret: Boolean(env.cronSecret),
    encryptionKey: Boolean(env.encryptionKey)
  };
  const alerts: string[] = [];
  if (n("deadJobs")) alerts.push(`${n("deadJobs")} tâche(s) en échec définitif.`);
  if (n("lateJobs")) alerts.push(`${n("lateJobs")} tâche(s) en retard : vérifier la tâche planifiée /api/cron/tick.`);
  if (n("pastDue")) alerts.push(`${n("pastDue")} paiement(s) en échec.`);
  if (n("mailboxErrors")) alerts.push(`${n("mailboxErrors")} boîte(s) d'envoi client en erreur.`);
  if (n("platformMailFailures")) alerts.push(`${n("platformMailFailures")} e-mail(s) de la plateforme non délivré(s).`);
  for (const [k, v] of Object.entries(integrations)) if (!v && ["platformEmail", "stripe", "cronSecret", "encryptionKey"].includes(k)) alerts.push(`Configuration manquante : ${k}.`);
  const mrr = n("mrrCents") / 100;
  return {
    m: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number(v)])),
    mrr, arr: mrr * 12, conversion, aiCostEuros,
    aiCostPerPayingOrg: n("activeSubs") ? aiCostEuros / n("activeSubs") : null,
    grossMarginEstimate: mrr ? Math.round(((mrr - aiCostEuros) / mrr) * 100) : null,
    plans: Object.fromEntries(plans.map(p => [p.plan as string, Number(p.n)])),
    costPerOrg: costPerOrg.map(r => ({ name: r.name as string, euros: Number(r.micros) / 1_000_000, calls: Number(r.calls) })),
    errors, requests, integrations, alerts
  };
}
