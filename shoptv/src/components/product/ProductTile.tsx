import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppImage, AppText, DiscountBadge, PressableScale, PriceTag } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useProductActions } from '@/features/catalog/useProductActions';
import type { Product } from '@/types/models';

/** Tuile produit compacte (grilles, résultats, favoris, produits similaires). */
export const ProductTile = memo(function ProductTile({ product, width }: { product: Product; width: number }) {
  const { favorite, toggleFavorite } = useProductActions(product);
  return (
    <PressableScale container onPress={() => router.push(`/product/${product.slug}`)} scaleTo={0.97} style={{ width }} accessibilityLabel={product.name}>
      <View style={[styles.imageWrap, { height: width * 1.08 }]}>
        <AppImage uri={product.coverUrl} style={StyleSheet.absoluteFill} />
        <DiscountBadge value={product.discountPercentage} size="sm" style={styles.badge} />
        <PressableScale haptic onPress={() => toggleFavorite('product')} style={styles.fav} accessibilityLabel="Favori">
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={18} color={favorite ? COLORS.fuchsia : COLORS.text} />
        </PressableScale>
        {product.videoUrl ? (
          <View style={styles.video}>
            <Ionicons name="play" size={11} color={COLORS.text} />
          </View>
        ) : null}
      </View>
      <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>
        {product.name}
      </AppText>
      <PriceTag price={product.price} compareAt={product.compareAtPrice} size="sm" style={styles.price} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  imageWrap: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: { position: 'absolute', top: SPACING.sm, left: SPACING.sm },
  fav: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
  },
  video: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
  },
  name: { marginTop: SPACING.sm, fontSize: 14 },
  price: { marginTop: 2, gap: SPACING.sm },
});
