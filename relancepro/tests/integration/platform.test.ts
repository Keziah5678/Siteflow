import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { closeDb, system, withTenant } from "@/lib/db";
import { logIn, requestPasswordReset, resetPassword, sessionUser, verifyEmail, AuthError, createSession } from "@/lib/auth/service";
import { loadContext } from "@/lib/app/context";
import { addQuote, createProspect, eraseProspect, getProspect, importCsv, listProspects, recordInbound, setStatus } from "@/lib/app/prospects";
import { approveMessage, createDraft, sendNow, unsubscribeUrl } from "@/lib/app/messages";
import { enroll, saveSequence, setAutomationPaused } from "@/lib/app/sequences";
import { receiveForm, unsubscribe } from "@/lib/app/inbound";
import { connectSmtp } from "@/lib/mail/mailbox";
import { enqueue, runDueJobs } from "@/lib/jobs/queue";
import { HANDLERS } from "@/lib/jobs/handlers";
import { handleStripeEvent, verifyWebhook } from "@/lib/billing/stripe";
import { createEndpoint, emitWebhook } from "@/lib/app/webhooks";
import { dashboard } from "@/lib/app/dashboard";
import { adminMetrics } from "@/lib/admin/metrics";
import { newCompany, startSmtp } from "./helpers";

let smtp: Awaited<ReturnType<typeof startSmtp>>;
beforeAll(async () => { smtp = await startSmtp(); });
afterAll(async () => { await smtp.close(); await closeDb(); });

async function drainJobs() {
  await system()`update rp.jobs set run_at = now() where status = 'queued'`;
  for (let i = 0; i < 10; i++) { const r = await runDueJobs(HANDLERS, 100); if (!r.processed && !r.failed) break; }
}

describe("Isolation entre entreprises (RLS)", () => {
  it("une entreprise ne voit, ne modifie et n'insère jamais rien chez une autre", async () => {
    const a = await newCompany("alpha"), b = await newCompany("beta");
    const pb = await createProspect(b.ctx, { firstName: "Secret", email: "client@beta-client.fr", need: "Devis toiture", lawfulBasis: "pre_contract" });
    await withTenant(a.userId, async tx => {
      expect((await tx`select * from rp.prospects where id = ${pb}`).length).toBe(0);
      expect((await tx`select * from rp.prospects where org_id = ${b.orgId}`).length).toBe(0);
      expect((await tx`select * from rp.organizations where id = ${b.orgId}`).length).toBe(0);
      expect((await tx`select * from rp.interactions where org_id = ${b.orgId}`).length).toBe(0);
      expect((await tx`select * from rp.consents where org_id = ${b.orgId}`).length).toBe(0);
      expect((await tx`update rp.prospects set first_name = 'pirate' where id = ${pb} returning id`).length).toBe(0);
      expect((await tx`delete from rp.prospects where id = ${pb} returning id`).length).toBe(0);
    });
    await expect(withTenant(a.userId, tx => tx`insert into rp.prospects (org_id, email) values (${b.orgId}, 'x@y.fr')`)).rejects.toThrow(/row-level security/);
    await expect(withTenant(a.userId, tx => tx`insert into rp.memberships (org_id, user_id, role) values (${b.orgId}, ${a.userId}, 'owner')`)).rejects.toThrow();
    // The application layer refuses as well.
    expect(await getProspect(a.ctx, pb)).toBeNull();
    await expect(setStatus(a.ctx, pb, "won")).rejects.toThrow(/introuvable/);
    expect(await loadContext(a.userId, b.orgId)).toBeNull();
  });

  it("le rôle applicatif n'accède ni aux secrets, ni aux sessions, ni à la file d'attente", async () => {
    const a = await newCompany("gamma");
    await expect(withTenant(a.userId, tx => tx`select secret_enc from rp.mailboxes`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`select * from rp.sessions`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`select * from rp.jobs`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`select password_hash from rp.users`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`delete from rp.consents`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`update rp.organizations set trial_ends_at = now() + interval '10 years' where id = ${a.orgId}`)).rejects.toThrow(/permission denied/);
    await expect(withTenant(a.userId, tx => tx`insert into rp.subscriptions (org_id, plan, status) values (${a.orgId}, 'business', 'active')`)).rejects.toThrow(/permission denied/);
  });
});

