import "server-only";
import type { Db } from "../db";
import { jsonb, system } from "../db";

/**
 * Operational helpers shared by every module: rate limiting (shared across
 * serverless instances, stored in Postgres), audit trail, error log.
 */

export async function rateLimit(key: string, limit: number, windowSeconds: number, db: Db = system()): Promise<{ ok: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db`
    insert into rp.rate_limits (key, window_start, count) values (${key}, ${windowStart}::timestamptz, 1)
    on conflict (key, window_start) do update set count = rp.rate_limits.count + 1
    returning count`;
  const count = Number(row.count);
  if (Math.random() < 0.01) await db`delete from rp.rate_limits where window_start < now() - interval '1 day'`;
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function audit(db: Db, entry: { orgId: string | null; userId: string | null; action: string; targetType?: string; targetId?: string | null; meta?: Record<string, unknown> }) {
  await db`
    insert into rp.audit_log (org_id, user_id, action, target_type, target_id, meta)
    values (${entry.orgId}, ${entry.userId}, ${entry.action}, ${entry.targetType ?? ""}, ${entry.targetId ?? null}, ${jsonb(entry.meta ?? {})}::jsonb)`;
}

/** Records a technical error for the admin dashboard. Never stores secrets or message bodies. */
export async function logError(source: string, error: unknown, context: Record<string, unknown> = {}, orgId: string | null = null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", source, message, orgId, at: new Date().toISOString() }));
  try {
    await system()`insert into rp.error_log (org_id, source, message, context) values (${orgId}, ${source}, ${message.slice(0, 2000)}, ${jsonb(context)}::jsonb)`;
  } catch { /* the error log must never throw */ }
}
