import "server-only";
import { randomUUID } from "node:crypto";
import { system, withTenant } from "../db";
import { analyzeMessage, draftFollowUp, PROMPT_VERSION, reviewDraft, type DraftFacts } from "../ai/engine";
import { llmAvailable, llmFollowUp } from "../ai/llm";
import { checkSend, isDeferral } from "../compliance/gate";
import { effectivePlan, limitsFor, type PlanId } from "../billing/plans";
import { sendFromMailbox } from "../mail/mailbox";
import { enqueue } from "../jobs/queue";
import { emailHash, sign } from "../server/crypto";
import { env } from "../server/env";
import { logError } from "../server/ops";
import { emitWebhook } from "./webhooks";
import { AppError, requireActive, settingsWithDefaults, type OrgContext, type OrgSettings } from "./context";

/* --------------------------------------------------------------- quota */

export async function aiActionsThisMonth(orgId: string): Promise<number> {
  const [r] = await system()`select count(*)::int as n from rp.ai_usage where org_id = ${orgId} and created_at >= date_trunc('month', now())`;
  return Number(r.n);
}

async function orgPlan(orgId: string) {
  const [r] = await system()`select o.trial_ends_at, o.automation_paused, o.timezone, o.settings, o.name, s.plan, s.status, s.current_period_end
    from rp.organizations o left join rp.subscriptions s on s.org_id = o.id where o.id = ${orgId}`;
  const plan = effectivePlan({ plan: (r.plan as PlanId) ?? null, status: (r.status as string) ?? "none", currentPeriodEnd: (r.currentPeriodEnd as Date) ?? null }, r.trialEndsAt as Date);
  return { plan, limits: limitsFor(plan), paused: Boolean(r.automationPaused), timezone: r.timezone as string, settings: settingsWithDefaults((r.settings ?? {}) as OrgSettings), name: r.name as string };
}

/* --------------------------------------------------------------- drafts */

export type BuiltDraft = { subject: string; body: string; reviewReasons: string[]; aiGenerated: boolean; promptVersion: string };

/** Builds a follow-up from the prospect's real data. Runs at system level (jobs) — callers check access. */
export async function buildDraft(orgId: string, prospectId: string, opts: { stepPosition?: number; isLastStep?: boolean; customSubject?: string; customBody?: string; useAi?: boolean } = {}): Promise<BuiltDraft> {
  const sql = system();
  const [p] = await sql`select * from rp.prospects where id = ${prospectId} and org_id = ${orgId}`;
  if (!p) throw new AppError("Prospect introuvable.", "not_found");
  const org = await orgPlan(orgId);
  const [lastIn] = await sql`select body from rp.interactions where prospect_id = ${prospectId} and direction = 'inbound' order by occurred_at desc limit 1`;
  const [quote] = await sql`select reference, sent_at, amount_cents from rp.quotes where prospect_id = ${prospectId} and status = 'sent' order by created_at desc limit 1`;
  const facts: DraftFacts = {
    prospectFirstName: p.firstName as string, prospectLastName: p.lastName as string, prospectCompany: p.company as string,
    need: (p.need as string) || "", lastInboundText: (lastIn?.body as string) ?? "",
    quote: quote ? { reference: quote.reference as string, sentAt: (quote.sentAt as Date) ?? null, amountCents: quote.amountCents != null ? Number(quote.amountCents) : null } : null,
    companyName: org.name, senderName: org.settings.senderName, bookingUrl: org.settings.bookingUrl || null, signature: org.settings.signature,
    stepPosition: opts.stepPosition ?? 1, isLastStep: Boolean(opts.isLastStep), customSubject: opts.customSubject, customBody: opts.customBody
  };
  const baseline = draftFollowUp(facts);
  const reasons = reviewDraft(baseline, facts);
  const inboundReading = facts.lastInboundText ? analyzeMessage(facts.lastInboundText, { inbound: true }) : null;
  const humanReasons = inboundReading?.humanReasons.filter(r => !r.startsWith("Intention incertaine")) ?? [];
  let result: BuiltDraft = { ...baseline, reviewReasons: [...reasons, ...humanReasons], aiGenerated: false, promptVersion: "template.v1" };

  if (opts.useAi !== false && !opts.customBody && llmAvailable() && (await aiActionsThisMonth(orgId)) < org.limits.aiActionsPerMonth) {
    try {
      const out = await llmFollowUp(facts, baseline);
      await sql`insert into rp.ai_usage (org_id, operation, provider, model, input_tokens, output_tokens, cost_micros) values (${orgId}, 'followup', ${out.provider}, ${out.model}, ${out.inputTokens}, ${out.outputTokens}, ${out.costMicros})`;
      const llmReasons = reviewDraft(out.data, facts);
      // The model never gets the last word on facts: if it added an unsupported claim, keep the factual draft.
      if (!llmReasons.length) result = { ...out.data, reviewReasons: [...reasons, ...humanReasons], aiGenerated: true, promptVersion: PROMPT_VERSION.followup };
    } catch (e) {
      await logError("ai:followup", e, {}, orgId);
    }
  }
  return result;
}

