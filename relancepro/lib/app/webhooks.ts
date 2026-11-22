import "server-only";
import { createHmac } from "node:crypto";
import { system, withTenant } from "../db";
import { enqueue } from "../jobs/queue";
import { decrypt, encrypt, randomToken } from "../server/crypto";
import { AppError, requireRole, type OrgContext } from "./context";

/**
 * Outgoing webhooks: each event is delivered as a signed POST
 * (`X-RelancePro-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`),
 * through the job queue, with retries. Lets customers connect any CRM,
 * Zapier/Make/n8n scenario or internal tool.
 */

export const WEBHOOK_EVENTS = ["prospect.created", "prospect.updated", "message.sent", "reply.received"] as const;

export async function emitWebhook(orgId: string, event: string, data: Record<string, unknown>) {
  const sql = system();
  const endpoints = await sql`select id from rp.webhook_endpoints where org_id = ${orgId} and active and ${event} = any(events)`;
  for (const e of endpoints) {
    const [d] = await sql`insert into rp.webhook_deliveries (org_id, endpoint_id, event) values (${orgId}, ${e.id}, ${event}) returning id`;
    await enqueue(sql, "webhook_delivery", { deliveryId: d.id, payload: { id: d.id, event, createdAt: new Date().toISOString(), data } }, { orgId, key: `webhook:${d.id}`, maxAttempts: 6 });
  }
}

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export async function deliverWebhook(payload: { deliveryId: string; payload: Record<string, unknown> }) {
  const sql = system();
  const [d] = await sql`select d.*, e.url, e.secret_enc, e.active from rp.webhook_deliveries d join rp.webhook_endpoints e on e.id = d.endpoint_id where d.id = ${payload.deliveryId}`;
  if (!d || !d.active || d.status === "delivered") return;
  const body = JSON.stringify(payload.payload);
  let code = 0;
  try {
    const res = await fetch(d.url as string, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/json", "User-Agent": "RelancePro-Webhooks/1.0", "X-RelancePro-Event": String(payload.payload.event), "X-RelancePro-Signature": signPayload(decrypt(d.secretEnc as string), body) },
      body
    });
    code = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await sql`update rp.webhook_deliveries set status = 'delivered', response_code = ${code}, attempts = attempts + 1 where id = ${d.id}`;
  } catch (e) {
    await sql`update rp.webhook_deliveries set status = 'failed', response_code = ${code || null}, attempts = attempts + 1 where id = ${d.id}`;
    throw e;
  }
}

/** Refuses private / loopback targets so webhooks can't be used to probe internal networks. */
export function assertPublicHttps(raw: string): string {
  let u: URL;
  try { u = new URL(raw); } catch { throw new AppError("URL invalide."); }
  if (u.protocol !== "https:") throw new AppError("L'URL doit commencer par https://");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd")) {
    throw new AppError("Adresse privée refusée.");
  }
  return u.toString();
}

export async function createEndpoint(ctx: OrgContext, url: string, events: string[]): Promise<{ id: string; secret: string }> {
  requireRole(ctx, "admin");
  if (!ctx.limits.webhooks) throw new AppError("Les webhooks sont disponibles à partir de la formule Pro.", "limit");
  const clean = assertPublicHttps(url);
  const evs = events.filter(e => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!evs.length) throw new AppError("Choisissez au moins un événement.");
  const secret = `whsec_${randomToken(24)}`;
  // Insert as owner role: rp_app cannot write the encrypted secret column by design.
  const [row] = await system()`insert into rp.webhook_endpoints (org_id, url, secret_enc, events) values (${ctx.orgId}, ${clean}, ${encrypt(secret)}, ${evs}::text[]) returning id`;
  await withTenant(ctx.userId, tx => tx`insert into rp.audit_log (org_id, user_id, action, target_type, target_id) values (${ctx.orgId}, ${ctx.userId}, 'webhook_created', 'webhook', ${row.id as string})`);
  return { id: row.id as string, secret };
}

export async function listEndpoints(ctx: OrgContext) {
  return withTenant(ctx.userId, tx => tx`
    select e.id, e.url, e.events, e.active, e.created_at,
      (select count(*)::int from rp.webhook_deliveries d where d.endpoint_id = e.id and d.status = 'delivered') as delivered,
      (select count(*)::int from rp.webhook_deliveries d where d.endpoint_id = e.id and d.status = 'failed') as failed
    from rp.webhook_endpoints e where e.org_id = ${ctx.orgId} order by e.created_at`);
}

export async function deleteEndpoint(ctx: OrgContext, id: string) {
  requireRole(ctx, "admin");
  await withTenant(ctx.userId, tx => tx`delete from rp.webhook_endpoints where id = ${id} and org_id = ${ctx.orgId}`);
}
