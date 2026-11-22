// Applies db/migrations/*.sql in order, once each, inside a transaction per file.
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL manquant"); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
await sql`create table if not exists public.rp_migrations (name text primary key, applied_at timestamptz not null default now())`;
const done = new Set((await sql`select name from public.rp_migrations`).map(r => r.name));
for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) {
  if (done.has(f)) continue;
  await sql.begin(async tx => {
    await tx.unsafe(readFileSync(join(dir, f), "utf8"));
    await tx`insert into public.rp_migrations(name) values (${f})`;
  });
  console.log("applied", f);
}
await sql.end();
