import "server-only";
import nodemailer from "nodemailer";
import { z } from "zod";
import { system } from "../db";
import { decrypt, encrypt } from "../server/crypto";
import { env } from "../server/env";

/**
 * The company's own sending mailbox. RelancePro sends follow-ups FROM the
 * customer's address, so replies land in their inbox.
 *
 * - SMTP (works today with any provider: OVH, IONOS, Gandi, Google Workspace
 *   or Gmail with an app password, Microsoft 365 with SMTP AUTH…).
 * - Gmail API / Microsoft Graph via OAuth: code paths ready; they need the
 *   OAuth applications described in INTEGRATIONS.md.
 */

export const smtpSchema = z.object({
  fromName: z.string().trim().max(120).default(""),
  fromEmail: z.string().trim().toLowerCase().email("Adresse d'expédition invalide."),
  host: z.string().trim().min(3, "Serveur SMTP requis.").max(200).regex(/^[a-z0-9.-]+$/i, "Nom de serveur invalide."),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.coerce.boolean(),
  user: z.string().trim().min(1, "Identifiant requis.").max(200),
  password: z.string().min(1, "Mot de passe requis.").max(500),
  dailyLimit: z.coerce.number().int().min(1).max(2000).default(80)
});

export type OutgoingMail = { to: string; subject: string; text: string; html: string; headers?: Record<string, string>; replyTo?: string; unsubscribeUrl?: string };

type MailboxRow = { id: string; orgId: string; provider: string; fromName: string; fromEmail: string; smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean; smtpUser: string | null; secretEnc: string | null };

function smtpTransport(m: { smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean; smtpUser: string | null }, password: string) {
  return nodemailer.createTransport({
    host: m.smtpHost!, port: m.smtpPort!, secure: m.smtpSecure, auth: { user: m.smtpUser!, pass: password },
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: process.env.RP_SMTP_ALLOW_SELF_SIGNED !== "true" }
  });
}

/** Saves the SMTP settings after a real login check against the server. */
export async function connectSmtp(orgId: string, raw: z.input<typeof smtpSchema>): Promise<{ ok: boolean; error?: string }> {
  const s = smtpSchema.parse(raw);
  const transport = smtpTransport({ smtpHost: s.host, smtpPort: s.port, smtpSecure: s.secure, smtpUser: s.user }, s.password);
  let error: string | undefined;
  try { await transport.verify(); } catch (e) { error = (e as Error).message.slice(0, 300); }
  await system()`
    insert into rp.mailboxes (org_id, provider, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, secret_enc, status, last_error, last_tested_at, daily_limit)
    values (${orgId}, 'smtp', ${s.fromName}, ${s.fromEmail}, ${s.host}, ${s.port}, ${s.secure}, ${s.user}, ${encrypt(s.password)}, ${error ? "error" : "connected"}, ${error ?? null}, now(), ${s.dailyLimit})
    on conflict (org_id) do update set provider = 'smtp', from_name = excluded.from_name, from_email = excluded.from_email, smtp_host = excluded.smtp_host,
      smtp_port = excluded.smtp_port, smtp_secure = excluded.smtp_secure, smtp_user = excluded.smtp_user, secret_enc = excluded.secret_enc,
      status = excluded.status, last_error = excluded.last_error, last_tested_at = now(), daily_limit = excluded.daily_limit`;
  return error ? { ok: false, error } : { ok: true };
}

async function loadMailbox(orgId: string): Promise<MailboxRow | null> {
  const [m] = await system()`select id, org_id, provider, from_name, from_email, smtp_host, smtp_port, smtp_secure, smtp_user, secret_enc from rp.mailboxes where org_id = ${orgId} and status <> 'disconnected'`;
  return (m as unknown as MailboxRow) ?? null;
}

const fromHeader = (m: MailboxRow) => (m.fromName ? `"${m.fromName.replace(/"/g, "")}" <${m.fromEmail}>` : m.fromEmail);

export async function sendFromMailbox(orgId: string, mail: OutgoingMail): Promise<{ messageId: string }> {
  const m = await loadMailbox(orgId);
  if (!m || !m.secretEnc) throw new Error("Aucune boîte d'envoi connectée.");
  const secret = decrypt(m.secretEnc);
  if (m.provider === "smtp") {
    const info = await smtpTransport(m, secret).sendMail({ from: fromHeader(m), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers, replyTo: mail.replyTo, list: mail.unsubscribeUrl ? { unsubscribe: mail.unsubscribeUrl } : undefined });
    return { messageId: String(info.messageId ?? "") };
  }
  const token = await accessToken(m.provider as "gmail" | "outlook", secret);
  const raw = await buildRaw(m, mail);
  if (m.provider === "gmail") {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: raw.toString("base64url") }) });
    if (!r.ok) throw new Error(`Gmail ${r.status}`);
    return { messageId: String((await r.json()).id ?? "") };
  }
  const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "text/plain" }, body: raw.toString("base64") });
  if (!r.ok) throw new Error(`Microsoft Graph ${r.status}`);
  return { messageId: "" };
}

