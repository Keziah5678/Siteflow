/**
 * RelancePro AI — deterministic core.
 *
 * Works without any API key and is always run first: it classifies, scores
 * and drafts from the facts the company actually has. The optional language
 * model (llm.ts) may rephrase a draft, but its output goes through the same
 * guard (reviewDraft) which flags anything not supported by those facts.
 */

export const PROMPT_VERSION = { analyze: "analyze.v1", followup: "followup.v1" } as const;

export type Intent = "request" | "positive" | "question" | "refusal" | "unsubscribe" | "out_of_office" | "unknown";

export type Analysis = {
  intent: Intent;
  urgent: boolean;
  need: string;
  summary: string;
  needsHuman: boolean;
  humanReasons: string[];
  suggestedStatus: string | null;
  confidence: number; // 0..1
};

const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
const has = (t: string, words: RegExp) => words.test(t);

const UNSUB = /(desinscri|desabonn|ne (plus|pas) (me )?(recevoir|contacter|relancer)|ne plus etre (contacte|relance|sollicite)|retirez[- ]moi|supprimez (mes|moi)|plus de (mail|message|relance)|stop( |$|\.|!)|arretez de m|opposition|rgpd|effacement de mes donnees)/;
const REFUSAL = /(pas interesse|ne sommes pas interesse|ne donnerons pas suite|pas donner suite|avons (choisi|retenu|trouve) (un autre|une autre|ailleurs)|projet (est )?(annule|abandonne|reporte sine die)|trop cher|hors budget|ce n est plus d actualite|plus besoin|non merci|nous declinons)/;
const POSITIVE = /(d accord|ok pour|je valide|nous validons|bon pour accord|interesse|ca nous interesse|on y va|allons-y|je confirme|confirmons|quand (pouvez|pourriez|seriez)-vous|vos disponibilites|prendre rendez-vous|un rendez-vous|un rdv|rappelez-moi|appelez-moi|tenez-moi au courant|je suis disponible|nous sommes disponibles|envoyez[- ]moi le devis|acceptons|j accepte)/;
const QUESTION = /(\?|combien|quel (est le )?(prix|tarif|delai|cout)|quels (sont les )?(delais|tarifs)|est-ce que|pourriez-vous m indiquer|savoir si)/;
const OOO = /(absent du bureau|out of office|reponse automatique|en conges|actuellement absent|de retour le|auto-?reply)/;
const REQUEST = /(devis|demande|besoin|souhait|voudrais|aimerais|recherche|cherche|intervention|renseignement|information|estimation|projet)/;
const URGENT = /(urgent|en urgence|au plus vite|des que possible|rapidement|asap|aujourd hui|demain|ce week-end|immediatement|fuite|panne|bloque|degat|sinistre|ne demarre plus)/;
const SENSITIVE = /(avocat|litige|plainte|mise en demeure|tribunal|huissier|scandal|inadmissible|mecontent|arnaque|remboursement|dommages|assurance|accident|blesse|sante|medical)/;
const PRICE_Q = /(combien|prix|tarif|cout|devis.*montant|budget)/;
const DELAY_Q = /(delai|quand|date|disponibilit|planning)/;

function sentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
}

export function extractNeed(text: string): string {
  const s = sentences(text);
  const hit = s.find(x => REQUEST.test(norm(x)));
  return (hit ?? s[0] ?? "").slice(0, 280);
}

export function analyzeMessage(text: string, opts: { inbound?: boolean } = {}): Analysis {
  const t = norm(text);
  const humanReasons: string[] = [];
  let intent: Intent = "unknown";
  let confidence = 0.4;
  if (has(t, OOO)) { intent = "out_of_office"; confidence = 0.85; }
  else if (has(t, UNSUB)) { intent = "unsubscribe"; confidence = 0.9; }
  else if (has(t, REFUSAL)) { intent = "refusal"; confidence = 0.8; }
  else if (has(t, POSITIVE)) { intent = "positive"; confidence = 0.75; }
  else if (has(t, QUESTION)) { intent = "question"; confidence = 0.65; }
  else if (has(t, REQUEST) && opts.inbound !== false) { intent = "request"; confidence = 0.7; }

  const urgent = has(t, URGENT);
  if (has(t, SENSITIVE)) humanReasons.push("Sujet sensible (réclamation, litige, sinistre ou santé).");
  if (intent === "question" && has(t, PRICE_Q)) humanReasons.push("Question de prix : seule l'entreprise peut répondre.");
  if (intent === "question" && has(t, DELAY_Q)) humanReasons.push("Question de délai ou de disponibilité : seule l'entreprise peut s'engager.");
  if (intent === "unknown" || confidence < 0.6) humanReasons.push("Intention incertaine.");
  if (intent === "positive") humanReasons.push("Réponse positive : à traiter personnellement pour conclure.");

  const suggestedStatus =
    intent === "unsubscribe" ? "opposed" :
    intent === "refusal" ? "lost" :
    intent === "positive" ? "meeting" :
    intent === "question" ? "to_contact" :
    intent === "request" ? "to_contact" : null;

  const s = sentences(text);
  const summary = s.slice(0, 2).join(" ").slice(0, 300) + (urgent ? " (urgent)" : "");
  return { intent, urgent, need: extractNeed(text), summary, needsHuman: humanReasons.length > 0, humanReasons, suggestedStatus, confidence };
}

