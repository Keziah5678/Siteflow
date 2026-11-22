import "server-only";
import { z } from "zod";
import { jsonb, system, withTenant, type Db } from "../db";
import { isForgotten } from "../ai/engine";
import { enqueue } from "../jobs/queue";
import { env } from "../server/env";
import { buildDraft } from "./messages";
import { AppError, requireActive, requireRole, settingsWithDefaults, type OrgContext, type OrgSettings } from "./context";

/**
 * Follow-up sequences. Each step runs `delayDays` after enrolment:
 *   alert  → the team is notified that the prospect hasn't answered
 *   email  → a follow-up is drafted; in automatic mode it is sent if every
 *            compliance rule passes, otherwise it waits for human approval
 *   close  → the sequence ends and the team decides what to do
 * Any reply from the prospect stops the sequence.
 */

export const DEFAULT_STEPS = [
  { position: 1, delayDays: 1, action: "alert" as const, subject: "", body: "", useAi: false },
  { position: 2, delayDays: 3, action: "email" as const, subject: "", body: "", useAi: true },
  { position: 3, delayDays: 7, action: "email" as const, subject: "", body: "", useAi: true },
  { position: 4, delayDays: 14, action: "close" as const, subject: "", body: "", useAi: false }
];

export const sequenceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  mode: z.enum(["assisted", "automatic"]),
  active: z.boolean().default(true),
  steps: z.array(z.object({
    delayDays: z.coerce.number().int().min(0).max(365),
    action: z.enum(["alert", "email", "close"]),
    subject: z.string().max(200).default(""),
    body: z.string().max(6000).default(""),
    useAi: z.coerce.boolean().default(true)
  })).min(1).max(12)
}).superRefine((s, ctx) => {
  for (let i = 1; i < s.steps.length; i++) if (s.steps[i].delayDays < s.steps[i - 1].delayDays) ctx.addIssue({ code: "custom", message: "Les délais doivent être croissants.", path: ["steps", i, "delayDays"] });
});

export async function createDefaultSequence(db: Db, orgId: string) {
  const [s] = await db`insert into rp.sequences (org_id, name, mode) values (${orgId}, 'Relance standard', 'assisted') returning id`;
  for (const st of DEFAULT_STEPS) {
    await db`insert into rp.sequence_steps (org_id, sequence_id, position, delay_days, action, subject, body, use_ai) values (${orgId}, ${s.id}, ${st.position}, ${st.delayDays}, ${st.action}, ${st.subject}, ${st.body}, ${st.useAi})`;
  }
  return s.id as string;
}

export async function listSequences(ctx: OrgContext) {
  return withTenant(ctx.userId, async tx => {
    const seqs = await tx`select s.*, (select count(*)::int from rp.enrollments e where e.sequence_id = s.id and e.status = 'active') as active_count from rp.sequences s where s.org_id = ${ctx.orgId} order by s.created_at`;
    const steps = await tx`select * from rp.sequence_steps where org_id = ${ctx.orgId} order by position`;
    return seqs.map(s => ({ ...s, steps: steps.filter(st => st.sequenceId === s.id) }));
  });
}

export async function saveSequence(ctx: OrgContext, id: string | null, raw: z.input<typeof sequenceSchema>) {
  requireActive(ctx);
  requireRole(ctx, "admin");
  const s = sequenceSchema.parse(raw);
  if (s.mode === "automatic" && !ctx.limits.automaticSending) throw new AppError("L'envoi automatique est disponible à partir de la formule Pro.", "limit");
  return withTenant(ctx.userId, async tx => {
    let seqId = id;
    if (seqId) {
      const r = await tx`update rp.sequences set name = ${s.name}, mode = ${s.mode}, active = ${s.active} where id = ${seqId} and org_id = ${ctx.orgId} returning id`;
      if (!r.length) throw new AppError("Séquence introuvable.", "not_found");
      await tx`delete from rp.sequence_steps where sequence_id = ${seqId} and org_id = ${ctx.orgId}`;
    } else {
      const [c] = await tx`select count(*)::int as n from rp.sequences where org_id = ${ctx.orgId}`;
      if (Number(c.n) >= ctx.limits.sequences) throw new AppError(`Votre formule permet ${ctx.limits.sequences} séquence(s).`, "limit");
      const [r] = await tx`insert into rp.sequences (org_id, name, mode, active) values (${ctx.orgId}, ${s.name}, ${s.mode}, ${s.active}) returning id`;
      seqId = r.id as string;
    }
    let pos = 1;
    for (const st of s.steps) {
      await tx`insert into rp.sequence_steps (org_id, sequence_id, position, delay_days, action, subject, body, use_ai) values (${ctx.orgId}, ${seqId}, ${pos++}, ${st.delayDays}, ${st.action}, ${st.subject}, ${st.body}, ${st.useAi})`;
    }
    await tx`insert into rp.audit_log (org_id, user_id, action, target_type, target_id, meta) values (${ctx.orgId}, ${ctx.userId}, 'sequence_saved', 'sequence', ${seqId}, ${jsonb({ mode: s.mode })}::jsonb)`;
    return seqId!;
  });
}

