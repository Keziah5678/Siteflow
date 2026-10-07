/**
 * Paiement. Architecture prête pour Stripe sans clé secrète dans l'app :
 *  1. la commande est créée côté serveur (RPC place_order, statut « pending ») ;
 *  2. l'Edge Function `create-checkout-session` (clé secrète côté serveur)
 *     crée une session Stripe Checkout et renvoie son URL ;
 *  3. l'app ouvre la page de paiement sécurisée ;
 *  4. le webhook `stripe-webhook` passe la commande en « paid ».
 * Sans Stripe configuré, la commande reste « En attente de paiement »
 * (ou est simulée comme payée en mode démo local).
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { isStripeConfigured } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type PaymentMethodId = 'card' | 'apple_pay' | 'google_pay' | 'paypal';

export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; icon: 'card-outline' | 'logo-apple' | 'logo-google' | 'wallet-outline' }[] = [
  { id: 'card', label: 'Carte bancaire', icon: 'card-outline' },
  { id: 'apple_pay', label: 'Apple Pay', icon: 'logo-apple' },
  { id: 'google_pay', label: 'Google Pay', icon: 'logo-google' },
  { id: 'paypal', label: 'PayPal', icon: 'wallet-outline' },
];

export const isOnlinePaymentEnabled = () => isStripeConfigured && !!supabase;

export type PaymentOutcome = 'paid' | 'pending' | 'cancelled';

export async function payOrder(orderId: string): Promise<PaymentOutcome> {
  if (!isOnlinePaymentEnabled()) return 'pending';
  const returnUrl = Linking.createURL(`/orders/${orderId}`);
  const { data, error } = await supabase!.functions.invoke<{ url: string }>('create-checkout-session', {
    body: { orderId, successUrl: `${returnUrl}?paid=1`, cancelUrl: `${returnUrl}?paid=0` },
  });
  if (error || !data?.url) throw new Error('Paiement indisponible pour le moment.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
  if (result.type !== 'success') return 'cancelled';
  return result.url.includes('paid=1') ? 'paid' : 'cancelled';
}
