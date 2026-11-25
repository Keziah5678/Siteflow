import "server-only";
import Stripe from "stripe";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

let stripe: Stripe | null = null;

/** Returns null when Stripe is not configured (payments are then disabled in the UI). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "true") {
    // Safety net: live mode must be enabled explicitly.
    throw new Error("Clé Stripe live détectée sans STRIPE_ALLOW_LIVE=true.");
  }
  // Honour an outbound HTTPS proxy when one is configured (corporate networks,
  // sandboxes). The Stripe SDK uses Node's https module, which ignores HTTPS_PROXY.
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  stripe ??= new Stripe(key, { maxNetworkRetries: 2, appInfo: { name: "VENTURE" }, ...(proxy ? { httpAgent: new HttpsProxyAgent(proxy) } : {}) });
  return stripe;
}

type Plan = Database["public"]["Enums"]["plan_tier"];

/**
 * Applies a Stripe event to the database. Pure w.r.t. Stripe (no API calls),
 * so it can be unit-tested with fixture events.
 */
export async function applyStripeEvent(db: SupabaseClient<Database>, event: Stripe.Event): Promise<"handled" | "ignored"> {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.metadata?.user_id ?? s.client_reference_id;
      const plan = s.metadata?.plan as Plan | undefined;
      if (!userId || !plan || s.mode !== "subscription") return "ignored";
      const subId = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
      await db.from("subscriptions").upsert({ user_id: userId, plan, status: "active", stripe_subscription_id: subId, updated_at: new Date().toISOString() });
      await db.from("profiles").update({ plan }).eq("id", userId);
      await db.from("payments").upsert(
        { user_id: userId, stripe_session_id: s.id, amount_cents: s.amount_total ?? 0, currency: s.currency ?? "eur", kind: `subscription:${plan}`, status: s.payment_status },
        { onConflict: "stripe_session_id" },
      );
      return "handled";
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) return "ignored";
      const active = event.type !== "customer.subscription.deleted" && ["active", "trialing", "past_due"].includes(sub.status);
      const plan: Plan = active ? ((sub.metadata?.plan as Plan) ?? "free") : "free";
      const periodEnd = sub.items?.data?.[0]?.current_period_end;
      await db.from("subscriptions").upsert({
        user_id: userId,
        plan,
        status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      await db.from("profiles").update({ plan }).eq("id", userId);
      return "handled";
    }
    default:
      return "ignored";
  }
}
