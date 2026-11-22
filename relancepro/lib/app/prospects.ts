import "server-only";
import { z } from "zod";
import { jsonb, system, withTenant, type DbRow, type Tx } from "../db";
import { analyzeMessage, scoreProspect, isForgotten } from "../ai/engine";
import { emailHash } from "../server/crypto";
import { emitWebhook } from "./webhooks";
import { mapRows, parseCsv } from "../prospects/csv";
import { AppError, requireActive, settingsWithDefaults, type OrgContext } from "./context";

export const STATUSES = ["new", "to_contact", "waiting", "to_follow_up", "meeting", "won", "lost", "opposed"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  new: "Nouveau", to_contact: "À contacter", waiting: "En attente", to_follow_up: "À relancer",
  meeting: "Rendez-vous obtenu", won: "Client gagné", lost: "Client perdu", opposed: "Opposition aux communications"
};
export const BASIS_LABEL: Record<string, string> = {
  consent: "Consentement du prospect",
  pre_contract: "Demande du prospect (devis, renseignement)",
  contract: "Client existant (exécution du contrat)",
  legitimate_interest: "Intérêt légitime B2B (adresse professionnelle, offre en lien avec son activité)"
};

const euros = z.union([z.number(), z.string()]).optional().nullable().transform(v => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[€\s]/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Montant invalide");
  return Math.round(n * 100);
});

export const prospectSchema = z.object({
  firstName: z.string().trim().max(100).default(""),
  lastName: z.string().trim().max(100).default(""),
  company: z.string().trim().max(160).default(""),
  email: z.string().trim().toLowerCase().email("E-mail invalide").max(200).optional().or(z.literal("")).transform(v => v || null),
  phone: z.string().trim().max(40).optional().or(z.literal("")).transform(v => v || null),
  need: z.string().trim().max(4000).default(""),
  estimatedValue: euros,
  lawfulBasis: z.enum(["consent", "legitimate_interest", "pre_contract", "contract"]).optional().nullable(),
  basisNote: z.string().trim().max(500).default(""),
  source: z.enum(["manual", "csv", "form", "email", "api"]).default("manual")
}).refine(p => p.email || p.phone, { message: "Un e-mail ou un téléphone est requis." }).refine(p => p.firstName || p.lastName || p.company, { message: "Indiquez un nom ou une entreprise." });

async function countProspects(tx: Tx, orgId: string) {
  const [r] = await tx`select count(*)::int as n from rp.prospects where org_id = ${orgId}`;
  return Number(r.n);
}

async function isSuppressed(tx: Tx, orgId: string, email: string | null) {
  if (!email) return false;
  const r = await tx`select 1 from rp.suppressions where org_id = ${orgId} and email_hash = ${emailHash(email)}`;
  return r.length > 0;
}

export async function createProspect(ctx: OrgContext, raw: z.input<typeof prospectSchema>, opts: { inboundText?: string; channel?: "form" | "email" | "phone" } = {}) {
  requireActive(ctx);
  const p = prospectSchema.parse(raw);
  const analysis = analyzeMessage(opts.inboundText ?? p.need, { inbound: true });
  const created = await withTenant(ctx.userId, async tx => {
    if ((await countProspects(tx, ctx.orgId)) >= ctx.limits.prospects) throw new AppError(`Limite de votre formule atteinte (${ctx.limits.prospects} prospects).`, "limit");
    if (p.email) {
      const dup = await tx`select id from rp.prospects where org_id = ${ctx.orgId} and email = ${p.email}`;
      if (dup.length) throw new AppError("Un prospect existe déjà avec cet e-mail.", "conflict");
    }
    const opposed = await isSuppressed(tx, ctx.orgId, p.email);
    const inboundAt = opts.inboundText || p.need ? new Date() : null;
    const score = scoreProspect({ status: "new", urgent: analysis.urgent, estimatedValueCents: p.estimatedValue, daysSinceInbound: 0, hasQuote: false, intent: analysis.intent });
    const [row] = await tx`
      insert into rp.prospects (org_id, first_name, last_name, company, email, phone, source, status, need, estimated_value_cents, lawful_basis, basis_note,
        owner_user_id, first_inbound_at, last_inbound_at, ai_summary, ai_intent, ai_urgency, ai_score)
      values (${ctx.orgId}, ${p.firstName}, ${p.lastName}, ${p.company}, ${p.email}, ${p.phone}, ${p.source}, ${opposed ? "opposed" : "new"}, ${p.need || analysis.need},
        ${p.estimatedValue}, ${p.lawfulBasis ?? null}, ${p.basisNote}, ${ctx.userId}, ${inboundAt}, ${inboundAt}, ${analysis.summary}, ${analysis.intent}, ${analysis.urgent}, ${score})
      returning id`;
    if (p.lawfulBasis) await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence, recorded_by) values (${ctx.orgId}, ${row.id}, ${p.lawfulBasis}, ${p.source}, ${p.basisNote}, ${ctx.userId})`;
    if (opts.inboundText || p.need) {
      await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, ai_intent, created_by)
        values (${ctx.orgId}, ${row.id}, 'inbound', ${opts.channel ?? (p.source === "form" ? "form" : "note")}, 'Demande initiale', ${opts.inboundText ?? p.need}, ${analysis.intent}, ${ctx.userId})`;
    }
    return row.id as string;
  });
  await emitWebhook(ctx.orgId, "prospect.created", { id: created, source: p.source });
  return created;
}

