import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe n'est pas configuré. Renseignez STRIPE_SECRET_KEY côté serveur." },
      { status: 503 },
    );
  }
  if (!process.env.STRIPE_PRICE_ID_PRO) {
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID_PRO manquant. Créez un tarif dans Stripe et renseignez son identifiant." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId as string | undefined;
  if (!workspaceId) return NextResponse.json({ error: "workspaceId manquant." }, { status: 422 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, slug, name")
    .eq("id", workspaceId)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: "Espace de travail introuvable." }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const stripe = getStripeClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("billing")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO, quantity: 1 }],
    success_url: `${appUrl}/dashboard/${workspace.slug}/settings?checkout=success`,
    cancel_url: `${appUrl}/dashboard/${workspace.slug}/settings?checkout=cancelled`,
    customer: (settings?.billing as { stripe_customer_id?: string } | undefined)?.stripe_customer_id,
    customer_email: (settings?.billing as { stripe_customer_id?: string } | undefined)?.stripe_customer_id
      ? undefined
      : user.email,
    client_reference_id: workspaceId,
    metadata: { workspace_id: workspaceId },
  });

  return NextResponse.json({ url: session.url });
}