/* --------------------------------------------------------------- scoring */

export type ScoreInput = { status: string; urgent: boolean; estimatedValueCents: number | null; daysSinceInbound: number | null; hasQuote: boolean; intent: string | null };

/** 0–100: how much attention this prospect deserves now. Explainable on purpose. */
export function scoreProspect(i: ScoreInput): number {
  if (["won", "lost", "opposed"].includes(i.status)) return 0;
  let s = 40;
  if (i.urgent) s += 20;
  if (i.hasQuote) s += 12;
  if (i.intent === "positive") s += 25;
  if (i.intent === "question") s += 10;
  if (i.status === "meeting") s += 10;
  if (i.estimatedValueCents) s += Math.min(15, Math.log10(Math.max(1, i.estimatedValueCents / 100)) * 4);
  if (i.daysSinceInbound != null) {
    if (i.daysSinceInbound <= 2) s += 10;
    else if (i.daysSinceInbound > 30) s -= 20;
    else if (i.daysSinceInbound > 14) s -= 10;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

/* ------------------------------------------------------- forgotten leads */

/** A lead is "forgotten" when the last word was the prospect's and nobody answered for `afterDays`. */
export function isForgotten(p: { status: string; lastInboundAt: Date | null; lastOutboundAt: Date | null; createdAt: Date }, afterDays: number, now = new Date()): boolean {
  if (["won", "lost", "opposed", "meeting"].includes(p.status)) return false;
  const lastIn = p.lastInboundAt ?? p.createdAt;
  const lastOut = p.lastOutboundAt;
  if (lastOut && lastOut >= lastIn) {
    // We spoke last: forgotten if the quote/answer got no follow-up for twice the delay.
    return now.getTime() - lastOut.getTime() > afterDays * 2 * 86400_000;
  }
  return now.getTime() - lastIn.getTime() > afterDays * 86400_000;
}

/* ------------------------------------------------------------- drafting */

export type DraftFacts = {
  prospectFirstName: string;
  prospectLastName: string;
  prospectCompany: string;
  need: string;
  lastInboundText: string;
  quote: { reference: string; sentAt: Date | null; amountCents: number | null } | null;
  companyName: string;
  senderName: string;
  bookingUrl: string | null;
  signature: string;
  stepPosition: number; // 1 = first follow-up
  isLastStep: boolean;
  customSubject?: string;
  customBody?: string;
};

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Replaces {{variables}} in a company-written template. Unknown variables are left visible so the guard flags them. */
export function renderTemplate(tpl: string, f: DraftFacts): string {
  const vars: Record<string, string> = {
    prenom: f.prospectFirstName, nom: f.prospectLastName, entreprise_prospect: f.prospectCompany, besoin: f.need,
    entreprise: f.companyName, expediteur: f.senderName, lien_rdv: f.bookingUrl ?? "",
    devis_reference: f.quote?.reference ?? "", devis_date: f.quote?.sentAt ? fmtDate(f.quote.sentAt) : ""
  };
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (m, k: string) => (k in vars && vars[k] ? vars[k] : m));
}

export function draftFollowUp(f: DraftFacts): { subject: string; body: string } {
  if (f.customBody?.trim()) {
    return { subject: renderTemplate(f.customSubject?.trim() || "Suite à votre demande", f), body: renderTemplate(f.customBody, f) };
  }
  const hello = f.prospectFirstName ? `Bonjour ${f.prospectFirstName},` : "Bonjour,";
  const topic = f.need ? ` concernant ${f.need.replace(/[.!?]+$/, "").replace(/^(je |nous )/i, "").slice(0, 160)}` : "";
  const lines: string[] = [hello, ""];
  if (f.quote?.reference) {
    lines.push(`Je reviens vers vous au sujet du devis ${f.quote.reference}${f.quote.sentAt ? ` envoyé le ${fmtDate(f.quote.sentAt)}` : ""}.`);
  } else {
    lines.push(`Je reviens vers vous suite à votre demande${topic}.`);
  }
  if (f.stepPosition <= 1) lines.push("Avez-vous pu en prendre connaissance ? Je reste à votre disposition pour toute question.");
  else if (!f.isLastStep) lines.push("Je me permets de vous relancer : votre projet est-il toujours d'actualité ?");
  else lines.push("Sans retour de votre part, je considérerai que votre demande n'est plus d'actualité. N'hésitez pas à me répondre si vous souhaitez poursuivre.");
  if (f.bookingUrl) lines.push("", `Si vous le souhaitez, vous pouvez choisir un créneau pour en parler : ${f.bookingUrl}`);
  lines.push("", "Bien cordialement,", f.signature?.trim() || [f.senderName, f.companyName].filter(Boolean).join("\n"));
  const subject = f.quote?.reference ? `Votre devis ${f.quote.reference}` : f.isLastStep ? "Votre demande est-elle toujours d'actualité ?" : `Suite à votre demande${f.companyName ? ` — ${f.companyName}` : ""}`;
  return { subject: subject.slice(0, 200), body: lines.join("\n") };
}

/* ------------------------------------------------------------------ guard */

const AMOUNT = /(\d[\d\s.,]*)\s?(€|eur\b|euros?\b|k€)/gi;
const DATEISH = /\b(\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|sous \d+ ?(h|heures|jours)|en \d+ ?(h|heures|jours)|demain|cette semaine|la semaine prochaine|\d{1,2} (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))\b/gi;
const PROMISES = /\b(garanti|garantie|gratuit|gratuite|offert|offerte|remise|promotion|promo|reduction|sans engagement|meilleur prix|moins cher|rembours)/gi;
const PHONE = /(\+33|0)[1-9]([\s.-]?\d{2}){4}/g;
const URL = /https?:\/\/[^\s)]+/gi;

