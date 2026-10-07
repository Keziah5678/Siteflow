import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { SummaryRows } from '@/components/product/SummaryRows';
import { AppImage, AppText, EmptyState, GlowCard, GradientButton, PressableScale, Screen, ScreenHeader, Skeleton, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useOrder } from '@/features/account/hooks';
import { STATUS_COLOR } from '@/features/account/orderStatus';
import { qk } from '@/lib/query';
import { formatDate, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL, ORDER_STEPS } from '@/services/orders';
import { isOnlinePaymentEnabled, PAYMENT_METHODS, payOrder } from '@/services/payments';

export default function OrderDetailScreen() {
  const { id, success, paid } = useLocalSearchParams<{ id: string; success?: string; paid?: string }>();
  const order = useOrder(id);
  const client = useQueryClient();
  const [paying, setPaying] = useState(false);
  const o = order.data;

  const pay = async () => {
    if (!o) return;
    setPaying(true);
    try {
      const outcome = await payOrder(o.id);
      if (outcome === 'paid') toast('Paiement confirmé 🎉', 'success');
      await client.invalidateQueries({ queryKey: qk.order(o.id) });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Paiement impossible', 'error');
    } finally {
      setPaying(false);
    }
  };

  if (order.isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Commande" />
        <View style={styles.scroll}>
          <Skeleton height={140} radius={RADIUS.lg} />
        </View>
      </Screen>
    );
  }
  if (!o) {
    return (
      <Screen>
        <ScreenHeader title="Commande" />
        <EmptyState icon="receipt-outline" title="Commande introuvable" actionLabel="Mes commandes" onAction={() => router.replace('/orders')} />
      </Screen>
    );
  }

  const stepIndex = ORDER_STEPS.indexOf(o.status);
  const method = PAYMENT_METHODS.find((m) => m.id === o.paymentMethod)?.label ?? o.paymentMethod;

  return (
    <Screen>
      <ScreenHeader title={o.number} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {success || paid === '1' ? (
          <Animated.View entering={ZoomIn.springify()}>
            <GlowCard animated radius={RADIUS.xl} contentStyle={styles.success}>
              <Ionicons name="checkmark-circle" size={44} color={COLORS.success} />
              <AppText variant="h3" align="center">
                Merci pour ta commande !
              </AppText>
              <AppText variant="caption" color={COLORS.textSecondary} align="center">
                Tu recevras une notification à chaque étape de la livraison.
              </AppText>
            </GlowCard>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown} style={styles.card}>
          <View style={styles.row}>
            <AppText variant="title">Statut</AppText>
            <AppText variant="bodyMedium" color={STATUS_COLOR[o.status]}>
              {ORDER_STATUS_LABEL[o.status]}
            </AppText>
          </View>
          {o.status !== 'cancelled' ? (
            <View style={styles.timeline}>
              {ORDER_STEPS.map((s, i) => {
                const done = stepIndex >= i;
                return (
                  <View key={s} style={styles.step}>
                    <View style={[styles.dot, done && styles.dotDone]}>{done ? <Ionicons name="checkmark" size={12} color={COLORS.text} /> : null}</View>
                    {i < ORDER_STEPS.length - 1 ? <View style={[styles.bar, stepIndex > i && styles.barDone]} /> : null}
                    <AppText variant="small" color={done ? COLORS.text : COLORS.textMuted} style={styles.stepLabel}>
                      {ORDER_STATUS_LABEL[s]}
                    </AppText>
                  </View>
                );
              })}
            </View>
          ) : null}
          {o.status === 'pending' && isOnlinePaymentEnabled() ? <GradientButton label="Payer maintenant" icon="card-outline" size="md" loading={paying} onPress={pay} /> : null}
        </Animated.View>

        <View style={styles.card}>
          <AppText variant="title">Articles</AppText>
          {o.items.map((it) => (
            <PressableScale key={it.id} onPress={() => router.push(`/product/${it.productId}`)} style={styles.item} accessibilityLabel={it.productName}>
              <AppImage uri={it.productImage} style={styles.itemImg} />
              <View style={styles.flex}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {it.productName}
                </AppText>
                <AppText variant="small" color={COLORS.textSecondary}>
                  {it.variantLabel ? `${it.variantLabel} · ` : ''}Qté {it.quantity}
                </AppText>
              </View>
              <AppText variant="bodyMedium">{formatPrice(it.unitPrice * it.quantity)}</AppText>
            </PressableScale>
          ))}
        </View>

        <View style={styles.card}>
          <AppText variant="title">Livraison</AppText>
          <AppText variant="body" color={COLORS.textSecondary}>
            {o.shippingAddress.fullName}
            {'\n'}
            {o.shippingAddress.line1}
            {o.shippingAddress.line2 ? `\n${o.shippingAddress.line2}` : ''}
            {'\n'}
            {o.shippingAddress.postalCode} {o.shippingAddress.city}, {o.shippingAddress.country}
          </AppText>
          <AppText variant="small" color={COLORS.textMuted}>
            Commandé le {formatDate(o.createdAt)} · {method}
          </AppText>
        </View>

        <SummaryRows subtotal={o.subtotal} shipping={o.shipping} total={o.total} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.lg, paddingBottom: SPACING.huge },
  success: { padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm },
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeline: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.borderStrong, zIndex: 1 },
  dotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryBright },
  bar: { position: 'absolute', top: 11, left: '50%', width: '100%', height: 2, backgroundColor: COLORS.borderStrong },
  barDone: { backgroundColor: COLORS.primaryBright },
  stepLabel: { marginTop: 6, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  itemImg: { width: 52, height: 52, borderRadius: RADIUS.sm },
  flex: { flex: 1 },
});
