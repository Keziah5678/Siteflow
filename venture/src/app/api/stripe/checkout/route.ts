import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Les paiements ne sont pas encore activés." }, { status: 503 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/pricing", publicEnv.appUrl), 303);

  const form = await request.formData().catch(() => null);
  const plan = z.enum(["plus", "business"]).safeParse(form?.get("plan"));
  if (!plan.success) return NextResponse.json({ error: "Offre invalide." }, { status: 400 });
  if (!(await rateLimit(`checkout:${user.id}`, 5, 600))) return NextResponse.json({ error: "Trop de tentatives." }, { status: 429 });

  const admin = createServiceClient();
  const [{ data: settings }, { data: sub }, { data: priv }] = await Promise.all([
    admin.from("plan_settings").select("*").eq("plan", plan.data).single(),
    admin.from("subscriptions").select("plan, status").eq("user_id", user.id).maybeSingle(),
    admin.from("profile_private").select("stripe_customer_id").eq("id", user.id).single(),
  ]);
  if (!settings) return NextResponse.json({ error: "Offre indisponible." }, { status: 404 });
  // Duplicate-payment prevention: one active subscription per user.
  if (sub && ["active", "trialing", "past_due"].includes(sub.status)) {
    return NextResponse.redirect(new URL("/settings?billing=active#plan", publicEnv.appUrl), 303);
  }

  let customerId = priv?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: `customer:${user.id}` });
    customerId = customer.id;
    await admin.from("profile_private").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan: plan.data },
      subscription_data: { metadata: { user_id: user.id, plan: plan.data } },
      line_items: [
        {
          quantity: 1,
          // Price comes from plan_settings, editable in the admin.
          price_data: { currency: settings.currency, unit_amount: settings.price_cents, recurring: { interval: "month" }, product_data: { name: settings.label } },
        },
      ],
      allow_promotion_codes: true,
      success_url: `${publicEnv.appUrl}/settings?billing=success#plan`,
      cancel_url: `${publicEnv.appUrl}/pricing?billing=cancelled`,
    },
    // Same user + plan within 10 minutes → same session (double-click safe).
    { idempotencyKey: `checkout:${user.id}:${plan.data}:${settings.price_cents}:${Math.floor(Date.now() / 600_000)}` },
  );
  return NextResponse.redirect(session.url!, 303);
}
