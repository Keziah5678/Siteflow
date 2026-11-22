"use server";
import { z } from "zod";
import { system } from "@/lib/db";
import { queuePlatformEmail } from "@/lib/mail/platform";
import { clientMeta } from "@/lib/auth/session";
import { rateLimit } from "@/lib/server/ops";
import { env } from "@/lib/server/env";

const schema = z.object({
  kind: z.enum(["contact", "demo", "support"]),
  name: z.string().trim().min(1, "Votre nom est requis.").max(120),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  company: z.string().trim().max(160).default(""),
  message: z.string().trim().min(5, "Votre message est trop court.").max(5000),
  website: z.string().max(0).optional() // honeypot
});

export type ContactState = { ok?: boolean; error?: string };

export async function submitContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  if (parsed.data.website) return { ok: true };
  const { ip } = await clientMeta();
  if (!(await rateLimit(`contact:${ip}`, 5, 3600)).ok) return { error: "Trop de messages envoyés. Réessayez plus tard." };
  const d = parsed.data;
  await system()`insert into rp.contact_requests (kind, name, email, company, message) values (${d.kind}, ${d.name}, ${d.email}, ${d.company}, ${d.message})`;
  if (env.supportEmail) {
    await queuePlatformEmail(system(), { to: env.supportEmail, kind: "support_notification", subject: `[${d.kind}] ${d.name}${d.company ? ` — ${d.company}` : ""}`, text: `${d.name} <${d.email}>\n${d.company}\n\n${d.message}` });
  }
  return { ok: true };
}
