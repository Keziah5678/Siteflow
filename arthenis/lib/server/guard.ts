import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AI, SUPABASE } from "./config";

/**
 * Protection shared by every AI route:
 *  - authentication (Supabase JWT when hosted; anonymous-by-IP in local mode),
 *  - per-identity rate limit (sliding minute window),
 *  - daily quotas for text and images, persisted in ai_usage when hosted,
 *  - body validation with zod, bounded body size.
 * Errors never leak secrets or stack traces.
 */

export type Caller = { id: string; supabase: SupabaseClient | null; hosted: boolean };

const windows = new Map<string, number[]>();
const memoryQuota = new Map<string, { day: string; text: number; image: number }>();

export function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function authenticate(req: Request): Promise<Caller | NextResponse> {
  if (!SUPABASE.url || !SUPABASE.key) {
    // Without accounts there is no one to bill: in production, paid AI stays off unless explicitly allowed.
    if (process.env.NODE_ENV === "production" && process.env.ARTHENIS_ALLOW_ANONYMOUS_AI !== "true") {
      return NextResponse.json({ available: false, error: "IA désactivée : configurez Supabase (comptes) ou ARTHENIS_ALLOW_ANONYMOUS_AI=true." }, { status: 200 });
    }
    return { id: `ip:${ipOf(req)}`, supabase: null, hosted: false };
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return jsonError("Authentification requise.", 401);
  const supabase = createClient(SUPABASE.url, SUPABASE.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: auth } } });
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data.user) return jsonError("Session invalide ou expirée.", 401);
  return { id: data.user.id, supabase, hosted: true };
}

export function rateLimit(key: string): NextResponse | null {
  const now = Date.now();
  const list = (windows.get(key) ?? []).filter(t => now - t < 60_000);
  if (list.length >= AI.ratePerMinute) return jsonError("Trop de requêtes. Patientez une minute.", 429);
  list.push(now);
  windows.set(key, list);
  if (windows.size > 5000) for (const [k, v] of windows) if (!v.some(t => now - t < 60_000)) windows.delete(k);
  return null;
}

/** Checks the daily quota; returns an error response when exhausted. */
export async function checkQuota(caller: Caller, op: "text" | "image"): Promise<NextResponse | null> {
  const limit = op === "image" ? AI.dailyImageLimit : AI.dailyTextLimit;
  const today = new Date().toISOString().slice(0, 10);
  if (caller.supabase) {
    const { count, error } = await caller.supabase.from("ai_usage").select("id", { count: "exact", head: true })
      .eq("user_id", caller.id).eq("operation", op).gte("created_at", `${today}T00:00:00Z`);
    if (!error && (count ?? 0) >= limit) return jsonError(`Quota quotidien atteint (${limit} ${op === "image" ? "images" : "requêtes IA"}).`, 429, { quota: true });
    return null;
  }
  const q = memoryQuota.get(caller.id);
  const used = q && q.day === today ? q[op] : 0;
  if (used >= limit) return jsonError(`Quota quotidien atteint (${limit}).`, 429, { quota: true });
  return null;
}

export async function recordUsage(caller: Caller, op: "text" | "image", worldId: string | null, costCents = 0) {
  if (caller.supabase) {
    await caller.supabase.from("ai_usage").insert({ user_id: caller.id, world_id: worldId, operation: op, cost_cents: costCents });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const q = memoryQuota.get(caller.id);
  const cur = q && q.day === today ? q : { day: today, text: 0, image: 0 };
  cur[op]++;
  memoryQuota.set(caller.id, cur);
}

/** Parses and validates a JSON body (max 256 KB). */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T | NextResponse> {
  const raw = await req.text();
  if (raw.length > 262_144) return jsonError("Requête trop volumineuse.", 413);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return jsonError("JSON invalide."); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return jsonError("Requête invalide.", 400, { issues: parsed.error.issues.slice(0, 5).map(i => `${i.path.join(".")}: ${i.message}`) });
  return parsed.data;
}

/** Runs the common preamble; returns either the caller or an error response. */
export async function guard(req: Request, op: "text" | "image"): Promise<Caller | NextResponse> {
  const caller = await authenticate(req);
  if (caller instanceof NextResponse) return caller;
  const limited = rateLimit(caller.id);
  if (limited) return limited;
  const quota = await checkQuota(caller, op);
  if (quota) return quota;
  return caller;
}

export function log(event: string, data: Record<string, unknown>) {
  // Structured server log; never includes prompts' secrets or keys.
  console.info(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
