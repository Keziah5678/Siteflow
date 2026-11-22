/**
 * Compliance gate — the last check before any e-mail leaves RelancePro.
 *
 * Pure function: every sending path (manual, assisted, automatic) calls it,
 * and a single failing rule blocks the send. Rules reflect French / EU
 * practice for B2B prospecting (RGPD art. 6 & 21, CNIL guidance on B2B
 * e-mail prospecting, LCEN art. L34-5 CPCE): a lawful basis must be recorded,
 * oppositions are final, every message carries an unsubscribe link, and
 * frequency is capped. It is a safeguard, not legal advice.
 */

export type LawfulBasis = "consent" | "legitimate_interest" | "pre_contract" | "contract";

export type GateInput = {
  automatic: boolean;
  prospect: {
    email: string | null;
    status: string;
    lawfulBasis: LawfulBasis | null;
    /** True when the address is a generic or personal one while the basis is legitimate interest (B2B only). */
    lastOutboundAt: Date | null;
    outboundLast30Days: number;
  };
  suppressed: boolean;
  org: { automationPaused: boolean; maxTouchesPer30Days: number; quietHours: { start: number; end: number }; timezone: string; allowWeekends?: boolean };
  globalAutomationDisabled: boolean;
  planAllowsAutomatic: boolean;
  mailboxConnected: boolean;
  sentTodayByOrg: number;
  dailyLimit: number;
  message: { status: string; hasUnsubscribeLink: boolean; reviewReasons: string[] };
  now?: Date;
};

export type GateResult = { ok: boolean; reasons: string[] };

const PERSONAL_DOMAINS = new Set(["gmail.com", "yahoo.fr", "yahoo.com", "hotmail.fr", "hotmail.com", "outlook.fr", "outlook.com", "live.fr", "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr", "icloud.com", "protonmail.com", "gmx.fr", "aol.com", "neuf.fr", "bbox.fr"]);

export function isPersonalAddress(email: string): boolean {
  return PERSONAL_DOMAINS.has(email.split("@")[1]?.toLowerCase() ?? "");
}

function hourIn(tz: string, d: Date): number {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).formatToParts(d).find(p => p.type === "hour");
    return Number(part?.value ?? d.getUTCHours());
  }
  catch { return d.getUTCHours(); }
}

export function checkSend(i: GateInput): GateResult {
  const reasons: string[] = [];
  const now = i.now ?? new Date();
  const p = i.prospect;

  if (!p.email) reasons.push("Le prospect n'a pas d'adresse e-mail.");
  if (i.suppressed || p.status === "opposed") reasons.push("Le prospect s'est opposé aux communications : aucune relance n'est possible.");
  if (p.status === "won" || p.status === "lost") reasons.push("Le dossier est clos (gagné ou perdu).");
  if (!p.lawfulBasis) reasons.push("Aucune base légale n'est enregistrée pour ce prospect (consentement, demande de devis, contrat ou intérêt légitime B2B).");
  if (p.lawfulBasis === "legitimate_interest" && p.email && isPersonalAddress(p.email)) {
    reasons.push("Intérêt légitime B2B invoqué pour une adresse personnelle : un consentement ou une demande du prospect est nécessaire.");
  }
  if (!i.mailboxConnected) reasons.push("Aucune boîte d'envoi connectée.");
  if (!i.message.hasUnsubscribeLink) reasons.push("Le message ne contient pas de lien de désinscription.");
  if (p.outboundLast30Days >= i.org.maxTouchesPer30Days) reasons.push(`Plafond atteint : ${i.org.maxTouchesPer30Days} relances sur 30 jours pour ce prospect.`);
  if (p.lastOutboundAt && now.getTime() - p.lastOutboundAt.getTime() < 20 * 3600_000) reasons.push("Un message a déjà été envoyé à ce prospect il y a moins de 20 heures.");
  if (i.sentTodayByOrg >= i.dailyLimit) reasons.push(`Limite d'envoi quotidienne atteinte (${i.dailyLimit}).`);

  if (i.automatic) {
    if (i.globalAutomationDisabled) reasons.push("Les envois automatiques sont suspendus sur toute la plateforme.");
    if (i.org.automationPaused) reasons.push("Les automatisations de l'entreprise sont arrêtées.");
    if (!i.planAllowsAutomatic) reasons.push("Votre formule n'inclut pas l'envoi automatique.");
    if (i.message.reviewReasons.length) reasons.push("Le message demande une validation humaine : " + i.message.reviewReasons.join(" ; "));
    const h = hourIn(i.org.timezone, now);
    const { start, end } = i.org.quietHours;
    const quiet = start > end ? h >= start || h < end : h >= start && h < end;
    if (quiet) reasons.push("Plage horaire de repos : l'envoi automatique attendra les heures ouvrées.");
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: i.org.timezone, weekday: "short" }).format(now);
    if (!i.org.allowWeekends && (day === "Sat" || day === "Sun")) reasons.push("Week-end : l'envoi automatique attendra un jour ouvré.");
  } else if (i.message.status !== "approved") {
    reasons.push("Le message doit être validé avant l'envoi.");
  }
  return { ok: reasons.length === 0, reasons };
}

/** Rules that only defer an automatic send (it will be retried later) rather than cancel it. */
export function isDeferral(reason: string): boolean {
  return reason.startsWith("Plage horaire") || reason.startsWith("Week-end") || reason.startsWith("Limite d'envoi quotidienne") || reason.startsWith("Un message a déjà été envoyé");
}
