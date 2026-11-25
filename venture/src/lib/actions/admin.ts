"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors";
import type { ActionState } from "./types";

const uuid = z.string().uuid();

async function db() {
  return createClient(); // every admin write is re-checked by RLS / SECURITY DEFINER RPCs
}

export async function moderateAction(targetType: string, targetId: string, hide: boolean): Promise<ActionState> {
  const t = z.enum(["project", "comment", "message", "profile", "opportunity"]).safeParse(targetType);
  if (!t.success || !uuid.safeParse(targetId).success) return { error: "Requête invalide." };
  const { error } = await (await db()).rpc("moderate_content", { p_type: t.data, p_id: targetId, p_hide: hide });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function resolveReportAction(reportId: string, status: string, note?: string): Promise<ActionState> {
  const s = z.enum(["open", "reviewing", "resolved", "dismissed"]).safeParse(status);
  if (!s.success || !uuid.safeParse(reportId).success) return { error: "Requête invalide." };
  const { error } = await (await db()).rpc("resolve_report", { p_report: reportId, p_status: s.data, p_note: note ?? undefined });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function updateUserAction(userId: string, patch: { plan?: string; verified?: boolean; suspended?: boolean; role?: string; accountType?: string }): Promise<ActionState> {
  const parsed = z
    .object({
      plan: z.enum(["free", "plus", "business"]).optional(),
      verified: z.boolean().optional(),
      suspended: z.boolean().optional(),
      role: z.enum(["user", "moderator", "admin", "superadmin"]).optional(),
      accountType: z.enum(["personal", "business"]).optional(),
    })
    .safeParse(patch);
  if (!parsed.success || !uuid.safeParse(userId).success) return { error: "Requête invalide." };
  const p = parsed.data;
  const { error } = await (await db()).rpc("admin_update_user", {
    p_user: userId,
    p_plan: p.plan,
    p_verified_organizer: p.verified,
    p_suspended: p.suspended,
    p_role: p.role,
    p_account_type: p.accountType,
  });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function updatePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      plan: z.enum(["free", "plus", "business"]),
      label: z.string().trim().min(2).max(60),
      price_eur: z.coerce.number().min(0).max(10000),
      ai_monthly_credits: z.coerce.number().int().min(0).max(1_000_000),
      features: z.string().max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Valeurs invalides." };
  const d = parsed.data;
  const { data, error } = await (await db())
    .from("plan_settings")
    .update({ label: d.label, price_cents: Math.round(d.price_eur * 100), ai_monthly_credits: d.ai_monthly_credits, features: d.features.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 12) })
    .eq("plan", d.plan)
    .select("plan");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath("/admin");
  revalidatePath("/pricing");
  return { ok: true, message: "Offre mise à jour." };
}

export async function updateSettingAction(key: string, value: unknown): Promise<ActionState> {
  const schemas: Record<string, z.ZodType> = {
    ticketing_commission_pct: z.number().min(0).max(50),
    services_commission_pct: z.number().min(0).max(50),
    show_demo_content: z.boolean(),
    ai_cost_per_credit_cents: z.number().min(0).max(1000),
    // Regulated crowdfunding stays off until an authorised partner exists.
    regulated_funding_enabled: z.literal(false),
  };
  const schema = schemas[key];
  if (!schema) return { error: "Paramètre inconnu." };
  const v = schema.safeParse(value);
  if (!v.success) return { error: key === "regulated_funding_enabled" ? "Le financement réglementé ne peut pas être activé sans partenaire agréé." : "Valeur invalide." };
  const { data, error } = await (await db()).from("app_settings").update({ value: v.data as never }).eq("key", key).select("key");
  if (error || !data?.length) return { error: toUserMessage(error ?? { message: "VENTURE_FORBIDDEN" }) };
  revalidatePath("/", "layout");
  return { ok: true };
}
