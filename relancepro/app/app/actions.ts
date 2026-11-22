"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireContext, ORG_COOKIE } from "@/lib/auth/session";
import { AppError, requireRole } from "@/lib/app/context";
import { addNote, addQuote, createProspect, eraseProspect, importCsv, recordInbound, setStatus, updateProspect, STATUSES, type Status } from "@/lib/app/prospects";
import { approveMessage, cancelMessage, createDraft, sendNow, updateDraft } from "@/lib/app/messages";
import { enroll, saveSequence, setAutomationPaused, stopEnrollment } from "@/lib/app/sequences";
import { connectSmtp, sendTestEmail, oauthConfigured } from "@/lib/mail/mailbox";
import { createEndpoint, deleteEndpoint } from "@/lib/app/webhooks";
import { invite, removeMember } from "@/lib/app/team";
import { createCheckout, createPortal } from "@/lib/billing/stripe";
import { system, withTenant, jsonb } from "@/lib/db";
import { rateLimit } from "@/lib/server/ops";
import type { PlanId } from "@/lib/billing/plans";

const q = (path: string, key: "ok" | "error", msg: string) => {
  const [base, hash] = path.split("#");
  return `${base}${base.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg.slice(0, 300))}${hash ? `#${hash}` : ""}`;
};

/** Runs an action; known errors come back to the page as a message, everything else is a real failure. */
async function act(path: string, fn: () => Promise<string | void>, okPath?: () => string): Promise<never> {
  let msg: string | void;
  try { msg = await fn(); }
  catch (e) {
    if (e instanceof AppError) redirect(q(path, "error", e.message));
    if (e instanceof ZodError) redirect(q(path, "error", e.issues[0]?.message ?? "Formulaire invalide."));
    throw e;
  }
  revalidatePath("/app", "layout");
  redirect(q(okPath ? okPath() : path, "ok", msg || "Enregistré."));
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const prospectInput = (f: FormData) => ({
  firstName: s(f, "firstName"), lastName: s(f, "lastName"), company: s(f, "company"), email: s(f, "email"), phone: s(f, "phone"),
  need: s(f, "need"), estimatedValue: s(f, "estimatedValue") || null, lawfulBasis: (s(f, "lawfulBasis") || null) as never, basisNote: s(f, "basisNote")
});

/* ------------------------------------------------------------ prospects */
export async function createProspectAction(f: FormData) {
  const { ctx } = await requireContext();
  let id = "";
  await act("/app/prospects/new", async () => { id = await createProspect(ctx, prospectInput(f)); return "Prospect ajouté. RelancePro AI a analysé sa demande."; }, () => `/app/prospects/${id}`);
}

export async function updateProspectAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${id}`, async () => { await updateProspect(ctx, id, prospectInput(f)); return "Fiche mise à jour."; });
}

export async function setStatusAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  const status = s(f, "status") as Status;
  await act(`/app/prospects/${id}`, async () => {
    if (!STATUSES.includes(status)) throw new AppError("Statut inconnu.");
    const won = s(f, "wonValue");
    await setStatus(ctx, id, status, { wonValueCents: won ? Math.round(Number(won.replace(",", ".")) * 100) || null : null, note: s(f, "note") });
    return "Statut mis à jour.";
  });
}

export async function addNoteAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${id}`, async () => { await addNote(ctx, id, s(f, "note")); return "Note ajoutée."; });
}

export async function addQuoteAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${id}`, async () => { await addQuote(ctx, id, { reference: s(f, "reference"), amount: s(f, "amount") || null, sentAt: s(f, "sentAt") || null, validUntil: s(f, "validUntil") || null }); return "Devis associé."; });
}

export async function recordInboundAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${id}`, async () => {
    const a = await recordInbound(ctx, id, s(f, "text"), (s(f, "channel") || "email") as never);
    const label: Record<string, string> = { unsubscribe: "demande de désinscription — opposition enregistrée", refusal: "refus — dossier passé en « perdu »", positive: "réponse positive — à traiter personnellement", question: "question — à traiter", request: "demande", out_of_office: "absence — aucune action", unknown: "intention incertaine — à lire" };
    return `Réponse enregistrée. RelancePro AI : ${label[a.intent] ?? a.intent}.`;
  });
}

export async function draftAction(id: string) {
  const { ctx } = await requireContext();
  await act(`/app/messages`, async () => { await createDraft(ctx, id); return "Relance préparée : relisez-la avant l'envoi."; });
}

