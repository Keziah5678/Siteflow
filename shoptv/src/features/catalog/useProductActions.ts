import { useCallback } from 'react';

import { toast } from '@/components/ui/Toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { shareProduct } from '@/lib/share';
import { incrementShare } from '@/services/catalog';
import { addToCart, toggleFavorite, toggleLike } from '@/services/user-data';
import { useLibrary } from '@/store/library';
import type { FavoriteKind, Product } from '@/types/models';

/**
 * Actions sociales d'un produit avec garde d'authentification :
 * les invités peuvent tout regarder, un compte est requis pour sauvegarder.
 */
export function useProductActions(product: Product | null | undefined) {
  const requireAuth = useRequireAuth();
  const id = product?.id ?? '';
  const liked = useLibrary((s) => s.likes.includes(id));
  const favorite = useLibrary((s) => s.favorites.some((f) => f.productId === id && f.kind === 'product'));
  const savedVideo = useLibrary((s) => s.favorites.some((f) => f.productId === id && f.kind === 'video'));

  const like = useCallback(() => {
    if (!product) return;
    requireAuth(() => toggleLike(product.id, product.categoryId).catch(() => toast('Action impossible, réessayez.', 'error')), 'like');
  }, [product, requireAuth]);

  const favoriteToggle = useCallback(
    (kind: FavoriteKind = 'product') => {
      if (!product) return;
      requireAuth(
        () =>
          toggleFavorite(product.id, kind, product.categoryId)
            .then((added) =>
              toast(
                added ? (kind === 'video' ? 'Vidéo sauvegardée' : 'Ajouté aux favoris') : kind === 'video' ? 'Vidéo retirée' : 'Retiré des favoris',
                'success',
              ),
            )
            .catch(() => toast('Action impossible, réessayez.', 'error')),
        'favorite',
      );
    },
    [product, requireAuth],
  );

  const share = useCallback(async () => {
    if (!product) return;
    const done = await shareProduct(product);
    if (done) incrementShare(product.id).catch(() => undefined);
  }, [product]);

  const addToCartWithFeedback = useCallback(
    async (variantId: string | null = null) => {
      if (!product) return;
      if (product.stock <= 0) {
        toast('Produit en rupture de stock', 'error');
        return;
      }
      try {
        await addToCart(product.id, variantId);
        toast(`${product.name} ajouté au panier`, 'success');
      } catch {
        toast('Panier non synchronisé, réessayez.', 'error');
      }
    },
    [product],
  );

  return { liked, favorite, savedVideo, like, toggleFavorite: favoriteToggle, share, addToCart: addToCartWithFeedback };
}
