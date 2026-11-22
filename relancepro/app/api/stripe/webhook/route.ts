import { NextResponse } from "next/server";
import { handleStripeEvent, verifyWebhook } from "@/lib/billing/stripe";
import { AppError } from "@/lib/app/context";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const payload = await req.text();
  let event;
  try { event = verifyWebhook(payload, req.headers.get("stripe-signature")); }
  catch (e) {
    const status = e instanceof AppError && e.code === "unavailable" ? 503 : 400;
    return NextResponse.json({ error: "Signature invalide" }, { status });
  }
  try {
    const result = await handleStripeEvent(event);
    return NextResponse.json({ received: true, result });
  } catch {
    return NextResponse.json({ error: "Traitement impossible, Stripe réessaiera" }, { status: 500 });
  }
}
