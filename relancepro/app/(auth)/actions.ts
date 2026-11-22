"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthError, logIn, requestPasswordReset, resetPassword, revokeSession, sendVerification, signUp, createSession, verifyEmail } from "@/lib/auth/service";
import { clearSessionCookie, clientMeta, currentUser, ORG_COOKIE, sessionToken, setSessionCookie } from "@/lib/auth/session";
import { acceptInvitation } from "@/lib/app/team";
import { rateLimit } from "@/lib/server/ops";
import { ZodError } from "zod";

export type FormState = { error?: string; ok?: string };

const safeNext = (n: FormDataEntryValue | null) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const meta = await clientMeta();
  try {
    const { userId } = await signUp({
      name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""),
      company: String(form.get("company") ?? ""), sector: String(form.get("sector") ?? "autre"),
      referralCode: String(form.get("referralCode") ?? "") || undefined, acceptTerms: form.get("acceptTerms") === "on" ? true : (false as never)
    }, meta);
    await setSessionCookie(await createSession(userId, meta));
  } catch (e) {
    if (e instanceof ZodError) return { error: e.issues[0]?.message ?? "Formulaire invalide." };
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  redirect("/verify-email?pending=1");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const token = await logIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""), await clientMeta());
    await setSessionCookie(token);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  const t = await sessionToken();
  if (t) await revokeSession(t);
  await clearSessionCookie();
  redirect("/");
}

export async function resendVerificationAction(): Promise<FormState> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.emailVerified) redirect("/app");
  if (!(await rateLimit(`resend:${u.id}`, 3, 3600)).ok) return { error: "Trop de demandes, réessayez dans une heure." };
  await sendVerification(u.id, u.email);
  return { ok: "Un nouvel e-mail de confirmation vient d'être envoyé." };
}

export async function verifyEmailAction(token: string) {
  return verifyEmail(token);
}

export async function forgotAction(_: FormState, form: FormData): Promise<FormState> {
  await requestPasswordReset(String(form.get("email") ?? ""), await clientMeta());
  return { ok: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé." };
}

export async function resetAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ok = await resetPassword(String(form.get("token") ?? ""), String(form.get("password") ?? ""));
    if (!ok) return { error: "Lien invalide ou expiré. Refaites une demande." };
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  redirect("/login?reset=1");
}

export async function acceptInviteAction(form: FormData) {
  const u = await currentUser();
  const token = String(form.get("token") ?? "");
  if (!u) redirect(`/login?next=${encodeURIComponent(`/invite?token=${token}`)}`);
  const orgId = await acceptInvitation(u.id, u.email, token);
  (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/app");
}