/**
 * Flags any claim in a draft that the facts don't support: amounts, dates or
 * delays, commercial promises, phone numbers, links, unfilled variables.
 * Each reason sends the message to human review instead of automatic sending.
 */
export function reviewDraft(draft: { subject: string; body: string }, facts: DraftFacts, extraAllowedText = ""): string[] {
  const reasons: string[] = [];
  const text = `${draft.subject}\n${draft.body}`;
  const allowed = norm([facts.need, facts.lastInboundText, facts.signature, facts.quote?.reference ?? "", facts.quote?.amountCents != null ? `${facts.quote.amountCents / 100} €` : "", facts.quote?.sentAt ? fmtDate(facts.quote.sentAt) : "", facts.bookingUrl ?? "", extraAllowedText].join(" "));
  const allowedDigits = allowed.replace(/[\s.,]/g, "");
  for (const m of text.matchAll(AMOUNT)) {
    const digits = m[1].replace(/[\s.,]/g, "");
    if (!allowedDigits.includes(digits)) { reasons.push(`Montant non présent dans les données : « ${m[0].trim()} ».`); break; }
  }
  for (const m of norm(text).matchAll(DATEISH)) {
    if (!allowed.includes(m[0])) { reasons.push(`Date ou délai non présent dans les données : « ${m[0]} ».`); break; }
  }
  for (const m of norm(text).matchAll(PROMISES)) {
    if (!allowed.includes(m[0])) { reasons.push(`Engagement commercial non présent dans les données : « ${m[0]} ».`); break; }
  }
  for (const m of text.matchAll(PHONE)) {
    if (!allowedDigits.includes(m[0].replace(/[\s.-]/g, ""))) { reasons.push("Numéro de téléphone non présent dans les données."); break; }
  }
  for (const m of text.matchAll(URL)) {
    if (!allowed.includes(norm(m[0]))) { reasons.push(`Lien non autorisé : ${m[0]}`); break; }
  }
  if (/\{\{|\}\}|\[[A-Z_ ]+\]/.test(text)) reasons.push("Variable non remplie dans le message.");
  if (draft.body.trim().length < 40) reasons.push("Message trop court.");
  if (draft.body.length > 4000) reasons.push("Message trop long.");
  return reasons;
}
