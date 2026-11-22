import "server-only";
import Stripe from "stripe";
import { system } from "../db";
import { env } from "../server/env";
import { logError } from "../server/ops";
import { PLANS, type PlanId } from "./plans";
import { AppError, requireRole, type OrgContext } from "../app/context";

/**
 * Stripe Billing. Checkout creates the subscription, the customer portal
 * handles plan changes, cards, invoices and cancellation, and webhooks are
 * the single source of truth for rights (rp.subscriptions). Every event is
 * recorded once (rp.stripe_events) so replays are harmless.
 */

let client: Stripe | null = null;
export const stripeConfigured = () => Boolean(env.stripeSecret && env.stripePrices.starter && env.stripePrices.pro && env.stripePrices.business);

export function stripe(): Stripe {
  if (!env.stripeSecret) throw new AppError("Paiement non configuré (STRIPE_SECRET_KEY).", "unavailable");
  client ??= new Stripe(env.stripeSecret);
  return client;
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  const p = env.stripePrices;
  return priceId === p.starter ? "starter" : priceId === p.pro ? "pro" : priceId === p.business ? "business" : null;
}

async function ensureCustomer(ctx: OrgContext, email: string): Promise<string> {
  if (ctx.subscription?.stripeCustomerId) return ctx.subscription.stripeCustomerId;
  const customer = await stripe().customers.create({ email, name: ctx.org.name, metadata: { org_id: ctx.orgId } }, { idempotencyKey: `customer:${ctx.orgId}` });
  await system()`insert into rp.subscriptions (org_id, stripe_customer_id) values (${ctx.orgId}, ${customer.id})
    on conflict (org_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()`;
  return customer.id;
}

export async function createCheckout(ctx: OrgContext, plan: PlanId, email: string): Promise<string> {
  requireRole(ctx, "admin");
  if (!stripeConfigured()) throw new AppError("Le paiement en ligne n'est pas encore activé.", "unavailable");
  if (!(plan in PLANS)) throw new AppError("Formule inconnue.");
  if (ctx.subscription?.plan && ["active", "past_due", "trialing"].includes(ctx.subscription.status)) {
    throw new AppError("Un abonnement est déjà actif : changez de formule depuis le portail de facturation.", "conflict");
  }
  const customer = await ensureCustomer(ctx, email);
  const trialDaysLeft = Math.max(0, Math.ceil((ctx.org.trialEndsAt.getTime() - Date.now()) / 86400_000));
  const session = await stripe().checkout.sessions.create({
    mode: "subscription", customer, client_reference_id: ctx.orgId,
    line_items: [{ price: env.stripePrices[plan], quantity: 1 }],
    subscription_data: { metadata: { org_id: ctx.orgId }, ...(trialDaysLeft >= 1 ? { trial_period_days: trialDaysLeft } : {}) },
    metadata: { org_id: ctx.orgId, plan },
    allow_promotion_codes: true, billing_address_collection: "required", tax_id_collection: { enabled: true },
    customer_update: { address: "auto", name: "auto" }, locale: "fr",
    success_url: `${env.appUrl}/app/billing?status=success`, cancel_url: `${env.appUrl}/app/billing?status=cancelled`
  });
  if (!session.url) throw new AppError("Stripe n'a pas renvoyé d'URL de paiement.", "unavailable");
  return session.url;
}

export async function createPortal(ctx: OrgContext): Promise<string> {
  requireRole(ctx, "admin");
  if (!ctx.subscription?.stripeCustomerId) throw new AppError("Aucun compte de facturation pour l'instant.", "not_found");
  const s = await stripe().billingPortal.sessions.create({ customer: ctx.subscription.stripeCustomerId, return_url: `${env.appUrl}/app/billing`, locale: "fr" });
  return s.url;
}

/** Applies a subscription object to rp.subscriptions. Pure data mapping, exported for tests. */
export async function syncSubscription(sub: Stripe.Subscription) {
  const sql = system();
  const item = sub.items.data[0];
  const plan = planForPrice(item?.price?.id);
  const orgId = sub.metadata?.org_id || null;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  const amount = (item?.price?.unit_amount ?? 0) * (item?.quantity ?? 1);
  const rows = orgId
    ? await sql`select org_id from rp.subscriptions where org_id = ${orgId}`
    : await sql`select org_id from rp.subscriptions where stripe_customer_id = ${customerId}`;
  const target = (rows[0]?.orgId as string) ?? orgId;
  if (!target) throw new Error(`Abonnement ${sub.id} sans organisation connue`);
  await sql`
    insert into rp.subscriptions (org_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, cancel_at_period_end, monthly_amount_cents, updated_at)
    values (${target}, ${customerId}, ${sub.id}, ${plan}, ${sub.status}, ${periodEnd ? new Date(periodEnd * 1000).toISOString() : null}::timestamptz, ${sub.cancel_at_period_end}, ${amount}, now())
    on conflict (org_id) do update set stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,
      plan = excluded.plan, status = excluded.status, current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end, monthly_amount_cents = excluded.monthly_amount_cents, updated_at = now()`;
  if (sub.status === "active") await sql`update rp.referrals set status = 'converted' where referred_org = ${target} and status = 'signed_up'`;
  return target;
}

export function verifyWebhook(payload: string, signature: string | null): Stripe.Event {
  if (!env.stripeWebhookSecret) throw new AppError("Webhook Stripe non configuré.", "unavailable");
  if (!signature) throw new AppError("Signature manquante.");
  // constructEvent only needs the signing secret; no API key or network call involved.
  return Stripe.webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  const sql = system();
  const fresh = await sql`insert into rp.stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`;
  if (!fresh.length) {
    const [prev] = await sql`select processed_at from rp.stripe_events where id = ${event.id}`;
    if (prev?.processedAt) return "duplicate";
  }
  try {
    let handled = true;
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orgId = s.metadata?.org_id ?? s.client_reference_id;
        if (orgId && s.customer) await sql`insert into rp.subscriptions (org_id, stripe_customer_id) values (${orgId}, ${String(s.customer)})
          on conflict (org_id) do update set stripe_customer_id = excluded.stripe_customer_id, updated_at = now()`;
        if (s.subscription && env.stripeSecret) await syncSubscription(await stripe().subscriptions.retrieve(String(s.subscription)));
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const customer = String(inv.customer ?? "");
        await sql`update rp.subscriptions set status = 'past_due', updated_at = now() where stripe_customer_id = ${customer}`;
        await sql`insert into rp.error_log (org_id, source, message) select org_id, 'billing', 'Échec de paiement — Stripe relance le client automatiquement' from rp.subscriptions where stripe_customer_id = ${customer}`;
        break;
      }
      default:
        handled = false;
    }
    await sql`update rp.stripe_events set processed_at = now(), error = null where id = ${event.id}`;
    return handled ? "processed" : "ignored";
  } catch (e) {
    await sql`update rp.stripe_events set error = ${(e as Error).message.slice(0, 500)} where id = ${event.id}`;
    await logError("stripe_webhook", e, { eventId: event.id, type: event.type });
    throw e; // Stripe will retry
  }
}