export async function enrollAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${id}`, async () => { await enroll(ctx, id, s(f, "sequenceId")); return "Prospect inscrit dans la séquence."; });
}

export async function stopEnrollmentAction(prospectId: string, enrollmentId: string) {
  const { ctx } = await requireContext();
  await act(`/app/prospects/${prospectId}`, async () => { await stopEnrollment(ctx, enrollmentId); return "Séquence arrêtée."; });
}

export async function eraseProspectAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects`, async () => { await eraseProspect(ctx, id, f.get("keepOpposition") === "on"); return "Prospect et historique supprimés."; });
}

export async function importCsvAction(f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/prospects`, async () => {
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) throw new AppError("Choisissez un fichier CSV.");
    if (file.size > 5_000_000) throw new AppError("Fichier trop volumineux (5 Mo maximum).");
    const r = await importCsv(ctx, await file.text(), s(f, "lawfulBasis") || null, s(f, "evidence"));
    return `${r.created} prospect(s) importé(s), ${r.skipped} déjà présent(s), ${r.opposed} en opposition${r.errors.length ? `, ${r.errors.length} ligne(s) ignorée(s) : ${r.errors.slice(0, 3).map(e => `ligne ${e.line} — ${e.message}`).join(" ; ")}` : ""}.`;
  });
}

/* ------------------------------------------------------------- messages */
export async function saveDraftAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/messages`, async () => { await updateDraft(ctx, id, s(f, "subject"), String(f.get("body") ?? "")); return "Brouillon enregistré."; });
}

export async function approveAndSendAction(id: string, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/messages`, async () => {
    if (f.get("subject")) await updateDraft(ctx, id, s(f, "subject"), String(f.get("body") ?? ""));
    await approveMessage(ctx, id);
    const r = await sendNow(ctx, id);
    if (r.status === "blocked") throw new AppError(`Envoi bloqué : ${r.reasons.join(" ")}`);
    return r.status === "sent" ? "Relance envoyée." : "Relance traitée.";
  });
}

export async function cancelMessageAction(id: string) {
  const { ctx } = await requireContext();
  await act(`/app/messages`, async () => { await cancelMessage(ctx, id); return "Message abandonné."; });
}

/* ------------------------------------------------------------ sequences */
export async function saveSequenceAction(id: string | null, f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/sequences`, async () => {
    const steps = [];
    for (let i = 0; i < 8; i++) {
      const action = s(f, `action_${i}`);
      if (!action) continue;
      steps.push({ delayDays: Number(s(f, `delay_${i}`) || 0), action: action as "alert" | "email" | "close", subject: s(f, `subject_${i}`), body: String(f.get(`body_${i}`) ?? ""), useAi: f.get(`ai_${i}`) === "on" });
    }
    await saveSequence(ctx, id, { name: s(f, "name"), mode: s(f, "mode") as "assisted" | "automatic", active: f.get("active") === "on", steps });
    return "Séquence enregistrée.";
  });
}

export async function toggleAutomationAction(f: FormData) {
  const { ctx } = await requireContext();
  const paused = f.get("paused") === "true";
  await act(`/app/sequences`, async () => { await setAutomationPaused(ctx, paused); return paused ? "Toutes les automatisations sont arrêtées." : "Automatisations réactivées."; });
}

/* ------------------------------------------------------------- settings */
export async function saveSettingsAction(f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/settings`, async () => {
    requireRole(ctx, "admin");
    const booking = s(f, "bookingUrl");
    if (booking && !/^https:\/\/\S+$/.test(booking)) throw new AppError("Le lien de rendez-vous doit commencer par https://");
    const settings = {
      ...ctx.org.settings, senderName: s(f, "senderName").slice(0, 120), signature: String(f.get("signature") ?? "").slice(0, 1000), bookingUrl: booking,
      followUpAfterDays: Math.max(1, Math.min(60, Number(s(f, "followUpAfterDays")) || 3)),
      maxTouchesPer30Days: Math.max(1, Math.min(10, Number(s(f, "maxTouchesPer30Days")) || 3)),
      quietHours: { start: Math.max(0, Math.min(23, Number(s(f, "quietStart")) || 19)), end: Math.max(0, Math.min(23, Number(s(f, "quietEnd")) || 8)) },
      allowWeekends: f.get("allowWeekends") === "on"
    };
    const siret = s(f, "siret").replace(/\s/g, "");
    if (siret && !/^\d{14}$/.test(siret)) throw new AppError("Le SIRET doit comporter 14 chiffres.");
    await withTenant(ctx.userId, tx => tx`update rp.organizations set name = ${s(f, "name") || ctx.org.name}, siret = ${siret || null}, settings = ${jsonb(settings)}::jsonb where id = ${ctx.orgId}`);
    return "Paramètres enregistrés.";
  });
}

export async function connectSmtpAction(f: FormData) {
  const { ctx } = await requireContext();
  await act(`/app/settings#boite`, async () => {
    requireRole(ctx, "admin");
    if (!(await rateLimit(`smtp-connect:${ctx.orgId}`, 10, 3600)).ok) throw new AppError("Trop de tentatives de connexion, réessayez plus tard.");
    const r = await connectSmtp(ctx.orgId, { fromName: s(f, "fromName"), fromEmail: s(f, "fromEmail"), host: s(f, "host"), port: s(f, "port") as never, secure: (f.get("secure") === "on") as never, user: s(f, "user"), password: String(f.get("password") ?? ""), dailyLimit: (s(f, "dailyLimit") || 80) as never });
    if (!r.ok) throw new AppError(`Connexion refusée par le serveur : ${r.error}`);
    return "Boîte d'envoi connectée et vérifiée.";
  });
}

