import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppImage, AppText, EmptyState, PressableScale, Screen, ScreenHeader, Skeleton } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useOrders } from '@/features/account/hooks';
import { STATUS_COLOR } from '@/features/account/orderStatus';
import { formatDate, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABEL } from '@/services/orders';
import { useSession } from '@/store/session';


export default function OrdersScreen() {
  const status = useSession((s) => s.status);
  const orders = useOrders();
  if (status === 'signedOut') return <Redirect href="/login" />;

  return (
    <Screen>
      <ScreenHeader title="Commandes" />
      <FlatList
        data={orders.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={orders.isRefetching} onRefresh={orders.refetch} tintColor={COLORS.primaryBright} />}
        ListEmptyComponent={
          orders.isLoading ? (
            <Skeleton height={110} radius={RADIUS.lg} />
          ) : (
            <EmptyState icon="receipt-outline" title="Aucune commande" message="Tes commandes apparaîtront ici." actionLabel="Commencer mon shopping" onAction={() => router.replace('/home')} />
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 50)}>
            <PressableScale onPress={() => router.push(`/orders/${item.id}`)} scaleTo={0.98} style={styles.card} accessibilityLabel={`Commande ${item.number}`}>
              <View style={styles.head}>
                <AppText variant="title">{item.number}</AppText>
                <View style={[styles.badge, { borderColor: STATUS_COLOR[item.status] }]}>
                  <AppText variant="small" color={STATUS_COLOR[item.status]}>
                    {ORDER_STATUS_LABEL[item.status]}
                  </AppText>
                </View>
              </View>
              <View style={styles.thumbs}>
                {item.items.slice(0, 4).map((it) => (
                  <AppImage key={it.id} uri={it.productImage} style={styles.thumb} />
                ))}
                {item.items.length > 4 ? <AppText variant="caption">+{item.items.length - 4}</AppText> : null}
              </View>
              <View style={styles.head}>
                <AppText variant="caption" color={COLORS.textSecondary}>
                  {formatDate(item.createdAt)} · {item.items.reduce((s, i) => s + i.quantity, 0)} article(s)
                </AppText>
                <View style={styles.total}>
                  <AppText variant="bodyMedium">{formatPrice(item.total)}</AppText>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                </View>
              </View>
            </PressableScale>
          </Animated.View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.screen, gap: SPACING.md },
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
  thumbs: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  thumb: { width: 52, height: 52, borderRadius: RADIUS.sm },
  total: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
