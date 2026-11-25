"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, loginSchema, passwordSchema, signupSchema } from "@/lib/validation";
import { toUserMessage } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";
import { safeRedirectPath } from "@/lib/utils";
import type { ActionState } from "./types";
import { z } from "zod";

export async function signUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const f = fieldErrors(parsed.error);
    if (f.website) return { ok: true, message: "Vérifie ta boîte mail pour confirmer ton compte." }; // silent honeypot
    return { error: "Corrige les champs indiqués.", fields: f };
  }
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 3600))) return { error: "Trop de tentatives d'inscription. Réessaie plus tard." };

  const { display_name, email, password, birthdate } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name, birthdate },
      emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/onboarding`,
    },
  });
  if (error) return { error: toUserMessage(error) };
  return { ok: true, message: `Un email de confirmation a été envoyé à ${email}. Clique sur le lien pour activer ton compte.` };
}

export async function signInAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Corrige les champs indiqués.", fields: fieldErrors(parsed.error) };
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 20, 600)) || !(await rateLimit(`login:${parsed.data.email}`, 10, 600))) {
    return { error: "Trop de tentatives de connexion. Réessaie dans quelques minutes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: toUserMessage(error), data: /not confirmed/i.test(error.message) ? { unconfirmed: true } : undefined };
  redirect(safeRedirectPath(formData.get("next")?.toString()));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Email invalide.", fields: { email: "Email invalide" } };
  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) return { error: "Trop de demandes. Réessaie plus tard." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${publicEnv.appUrl}/auth/callback?next=/update-password` });
  if (error) console.error("[venture] reset password", error.message);
  // Same answer whether or not the account exists (no account enumeration).
  return { ok: true, message: "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé." };
}

export async function resendConfirmationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Email invalide." };
  const ip = await clientIp();
  if (!(await rateLimit(`resend:${ip}`, 5, 3600))) return { error: "Trop de demandes. Réessaie plus tard." };
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: email.data, options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=/onboarding` } });
  return { ok: true, message: "Si ce compte attend une confirmation, un nouvel email a été envoyé." };
}

export async function updatePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const pw = passwordSchema.safeParse(formData.get("password"));
  if (!pw.success) return { error: pw.error.issues[0]?.message ?? "Mot de passe invalide", fields: { password: pw.error.issues[0]?.message ?? "" } };
  if (formData.get("password") !== formData.get("confirm")) return { error: "Les mots de passe ne correspondent pas.", fields: { confirm: "Différent du mot de passe" } };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Le lien a expiré. Refais une demande de réinitialisation." };
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { error: toUserMessage(error) };
  return { ok: true, message: "Mot de passe mis à jour." };
}