describe("Comptes", () => {
  it("vérification e-mail, connexion, mauvais mot de passe, réinitialisation qui déconnecte partout", async () => {
    const a = await newCompany("auth");
    await system()`update rp.users set email_verified_at = null where id = ${a.userId}`;
    const [mail] = await system()`select text_body from rp.outbox_emails where to_email = ${a.email} and kind = 'verify'`;
    const token = String(mail.textBody).match(/token=([\w-]+)/)![1];
    expect(await verifyEmail(token)).toBe(true);
    expect(await verifyEmail(token)).toBe(false); // single use
    const session = await logIn(a.email, "motdepasse-solide-42");
    expect((await sessionUser(session))?.emailVerified).toBe(true);
    await expect(logIn(a.email, "mauvais")).rejects.toBeInstanceOf(AuthError);
    await requestPasswordReset(a.email);
    const [reset] = await system()`select text_body from rp.outbox_emails where to_email = ${a.email} and kind = 'reset'`;
    const rt = String(reset.textBody).match(/token=([\w-]+)/)![1];
    expect(await resetPassword(rt, "nouveau-mot-de-passe-1")).toBe(true);
    expect(await sessionUser(session)).toBeNull();
    expect(await logIn(a.email, "nouveau-mot-de-passe-1")).toBeTruthy();
  });

  it("limite les tentatives de connexion", async () => {
    const a = await newCompany("bruteforce");
    for (let i = 0; i < 8; i++) await logIn(a.email, "faux").catch(() => {});
    await expect(logIn(a.email, "motdepasse-solide-42")).rejects.toThrow(/Trop de tentatives/);
  });
});

