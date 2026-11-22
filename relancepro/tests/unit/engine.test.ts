import { describe, expect, it } from "vitest";
import { analyzeMessage, draftFollowUp, isForgotten, renderTemplate, reviewDraft, scoreProspect, type DraftFacts } from "@/lib/ai/engine";
import { checkSend, isDeferral, isPersonalAddress, type GateInput } from "@/lib/compliance/gate";
import { mapRows, parseCsv, toCsv } from "@/lib/prospects/csv";
import { effectivePlan, limitsFor, PLANS } from "@/lib/billing/plans";

const facts = (over: Partial<DraftFacts> = {}): DraftFacts => ({
  prospectFirstName: "Julie", prospectLastName: "Martin", prospectCompany: "Martin SARL",
  need: "Je souhaite un devis pour la révision de ma Clio.", lastInboundText: "Bonjour, je souhaite un devis pour la révision de ma Clio.",
  quote: null, companyName: "Garage du Centre", senderName: "Paul", bookingUrl: null, signature: "Paul\nGarage du Centre",
  stepPosition: 1, isLastStep: false, ...over
});

describe("RelancePro AI — analyse", () => {
  it("détecte une demande de désinscription, même polie", () => {
    expect(analyzeMessage("Merci de ne plus me contacter, je ne souhaite plus recevoir vos messages.").intent).toBe("unsubscribe");
    expect(analyzeMessage("STOP").intent).toBe("unsubscribe");
  });
  it("distingue refus, réponse positive, question et absence", () => {
    expect(analyzeMessage("Nous avons choisi un autre prestataire, merci.").intent).toBe("refusal");
    expect(analyzeMessage("C'est d'accord, quand pouvez-vous passer ?").intent).toBe("positive");
    expect(analyzeMessage("Quel est le délai pour une intervention ?").intent).toBe("question");
    expect(analyzeMessage("Je suis absent du bureau jusqu'au 3 janvier.").intent).toBe("out_of_office");
  });
  it("repère l'urgence et les sujets demandant un humain", () => {
    const a = analyzeMessage("Urgent : fuite d'eau dans la cuisine, pouvez-vous venir demain ?");
    expect(a.urgent).toBe(true);
    const b = analyzeMessage("Combien coûte le remplacement ?");
    expect(b.needsHuman).toBe(true);
    expect(b.humanReasons.join(" ")).toMatch(/prix/);
    expect(analyzeMessage("Je vais saisir mon avocat.").humanReasons.join(" ")).toMatch(/sensible/);
  });
  it("extrait le besoin", () => {
    expect(analyzeMessage("Bonjour. Nous aurions besoin d'un nettoyage de bureaux chaque semaine. Merci.").need).toMatch(/nettoyage de bureaux/);
  });
});

describe("RelancePro AI — rédaction sans invention", () => {
  it("rédige une relance à partir des seuls faits, sans signal d'alerte", () => {
    const d = draftFollowUp(facts());
    expect(d.body).toMatch(/Bonjour Julie/);
    expect(d.body).toMatch(/révision de ma Clio|révision/);
    expect(reviewDraft(d, facts())).toEqual([]);
  });
  it("cite le devis existant et sa date", () => {
    const f = facts({ quote: { reference: "D-2026-041", sentAt: new Date("2026-03-12T10:00:00Z"), amountCents: 48000 } });
    const d = draftFollowUp(f);
    expect(d.subject).toBe("Votre devis D-2026-041");
    expect(d.body).toMatch(/12 mars/);
    expect(reviewDraft(d, f)).toEqual([]);
  });
  it("signale tout montant, délai, promesse ou lien absent des données", () => {
    const f = facts();
    const r = reviewDraft({ subject: "Offre", body: "Bonjour Julie, je vous propose 350 € avec une remise, intervention sous 48h. Voir https://exemple.fr" }, f);
    expect(r.some(x => x.startsWith("Montant"))).toBe(true);
    expect(r.some(x => x.startsWith("Date ou délai"))).toBe(true);
    expect(r.some(x => x.startsWith("Engagement"))).toBe(true);
    expect(r.some(x => x.startsWith("Lien"))).toBe(true);
  });
  it("accepte un montant présent dans le devis", () => {
    const f = facts({ quote: { reference: "D1", sentAt: null, amountCents: 48000 } });
    expect(reviewDraft({ subject: "Devis", body: "Bonjour Julie, je reviens vers vous pour le devis D1 de 480 €, avez-vous pu le consulter ?" }, f)).toEqual([]);
  });
  it("remplit les modèles et laisse visibles les variables inconnues", () => {
    expect(renderTemplate("Bonjour {{prenom}} de {{entreprise_prospect}}", facts())).toBe("Bonjour Julie de Martin SARL");
    const r = renderTemplate("Code {{inconnu}}", facts());
    expect(reviewDraft({ subject: "x", body: `${r} ${"texte ".repeat(10)}` }, facts())).toContain("Variable non remplie dans le message.");
  });
});

