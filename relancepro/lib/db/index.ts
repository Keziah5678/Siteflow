import "server-only";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { env } from "../server/env";

/**
 * Database access.
 *
 * - `system()` : the owner connection, for platform work (signup, cron,
 *   webhooks, admin). Code using it must filter by organization itself.
 * - `withTenant(userId, fn)` : a transaction in which the role is switched
 *   to `rp_app` and `app.user_id` is set, so Row Level Security restricts
 *   every statement to the organizations this user belongs to. All
 *   customer-facing reads and writes go through it.
 */
let pool: Sql | null = null;

export function system(): Sql {
  if (!env.databaseUrl) throw new Error("DATABASE_URL n'est pas configurée.");
  if (!pool) {
    pool = postgres(env.databaseUrl, {
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // compatible with Supabase's transaction pooler
      transform: postgres.camel,
      onnotice: () => {}
    });
  }
  return pool;
}

export type Tx = TransactionSql;
export type Db = Sql | TransactionSql;

export async function withTenant<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return system().begin(async tx => {
    await tx`select set_config('app.user_id', ${userId}, true)`;
    await tx`set local role rp_app`;
    return fn(tx);
  }) as Promise<T>;
}

export async function closeDb() {
  if (pool) { await pool.end({ timeout: 5 }); pool = null; }
}

/**
 * Passes a value to a `::jsonb` parameter. With postgres v4, an object is
 * serialised as JSON; a pre-stringified value would be stored as a JSON
 * *string*, which is why JSON.stringify must never be used for jsonb.
 */
export const jsonb = (v: unknown) => v as never;
