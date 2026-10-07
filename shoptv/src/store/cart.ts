import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CartLine } from '@/types/models';

import { persistStorage } from './storage';

export const MAX_QUANTITY = 20;

const sameLine = (a: Pick<CartLine, 'productId' | 'variantId'>, b: Pick<CartLine, 'productId' | 'variantId'>) =>
  a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);

interface CartState {
  lines: CartLine[];
  add: (productId: string, variantId?: string | null, quantity?: number) => CartLine;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  replaceAll: (lines: CartLine[]) => void;
  clear: () => void;
}

/**
 * Panier local (source de vérité côté UI, persistant).
 * La synchronisation Supabase pour les utilisateurs connectés est assurée
 * par `services/cart-sync.ts` (écriture immédiate + fusion à la connexion).
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (productId, variantId = null, quantity = 1) => {
        const existing = get().lines.find((l) => sameLine(l, { productId, variantId }));
        const next: CartLine = {
          productId,
          variantId,
          quantity: Math.min(MAX_QUANTITY, (existing?.quantity ?? 0) + quantity),
        };
        set({
          lines: existing
            ? get().lines.map((l) => (sameLine(l, next) ? next : l))
            : [...get().lines, next],
        });
        return next;
      },
      setQuantity: (productId, variantId, quantity) => {
        const q = Math.max(0, Math.min(MAX_QUANTITY, quantity));
        set({
          lines:
            q === 0
              ? get().lines.filter((l) => !sameLine(l, { productId, variantId }))
              : get().lines.map((l) => (sameLine(l, { productId, variantId }) ? { ...l, quantity: q } : l)),
        });
      },
      remove: (productId, variantId) => set({ lines: get().lines.filter((l) => !sameLine(l, { productId, variantId })) }),
      replaceAll: (lines) => set({ lines }),
      clear: () => set({ lines: [] }),
    }),
    { name: 'shoptv-cart', storage: persistStorage },
  ),
);

export const selectCartCount = (s: CartState) => s.lines.reduce((sum, l) => sum + l.quantity, 0);
