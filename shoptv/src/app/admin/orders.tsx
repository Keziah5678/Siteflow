import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppText, PressableScale, Screen, ScreenHeader, SelectSheet, Skeleton, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { STATUS_COLOR } from '@/features/account/orderStatus';
import { useAdminOrders } from '@/features/admin/hooks';
import { formatDate, formatPrice } from '@/lib/format';
import { updateOrderStatus } from '@/services/admin';
import { ORDER_STATUS_LABEL } from '@/services/orders';
import type { Order, OrderStatus } from '@/types/models';

const STATUSES = (Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => ({ value: s, label: ORDER_STATUS_LABEL[s] }));

export default function AdminOrders() {
  const orders = useAdminOrders();
  const client = useQueryClient();
  const [editing, setEditing] = useState<Order | null>(null);

  const change = async (status: OrderStatus) => {
    if (!editing) return;
    try {
      await updateOrderStatus(editing.id, status);
      await client.invalidateQueries();
      toast(`Commande ${editing.number} : ${ORDER_STATUS_LABEL[status]}`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Mise à jour impossible', 'error');
    }
  };

  return (
    <Screen wide>
      <ScreenHeader title="Commandes" />
      <FlatList
        data={orders.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={orders.isLoading ? <Skeleton height={70} radius={RADIUS.md} /> : <AppText color={COLORS.textSecondary}>Aucune commande.</AppText>}
        renderItem={({ item }) => (
          <PressableScale onPress={() => setEditing(item)} scaleTo={0.99} style={styles.row} accessibilityLabel={`Commande ${item.number}`}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">
                {item.number} · {item.shippingAddress?.fullName ?? ''}
              </AppText>
              <AppText variant="small" color={COLORS.textSecondary}>
                {formatDate(item.createdAt)} · {item.items.length} article(s) · {formatPrice(item.total)}
              </AppText>
            </View>
            <View style={[styles.badge, { borderColor: STATUS_COLOR[item.status] }]}>
              <AppText variant="small" color={STATUS_COLOR[item.status]}>
                {ORDER_STATUS_LABEL[item.status]}
              </AppText>
            </View>
          </PressableScale>
        )}
      />
      <SelectSheet visible={!!editing} title={`Statut — ${editing?.number ?? ''}`} options={STATUSES} value={editing?.status ?? 'pending'} onSelect={change} onClose={() => setEditing(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.screen, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  flex: { flex: 1, gap: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1 },
});