export async function updateProspect(ctx: OrgContext, id: string, raw: z.input<typeof prospectSchema>) {
  const p = prospectSchema.parse(raw);
  await withTenant(ctx.userId, async tx => {
    const [cur] = await tx`select lawful_basis, email from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!cur) throw new AppError("Prospect introuvable.", "not_found");
    if (p.email && p.email !== cur.email) {
      const dup = await tx`select id from rp.prospects where org_id = ${ctx.orgId} and email = ${p.email} and id <> ${id}`;
      if (dup.length) throw new AppError("Un autre prospect utilise déjà cet e-mail.", "conflict");
    }
    await tx`update rp.prospects set first_name = ${p.firstName}, last_name = ${p.lastName}, company = ${p.company}, email = ${p.email}, phone = ${p.phone},
      need = ${p.need}, estimated_value_cents = ${p.estimatedValue}, lawful_basis = ${p.lawfulBasis ?? null}, basis_note = ${p.basisNote}
      where id = ${id} and org_id = ${ctx.orgId}`;
    if ((p.lawfulBasis ?? null) !== (cur.lawfulBasis ?? null)) {
      await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence, recorded_by) values (${ctx.orgId}, ${id}, ${p.lawfulBasis ?? "withdrawn"}, 'modification', ${p.basisNote}, ${ctx.userId})`;
    }
  });
  await emitWebhook(ctx.orgId, "prospect.updated", { id });
}

/** Status change. "opposed" registers the opposition permanently and stops every sequence. */
export async function setStatus(ctx: OrgContext, id: string, status: Status, extra: { wonValueCents?: number | null; note?: string } = {}) {
  if (!STATUSES.includes(status)) throw new AppError("Statut inconnu.");
  await withTenant(ctx.userId, async tx => {
    const [p] = await tx`select email, status from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!p) throw new AppError("Prospect introuvable.", "not_found");
    if (p.status === "opposed" && status !== "opposed") {
      throw new AppError("Ce prospect s'est opposé aux communications. Seule une nouvelle demande de sa part (consentement enregistré) permet de reprendre contact.", "forbidden");
    }
    await tx`update rp.prospects set status = ${status}, won_value_cents = ${status === "won" ? extra.wonValueCents ?? null : null} where id = ${id} and org_id = ${ctx.orgId}`;
    if (status === "opposed") await registerOpposition(tx, ctx.orgId, id, p.email as string | null, "opposition", ctx.userId);
    if (["won", "lost", "opposed", "meeting"].includes(status)) {
      await tx`update rp.enrollments set status = 'stopped', stopped_reason = ${"Statut : " + STATUS_LABEL[status]}, next_run_at = null where prospect_id = ${id} and org_id = ${ctx.orgId} and status = 'active'`;
      await tx`update rp.messages set status = 'cancelled' where prospect_id = ${id} and org_id = ${ctx.orgId} and status in ('draft','needs_review','approved')`;
    }
    await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, created_by)
      values (${ctx.orgId}, ${id}, 'internal', 'system', 'Statut modifié', ${`${STATUS_LABEL[p.status as Status]} → ${STATUS_LABEL[status]}${extra.note ? ` — ${extra.note}` : ""}`}, ${ctx.userId})`;
  });
  await emitWebhook(ctx.orgId, "prospect.updated", { id, status });
}

