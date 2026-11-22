/**
 * Commercial plans and the rights they grant. Pure module: the same rules
 * are used to display the pricing page and to enforce limits server-side.
 * Prices are commercial hypotheses to be tested (see PROJECT_PLAN.md).
 */

export type PlanId = "starter" | "pro" | "business";
export type EffectivePlan = PlanId | "trial" | "expired";

export type Limits = {
  users: number;
  prospects: number;
  aiActionsPerMonth: number;
  emailsPerDay: number;
  automaticSending: boolean;
  sequences: number;
  webhooks: boolean;
  advancedReports: boolean;
  prioritySupport: boolean;
};

export const PLANS: Record<PlanId, { name: string; priceEuros: number; tagline: string; features: string[]; limits: Limits }> = {
  starter: {
    name: "Starter", priceEuros: 79, tagline: "Pour ne plus oublier aucune demande.",
    features: ["Gestion des prospects", "Tableau de bord", "Détection des demandes oubliées", "Suggestions RelancePro AI", "Relances manuelles ou assistées", "Statistiques essentielles"],
    limits: { users: 1, prospects: 1000, aiActionsPerMonth: 300, emailsPerDay: 60, automaticSending: false, sequences: 1, webhooks: false, advancedReports: false, prioritySupport: false }
  },
  pro: {
    name: "Pro", priceEuros: 149, tagline: "Pour automatiser vos relances autorisées.",
    features: ["Tout Starter", "Relances automatisées autorisées", "Séquences personnalisées", "Gestion avancée des prospects", "Jusqu'à 5 utilisateurs", "Webhooks et formulaires", "Statistiques détaillées"],
    limits: { users: 5, prospects: 10000, aiActionsPerMonth: 1500, emailsPerDay: 200, automaticSending: true, sequences: 10, webhooks: true, advancedReports: true, prioritySupport: false }
  },
  business: {
    name: "Business", priceEuros: 299, tagline: "Pour les équipes commerciales.",
    features: ["Tout Pro", "Gestion avancée des équipes", "Automatisations étendues", "Rapports personnalisés", "Intégrations avancées", "Support prioritaire"],
    limits: { users: 25, prospects: 50000, aiActionsPerMonth: 6000, emailsPerDay: 600, automaticSending: true, sequences: 50, webhooks: true, advancedReports: true, prioritySupport: true }
  }
};

/** Seven-day trial: Pro features, controlled quotas. */
export const TRIAL_LIMITS: Limits = { users: 2, prospects: 200, aiActionsPerMonth: 60, emailsPerDay: 25, automaticSending: true, sequences: 2, webhooks: true, advancedReports: true, prioritySupport: false };
export const EXPIRED_LIMITS: Limits = { users: 1, prospects: 0, aiActionsPerMonth: 0, emailsPerDay: 0, automaticSending: false, sequences: 0, webhooks: false, advancedReports: false, prioritySupport: false };

export type SubscriptionState = { plan: PlanId | null; status: string; currentPeriodEnd: Date | null };

/** Stripe statuses that keep the paid rights. `past_due` keeps them while Stripe retries the payment. */
const PAID_STATUSES = new Set(["active", "past_due"]);

export function effectivePlan(sub: SubscriptionState | null, trialEndsAt: Date, now = new Date()): EffectivePlan {
  if (sub?.plan && (PAID_STATUSES.has(sub.status) || (sub.status === "trialing" && sub.plan))) return sub.plan;
  if (sub?.plan && sub.status === "canceled" && sub.currentPeriodEnd && sub.currentPeriodEnd > now) return sub.plan;
  if (trialEndsAt > now) return "trial";
  return "expired";
}

export function limitsFor(plan: EffectivePlan): Limits {
  if (plan === "trial") return TRIAL_LIMITS;
  if (plan === "expired") return EXPIRED_LIMITS;
  return PLANS[plan].limits;
}

export function planLabel(plan: EffectivePlan): string {
  return plan === "trial" ? "Essai gratuit" : plan === "expired" ? "Expiré" : PLANS[plan].name;
}

export const formatEuros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 });
