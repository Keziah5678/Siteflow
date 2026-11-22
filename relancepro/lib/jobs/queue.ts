import "server-only";
import type { Db } from "../db";
import { jsonb, system } from "../db";
import { logError } from "../server/ops";

/**
 * Durable job queue in PostgreSQL.
 *  - enqueue() is idempotent through `idempotency_key` (unique).
 *  - runDueJobs() claims due jobs with FOR UPDATE SKIP LOCKED, so several
 *    workers (cron ticks, after() hooks) never process the same job twice.
 *  - failures are retried with exponential backoff, then marked `dead` and
 *    surfaced in the admin dashboard.
 */

export type JobHandler = (payload: Record<string, unknown>, job: { id: number; orgId: string | null; attempts: number }) => Promise<void>;

export async function enqueue(db: Db, type: string, payload: Record<string, unknown>, opts: { orgId?: string | null; runAt?: Date; key?: string; maxAttempts?: number } = {}): Promise<boolean> {
  const rows = await db`
    insert into rp.jobs (org_id, type, payload, run_at, idempotency_key, max_attempts)
    values (${opts.orgId ?? null}, ${type}, ${jsonb(payload)}::jsonb, ${(opts.runAt ?? new Date()).toISOString()}::timestamptz, ${opts.key ?? null}, ${opts.maxAttempts ?? 5})
    on conflict (idempotency_key) do nothing
    returning id`;
  return rows.length > 0;
}

export function backoffMs(attempts: number): number {
  return Math.min(6 * 3600_000, 60_000 * 2 ** Math.max(0, attempts - 1));
}

export async function runDueJobs(handlers: Record<string, JobHandler>, limit = 25): Promise<{ processed: number; failed: number }> {
  const sql = system();
  // Jobs stuck in "running" (crashed worker) are released after 10 minutes.
  await sql`update rp.jobs set status = 'queued', locked_at = null where status = 'running' and locked_at < now() - interval '10 minutes'`;
  const claimed = await sql.begin(async tx => tx`
    update rp.jobs set status = 'running', locked_at = now(), attempts = attempts + 1
    where id in (
      select id from rp.jobs where status = 'queued' and run_at <= now()
      order by run_at limit ${limit} for update skip locked
    )
    returning id, org_id, type, payload, attempts, max_attempts`);
  let processed = 0, failed = 0;
  for (const job of claimed) {
    const handler = handlers[job.type as string];
    try {
      if (!handler) throw new Error(`Aucun gestionnaire pour ${job.type}`);
      await handler(job.payload as Record<string, unknown>, { id: Number(job.id), orgId: job.orgId as string | null, attempts: Number(job.attempts) });
      await sql`update rp.jobs set status = 'done', finished_at = now(), last_error = null where id = ${job.id}`;
      processed++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      const dead = Number(job.attempts) >= Number(job.maxAttempts);
      await sql`
        update rp.jobs set status = ${dead ? "dead" : "queued"}, locked_at = null, last_error = ${message.slice(0, 1000)},
          run_at = now() + (${backoffMs(Number(job.attempts))} * interval '1 millisecond'), finished_at = ${dead ? new Date().toISOString() : null}::timestamptz
        where id = ${job.id}`;
      if (dead) await logError(`job:${job.type}`, e, { jobId: Number(job.id) }, job.orgId as string | null);
    }
  }
  return { processed, failed };
}