describe("Détection et priorisation", () => {
  const now = new Date("2026-05-20T10:00:00Z");
  it("une demande sans réponse depuis plus de N jours est oubliée", () => {
    expect(isForgotten({ status: "new", lastInboundAt: new Date("2026-05-15T10:00:00Z"), lastOutboundAt: null, createdAt: new Date("2026-05-15T10:00:00Z") }, 3, now)).toBe(true);
    expect(isForgotten({ status: "new", lastInboundAt: new Date("2026-05-19T10:00:00Z"), lastOutboundAt: null, createdAt: new Date("2026-05-19T10:00:00Z") }, 3, now)).toBe(false);
    expect(isForgotten({ status: "opposed", lastInboundAt: new Date("2026-01-01"), lastOutboundAt: null, createdAt: new Date("2026-01-01") }, 3, now)).toBe(false);
  });
  it("un devis envoyé sans suite est oublié après le double du délai", () => {
    expect(isForgotten({ status: "waiting", lastInboundAt: new Date("2026-05-01"), lastOutboundAt: new Date("2026-05-16T10:00:00Z"), createdAt: new Date("2026-05-01") }, 3, now)).toBe(false);
    expect(isForgotten({ status: "waiting", lastInboundAt: new Date("2026-05-01"), lastOutboundAt: new Date("2026-05-10T10:00:00Z"), createdAt: new Date("2026-05-01") }, 3, now)).toBe(true);
  });
  it("score explicable", () => {
    const base = { status: "new", urgent: false, estimatedValueCents: null, daysSinceInbound: 5, hasQuote: false, intent: null };
    expect(scoreProspect({ ...base, urgent: true })).toBeGreaterThan(scoreProspect(base));
    expect(scoreProspect({ ...base, status: "opposed" })).toBe(0);
  });
});

const gate = (over: Partial<GateInput> = {}, prospect: Partial<GateInput["prospect"]> = {}, org: Partial<GateInput["org"]> = {}): GateInput => ({
  automatic: false,
  prospect: { email: "julie@martin-sarl.fr", status: "waiting", lawfulBasis: "pre_contract", lastOutboundAt: null, outboundLast30Days: 0, ...prospect },
  suppressed: false,
  org: { automationPaused: false, maxTouchesPer30Days: 3, quietHours: { start: 19, end: 8 }, timezone: "Europe/Paris", allowWeekends: true, ...org },
  globalAutomationDisabled: false, planAllowsAutomatic: true, mailboxConnected: true, sentTodayByOrg: 0, dailyLimit: 80,
  message: { status: "approved", hasUnsubscribeLink: true, reviewReasons: [] },
  now: new Date("2026-05-20T10:00:00Z"), ...over
});