export async function registerOpposition(tx: Tx, orgId: string, prospectId: string, email: string | null, reason: "unsubscribe" | "opposition" | "refusal", userId: string | null) {
  if (email) await tx`insert into rp.suppressions (org_id, email_hash, reason) values (${orgId}, ${emailHash(email)}, ${reason}) on conflict do nothing`;
  await tx`update rp.prospects set status = 'opposed', next_action_at = null where id = ${prospectId} and org_id = ${orgId}`;
  await tx`update rp.enrollments set status = 'stopped', stopped_reason = 'Opposition du prospect', next_run_at = null where prospect_id = ${prospectId} and org_id = ${orgId} and status = 'active'`;
  await tx`update rp.messages set status = 'cancelled' where prospect_id = ${prospectId} and org_id = ${orgId} and status in ('draft','needs_review','approved','sending')`;
  if (userId) await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence, recorded_by) values (${orgId}, ${prospectId}, 'withdrawn', ${reason}, '', ${userId})`;
}

export async function addNote(ctx: OrgContext, id: string, body: string) {
  const text = body.trim().slice(0, 5000);
  if (!text) throw new AppError("La note est vide.");
  await withTenant(ctx.userId, tx => tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, created_by)
    select ${ctx.orgId}, id, 'internal', 'note', 'Note', ${text}, ${ctx.userId} from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`);
}

export async function addQuote(ctx: OrgContext, id: string, q: { reference: string; amount?: string | number | null; sentAt?: string | null; validUntil?: string | null }) {
  const amount = euros.parse(q.amount ?? null);
  const sentAt = q.sentAt ? new Date(q.sentAt) : new Date();
  if (Number.isNaN(sentAt.getTime())) throw new AppError("Date d'envoi invalide.");
  await withTenant(ctx.userId, async tx => {
    const [p] = await tx`select id, status from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!p) throw new AppError("Prospect introuvable.", "not_found");
    await tx`insert into rp.quotes (org_id, prospect_id, reference, amount_cents, status, sent_at, valid_until)
      values (${ctx.orgId}, ${id}, ${q.reference.trim().slice(0, 80)}, ${amount}, 'sent', ${sentAt.toISOString()}::timestamptz, ${q.validUntil || null})`;
    await tx`update rp.prospects set last_outbound_at = greatest(coalesce(last_outbound_at, ${sentAt.toISOString()}::timestamptz), ${sentAt.toISOString()}::timestamptz),
      status = case when status in ('new','to_contact') then 'waiting' else status end,
      estimated_value_cents = coalesce(estimated_value_cents, ${amount})
      where id = ${id} and org_id = ${ctx.orgId}`;
    await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, occurred_at, created_by)
      values (${ctx.orgId}, ${id}, 'outbound', 'system', 'Devis envoyé', ${`Devis ${q.reference}${amount != null ? ` — ${(amount / 100).toLocaleString("fr-FR")} €` : ""}`}, ${sentAt.toISOString()}::timestamptz, ${ctx.userId})`;
  });
}

/**
 * Records something the prospect said (pasted reply, phone call, forwarded
 * e-mail) and applies RelancePro AI's reading of it. An unsubscribe request
 * is always honoured immediately; other intents update the status.
 */
