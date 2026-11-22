import "server-only";
import { system } from "../db";
import { effectivePlan, limitsFor, type EffectivePlan, type Limits, type PlanId } from "../billing/plans";

export class AppError extends Error {
  constructor(message: string, readonly code: "forbidden" | "not_found" | "validation" | "limit" | "conflict" | "unavailable" = "validation") { super(message); }
}

export type OrgSettings = {
  senderName?: string;
  signature?: string;
  bookingUrl?: string;
  followUpAfterDays?: number;
  quietHours?: { start: number; end: number };
  maxTouchesPer30Days?: number;
  defaultLawfulBasis?: string;
  allowWeekends?: boolean;
};

export type OrgContext = {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "member";
  org: { id: string; name: string; sector: string; timezone: string; trialEndsAt: Date; automationPaused: boolean; settings: OrgSettings; inboundToken: string; referralCode: string };
  plan: EffectivePlan;
  limits: Limits;
  subscription: { plan: PlanId | null; status: string; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean; stripeCustomerId: string | null } | null;
};

/** Loads an organization for a user, verifying membership. Every server action starts here. */
export async function loadContext(userId: string, orgId?: string | null): Promise<OrgContext | null> {
  const rows = await system()`
    select o.*, m.role, s.plan as sub_plan, s.status as sub_status, s.current_period_end, s.cancel_at_period_end, s.stripe_customer_id
    from rp.memberships m join rp.organizations o on o.id = m.org_id left join rp.subscriptions s on s.org_id = o.id
    where m.user_id = ${userId} ${orgId ? system()`and o.id = ${orgId}` : system()``}
    order by m.created_at limit 1`;
  const r = rows[0];
  if (!r) return null;
  const subscription = { plan: (r.subPlan as PlanId) ?? null, status: (r.subStatus as string) ?? "none", currentPeriodEnd: (r.currentPeriodEnd as Date) ?? null, cancelAtPeriodEnd: Boolean(r.cancelAtPeriodEnd), stripeCustomerId: (r.stripeCustomerId as string) ?? null };
  const plan = effectivePlan(subscription, r.trialEndsAt as Date);
  return {
    userId, orgId: r.id as string, role: r.role as OrgContext["role"],
    org: { id: r.id as string, name: r.name as string, sector: r.sector as string, timezone: r.timezone as string, trialEndsAt: r.trialEndsAt as Date, automationPaused: Boolean(r.automationPaused), settings: (r.settings ?? {}) as OrgSettings, inboundToken: r.inboundToken as string, referralCode: r.referralCode as string },
    plan, limits: limitsFor(plan), subscription
  };
}

export function requireRole(ctx: OrgContext, min: "admin" | "owner") {
  const rank = { member: 1, admin: 2, owner: 3 };
  if (rank[ctx.role] < rank[min]) throw new AppError("Action réservée aux administrateurs de l'entreprise.", "forbidden");
}

export function requireActive(ctx: OrgContext) {
  if (ctx.plan === "expired") throw new AppError("Votre essai est terminé : choisissez une formule pour continuer.", "limit");
}

export const settingsWithDefaults = (s: OrgSettings) => ({
  senderName: s.senderName ?? "",
  signature: s.signature ?? "",
  bookingUrl: s.bookingUrl ?? "",
  followUpAfterDays: s.followUpAfterDays ?? 3,
  quietHours: s.quietHours ?? { start: 19, end: 8 },
  maxTouchesPer30Days: s.maxTouchesPer30Days ?? 3,
  defaultLawfulBasis: s.defaultLawfulBasis ?? "",
  allowWeekends: s.allowWeekends ?? false
});