export async function testMailboxAction(f: FormData) {
  const { user, ctx } = await requireContext();
  await act(`/app/settings#boite`, async () => {
    if (!(await rateLimit(`smtp-test:${ctx.orgId}`, 5, 3600)).ok) throw new AppError("Trop de tests, réessayez plus tard.");
    const to = s(f, "to") || user.email;
    try { await sendTestEmail(ctx.orgId, to); } catch (e) { throw new AppError(`Échec de l'envoi : ${(e as Error).message}`); }
    return `E-mail de test envoyé à ${to}.`;
  });
}

export async function disconnectMailboxAction() {
  const { ctx } = await requireContext();
  await act(`/app/settings#boite`, async () => { requireRole(ctx, "admin"); await withTenant(ctx.userId, tx => tx`delete from rp.mailboxes where org_id = ${ctx.orgId}`); return "Boîte d'envoi déconnectée."; });
}

export async function oauthStartCheck(provider: "gmail" | "outlook") {
  return oauthConfigured(provider);
}

export async function createWebhookAction(f: FormData) {
  const { ctx } = await requireContext();
  let secret = "";
  await act(`/app/settings#webhooks`, async () => {
    const r = await createEndpoint(ctx, s(f, "url"), f.getAll("events").map(String));
    secret = r.secret;
    return `Webhook créé. Secret de signature (affiché une seule fois) : ${secret}`;
  });
}

export async function deleteWebhookAction(id: string) {
  const { ctx } = await requireContext();
  await act(`/app/settings#webhooks`, async () => { await deleteEndpoint(ctx, id); return "Webhook supprimé."; });
}

export async function inviteAction(f: FormData) {
  const { user, ctx } = await requireContext();
  await act(`/app/settings#equipe`, async () => { await invite(ctx, s(f, "email"), (s(f, "role") === "admin" ? "admin" : "member"), user.name); return "Invitation envoyée."; });
}

export async function removeMemberAction(userId: string) {
  const { ctx } = await requireContext();
  await act(`/app/settings#equipe`, async () => { await removeMember(ctx, userId); return "Membre retiré."; });
}

export async function switchOrgAction(f: FormData) {
  await requireContext();
  (await cookies()).set(ORG_COOKIE, s(f, "orgId"), { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/app");
}

export async function supportRequestAction(f: FormData) {
  const { user, ctx } = await requireContext();
  await act(`/app/settings#support`, async () => {
    const message = s(f, "message");
    if (message.length < 5) throw new AppError("Décrivez votre demande.");
    if (!(await rateLimit(`support:${ctx.orgId}`, 10, 3600)).ok) throw new AppError("Trop de demandes, réessayez plus tard.");
    await system()`insert into rp.contact_requests (kind, name, email, company, message, org_id) values ('support', ${user.name || user.email}, ${user.email}, ${ctx.org.name}, ${message.slice(0, 5000)}, ${ctx.orgId})`;
    return "Demande envoyée au support. Réponse par e-mail.";
  });
}

/* -------------------------------------------------------------- billing */
export async function checkoutAction(f: FormData) {
  const { user, ctx } = await requireContext();
  let url = "";
  try { url = await createCheckout(ctx, s(f, "plan") as PlanId, user.email); }
  catch (e) { if (e instanceof AppError) redirect(q("/app/billing", "error", e.message)); throw e; }
  redirect(url);
}

export async function portalAction() {
  const { ctx } = await requireContext();
  let url = "";
  try { url = await createPortal(ctx); }
  catch (e) { if (e instanceof AppError) redirect(q("/app/billing", "error", e.message)); throw e; }
  redirect(url);
}