export async function createDraft(ctx: OrgContext, prospectId: string, opts: { customSubject?: string; customBody?: string } = {}) {
  requireActive(ctx);
  // Access check under RLS first.
  const ok = await withTenant(ctx.userId, tx => tx`select id, status from rp.prospects where id = ${prospectId} and org_id = ${ctx.orgId}`);
  if (!ok.length) throw new AppError("Prospect introuvable.", "not_found");
  if (ok[0].status === "opposed") throw new AppError("Ce prospect s'est opposé aux communications.", "forbidden");
  const d = await buildDraft(ctx.orgId, prospectId, opts);
  const [m] = await withTenant(ctx.userId, tx => tx`
    insert into rp.messages (org_id, prospect_id, subject, body, status, review_reasons, ai_generated, prompt_version, idempotency_key)
    values (${ctx.orgId}, ${prospectId}, ${d.subject}, ${d.body}, ${d.reviewReasons.length ? "needs_review" : "draft"}, ${d.reviewReasons}::text[], ${d.aiGenerated}, ${d.promptVersion}, ${`manual:${randomUUID()}`})
    returning id`);
  return m.id as string;
}

export async function updateDraft(ctx: OrgContext, id: string, subject: string, body: string) {
  const s = subject.trim().slice(0, 200), b = body.trim().slice(0, 8000);
  if (s.length < 3 || b.length < 20) throw new AppError("Objet ou message trop court.");
  const n = await withTenant(ctx.userId, tx => tx`update rp.messages set subject = ${s}, body = ${b}, status = 'draft', approved_by = null, approved_at = null
    where id = ${id} and org_id = ${ctx.orgId} and status in ('draft','needs_review','approved','blocked') returning id`);
  if (!n.length) throw new AppError("Ce message ne peut plus être modifié.", "conflict");
}

/** Human approval: the reviewer takes responsibility for the content. */
export async function approveMessage(ctx: OrgContext, id: string) {
  const n = await withTenant(ctx.userId, tx => tx`update rp.messages set status = 'approved', approved_by = ${ctx.userId}, approved_at = now()
    where id = ${id} and org_id = ${ctx.orgId} and status in ('draft','needs_review','blocked') returning id`);
  if (!n.length) throw new AppError("Ce message ne peut pas être validé.", "conflict");
}

export async function cancelMessage(ctx: OrgContext, id: string) {
  await withTenant(ctx.userId, tx => tx`update rp.messages set status = 'cancelled' where id = ${id} and org_id = ${ctx.orgId} and status in ('draft','needs_review','approved','blocked')`);
}

export async function listMessages(ctx: OrgContext, status?: string) {
  return withTenant(ctx.userId, tx => tx`
    select m.*, p.first_name, p.last_name, p.company, p.email from rp.messages m join rp.prospects p on p.id = m.prospect_id
    where m.org_id = ${ctx.orgId} ${status ? tx`and m.status = ${status}` : tx`and m.status in ('draft','needs_review','approved','blocked','failed')`}
    order by m.created_at desc limit 200`);
}

/* ---------------------------------------------------------------- send */

