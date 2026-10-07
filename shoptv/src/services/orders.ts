import { uid } from '@/lib/slug';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/store/cart';
import { useDemoAccount } from '@/store/demo-account';
import { useSession } from '@/store/session';
import type { Address, CartLine, Order, Product } from '@/types/models';

import { getProductsByIds } from './catalog';
import { demoDb } from './demo-db';
import { mapOrder } from './mappers';
import { pushLocalNotification } from './notifications';
import { trackEvent } from './user-data';

export const FREE_SHIPPING_THRESHOLD = 50;
export const SHIPPING_FEE = 4.99;

export interface CartSummaryLine extends CartLine {
  product: Product;
  variantLabel: string | null;
  lineTotal: number;
}

export interface CartSummary {
  lines: CartSummaryLine[];
  subtotal: number;
  shipping: number;
  total: number;
  savings: number;
}

/** Même règle que la fonction SQL place_order (calcul indicatif côté client). */
export function computeShipping(subtotal: number): number {
  return subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

export async function buildCartSummary(lines: CartLine[]): Promise<CartSummary> {
  const products = await getProductsByIds([...new Set(lines.map((l) => l.productId))]);
  const summaryLines: CartSummaryLine[] = [];
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) continue;
    const variant = product.variants.find((v) => v.id === line.variantId);
    summaryLines.push({
      ...line,
      product,
      variantLabel: variant ? `${variant.label} : ${variant.value}` : null,
      lineTotal: product.price * line.quantity,
    });
  }
  const subtotal = round(summaryLines.reduce((s, l) => s + l.lineTotal, 0));
  const savings = round(summaryLines.reduce((s, l) => s + ((l.product.compareAtPrice ?? l.product.price) - l.product.price) * l.quantity, 0));
  const shipping = computeShipping(subtotal);
  return { lines: summaryLines, subtotal, shipping, total: round(subtotal + shipping), savings };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Passe commande. Avec Supabase, le serveur recalcule prix et stock
 * (RPC `place_order`) : le client n'envoie que l'adresse.
 * Le paiement Stripe s'insère ici (voir README « Activer Stripe »).
 */
export async function placeOrder(address: Address, paymentMethod: string): Promise<string> {
  const { profile, isDemo } = useSession.getState();
  if (!profile) throw new Error('Connectez-vous pour commander.');

  if (!supabase || isDemo) {
    const summary = await buildCartSummary(useCart.getState().lines);
    if (!summary.lines.length) throw new Error('Votre panier est vide.');
    for (const l of summary.lines) {
      if (l.product.stock < l.quantity) throw new Error(`Stock insuffisant pour ${l.product.name}.`);
    }
    const orderId = uid();
    const order: Order = {
      id: orderId,
      userId: profile.id,
      number: `STV-${10000 + useDemoAccount.getState().orders.length + 1}`,
      status: 'paid',
      subtotal: summary.subtotal,
      shipping: summary.shipping,
      total: summary.total,
      shippingAddress: address,
      paymentMethod,
      createdAt: new Date().toISOString(),
      items: summary.lines.map((l) => ({
        id: uid(),
        orderId,
        productId: l.productId,
        productName: l.product.name,
        productImage: l.product.coverUrl,
        variantLabel: l.variantLabel,
        unitPrice: l.product.price,
        quantity: l.quantity,
      })),
    };
    for (const l of summary.lines) {
      const p = demoDb.products.find((x) => x.id === l.productId);
      if (p) p.stock -= l.quantity;
      trackEvent({ type: 'purchase', productId: l.productId, categoryId: l.product.categoryId });
    }
    useDemoAccount.getState().addOrder(order);
    pushLocalNotification('order', 'Paiement confirmé', `Commande ${order.number}`, { orderId });
    useCart.getState().clear();
    return orderId;
  }

  const { data, error } = await supabase.rpc('place_order', { p_address: address, p_payment_method: paymentMethod });
  if (error) throw new Error(error.message);
  useCart.getState().clear();
  return data as string;
}

export async function listOrders(): Promise<Order[]> {
  const { isDemo, userId } = useSession.getState();
  if (!userId) return [];
  if (!supabase || isDemo) return useDemoAccount.getState().orders;
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapOrder);
}

export async function getOrder(id: string): Promise<Order | null> {
  const { isDemo } = useSession.getState();
  if (!supabase || isDemo) return useDemoAccount.getState().orders.find((o) => o.id === id) ?? null;
  const { data, error } = await supabase.from('orders').select('*, items:order_items(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

export const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'En attente de paiement',
  paid: 'Payée',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};

export const ORDER_STEPS: Order['status'][] = ['paid', 'preparing', 'shipped', 'delivered'];
