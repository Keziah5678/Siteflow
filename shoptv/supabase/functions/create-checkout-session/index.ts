// Edge Function Supabase (Deno) — crée une session Stripe Checkout pour une commande.
// Secrets requis (jamais dans l'app) :
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_… 
// Déploiement : supabase functions deploy create-checkout-session
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { orderId, successUrl, cancelUrl } = await req.json();
    // Client lié au JWT de l'utilisateur : la RLS garantit qu'il ne lit que SES commandes.
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, number, status, shipping, order_items(product_name, unit_price, quantity, product_image)')
      .eq('id', orderId)
      .single();
    if (error || !order) return new Response(JSON.stringify({ error: 'Commande introuvable' }), { status: 404, headers: cors });
    if (order.status !== 'pending') return new Response(JSON.stringify({ error: 'Commande déjà réglée' }), { status: 409, headers: cors });

    const lineItems = order.order_items.map((it: { product_name: string; unit_price: number; quantity: number; product_image: string }) => ({
      quantity: it.quantity,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(Number(it.unit_price) * 100),
        product_data: { name: it.product_name, images: it.product_image?.startsWith('http') ? [it.product_image] : [] },
      },
    }));
    if (Number(order.shipping) > 0) {
      lineItems.push({ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(Number(order.shipping) * 100), product_data: { name: 'Livraison', images: [] } } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: order.id,
      metadata: { order_id: order.id, order_number: order.number },
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
