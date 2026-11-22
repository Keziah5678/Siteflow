import "server-only";
import { z } from "zod";
import { jsonb, system } from "../db";
import { enqueue } from "../jobs/queue";
import { layout, queuePlatformEmail } from "../mail/platform";
import { hashPassword, randomToken, sha256, verifyPassword } from "../server/crypto";
import { env } from "../server/env";
import { audit, rateLimit } from "../server/ops";
import { createDefaultSequence } from "../app/sequences";

/**
 * Accounts and sessions. Framework-free (no next/headers) so it can be
 * exercised by integration tests directly against PostgreSQL.
 */

export class AuthError extends Error {
  constructor(message: string, readonly code = "auth") { super(message); }
}

export const SESSION_DAYS = 30;

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Votre nom est requis.").max(120),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(200),
  password: z.string().min(10, "10 caractères minimum.").max(200),
  company: z.string().trim().min(1, "Le nom de l'entreprise est requis.").max(120),
  sector: z.string().trim().max(60).default("autre"),
  referralCode: z.string().trim().toUpperCase().max(20).optional(),
  acceptTerms: z.literal(true, { message: "Vous devez accepter les conditions." })
});

export type SessionUser = { id: string; email: string; name: string; emailVerified: boolean; isPlatformAdmin: boolean };

async function createEmailToken(userId: string, purpose: "verify" | "reset", hours: number): Promise<string> {
  const token = randomToken();
  await system()`insert into rp.email_tokens (id, user_id, purpose, expires_at) values (${sha256(token)}, ${userId}, ${purpose}, now() + (${hours} * interval '1 hour'))`;
  return token;
}

export async function sendVerification(userId: string, email: string) {
  const token = await createEmailToken(userId, "verify", 48);
  const url = `${env.appUrl}/verify-email?token=${token}`;
  await queuePlatformEmail(system(), {
    to: email, kind: "verify", subject: "Confirmez votre adresse e-mail",
    text: `Bienvenue sur RelancePro.\n\nConfirmez votre adresse pour activer votre espace : ${url}\n\nCe lien expire dans 48 heures.`,
    html: layout("Confirmez votre adresse e-mail", ["Bienvenue sur RelancePro.", "Confirmez votre adresse pour activer votre espace. Ce lien expire dans 48 heures."], { label: "Confirmer mon adresse", url })
  });
}

/** Creates the user, their organization (7-day trial), the owner membership, and queues verification + onboarding. */
export async function signUp(input: z.input<typeof signupSchema>, meta: { ip?: string } = {}) {
  const data = signupSchema.parse(input);
  const rl = await rateLimit(`signup:${meta.ip ?? "unknown"}`, 10, 3600);
  if (!rl.ok) throw new AuthError("Trop d'inscriptions depuis cette adresse. Réessayez plus tard.", "rate_limited");
  const passwordHash = await hashPassword(data.password);
  const sql = system();
  const result = await sql.begin(async tx => {
    const exists = await tx`select 1 from rp.users where email = ${data.email}`;
    if (exists.length) throw new AuthError("Un compte existe déjà avec cette adresse.", "exists");
    const [user] = await tx`insert into rp.users (email, password_hash, name) values (${data.email}, ${passwordHash}, ${data.name}) returning id`;
    const referrer = data.referralCode ? (await tx`select id from rp.organizations where referral_code = ${data.referralCode}`)[0] : undefined;
    const [org] = await tx`insert into rp.organizations (name, sector, referred_by, settings) values (${data.company}, ${data.sector}, ${referrer?.id ?? null},
      ${jsonb({ senderName: data.name, followUpAfterDays: 3, quietHours: { start: 19, end: 8 }, maxTouchesPer30Days: 3 })}::jsonb) returning id`;
    await tx`insert into rp.memberships (org_id, user_id, role) values (${org.id}, ${user.id}, 'owner')`;
    await tx`insert into rp.subscriptions (org_id, status) values (${org.id}, 'trialing')`;
    await createDefaultSequence(tx, org.id as string);
    if (referrer) await tx`insert into rp.referrals (referrer_org, referred_org) values (${referrer.id}, ${org.id})`;
    await audit(tx, { orgId: org.id as string, userId: user.id as string, action: "signup" });
    // Onboarding: activation help after 1 day, trial reminder 2 days before the end.
    await enqueue(tx, "onboarding_email", { userId: user.id, step: "activation" }, { orgId: org.id as string, runAt: new Date(Date.now() + 24 * 3600_000), key: `onboarding:activation:${user.id}` });
    await enqueue(tx, "onboarding_email", { userId: user.id, step: "trial_ending" }, { orgId: org.id as string, runAt: new Date(Date.now() + 5 * 24 * 3600_000), key: `onboarding:trial:${user.id}` });
    return { userId: user.id as string, orgId: org.id as string };
  });
  await sendVerification(result.userId, data.email);
  return result;
}

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string } = {}): Promise<string> {
  const token = randomToken();
  await system()`insert into rp.sessions (id, user_id, expires_at, ip, user_agent)
    values (${sha256(token)}, ${userId}, now() + (${SESSION_DAYS} * interval '1 day'), ${meta.ip ?? null}, ${(meta.userAgent ?? "").slice(0, 300)})`;
  await system()`update rp.users set last_login_at = now() where id = ${userId}`;
  return token;
}