export async function enroll(ctx: OrgContext, prospectId: string, sequenceId: string) {
  requireActive(ctx);
  const res = await withTenant(ctx.userId, async tx => {
    const [p] = await tx`select id, status, lawful_basis, email from rp.prospects where id = ${prospectId} and org_id = ${ctx.orgId}`;
    if (!p) throw new AppError("Prospect introuvable.", "not_found");
    if (p.status === "opposed") throw new AppError("Ce prospect s'est opposé aux communications.", "forbidden");
    if (["won", "lost"].includes(p.status as string)) throw new AppError("Le dossier est clos.", "conflict");
    if (!p.lawfulBasis) throw new AppError("Renseignez d'abord la base légale de ce prospect (demande de devis, consentement, contrat ou intérêt légitime B2B).", "forbidden");
    if (!p.email) throw new AppError("Ce prospect n'a pas d'adresse e-mail.");
    const [s] = await tx`select id, active from rp.sequences where id = ${sequenceId} and org_id = ${ctx.orgId}`;
    if (!s || !s.active) throw new AppError("Séquence introuvable ou inactive.", "not_found");
    const [first] = await tx`select delay_days, position from rp.sequence_steps where sequence_id = ${sequenceId} order by position limit 1`;
    if (!first) throw new AppError("Cette séquence n'a aucune étape.");
    const active = await tx`select id from rp.enrollments where prospect_id = ${prospectId} and status = 'active'`;
    if (active.length) throw new AppError("Ce prospect suit déjà une séquence.", "conflict");
    const runAt = new Date(Date.now() + Number(first.delayDays) * 86400_000);
    const [e] = await tx`insert into rp.enrollments (org_id, prospect_id, sequence_id, next_run_at) values (${ctx.orgId}, ${prospectId}, ${sequenceId}, ${runAt.toISOString()}::timestamptz) returning id`;
    return { enrollmentId: e.id as string, position: Number(first.position), runAt };
  });
  await enqueue(system(), "enrollment_step", { enrollmentId: res.enrollmentId, position: res.position }, { orgId: ctx.orgId, runAt: res.runAt, key: `enr:${res.enrollmentId}:${res.position}` });
  return res.enrollmentId;
}

export async function stopEnrollment(ctx: OrgContext, enrollmentId: string) {
  await withTenant(ctx.userId, async tx => {
    await tx`update rp.enrollments set status = 'stopped', stopped_reason = 'Arrêt manuel', next_run_at = null where id = ${enrollmentId} and org_id = ${ctx.orgId} and status = 'active'`;
    await tx`update rp.messages set status = 'cancelled' where enrollment_id = ${enrollmentId} and org_id = ${ctx.orgId} and status in ('draft','needs_review','approved')`;
  });
}

/** Emergency stop: no automatic step runs and no automatic send leaves until resumed. */
export async function setAutomationPaused(ctx: OrgContext, paused: boolean) {
  requireRole(ctx, "admin");
  await withTenant(ctx.userId, async tx => {
    await tx`update rp.organizations set automation_paused = ${paused} where id = ${ctx.orgId}`;
    if (paused) await tx`update rp.messages set status = 'needs_review', review_reasons = array['Automatisations arrêtées par l''entreprise'] where org_id = ${ctx.orgId} and status = 'approved' and enrollment_id is not null`;
    await tx`insert into rp.audit_log (org_id, user_id, action) values (${ctx.orgId}, ${ctx.userId}, ${paused ? "automation_paused" : "automation_resumed"})`;
  });
}

/* ------------------------------------------------------------ worker side */

