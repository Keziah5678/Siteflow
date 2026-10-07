/**
 * Données personnelles : favoris, likes, drops suivis, panier, événements.
 * Stratégie : mise à jour optimiste du store local, puis écriture Supabase
 * si l'utilisateur est connecté (retour arrière en cas d'erreur).
 */
import { supabase } from '@/lib/supabase';
import { useCart } from '@/store/cart';
import { useLibrary } from '@/store/library';
import { useSession } from '@/store/session';
import type { CartLine, FavoriteKind, FavoriteRef, UserEvent } from '@/types/models';

import { demoDb } from './demo-db';

function remoteUserId(): string | null {
  const { userId, isDemo } = useSession.getState();
  return supabase && userId && !isDemo ? userId : null;
}

async function withRollback(apply: () => void, rollback: () => void, remote: () => Promise<{ error: unknown } | void>) {
  apply();
  try {
    const res = await remote();
    if (res && res.error) throw res.error;
  } catch (e) {
    rollback();
    throw e;
  }
}

// ───────────── Favoris

export async function toggleFavorite(productId: string, kind: FavoriteKind = 'product', categoryId?: string | null): Promise<boolean> {
  const lib = useLibrary.getState();
  const next = !lib.isFavorite(productId, kind);
  const uid = remoteUserId();
  await withRollback(
    () => lib.setFavorite(productId, kind, next),
    () => useLibrary.getState().setFavorite(productId, kind, !next),
    async () => {
      if (!uid) return;
      return next
        ? supabase!.from('favorites').upsert({ user_id: uid, product_id: productId, kind })
        : supabase!.from('favorites').delete().match({ user_id: uid, product_id: productId, kind });
    },
  );
  if (next) trackEvent({ type: 'favorite', productId, categoryId });
  return next;
}

// ───────────── Likes

export async function toggleLike(productId: string, categoryId?: string | null): Promise<boolean> {
  const lib = useLibrary.getState();
  const next = !lib.likes.includes(productId);
  const uid = remoteUserId();
  await withRollback(
    () => {
      lib.setLike(productId, next);
      if (!supabase) {
        const p = demoDb.products.find((x) => x.id === productId);
        if (p) p.likesCount += next ? 1 : -1;
      }
    },
    () => useLibrary.getState().setLike(productId, !next),
    async () => {
      if (!uid) return;
      return next
        ? supabase!.from('likes').upsert({ user_id: uid, product_id: productId })
        : supabase!.from('likes').delete().match({ user_id: uid, product_id: productId });
    },
  );
  if (next) trackEvent({ type: 'like', productId, categoryId });
  return next;
}

// ───────────── Drops suivis (« Me le rappeler »)

export async function toggleDropFollow(dropId: string): Promise<boolean> {
  const lib = useLibrary.getState();
  const next = !lib.followedDrops.includes(dropId);
  const uid = remoteUserId();
  await withRollback(
    () => lib.setFollow(dropId, next),
    () => useLibrary.getState().setFollow(dropId, !next),
    async () => {
      if (!uid) return;
      return next
        ? supabase!.from('drop_follows').upsert({ user_id: uid, drop_id: dropId })
        : supabase!.from('drop_follows').delete().match({ user_id: uid, drop_id: dropId });
    },
  );
  return next;
}

// ───────────── Panier

export async function addToCart(productId: string, variantId: string | null = null, quantity = 1): Promise<void> {
  const line = useCart.getState().add(productId, variantId, quantity);
  await pushCartLine(line);
}

export async function setCartQuantity(productId: string, variantId: string | null, quantity: number): Promise<void> {
  useCart.getState().setQuantity(productId, variantId, quantity);
  if (quantity <= 0) return removeRemoteCartLine(productId, variantId);
  await pushCartLine({ productId, variantId, quantity });
}

export async function removeFromCart(productId: string, variantId: string | null): Promise<void> {
  useCart.getState().remove(productId, variantId);
  await removeRemoteCartLine(productId, variantId);
}

async function pushCartLine(line: CartLine) {
  const uid = remoteUserId();
  if (!uid) return;
  const { error } = await supabase!
    .from('cart_items')
    .upsert(
      { user_id: uid, product_id: line.productId, variant_id: line.variantId ?? '', quantity: line.quantity },
      { onConflict: 'user_id,product_id,variant_id' },
    );
  if (error) throw error;
}

async function removeRemoteCartLine(productId: string, variantId: string | null) {
  const uid = remoteUserId();
  if (!uid) return;
  const { error } = await supabase!.from('cart_items').delete().match({ user_id: uid, product_id: productId, variant_id: variantId ?? '' });
  if (error) throw error;
}

// ───────────── Événements (recommandation)

const pendingEvents: UserEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function trackEvent(event: Omit<UserEvent, 'at'>): void {
  useLibrary.getState().pushEvent(event);
  const uid = remoteUserId();
  if (!uid) return;
  pendingEvents.push({ ...event, at: Date.now() });
  if (flushTimer) return;
  // Envoi groupé pour limiter les requêtes.
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const batch = pendingEvents.splice(0, pendingEvents.length);
    if (!batch.length) return;
    await supabase!.from('user_events').insert(
      batch.map((e) => ({
        user_id: uid,
        type: e.type,
        product_id: e.productId ?? null,
        category_id: e.categoryId ?? null,
        value: e.value ?? null,
      })),
    );
  }, 4000);
}

// ───────────── Synchronisation à la connexion

/**
 * Fusionne le panier invité avec le panier serveur, puis recharge
 * favoris, likes et drops suivis depuis Supabase.
 */
export async function syncUserData(userId: string): Promise<void> {
  if (!supabase) return;
  const localLines = useCart.getState().lines;
  if (localLines.length) {
    const { data: remote } = await supabase.from('cart_items').select('product_id, variant_id, quantity').eq('user_id', userId);
    const merged = localLines.map((l) => {
      const r = (remote ?? []).find((x) => x.product_id === l.productId && (x.variant_id || null) === (l.variantId ?? null));
      return { user_id: userId, product_id: l.productId, variant_id: l.variantId ?? '', quantity: Math.min(20, l.quantity + (r?.quantity ?? 0)) };
    });
    await supabase.from('cart_items').upsert(merged, { onConflict: 'user_id,product_id,variant_id' });
  }

  const [cart, favs, likes, follows] = await Promise.all([
    supabase.from('cart_items').select('product_id, variant_id, quantity').eq('user_id', userId).order('created_at'),
    supabase.from('favorites').select('product_id, kind').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('likes').select('product_id').eq('user_id', userId),
    supabase.from('drop_follows').select('drop_id').eq('user_id', userId),
  ]);

  if (!cart.error) {
    useCart.getState().replaceAll(
      (cart.data ?? []).map((r) => ({ productId: r.product_id, variantId: r.variant_id || null, quantity: r.quantity })),
    );
  }
  useLibrary.getState().hydrateFromServer({
    favorites: ((favs.data ?? []) as { product_id: string; kind: FavoriteKind }[]).map<FavoriteRef>((f) => ({ productId: f.product_id, kind: f.kind })),
    likes: (likes.data ?? []).map((l) => l.product_id as string),
    followedDrops: (follows.data ?? []).map((f) => f.drop_id as string),
  });
}

/** À la déconnexion : on vide les données liées au compte. */
export function clearUserData(): void {
  useLibrary.getState().resetUserData();
  useCart.getState().clear();
}
