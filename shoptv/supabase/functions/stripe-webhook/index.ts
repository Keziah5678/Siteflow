// Edge Function Supabase (Deno) — webhook Stripe : marque la commande payée.
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (SUPABASE_SERVICE_ROLE_KEY est fourni par Supabase).
// Déploiement : supabase functions deploy stripe-webhook --no-verify-jwt
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
  } catch {
    return new Response('Signature invalide', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId && session.payment_status === 'paid') {
      await admin
        .from('orders')
        .update({ status: 'paid', stripe_payment_intent_id: String(session.payment_intent ?? '') })
        .eq('id', orderId)
        .eq('status', 'pending');
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