export async function recordInbound(ctx: OrgContext, id: string, text: string, channel: "email" | "phone" | "form" | "meeting" = "email") {
  const body = text.trim().slice(0, 20000);
  if (!body) throw new AppError("Le message est vide.");
  const a = analyzeMessage(body, { inbound: true });
  await withTenant(ctx.userId, async tx => {
    const [p] = await tx`select id, email, status from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!p) throw new AppError("Prospect introuvable.", "not_found");
    await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, ai_intent, created_by)
      values (${ctx.orgId}, ${id}, 'inbound', ${channel}, 'Réponse du prospect', ${body}, ${a.intent}, ${ctx.userId})`;
    await tx`update rp.prospects set last_inbound_at = now(), ai_summary = ${a.summary}, ai_intent = ${a.intent}, ai_urgency = ${a.urgent} where id = ${id} and org_id = ${ctx.orgId}`;
    // Any reply ends the automatic sequence: a human takes over.
    await tx`update rp.enrollments set status = 'stopped', stopped_reason = 'Réponse du prospect', next_run_at = null where prospect_id = ${id} and org_id = ${ctx.orgId} and status = 'active'`;
    await tx`update rp.messages set status = 'cancelled' where prospect_id = ${id} and org_id = ${ctx.orgId} and status in ('draft','needs_review','approved')`;
    if (a.intent === "unsubscribe") await registerOpposition(tx, ctx.orgId, id, p.email as string | null, "unsubscribe", ctx.userId);
    else if (p.status !== "opposed" && a.suggestedStatus && a.intent !== "out_of_office") {
      await tx`update rp.prospects set status = ${a.suggestedStatus} where id = ${id} and org_id = ${ctx.orgId} and status not in ('won','opposed')`;
    }
  });
  await emitWebhook(ctx.orgId, "reply.received", { id, intent: a.intent });
  return a;
}

export async function importCsv(ctx: OrgContext, text: string, basis: string | null, evidence: string) {
  requireActive(ctx);
  if (text.length > 5_000_000) throw new AppError("Fichier trop volumineux (5 Mo maximum).");
  const { rows, errors } = mapRows(parseCsv(text));
  const lawful = basis && ["consent", "legitimate_interest", "pre_contract", "contract"].includes(basis) ? basis : null;
  let created = 0, skipped = 0, opposed = 0;
  await withTenant(ctx.userId, async tx => {
    const existing = await countProspects(tx, ctx.orgId);
    if (existing + rows.length > ctx.limits.prospects) throw new AppError(`Cet import dépasserait la limite de votre formule (${ctx.limits.prospects} prospects).`, "limit");
    for (const r of rows) {
      if (r.email && (await tx`select 1 from rp.prospects where org_id = ${ctx.orgId} and email = ${r.email}`).length) { skipped++; continue; }
      const sup = await isSuppressed(tx, ctx.orgId, r.email);
      if (sup) opposed++;
      const a = r.need ? analyzeMessage(r.need) : null;
      const [row] = await tx`
        insert into rp.prospects (org_id, first_name, last_name, company, email, phone, source, status, need, estimated_value_cents, lawful_basis, basis_note, owner_user_id, ai_summary, ai_intent, ai_urgency)
        values (${ctx.orgId}, ${r.firstName}, ${r.lastName}, ${r.company}, ${r.email}, ${r.phone}, 'csv', ${sup ? "opposed" : r.status ?? "new"}, ${r.need}, ${r.estimatedValueCents},
          ${lawful}, ${evidence.slice(0, 500)}, ${ctx.userId}, ${a?.summary ?? ""}, ${a?.intent ?? null}, ${a?.urgent ?? false})
        returning id`;
      if (lawful) await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence, recorded_by) values (${ctx.orgId}, ${row.id}, ${lawful}, 'import CSV', ${evidence.slice(0, 1000)}, ${ctx.userId})`;
      created++;
    }
    await tx`insert into rp.audit_log (org_id, user_id, action, meta) values (${ctx.orgId}, ${ctx.userId}, 'import_csv', ${jsonb({ created, skipped, opposed, errors: errors.length })}::jsonb)`;
  });
  return { created, skipped, opposed, errors };
}

export type ProspectFilter = { q?: string; status?: string; forgotten?: boolean; sort?: "score" | "recent" | "name" };

export async function listProspects(ctx: OrgContext, f: ProspectFilter = {}) {
  const followUp = settingsWithDefaults(ctx.org.settings).followUpAfterDays;
  const q = f.q?.trim() ? `%${f.q.trim().toLowerCase().replace(/[%_]/g, "")}%` : null;
  const rows = await withTenant(ctx.userId, tx => tx`
    select p.*, (select count(*)::int from rp.quotes qu where qu.prospect_id = p.id) as quote_count,
      (select e.id from rp.enrollments e where e.prospect_id = p.id and e.status = 'active') as enrollment_id
    from rp.prospects p
    where p.org_id = ${ctx.orgId}
      ${f.status ? tx`and p.status = ${f.status}` : tx``}
      ${q ? tx`and (lower(p.first_name || ' ' || p.last_name || ' ' || p.company || ' ' || coalesce(p.email, '')) like ${q})` : tx``}
    order by ${f.sort === "name" ? tx`p.last_name, p.first_name` : f.sort === "recent" ? tx`p.created_at desc` : tx`p.ai_score desc nulls last, p.created_at desc`}
    limit 500`);
  const now = new Date();
  const mapped = (rows as unknown as Array<DbRow>).map((r): DbRow => ({ ...r, forgotten: isForgotten({ status: r.status as string, lastInboundAt: r.lastInboundAt as Date | null, lastOutboundAt: r.lastOutboundAt as Date | null, createdAt: r.createdAt as Date }, followUp, now) }));
  return f.forgotten ? mapped.filter(r => r.forgotten) : mapped;
}

export async function getProspect(ctx: OrgContext, id: string) {
  return withTenant(ctx.userId, async tx => {
    const [p] = await tx`select * from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!p) return null;
    const [interactions, quotes, messages, consents, enrollment] = await Promise.all([
      tx`select i.*, u.name as author from rp.interactions i left join rp.users u on u.id = i.created_by where i.prospect_id = ${id} and i.org_id = ${ctx.orgId} order by i.occurred_at desc limit 200`,
      tx`select * from rp.quotes where prospect_id = ${id} and org_id = ${ctx.orgId} order by created_at desc`,
      tx`select * from rp.messages where prospect_id = ${id} and org_id = ${ctx.orgId} order by created_at desc limit 50`,
      tx`select c.*, u.name as recorded_by_name from rp.consents c left join rp.users u on u.id = c.recorded_by where c.prospect_id = ${id} and c.org_id = ${ctx.orgId} order by c.recorded_at desc`,
      tx`select e.*, s.name as sequence_name, s.mode from rp.enrollments e join rp.sequences s on s.id = e.sequence_id where e.prospect_id = ${id} and e.org_id = ${ctx.orgId} order by e.started_at desc limit 1`
    ]);
    return { prospect: p, interactions, quotes, messages, consents, enrollment: enrollment[0] ?? null };
  });
}

