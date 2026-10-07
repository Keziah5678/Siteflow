import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppImage, AppText, GradientButton, PressableScale, Screen, ScreenHeader, Skeleton, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useDrops } from '@/features/drops/hooks';
import { useNow } from '@/hooks/useNow';
import { confirmAction } from '@/lib/confirm';
import { DROP_STATUS_LABEL, getDropStatus } from '@/lib/drops';
import { formatDropMoment } from '@/lib/format';
import { deleteDrop } from '@/services/drops';

export default function AdminDrops() {
  const drops = useDrops();
  const client = useQueryClient();
  const now = useNow();

  const remove = (id: string, title: string) =>
    confirmAction('Supprimer le drop', `« ${title} » sera supprimé.`, async () => {
      try {
        await deleteDrop(id);
        await client.invalidateQueries();
        toast('Drop supprimé', 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Suppression impossible', 'error');
      }
    });

  return (
    <Screen wide>
      <ScreenHeader title="Drops" right={<GradientButton label="Nouveau" icon="add" size="sm" onPress={() => router.push('/admin/drop/new')} />} />
      <FlatList
        data={drops.data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={drops.isLoading ? <Skeleton height={70} radius={RADIUS.md} /> : <AppText color={COLORS.textSecondary}>Aucun drop.</AppText>}
        renderItem={({ item }) => {
          const status = getDropStatus(item, now);
          return (
            <PressableScale onPress={() => router.push(`/admin/drop/${item.id}`)} scaleTo={0.99} style={styles.row} accessibilityLabel={`Modifier ${item.title}`}>
              <AppImage uri={item.imageUrl} style={styles.thumb} />
              <View style={styles.flex}>
                <AppText variant="bodyMedium">
                  {item.title}
                  {item.isMega ? ' · MEGA' : ''}
                </AppText>
                <AppText variant="small" color={COLORS.textSecondary}>
                  {DROP_STATUS_LABEL[status]} · {formatDropMoment(item.startsAt)} · {item.productIds.length} produits
                </AppText>
              </View>
              <PressableScale onPress={() => remove(item.id, item.title)} hitSlop={8} accessibilityLabel="Supprimer">
                <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
              </PressableScale>
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.screen, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  thumb: { width: 52, height: 52, borderRadius: RADIUS.sm },
  flex: { flex: 1 },
});
