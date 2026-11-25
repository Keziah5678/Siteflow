import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { readFileSync } from "node:fs";
import path from "node:path";

// Load .env.local (local stack keys) for integration tests.
for (const line of readFileSync(path.resolve(__dirname, "../../.env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2];
}

export const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export type DB = SupabaseClient<Database>;
export const admin: DB = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
export const anon = (): DB => createClient<Database>(URL, ANON, { auth: { persistSession: false } });

const run = Math.random().toString(36).slice(2, 8);
export const PASSWORD = "Venture2026Test";

export type TestUser = { id: string; email: string; db: DB };

export async function createUser(name: string, opts: { birthdate?: string; onboard?: boolean } = {}): Promise<TestUser> {
  const email = `${name}.${run}@test.venture.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, birthdate: opts.birthdate ?? "1995-06-15" },
  });
  if (error || !data.user) throw new Error(`createUser ${name}: ${error?.message}`);
  const db = anon();
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  if (opts.onboard !== false) {
    await db.from("profiles").update({ onboarded: true }).eq("id", data.user.id);
  }
  return { id: data.user.id, email, db };
}

export async function cleanup(users: TestUser[]) {
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
}