/** RGPD right of access: everything held about one prospect, as JSON. */
export async function exportProspect(ctx: OrgContext, id: string) {
  const d = await getProspect(ctx, id);
  if (!d) throw new AppError("Prospect introuvable.", "not_found");
  return { exportedAt: new Date().toISOString(), organization: ctx.org.name, ...d };
}

/**
 * RGPD right to erasure: deletes the prospect and its history. The proof of
 * past legal bases is kept detached (no identity), and if the person opposed
 * contact, the keyed hash of the address stays in the opposition list so a
 * re-import can never target them again.
 */
export async function eraseProspect(ctx: OrgContext, id: string, keepOpposition: boolean) {
  await withTenant(ctx.userId, async tx => {
    const [p] = await tx`select email, status from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    if (!p) throw new AppError("Prospect introuvable.", "not_found");
    if ((keepOpposition || p.status === "opposed") && p.email) await tx`insert into rp.suppressions (org_id, email_hash, reason) values (${ctx.orgId}, ${emailHash(p.email as string)}, 'opposition') on conflict do nothing`;
    await tx`delete from rp.prospects where id = ${id} and org_id = ${ctx.orgId}`;
    await tx`insert into rp.audit_log (org_id, user_id, action, target_type, target_id) values (${ctx.orgId}, ${ctx.userId}, 'erase_prospect', 'prospect', ${id})`;
  });
}

export async function refreshScores(orgId: string) {
  const sql = system();
  const rows = await sql`select p.id, p.status, p.ai_urgency, p.estimated_value_cents, p.last_inbound_at, p.ai_intent,
    exists(select 1 from rp.quotes q where q.prospect_id = p.id) as has_quote from rp.prospects p where p.org_id = ${orgId} and p.status not in ('won','lost','opposed')`;
  for (const r of rows) {
    const days = r.lastInboundAt ? (Date.now() - (r.lastInboundAt as Date).getTime()) / 86400_000 : null;
    const s = scoreProspect({ status: r.status as string, urgent: Boolean(r.aiUrgency), estimatedValueCents: r.estimatedValueCents ? Number(r.estimatedValueCents) : null, daysSinceInbound: days, hasQuote: Boolean(r.hasQuote), intent: r.aiIntent as string | null });
    await sql`update rp.prospects set ai_score = ${s} where id = ${r.id}`;
  }
}
