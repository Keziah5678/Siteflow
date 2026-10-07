import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AppImage, AppText, GradientButton, PressableScale, Screen, ScreenHeader, Skeleton, TextField, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAdminProducts } from '@/features/admin/hooks';
import { confirmAction } from '@/lib/confirm';
import { formatPrice } from '@/lib/format';
import { deleteProduct } from '@/services/admin';

export default function AdminProducts() {
  const products = useAdminProducts();
  const client = useQueryClient();
  const [q, setQ] = useState('');
  const list = useMemo(() => (products.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase())), [products.data, q]);

  const remove = (id: string, name: string) =>
    confirmAction('Supprimer le produit', `« ${name} » sera définitivement supprimé.`, async () => {
      try {
        await deleteProduct(id);
        await client.invalidateQueries();
        toast('Produit supprimé', 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Suppression impossible', 'error');
      }
    });

  return (
    <Screen wide>
      <ScreenHeader title="Produits" right={<GradientButton label="Nouveau" icon="add" size="sm" onPress={() => router.push('/admin/product/new')} />} />
      <View style={styles.pad}>
        <TextField icon="search-outline" placeholder="Filtrer les produits…" value={q} onChangeText={setQ} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={products.isLoading ? <Skeleton height={70} radius={RADIUS.md} /> : <AppText color={COLORS.textSecondary}>Aucun produit.</AppText>}
        renderItem={({ item }) => (
          <PressableScale onPress={() => router.push(`/admin/product/${item.id}`)} scaleTo={0.99} style={styles.row} accessibilityLabel={`Modifier ${item.name}`}>
            <AppImage uri={item.coverUrl} style={styles.thumb} />
            <View style={styles.flex}>
              <AppText variant="bodyMedium" numberOfLines={1}>
                {item.name}
              </AppText>
              <AppText variant="small" color={COLORS.textSecondary}>
                {formatPrice(item.price)} · stock {item.stock} · {item.category?.name ?? '—'}
                {item.isActive ? '' : ' · inactif'}
              </AppText>
            </View>
            <PressableScale onPress={() => remove(item.id, item.name)} hitSlop={8} accessibilityLabel="Supprimer">
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </PressableScale>
          </PressableScale>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: SPACING.screen },
  list: { padding: SPACING.screen, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  thumb: { width: 52, height: 52, borderRadius: RADIUS.sm },
  flex: { flex: 1 },
});
