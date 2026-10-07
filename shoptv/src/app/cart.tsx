import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuantityStepper } from '@/components/product/QuantityStepper';
import { SummaryRows } from '@/components/product/SummaryRows';
import { AppImage, AppText, EmptyState, GradientButton, PressableScale, Screen, ScreenHeader, Skeleton, toast } from '@/components/ui';
import { COLORS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';
import { useCartSummary } from '@/features/cart/hooks';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { formatPrice } from '@/lib/format';
import { removeFromCart, setCartQuantity } from '@/services/user-data';
import { selectCartCount, useCart } from '@/store/cart';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const summary = useCartSummary();
  const count = useCart(selectCartCount);
  const requireAuth = useRequireAuth();
  const lines = summary.data?.lines ?? [];

  const change = (productId: string, variantId: string | null, q: number) =>
    (q <= 0 ? removeFromCart(productId, variantId) : setCartQuantity(productId, variantId, q)).catch(() => toast('Panier non synchronisé', 'error'));

  return (
    <Screen>
      <ScreenHeader title={`Panier${count ? ` (${count})` : ''}`} />
      {summary.isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={96} radius={RADIUS.md} />
          <Skeleton height={96} radius={RADIUS.md} />
        </View>
      ) : !lines.length ? (
        <EmptyState icon="bag-handle-outline" title="Ton panier est vide" message="Découvre les produits du moment et les drops en cours." actionLabel="Découvrir" onAction={() => router.replace('/home')} />
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(l) => `${l.productId}:${l.variantId ?? ''}`}
            contentContainerStyle={[styles.pad, { paddingBottom: 340 }]}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 50)} exiting={FadeOut} layout={LinearTransition} style={styles.line}>
                <PressableScale onPress={() => router.push(`/product/${item.product.slug}`)} style={styles.thumb} accessibilityLabel={item.product.name}>
                  <AppImage uri={item.product.coverUrl} style={StyleSheet.absoluteFill} />
                </PressableScale>
                <View style={styles.lineInfo}>
                  <AppText variant="bodyMedium" numberOfLines={2}>
                    {item.product.name}
                  </AppText>
                  {item.variantLabel ? (
                    <AppText variant="small" color={COLORS.textSecondary}>
                      {item.variantLabel}
                    </AppText>
                  ) : null}
                  <View style={styles.lineBottom}>
                    <AppText variant="title" color={COLORS.primaryBright}>
                      {formatPrice(item.lineTotal)}
                    </AppText>
                    <QuantityStepper value={item.quantity} max={Math.min(20, item.product.stock)} onChange={(q) => change(item.productId, item.variantId, q)} />
                  </View>
                </View>
              </Animated.View>
            )}
          />
          <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.footerInner}>
              {summary.data ? <SummaryRows {...summary.data} /> : null}
              <GradientButton
                label="Passer commande"
                icon="lock-closed-outline"
                pulse
                onPress={() => requireAuth(() => router.push('/checkout'), 'checkout')}
              />
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SPACING.screen, gap: SPACING.md },
  line: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  thumb: { width: 84, height: 84, borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: COLORS.surface },
  lineInfo: { flex: 1, gap: 2 },
  lineBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: SPACING.md, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerInner: { width: '100%', maxWidth: LAYOUT.maxContentWidth, paddingHorizontal: SPACING.screen, gap: SPACING.md },
});