export async function logIn(emailRaw: string, password: string, meta: { ip?: string; userAgent?: string } = {}): Promise<string> {
  const email = emailRaw.trim().toLowerCase();
  const byIp = await rateLimit(`login-ip:${meta.ip ?? "unknown"}`, 30, 900);
  const byEmail = await rateLimit(`login:${email}`, 8, 900);
  if (!byIp.ok || !byEmail.ok) throw new AuthError("Trop de tentatives. Réessayez dans quelques minutes.", "rate_limited");
  const [user] = await system()`select id, password_hash from rp.users where email = ${email}`;
  // Same work whether or not the account exists, to avoid revealing it through timing.
  const ok = await verifyPassword(password, (user?.passwordHash as string) ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + "A".repeat(86) + "==");
  if (!user || !ok) throw new AuthError("Identifiants incorrects.");
  return createSession(user.id as string, meta);
}

export async function sessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await system()`
    select u.id, u.email, u.name, u.email_verified_at, u.is_platform_admin
    from rp.sessions s join rp.users u on u.id = s.user_id
    where s.id = ${sha256(token)} and s.revoked_at is null and s.expires_at > now()`;
  if (!row) return null;
  return { id: row.id as string, email: row.email as string, name: row.name as string, emailVerified: Boolean(row.emailVerifiedAt), isPlatformAdmin: Boolean(row.isPlatformAdmin) || env.adminEmails.includes(row.email as string) };
}

export async function revokeSession(token: string) {
  await system()`update rp.sessions set revoked_at = now() where id = ${sha256(token)}`;
}

export async function verifyEmail(token: string): Promise<boolean> {
  const sql = system();
  return sql.begin(async tx => {
    const [t] = await tx`update rp.email_tokens set used_at = now() where id = ${sha256(token)} and purpose = 'verify' and used_at is null and expires_at > now() returning user_id`;
    if (!t) return false;
    await tx`update rp.users set email_verified_at = coalesce(email_verified_at, now()) where id = ${t.userId}`;
    return true;
  });
}

export async function requestPasswordReset(emailRaw: string, meta: { ip?: string } = {}) {
  const email = emailRaw.trim().toLowerCase();
  const rl = await rateLimit(`reset:${email}:${meta.ip ?? ""}`, 3, 3600);
  if (!rl.ok) return; // silent: never reveal anything
  const [user] = await system()`select id from rp.users where email = ${email}`;
  if (!user) return;
  const token = await createEmailToken(user.id as string, "reset", 1);
  const url = `${env.appUrl}/reset-password?token=${token}`;
  await queuePlatformEmail(system(), {
    to: email, kind: "reset", subject: "Réinitialisation de votre mot de passe",
    text: `Une réinitialisation de mot de passe a été demandée.\n\nNouveau mot de passe : ${url}\n\nCe lien expire dans une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: layout("Réinitialisation du mot de passe", ["Une réinitialisation a été demandée pour votre compte.", "Ce lien expire dans une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."], { label: "Choisir un nouveau mot de passe", url })
  });
}

export async function resetPassword(token: string, password: string): Promise<boolean> {
  if (password.length < 10) throw new AuthError("10 caractères minimum.", "validation");
  const hash = await hashPassword(password);
  return system().begin(async tx => {
    const [t] = await tx`update rp.email_tokens set used_at = now() where id = ${sha256(token)} and purpose = 'reset' and used_at is null and expires_at > now() returning user_id`;
    if (!t) return false;
    await tx`update rp.users set password_hash = ${hash}, email_verified_at = coalesce(email_verified_at, now()) where id = ${t.userId}`;
    await tx`update rp.sessions set revoked_at = now() where user_id = ${t.userId} and revoked_at is null`; // log out everywhere
    return true;
  });
}

export async function memberships(userId: string) {
  return system()`
    select o.id, o.name, m.role from rp.memberships m join rp.organizations o on o.id = m.org_id
    where m.user_id = ${userId} order by m.created_at`;
}
