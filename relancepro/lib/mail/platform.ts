import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { Db } from "../db";
import { system } from "../db";
import { enqueue } from "../jobs/queue";
import { env } from "../server/env";

/**
 * Transactional e-mails sent BY RelancePro (verification, password reset,
 * invitations, onboarding). Written to an outbox, then delivered by the job
 * queue through PLATFORM_SMTP_URL (any provider: Brevo, Resend, Postmark,
 * OVH…). Without SMTP configured they are kept as "logged" and, in
 * development only, readable at /dev/outbox.
 */

export type PlatformEmail = { to: string; kind: string; subject: string; text: string; html?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f5fb;font-family:Inter,Arial,sans-serif;color:#1f2330">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:32px;max-width:100%">
<tr><td style="font-weight:700;font-size:18px;color:#3b2fd9">RelancePro</td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:700">${esc(title)}</td></tr>
${paragraphs.map(p => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#3d4252">${esc(p)}</td></tr>`).join("")}
${cta ? `<tr><td style="padding-top:24px"><a href="${esc(cta.url)}" style="background:linear-gradient(135deg,#2f6bff,#6d28d9);color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></td></tr>
<tr><td style="padding-top:14px;font-size:12px;color:#7b8194">Si le bouton ne fonctionne pas : ${esc(cta.url)}</td></tr>` : ""}
<tr><td style="padding-top:28px;font-size:12px;color:#9aa0b3">Vous recevez cet e-mail car un compte RelancePro est associé à cette adresse.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function queuePlatformEmail(db: Db, email: PlatformEmail): Promise<number> {
  const html = email.html ?? layout(email.subject, email.text.split("\n\n"));
  const [row] = await db`
    insert into rp.outbox_emails (to_email, subject, text_body, html_body, kind)
    values (${email.to}, ${email.subject}, ${email.text}, ${html}, ${email.kind}) returning id`;
  await enqueue(db, "platform_email", { outboxId: Number(row.id) }, { key: `outbox:${row.id}` });
  return Number(row.id);
}

let transport: Transporter | null = null;

export async function deliverPlatformEmail(outboxId: number): Promise<void> {
  const sql = system();
  const [mail] = await sql`select * from rp.outbox_emails where id = ${outboxId}`;
  if (!mail || mail.status === "sent") return;
  if (!env.platformSmtpUrl) {
    await sql`update rp.outbox_emails set status = 'logged' where id = ${outboxId}`;
    return;
  }
  transport ??= nodemailer.createTransport(env.platformSmtpUrl);
  try {
    await transport.sendMail({ from: env.platformFrom, to: mail.toEmail as string, subject: mail.subject as string, text: mail.textBody as string, html: mail.htmlBody as string });
    await sql`update rp.outbox_emails set status = 'sent', sent_at = now(), error = null where id = ${outboxId}`;
  } catch (e) {
    await sql`update rp.outbox_emails set status = 'failed', error = ${String((e as Error).message).slice(0, 500)} where id = ${outboxId}`;
    throw e;
  }
}
