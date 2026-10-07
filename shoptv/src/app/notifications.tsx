import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, EmptyState, PressableScale, Screen, ScreenHeader } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useNotifications } from '@/features/account/hooks';
import { formatRelative } from '@/lib/format';
import { markAllNotificationsRead } from '@/services/notifications';
import { useSession } from '@/store/session';
import type { AppNotification, NotificationType } from '@/types/models';

const ICONS: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  drop_soon: 'alarm-outline',
  drop_live: 'flash',
  price_drop: 'trending-down',
  back_in_stock: 'cube-outline',
  order: 'receipt-outline',
  shipping: 'bus-outline',
  promotion: 'pricetag-outline',
};

function open(n: AppNotification) {
  if (n.data.dropId) router.push(`/drop/${n.data.dropId}`);
  else if (n.data.orderId) router.push(`/orders/${n.data.orderId}`);
  else if (n.data.slug || n.data.productId) router.push(`/product/${n.data.slug ?? n.data.productId}`);
}

export default function NotificationsScreen() {
  const status = useSession((s) => s.status);
  const notifications = useNotifications();
  const client = useQueryClient();
  if (status === 'signedOut') return <Redirect href="/login" />;
  const unread = (notifications.data ?? []).some((n) => !n.readAt);

  const readAll = async () => {
    await markAllNotificationsRead();
    client.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        right={
          unread ? (
            <AppText variant="caption" color={COLORS.link} onPress={readAll}>
              Tout lire
            </AppText>
          ) : (
            <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} onPress={() => router.push('/settings')} />
          )
        }
      />
      <FlatList
        data={notifications.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={notifications.refetch} tintColor={COLORS.primaryBright} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Rien de neuf pour l’instant"
            message="Drops imminents, baisses de prix, retours en stock, commandes et livraisons apparaîtront ici."
            actionLabel="Gérer mes notifications"
            onAction={() => router.push('/settings')}
          />
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 40)}>
            <PressableScale onPress={() => open(item)} scaleTo={0.98} style={[styles.item, !item.readAt && styles.unread]} accessibilityLabel={item.title}>
              <View style={styles.icon}>
                <Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={20} color={COLORS.primaryBright} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">{item.title}</AppText>
                {item.body ? (
                  <AppText variant="caption" color={COLORS.textSecondary}>
                    {item.body}
                  </AppText>
                ) : null}
                <AppText variant="small" color={COLORS.textMuted} style={styles.time}>
                  {formatRelative(item.createdAt)}
                </AppText>
              </View>
              {!item.readAt ? <View style={styles.dot} /> : null}
            </PressableScale>
          </Animated.View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.screen, gap: SPACING.sm },
  item: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  unread: { borderColor: COLORS.primaryBorder },
  icon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  flex: { flex: 1, gap: 2 },
  time: { marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.fuchsia, marginTop: 6 },
});