describe("Portail de conformité", () => {
  it("autorise un envoi validé, licite et raisonnable", () => {
    expect(checkSend(gate())).toEqual({ ok: true, reasons: [] });
  });
  it("bloque toute relance après opposition, quelle que soit la source", () => {
    expect(checkSend(gate({ suppressed: true })).ok).toBe(false);
    expect(checkSend(gate({}, { status: "opposed" })).ok).toBe(false);
  });
  it("exige une base légale et refuse l'intérêt légitime sur une adresse personnelle", () => {
    expect(checkSend(gate({}, { lawfulBasis: null })).reasons.join()).toMatch(/base légale/);
    expect(isPersonalAddress("jean@gmail.com")).toBe(true);
    expect(checkSend(gate({}, { lawfulBasis: "legitimate_interest", email: "jean@gmail.com" })).ok).toBe(false);
    expect(checkSend(gate({}, { lawfulBasis: "legitimate_interest", email: "achats@entreprise.fr" })).ok).toBe(true);
  });
  it("plafonne la fréquence et la limite quotidienne", () => {
    expect(checkSend(gate({}, { outboundLast30Days: 3 })).ok).toBe(false);
    expect(checkSend(gate({}, { lastOutboundAt: new Date("2026-05-20T01:00:00Z") })).ok).toBe(false);
    expect(checkSend(gate({ sentTodayByOrg: 80 })).ok).toBe(false);
  });
  it("manuel : le message doit être validé", () => {
    expect(checkSend(gate({ message: { status: "draft", hasUnsubscribeLink: true, reviewReasons: [] } })).ok).toBe(false);
  });
  it("automatique : formule, interrupteurs, validation humaine, heures de repos, week-end", () => {
    const auto = (o: Partial<GateInput> = {}, org: Partial<GateInput["org"]> = {}) => checkSend(gate({ automatic: true, ...o }, {}, org));
    expect(auto().ok).toBe(true);
    expect(auto({ planAllowsAutomatic: false }).ok).toBe(false);
    expect(auto({ globalAutomationDisabled: true }).ok).toBe(false);
    expect(auto({}, { automationPaused: true }).ok).toBe(false);
    expect(auto({ message: { status: "approved", hasUnsubscribeLink: true, reviewReasons: ["Montant non présent"] } }).ok).toBe(false);
    const night = auto({ now: new Date("2026-05-20T21:30:00Z") });
    expect(night.ok).toBe(false);
    expect(night.reasons.every(isDeferral)).toBe(true);
    const sunday = auto({ now: new Date("2026-05-24T10:00:00Z") }, { allowWeekends: false });
    expect(sunday.reasons.some(r => r.startsWith("Week-end"))).toBe(true);
  });
});

describe("Import CSV", () => {
  it("lit un export Excel français (point-virgule, guillemets, BOM, retours à la ligne)", () => {
    const csv = "﻿Prénom;Nom;Société;E-mail;Téléphone;Besoin;Montant\r\nJulie;Martin;Martin SARL;Julie@Martin.fr;0601020304;\"Devis ; urgent\nsur deux lignes\";1 200,50\r\n";
    const { rows, errors } = mapRows(parseCsv(csv));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ firstName: "Julie", email: "julie@martin.fr", company: "Martin SARL", estimatedValueCents: 120050 });
    expect(rows[0].need).toContain("sur deux lignes");
  });
  it("rejette les lignes invalides et les doublons", () => {
    const { rows, errors } = mapRows(parseCsv("email,first name\nbad-email,A\nok@x.fr,B\nok@x.fr,C\n,D"));
    expect(rows).toHaveLength(1);
    expect(errors.map(e => e.line)).toEqual([2, 4, 5]);
  });
  it("neutralise les formules à l'export", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }])).toContain("'=HYPERLINK");
  });
});

describe("Formules", () => {
  const future = new Date(Date.now() + 86400_000), past = new Date(Date.now() - 86400_000);
  it("essai, abonnement, impayé, résiliation", () => {
    expect(effectivePlan(null, future)).toBe("trial");
    expect(effectivePlan(null, past)).toBe("expired");
    expect(effectivePlan({ plan: "pro", status: "active", currentPeriodEnd: null }, past)).toBe("pro");
    expect(effectivePlan({ plan: "pro", status: "past_due", currentPeriodEnd: null }, past)).toBe("pro");
    expect(effectivePlan({ plan: "pro", status: "canceled", currentPeriodEnd: future }, past)).toBe("pro");
    expect(effectivePlan({ plan: "pro", status: "canceled", currentPeriodEnd: past }, past)).toBe("expired");
    expect(effectivePlan({ plan: "starter", status: "unpaid", currentPeriodEnd: null }, past)).toBe("expired");
  });
  it("Starter n'inclut pas l'envoi automatique, Pro oui", () => {
    expect(PLANS.starter.limits.automaticSending).toBe(false);
    expect(limitsFor("pro").automaticSending).toBe(true);
    expect(limitsFor("expired").prospects).toBe(0);
    expect([PLANS.starter.priceEuros, PLANS.pro.priceEuros, PLANS.business.priceEuros]).toEqual([79, 149, 299]);
  });
});