export async function sendTestEmail(orgId: string, to: string) {
  return sendFromMailbox(orgId, {
    to, subject: "Test RelancePro — votre boîte d'envoi fonctionne",
    text: "Ce message confirme que RelancePro peut envoyer des e-mails depuis votre boîte.\n\nAucune action n'est requise.",
    html: "<p>Ce message confirme que RelancePro peut envoyer des e-mails depuis votre boîte.</p><p>Aucune action n'est requise.</p>"
  });
}

async function buildRaw(m: MailboxRow, mail: OutgoingMail): Promise<Buffer> {
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
  const info = await composer.sendMail({ from: fromHeader(m), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html, headers: mail.headers, list: mail.unsubscribeUrl ? { unsubscribe: mail.unsubscribeUrl } : undefined });
  return info.message as Buffer;
}

/* ------------------------------------------------------------ OAuth */

export const OAUTH = {
  gmail: { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/gmail.send openid email" },
  outlook: { auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scope: "offline_access Mail.Send User.Read" }
} as const;

export function oauthConfigured(p: "gmail" | "outlook") {
  return p === "gmail" ? Boolean(env.googleClientId && env.googleClientSecret) : Boolean(env.microsoftClientId && env.microsoftClientSecret);
}

export function oauthUrl(p: "gmail" | "outlook", state: string): string {
  const cfg = OAUTH[p];
  const q = new URLSearchParams({
    client_id: p === "gmail" ? env.googleClientId : env.microsoftClientId, redirect_uri: `${env.appUrl}/api/oauth/${p}/callback`,
    response_type: "code", scope: cfg.scope, state, ...(p === "gmail" ? { access_type: "offline", prompt: "consent" } : {})
  });
  return `${cfg.auth}?${q}`;
}

export async function oauthExchange(p: "gmail" | "outlook", code: string): Promise<{ refreshToken: string; email: string }> {
  const r = await fetch(OAUTH[p].token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, grant_type: "authorization_code", redirect_uri: `${env.appUrl}/api/oauth/${p}/callback`, client_id: p === "gmail" ? env.googleClientId : env.microsoftClientId, client_secret: p === "gmail" ? env.googleClientSecret : env.microsoftClientSecret })
  });
  if (!r.ok) throw new Error(`Échange OAuth refusé (${r.status})`);
  const j = await r.json();
  if (!j.refresh_token) throw new Error("Aucun jeton de rafraîchissement : réessayez en acceptant l'accès hors connexion.");
  let email = "";
  if (j.id_token) { try { email = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString()).email ?? ""; } catch { /* ignore */ } }
  if (!email && p === "outlook") {
    const me = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${j.access_token}` } });
    if (me.ok) { const d = await me.json(); email = d.mail ?? d.userPrincipalName ?? ""; }
  }
  return { refreshToken: j.refresh_token, email: String(email).toLowerCase() };
}

async function accessToken(p: "gmail" | "outlook", refreshToken: string): Promise<string> {
  const r = await fetch(OAUTH[p].token, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: p === "gmail" ? env.googleClientId : env.microsoftClientId, client_secret: p === "gmail" ? env.googleClientSecret : env.microsoftClientSecret })
  });
  if (!r.ok) throw new Error(`Jeton ${p} expiré ou révoqué (${r.status}) : reconnectez la boîte.`);
  return String((await r.json()).access_token);
}

export async function saveOAuthMailbox(orgId: string, p: "gmail" | "outlook", refreshToken: string, email: string, fromName: string) {
  await system()`
    insert into rp.mailboxes (org_id, provider, from_name, from_email, secret_enc, status, last_tested_at)
    values (${orgId}, ${p}, ${fromName}, ${email}, ${encrypt(refreshToken)}, 'connected', now())
    on conflict (org_id) do update set provider = excluded.provider, from_name = excluded.from_name, from_email = excluded.from_email,
      secret_enc = excluded.secret_enc, status = 'connected', last_error = null, last_tested_at = now(), smtp_host = null, smtp_port = null, smtp_user = null`;
}