describe("Prospects, conformité et envoi réel par SMTP", () => {
  it("de la demande à la relance envoyée, avec lien de désinscription et idempotence", async () => {
    const a = await newCompany("garage");
    const bad = await connectSmtp(a.orgId, { fromName: "Garage", fromEmail: "contact@garage-test.fr", host: "127.0.0.1", port: smtp.port, secure: false, user: "relance", password: "faux" });
    expect(bad.ok).toBe(false);
    const ok = await connectSmtp(a.orgId, { fromName: "Garage du Centre", fromEmail: "contact@garage-test.fr", host: "127.0.0.1", port: smtp.port, secure: false, user: "relance", password: "secret" });
    expect(ok).toEqual({ ok: true });

    const noBasis = await createProspect(a.ctx, { firstName: "Léa", lastName: "Durand", email: "lea@durand-transports.fr", need: "Révision de deux utilitaires." });
    const d0 = await createDraft(a.ctx, noBasis);
    await approveMessage(a.ctx, d0);
    await expect(sendNow(a.ctx, d0)).resolves.toMatchObject({ status: "blocked" });

    const id = await createProspect(a.ctx, { firstName: "Julie", lastName: "Martin", company: "Martin SARL", email: "julie@martin-sarl.fr", need: "Je souhaite un devis pour la révision de ma Clio.", lawfulBasis: "pre_contract", basisNote: "Appel du 3 mai" });
    await addQuote(a.ctx, id, { reference: "D-2026-041", amount: "480", sentAt: new Date(Date.now() - 6 * 86400_000).toISOString() });
    const draftId = await createDraft(a.ctx, id);
    const [draft] = await system()`select * from rp.messages where id = ${draftId}`;
    expect(draft.subject).toBe("Votre devis D-2026-041");
    expect(draft.reviewReasons).toEqual([]);
    await expect(sendNow(a.ctx, draftId)).resolves.toMatchObject({ status: "blocked" }); // not approved yet
    await approveMessage(a.ctx, draftId);
    const before = smtp.mails.length;
    expect(await sendNow(a.ctx, draftId)).toEqual({ status: "sent", reasons: [] });
    expect(await sendNow(a.ctx, draftId)).toEqual({ status: "skipped", reasons: [] }); // never twice
    expect(smtp.mails.length).toBe(before + 1);
    const mail = smtp.mails.at(-1)!;
    expect(mail.to).toEqual(["julie@martin-sarl.fr"]);
    expect(mail.raw.replace(/\r?\n[ \t]+/g, " ")).toMatch(/List-Unsubscribe: <http[^>]+\/u\//);
    expect(mail.raw.replace(/=\r?\n/g, "")).toContain("/u/"); // unsubscribe link in the body
    const p = await getProspect(a.ctx, id);
    expect(p!.prospect.status).toBe("waiting");
    expect(p!.interactions.some(i => i.direction === "outbound" && i.channel === "email")).toBe(true);

    // The prospect clicks the unsubscribe link: permanent opposition.
    const token = unsubscribeUrl(a.orgId, id).split("/u/")[1];
    expect(await unsubscribe(token)).toMatchObject({ ok: true, company: "Entreprise garage" });
    expect(await unsubscribe(token.slice(0, -2) + "xx")).toEqual({ ok: false });
    expect((await getProspect(a.ctx, id))!.prospect.status).toBe("opposed");
    await expect(createDraft(a.ctx, id)).rejects.toThrow(/opposé/);
    await expect(setStatus(a.ctx, id, "to_contact")).rejects.toThrow(/opposé/);

    // Erasure keeps the opposition: a re-import cannot target the person again.
    await eraseProspect(a.ctx, id, true);
    const r = await importCsv(a.ctx, "email;prenom\njulie@martin-sarl.fr;Julie\nnouveau@client-pro.fr;Marc", "legitimate_interest", "Salon pro 2026");
    expect(r).toMatchObject({ created: 2, opposed: 1 });
    const list = await listProspects(a.ctx, {});
    expect((list as unknown as Array<{ email: string; status: string }>).find(x => x.email === "julie@martin-sarl.fr")!.status).toBe("opposed");
  });

  it("une réponse du prospect est analysée et appliquée (refus, désinscription)", async () => {
    const a = await newCompany("artisan");
    const id = await createProspect(a.ctx, { firstName: "Marc", email: "marc@renov-pro.fr", need: "Rénovation salle de bain", lawfulBasis: "pre_contract" });
    const r1 = await recordInbound(a.ctx, id, "Nous avons choisi un autre prestataire, merci.");
    expect(r1.intent).toBe("refusal");
    expect((await getProspect(a.ctx, id))!.prospect.status).toBe("lost");
    const id2 = await createProspect(a.ctx, { firstName: "Sophie", email: "sophie@cabinet-sb.fr", need: "Entretien chaudière", lawfulBasis: "pre_contract" });
    await recordInbound(a.ctx, id2, "Merci de ne plus me contacter.");
    expect((await getProspect(a.ctx, id2))!.prospect.status).toBe("opposed");
  });
});

describe("Séquences et automatisation", () => {
  it("mode automatique : alerte, relance envoyée seule, puis arrêt d'urgence", async () => {
    const a = await newCompany("auto");
    await connectSmtp(a.orgId, { fromName: "Auto", fromEmail: "contact@auto-test.fr", host: "127.0.0.1", port: smtp.port, secure: false, user: "relance", password: "secret" });
    const seq = await saveSequence(a.ctx, null, { name: "Express", mode: "automatic", steps: [{ delayDays: 0, action: "alert" }, { delayDays: 0, action: "email" }, { delayDays: 0, action: "email" }, { delayDays: 0, action: "close" }] });
    const p1 = await createProspect(a.ctx, { firstName: "Nina", company: "Nina Immo", email: "nina@nina-immo.fr", need: "Estimation d'un appartement", lawfulBasis: "pre_contract" });
    const noBasis = await createProspect(a.ctx, { firstName: "X", email: "x@sans-base.fr" });
    await expect(enroll(a.ctx, noBasis, seq)).rejects.toThrow(/base légale/);
    await enroll(a.ctx, p1, seq);
    await expect(enroll(a.ctx, p1, seq)).rejects.toThrow(/déjà/);
    const before = smtp.mails.length;
    await drainJobs();
    const msgs = await system()`select status, step_position from rp.messages where prospect_id = ${p1} order by step_position`;
    // Step 2 is sent automatically; step 3 is drafted then held by the 20-hour spacing rule.
    expect(msgs[0].status).toBe("sent");
    expect(smtp.mails.length).toBe(before + 1);
    expect(smtp.mails.at(-1)!.to).toEqual(["nina@nina-immo.fr"]);
    const p = await getProspect(a.ctx, p1);
    expect(p!.interactions.some(i => i.subject === "Alerte")).toBe(true);

    // Emergency stop: nothing automatic leaves anymore.
    await setAutomationPaused(a.ctx, true);
    const p2 = await createProspect(a.ctx, { firstName: "Omar", email: "omar@omar-btp.fr", need: "Devis maçonnerie", lawfulBasis: "pre_contract" });
    await enroll(a.ctx, p2, seq);
    const count = smtp.mails.length;
    await drainJobs();
    expect(smtp.mails.length).toBe(count);
    expect((await system()`select count(*)::int as n from rp.messages where prospect_id = ${p2} and status = 'sent'`)[0].n).toBe(0);
  });

  it("Starter : pas de séquence automatique", async () => {
    const a = await newCompany("starter");
    await system()`update rp.subscriptions set plan = 'starter', status = 'active' where org_id = ${a.orgId}`;
    await expect(saveSequence(await a.reload(), null, { name: "Auto", mode: "automatic", steps: [{ delayDays: 1, action: "email" }] })).rejects.toThrow(/Pro/);
  });
});

describe("File d'attente", () => {
  it("idempotente, avec reprises puis échec définitif", async () => {
    expect(await enqueue(system(), "boom", {}, { key: "unique-key-1", maxAttempts: 2 })).toBe(true);
    expect(await enqueue(system(), "boom", {}, { key: "unique-key-1" })).toBe(false);
    const handlers = { boom: async () => { throw new Error("échec simulé"); } };
    await runDueJobs(handlers);
    await system()`update rp.jobs set run_at = now() where idempotency_key = 'unique-key-1'`;
    await runDueJobs(handlers);
    const [j] = await system()`select status, attempts from rp.jobs where idempotency_key = 'unique-key-1'`;
    expect(j).toMatchObject({ status: "dead", attempts: 2 });
  });
});

describe("Formulaire web, webhooks, Stripe, tableaux de bord", () => {
  it("le formulaire du site crée un prospect avec sa base légale, et ignore les robots", async () => {
    const a = await newCompany("form");
    const [o] = await system()`select inbound_token from rp.organizations where id = ${a.orgId}`;
    const r = await receiveForm(o.inboundToken as string, { name: "Claire Petit", email: "claire@petit-co.fr", message: "Bonjour, j'ai besoin d'un devis urgent pour un nettoyage de vitres.", page: "/contact" }, { ip: "1.2.3.4" });
    expect(r.ok).toBe(true);
    const p = await getProspect(a.ctx, r.prospectId!);
    expect(p!.prospect).toMatchObject({ source: "form", lawfulBasis: "pre_contract", aiUrgency: true });
    expect(p!.consents[0].basis).toBe("pre_contract");
    expect(await receiveForm(o.inboundToken as string, { name: "Bot", email: "b@b.fr", message: "x", website: "spam" }, { ip: "1.2.3.5" })).toMatchObject({ ignored: true });
    await expect(receiveForm("jeton-inconnu", {}, { ip: "1.2.3.6" })).rejects.toThrow(/inconnu/);
  });

  it("webhooks : URL privée refusée, livraisons mises en file", async () => {
    const a = await newCompany("hooks");
    await expect(createEndpoint(a.ctx, "https://127.0.0.1/hook", ["prospect.created"])).rejects.toThrow(/privée/);
    await expect(createEndpoint(a.ctx, "http://exemple.fr/hook", ["prospect.created"])).rejects.toThrow(/https/);
    const { secret } = await createEndpoint(a.ctx, "https://hooks.exemple-crm.fr/relancepro", ["prospect.created"]);
    expect(secret).toMatch(/^whsec_/);
    await emitWebhook(a.orgId, "prospect.created", { id: "x" });
    const [d] = await system()`select count(*)::int as n from rp.webhook_deliveries where org_id = ${a.orgId}`;
    expect(d.n).toBe(1);
  });

  it("Stripe : signature vérifiée, abonnement synchronisé, rejeu sans effet", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_relancepro";
    process.env.STRIPE_PRICE_STARTER = "price_starter"; process.env.STRIPE_PRICE_PRO = "price_pro"; process.env.STRIPE_PRICE_BUSINESS = "price_business";
    const a = await newCompany("billing");
    const event = { id: `evt_${Date.now()}`, object: "event", type: "customer.subscription.updated", data: { object: {
      id: "sub_123", object: "subscription", customer: "cus_123", status: "active", cancel_at_period_end: false, metadata: { org_id: a.orgId },
      items: { data: [{ price: { id: "price_pro", unit_amount: 14900 }, quantity: 1, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] }
    } } };
    const payload = JSON.stringify(event);
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_relancepro" });
    expect(() => verifyWebhook(payload, "t=1,v1=faux")).toThrow();
    const verified = verifyWebhook(payload, header);
    expect(await handleStripeEvent(verified)).toBe("processed");
    expect(await handleStripeEvent(verified)).toBe("duplicate");
    const ctx = await a.reload();
    expect(ctx.plan).toBe("pro");
    expect(ctx.limits.automaticSending).toBe(true);
    const m = await adminMetrics();
    expect(m.mrr).toBeGreaterThanOrEqual(149);
  });

  it("tableau de bord : chiffres issus des données", async () => {
    const a = await newCompany("stats");
    await createProspect(a.ctx, { firstName: "A", email: "a@stats-client.fr", need: "Devis", lawfulBasis: "pre_contract" });
    const id = await createProspect(a.ctx, { firstName: "B", email: "b@stats-client.fr", need: "Devis", lawfulBasis: "pre_contract" });
    await setStatus(a.ctx, id, "won", { wonValueCents: 250000 });
    const d = await dashboard(a.ctx, 30);
    expect(d.counts.total).toBe(2);
    expect(d.counts.newInPeriod).toBe(2);
    expect(d.counts.wonCents).toBe(250000);
    expect(d.counts.recoveredCents).toBe(0); // won without any follow-up sent: not counted as recovered
    expect(d.series).toHaveLength(30);
  });

  it("une session révoquée ou expirée ne donne plus accès", async () => {
    const a = await newCompany("session");
    const t = await createSession(a.userId);
    expect(await sessionUser(t)).not.toBeNull();
    await system()`update rp.sessions set expires_at = now() - interval '1 second'`;
    expect(await sessionUser(t)).toBeNull();
  });
});
