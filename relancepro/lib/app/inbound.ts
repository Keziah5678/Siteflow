import "server-only";
import { z } from "zod";
import { system } from "../db";
import { analyzeMessage, scoreProspect } from "../ai/engine";
import { emailHash, verifySignature } from "../server/crypto";
import { rateLimit } from "../server/ops";
import { emitWebhook } from "./webhooks";
import { effectivePlan, limitsFor, type PlanId } from "../billing/plans";
import { AppError } from "./context";

/**
 * Public entry points that don't use a session:
 *  - the website form endpoint (each company embeds its own token),
 *  - the unsubscribe link carried by every follow-up.
 */

export const formSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  company: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  marketingConsent: z.union([z.boolean(), z.string()]).optional().transform(v => v === true || v === "on" || v === "true" || v === "1"),
  website: z.string().max(0).optional().default("") // honeypot: must stay empty
});

/** Turns a website form submission into a prospect. The prospect asked: lawful basis = pre-contractual request. */
export async function receiveForm(token: string, raw: unknown, meta: { ip: string; page?: string }) {
  const sql = system();
  const [org] = await sql`select o.id, o.trial_ends_at, s.plan, s.status, s.current_period_end from rp.organizations o left join rp.subscriptions s on s.org_id = o.id where o.inbound_token = ${token}`;
  if (!org) throw new AppError("Formulaire inconnu.", "not_found");
  const ip = await rateLimit(`form:${meta.ip}`, 20, 3600);
  const perOrg = await rateLimit(`form-org:${org.id}`, 500, 86400);
  if (!ip.ok || !perOrg.ok) throw new AppError("Trop de demandes, réessayez plus tard.", "limit");
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) {
    if ((raw as { website?: string })?.website) return { ok: true, ignored: true }; // bot: pretend success
    throw new AppError("Merci de renseigner votre nom, un e-mail valide et votre message.");
  }
  const f = parsed.data;
  const plan = effectivePlan({ plan: (org.plan as PlanId) ?? null, status: (org.status as string) ?? "none", currentPeriodEnd: (org.currentPeriodEnd as Date) ?? null }, org.trialEndsAt as Date);
  const limits = limitsFor(plan);
  const [first, ...rest] = f.name.split(/\s+/);
  const a = analyzeMessage(f.message, { inbound: true });
  const basisNote = `Demande via le formulaire du site${meta.page ? ` (${meta.page.slice(0, 200)})` : ""} le ${new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`;
  const prospectId = await sql.begin(async tx => {
    const [existing] = await tx`select id, status from rp.prospects where org_id = ${org.id} and email = ${f.email}`;
    let id = existing?.id as string | undefined;
    if (!id) {
      const [count] = await tx`select count(*)::int as n from rp.prospects where org_id = ${org.id}`;
      if (Number(count.n) >= limits.prospects) throw new AppError("Ce formulaire est momentanément indisponible.", "limit");
      // A new request after an opposition is a fresh, explicit contact from the person.
      const [row] = await tx`insert into rp.prospects (org_id, first_name, last_name, company, email, phone, source, status, need, lawful_basis, basis_note, first_inbound_at, last_inbound_at, ai_summary, ai_intent, ai_urgency, ai_score)
        values (${org.id}, ${first ?? ""}, ${rest.join(" ")}, ${f.company}, ${f.email}, ${f.phone || null}, 'form', 'new', ${a.need}, ${f.marketingConsent ? "consent" : "pre_contract"}, ${basisNote}, now(), now(), ${a.summary}, ${a.intent}, ${a.urgent},
          ${scoreProspect({ status: "new", urgent: a.urgent, estimatedValueCents: null, daysSinceInbound: 0, hasQuote: false, intent: a.intent })})
        returning id`;
      id = row.id as string;
    } else {
      await tx`update rp.prospects set last_inbound_at = now(), need = ${a.need}, ai_summary = ${a.summary}, ai_intent = ${a.intent}, ai_urgency = ${a.urgent},
        status = case when status = 'opposed' then 'new' else 'to_contact' end, lawful_basis = coalesce(lawful_basis, 'pre_contract') where id = ${id}`;
      if (existing.status === "opposed") await tx`delete from rp.suppressions where org_id = ${org.id} and email_hash = ${emailHash(f.email)}`;
    }
    await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence) values (${org.id}, ${id}, ${f.marketingConsent ? "consent" : "pre_contract"}, 'formulaire web', ${basisNote})`;
    await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body, ai_intent) values (${org.id}, ${id}, 'inbound', 'form', 'Demande via le site', ${f.message}, ${a.intent})`;
    return id;
  });
  await emitWebhook(org.id as string, "prospect.created", { id: prospectId, source: "form" });
  return { ok: true, prospectId };
}

export function parseUnsubscribeToken(token: string): { orgId: string; prospectId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [orgId, prospectId, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(orgId) || !/^[0-9a-f-]{36}$/.test(prospectId)) return null;
  return verifySignature(`${orgId}.${prospectId}`, sig) ? { orgId, prospectId } : null;
}

/** Honours an unsubscribe request immediately and permanently. Idempotent. */
export async function unsubscribe(token: string): Promise<{ ok: boolean; company?: string }> {
  const t = parseUnsubscribeToken(token);
  if (!t) return { ok: false };
  const sql = system();
  return sql.begin(async tx => {
    const [p] = await tx`select p.email, o.name from rp.prospects p join rp.organizations o on o.id = p.org_id where p.id = ${t.prospectId} and p.org_id = ${t.orgId}`;
    if (!p) return { ok: true }; // erased already: nothing left to contact
    if (p.email) await tx`insert into rp.suppressions (org_id, email_hash, reason) values (${t.orgId}, ${emailHash(p.email as string)}, 'unsubscribe') on conflict do nothing`;
    await tx`update rp.prospects set status = 'opposed', next_action_at = null where id = ${t.prospectId} and org_id = ${t.orgId}`;
    await tx`update rp.enrollments set status = 'stopped', stopped_reason = 'Désinscription', next_run_at = null where prospect_id = ${t.prospectId} and status = 'active'`;
    await tx`update rp.messages set status = 'cancelled' where prospect_id = ${t.prospectId} and status in ('draft','needs_review','approved')`;
    await tx`insert into rp.consents (org_id, prospect_id, basis, source, evidence) values (${t.orgId}, ${t.prospectId}, 'withdrawn', 'lien de désinscription', '')`;
    await tx`insert into rp.interactions (org_id, prospect_id, direction, channel, subject, body) values (${t.orgId}, ${t.prospectId}, 'inbound', 'system', 'Désinscription', 'Le prospect a utilisé le lien de désinscription.')`;
    return { ok: true, company: p.name as string };
  });
}
