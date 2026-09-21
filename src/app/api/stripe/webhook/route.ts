import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  const payload = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature invalide.";
    return NextResponse.json({ error: `Webhook signature invalide : ${message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id || session.client_reference_id;
      if (workspaceId) {
        await supabase
          .from("settings")
          .update({
            billing: {
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              plan: "pro",
            },
          })
          .eq("workspace_id", workspaceId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: settingsRow } = await supabase
        .from("settings")
        .select("id, workspace_id, billing")
        .contains("billing", { stripe_subscription_id: subscription.id })
        .maybeSingle();
      if (settingsRow) {
        await supabase
          .from("settings")
          .update({ billing: { ...(settingsRow.billing as object), plan: "free" } })
          .eq("id", settingsRow.id);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
