import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { publicEnv } from "@/lib/env";

export async function POST() {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Les paiements ne sont pas activés." }, { status: 503 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", publicEnv.appUrl), 303);
  const { data: priv } = await supabase.from("profile_private").select("stripe_customer_id").eq("id", user.id).single();
  if (!priv?.stripe_customer_id) return NextResponse.redirect(new URL("/pricing", publicEnv.appUrl), 303);
  const portal = await stripe.billingPortal.sessions.create({ customer: priv.stripe_customer_id, return_url: `${publicEnv.appUrl}/settings#plan` });
  return NextResponse.redirect(portal.url, 303);
}