export function unsubscribeUrl(orgId: string, prospectId: string): string {
  const v = `${orgId}.${prospectId}`;
  return `${env.appUrl}/u/${v}.${sign(v)}`;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function composeEmail(body: string, companyName: string, unsub: string) {
  const footer = `—\nVous recevez ce message suite à vos échanges avec ${companyName}. Pour ne plus être contacté(e) : ${unsub}`;
  const text = `${body}\n\n${footer}`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
<p style="font-family:Arial,sans-serif;font-size:11px;color:#888;margin-top:24px">Vous recevez ce message suite à vos échanges avec ${escapeHtml(companyName)}. <a href="${escapeHtml(unsub)}" style="color:#888">Ne plus être contacté(e)</a>.</p>`;
  return { text, html };
}

export type SendOutcome = { status: "sent" | "deferred" | "blocked" | "skipped"; reasons: string[] };

/**
 * The only function that sends a follow-up. Idempotent: the message row is
 * locked and moved to `sending` first, so a retried job or a double click
 * can never send twice.
 */
export async function sendMessage(messageId: string, opts: { automatic: boolean; actorUserId?: string | null }): Promise<SendOutcome> {
  const sql = system();
  const claim = await sql.begin(async tx => {
    const [m] = await tx`select m.*, e.sequence_id from rp.messages m left join rp.enrollments e on e.id = m.enrollment_id where m.id = ${messageId} for update of m`;
    if (!m) return null;
    if (["sent", "sending", "cancelled"].includes(m.status as string)) return { skip: true, m };
    const [p] = await tx`select * from rp.prospects where id = ${m.prospectId} and org_id = ${m.orgId}`;
    if (!p) return null;
    const org = await orgPlan(m.orgId as string);
    const [mb] = await tx`select status, daily_limit from rp.mailboxes where org_id = ${m.orgId}`;
    const [counts] = await tx`select
      (select count(*)::int from rp.messages where org_id = ${m.orgId} and status = 'sent' and sent_at > now() - interval '1 day') as today,
      (select count(*)::int from rp.messages where prospect_id = ${p.id} and status = 'sent' and sent_at > now() - interval '30 days') as last30`;
    const suppressed = p.email ? (await tx`select 1 from rp.suppressions where org_id = ${m.orgId} and email_hash = ${emailHash(p.email as string)}`).length > 0 : false;
    const automaticSequence = opts.automatic ? (await tx`select mode, active from rp.sequences where id = ${m.sequenceId ?? null}`)[0] : null;
    const gate = checkSend({
      automatic: opts.automatic,
      prospect: { email: p.email as string | null, status: p.status as string, lawfulBasis: p.lawfulBasis as never, lastOutboundAt: (p.lastOutboundAt as Date) ?? null, outboundLast30Days: Number(counts.last30) },
      suppressed,
      org: { automationPaused: org.paused, maxTouchesPer30Days: org.settings.maxTouchesPer30Days, quietHours: org.settings.quietHours, timezone: org.timezone, allowWeekends: org.settings.allowWeekends },
      globalAutomationDisabled: env.automationDisabled,
      planAllowsAutomatic: org.limits.automaticSending && (!opts.automatic || (automaticSequence?.mode === "automatic" && automaticSequence?.active === true)),
      mailboxConnected: mb?.status === "connected",
      sentTodayByOrg: Number(counts.today),
      dailyLimit: Math.min(Number(mb?.dailyLimit ?? 0) || 0, org.limits.emailsPerDay),
      message: { status: m.status as string, hasUnsubscribeLink: true, reviewReasons: (m.reviewReasons as string[]) ?? [] }
    });
    if (!gate.ok) {
      if (opts.automatic && gate.reasons.every(isDeferral)) return { deferred: true, reasons: gate.reasons, m };
      if (opts.automatic) await tx`update rp.messages set status = 'needs_review', review_reasons = ${gate.reasons}::text[] where id = ${messageId}`;
      return { blocked: true, reasons: gate.reasons, m };
    }
    await tx`update rp.messages set status = 'sending' where id = ${messageId}`;
    return { go: true, m, p, org };
  });
  if (!claim) throw new AppError("Message introuvable.", "not_found");
  if ("skip" in claim) return { status: "skipped", reasons: [] };
  if ("deferred" in claim) {
    await enqueue(sql, "send_message", { messageId, automatic: true }, { orgId: claim.m.orgId as string, runAt: new Date(Date.now() + 2 * 3600_000), key: `send:${messageId}:${Math.floor(Date.now() / 3600_000)}` });
    return { status: "deferred", reasons: claim.reasons! };
  }
  if ("blocked" in claim) return { status: "blocked", reasons: claim.reasons! };

  const { m, p, org } = claim as unknown as { m: Record<string, string>; p: Record<string, string>; org: Awaited<ReturnType<typeof orgPlan>> };
  const unsub = unsubscribeUrl(m.orgId as string, p.id as string);
  const { text, html } = composeEmail(m.body as string, org.name, unsub);
  try {
    const res = await sendFromMailbox(m.orgId as string, {
      to: p.email as string, subject: m.subject as string, text, html, unsubscribeUrl: unsub,
      headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "X-RelancePro-Message": messageId }
    });
    await sql.begin(async tx => {
      await tx`update rp.messages set status = 'sent', sent_at = now(), provider_message_id = ${res.messageId}, error = null where id = ${messageId}`;
      await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, created_by)
        values (${m.orgId}, ${p.id}, 'outbound', 'email', ${m.subject as string}, ${m.body as string}, ${opts.actorUserId ?? null})`;
      await tx`update rp.prospects set last_outbound_at = now(), status = case when status in ('new','to_contact','to_follow_up') then 'waiting' else status end, next_action_at = null where id = ${p.id}`;
      await tx`insert into rp.audit_log (org_id, user_id, action, target_type, target_id, meta) values (${m.orgId}, ${opts.actorUserId ?? null}, ${opts.automatic ? "auto_send" : "send"}, 'message', ${messageId}, '{}'::jsonb)`;
    });
    await emitWebhook(m.orgId as string, "message.sent", { messageId, prospectId: p.id, automatic: opts.automatic });
    return { status: "sent", reasons: [] };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    await sql`update rp.messages set status = 'failed', error = ${msg} where id = ${messageId}`;
    await sql`update rp.mailboxes set status = case when ${/auth|login|credential|535|534/i.test(msg)} then 'error' else status end, last_error = ${msg} where org_id = ${m.orgId}`;
    await logError("send_message", e, { messageId }, m.orgId as string);
    throw new AppError(`Envoi impossible : ${msg}`, "unavailable");
  }
}

/** Manual "send now" from the UI: checks access under RLS, then sends. */
export async function sendNow(ctx: OrgContext, id: string): Promise<SendOutcome> {
  requireActive(ctx);
  const own = await withTenant(ctx.userId, tx => tx`select id from rp.messages where id = ${id} and org_id = ${ctx.orgId}`);
  if (!own.length) throw new AppError("Message introuvable.", "not_found");
  return sendMessage(id, { automatic: false, actorUserId: ctx.userId });
}