export async function processEnrollmentStep(payload: { enrollmentId: string; position: number }) {
  const sql = system();
  const [e] = await sql`select e.*, s.mode, s.active as seq_active, o.automation_paused, p.last_inbound_at, p.status as prospect_status
    from rp.enrollments e join rp.sequences s on s.id = e.sequence_id join rp.organizations o on o.id = e.org_id join rp.prospects p on p.id = e.prospect_id
    where e.id = ${payload.enrollmentId}`;
  if (!e || e.status !== "active" || Number(e.currentPosition) >= payload.position) return; // stale or already done (idempotent)
  const orgId = e.orgId as string;
  if (e.automationPaused || env.automationDisabled || !e.seqActive) {
    // Held, not lost: try again in 6 hours.
    await enqueue(sql, "enrollment_step", payload, { orgId, runAt: new Date(Date.now() + 6 * 3600_000), key: `enr:${e.id}:${payload.position}:${Math.floor(Date.now() / 21600_000)}` });
    return;
  }
  if (e.lastInboundAt && (e.lastInboundAt as Date) > (e.startedAt as Date)) {
    await sql`update rp.enrollments set status = 'stopped', stopped_reason = 'Réponse du prospect', next_run_at = null where id = ${e.id}`;
    return;
  }
  if (["opposed", "won", "lost", "meeting"].includes(e.prospectStatus as string)) {
    await sql`update rp.enrollments set status = 'stopped', stopped_reason = 'Dossier clos ou opposition', next_run_at = null where id = ${e.id}`;
    return;
  }
  const steps = await sql`select * from rp.sequence_steps where sequence_id = ${e.sequenceId} order by position`;
  const step = steps.find(s => Number(s.position) === payload.position);
  if (!step) { await sql`update rp.enrollments set status = 'completed', next_run_at = null where id = ${e.id}`; return; }
  const emailSteps = steps.filter(s => s.action === "email");
  const isLastEmail = emailSteps.length > 0 && emailSteps[emailSteps.length - 1].position === step.position;

  if (step.action === "alert") {
    await sql`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body) values (${orgId}, ${e.prospectId}, 'internal', 'system', 'Alerte', ${`Aucune réponse depuis ${step.delayDays} jour(s) : à relancer.`})`;
    await sql`update rp.prospects set status = case when status in ('new','to_contact','waiting') then 'to_follow_up' else status end, next_action_at = now() where id = ${e.prospectId}`;
  } else if (step.action === "email") {
    const d = await buildDraft(orgId, e.prospectId as string, { stepPosition: emailSteps.findIndex(s => s.position === step.position) + 1, isLastStep: isLastEmail, customSubject: (step.subject as string) || undefined, customBody: (step.body as string) || undefined, useAi: Boolean(step.useAi) });
    const auto = e.mode === "automatic" && d.reviewReasons.length === 0;
    const [m] = await sql`
      insert into rp.messages (org_id, prospect_id, enrollment_id, step_position, subject, body, status, review_reasons, ai_generated, prompt_version, idempotency_key)
      values (${orgId}, ${e.prospectId}, ${e.id}, ${step.position}, ${d.subject}, ${d.body}, ${auto ? "approved" : "needs_review"}, ${d.reviewReasons}::text[], ${d.aiGenerated}, ${d.promptVersion}, ${`enr:${e.id}:${step.position}`})
      on conflict (idempotency_key) do nothing returning id`;
    if (m && auto) await enqueue(sql, "send_message", { messageId: m.id, automatic: true }, { orgId, key: `send:${m.id}` });
    if (!auto) await sql`update rp.prospects set status = case when status in ('new','to_contact','waiting') then 'to_follow_up' else status end, next_action_at = now() where id = ${e.prospectId}`;
  } else if (step.action === "close") {
    await sql`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body) values (${orgId}, ${e.prospectId}, 'internal', 'system', 'Séquence terminée', 'Séquence terminée sans réponse : à clôturer ou à reprendre manuellement.')`;
  }

  const next = steps.find(s => Number(s.position) > payload.position);
  if (next) {
    const runAt = new Date((e.startedAt as Date).getTime() + Number(next.delayDays) * 86400_000);
    await sql`update rp.enrollments set current_position = ${payload.position}, next_run_at = ${runAt.toISOString()}::timestamptz where id = ${e.id}`;
    await enqueue(sql, "enrollment_step", { enrollmentId: e.id, position: Number(next.position) }, { orgId, runAt, key: `enr:${e.id}:${next.position}` });
  } else {
    await sql`update rp.enrollments set current_position = ${payload.position}, status = 'completed', next_run_at = null where id = ${e.id}`;
  }
}

/** Daily: flags leads nobody answered, so they show up in "À relancer". */
export async function scanForgotten(orgId: string): Promise<number> {
  const sql = system();
  const [o] = await sql`select settings from rp.organizations where id = ${orgId}`;
  const after = settingsWithDefaults((o?.settings ?? {}) as OrgSettings).followUpAfterDays;
  const rows = await sql`select id, status, last_inbound_at, last_outbound_at, created_at from rp.prospects where org_id = ${orgId} and status in ('new','to_contact','waiting')`;
  let n = 0;
  for (const r of rows) {
    if (!isForgotten({ status: r.status as string, lastInboundAt: r.lastInboundAt as Date | null, lastOutboundAt: r.lastOutboundAt as Date | null, createdAt: r.createdAt as Date }, after)) continue;
    await sql`update rp.prospects set status = 'to_follow_up', next_action_at = now() where id = ${r.id} and status = ${r.status}`;
    await sql`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body) values (${orgId}, ${r.id}, 'internal', 'system', 'Demande sans suivi détectée', ${`Aucun suivi depuis plus de ${after} jour(s).`})`;
    n++;
  }
  return n;
}
