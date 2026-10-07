import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { StatCard } from '@/components/admin/FormKit';
import { AppImage, AppText, PressableScale, Screen, ScreenHeader, Skeleton } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAdminStats } from '@/features/admin/hooks';
import { formatCount, formatPrice } from '@/lib/format';

const SECTIONS: { href: '/admin/products' | '/admin/drops' | '/admin/catalog' | '/admin/orders' | '/admin/users'; icon: keyof typeof Ionicons.glyphMap; label: string; hint: string }[] = [
  { href: '/admin/products', icon: 'cube-outline', label: 'Produits', hint: 'Créer, modifier, médias' },
  { href: '/admin/drops', icon: 'flash-outline', label: 'Drops', hint: 'Planifier et associer' },
  { href: '/admin/catalog', icon: 'pricetags-outline', label: 'Catégories & marques', hint: 'Référentiels' },
  { href: '/admin/orders', icon: 'receipt-outline', label: 'Commandes', hint: 'Suivi et statuts' },
  { href: '/admin/users', icon: 'people-outline', label: 'Utilisateurs', hint: 'Comptes et rôles' },
];

export default function AdminDashboard() {
  const stats = useAdminStats();
  const s = stats.data;
  const maxDay = Math.max(1, ...(s?.salesByDay ?? []).map((d) => d.total));

  return (
    <Screen wide>
      <ScreenHeader title="Administration" />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={stats.isRefetching} onRefresh={stats.refetch} tintColor={COLORS.primaryBright} />}>
        {stats.isLoading ? (
          <Skeleton height={110} radius={RADIUS.lg} />
        ) : stats.error ? (
          <AppText color={COLORS.danger}>Statistiques indisponibles : {(stats.error as Error).message}</AppText>
        ) : s ? (
          <View style={styles.stats}>
            <StatCard icon="cash-outline" label="Ventes" value={formatPrice(s.revenue)} />
            <StatCard icon="receipt-outline" label="Commandes" value={String(s.orders)} />
            <StatCard icon="people-outline" label="Utilisateurs" value={String(s.users)} />
            <StatCard icon="cube-outline" label="Produits actifs" value={String(s.products)} />
          </View>
        ) : null}

        <View style={styles.card}>
          <AppText variant="title">Ventes — 14 derniers jours</AppText>
          {s?.salesByDay.length ? (
            <View style={styles.chart}>
              {s.salesByDay.map((d) => (
                <View key={d.day} style={styles.barCol}>
                  <View style={[styles.bar, { height: `${(d.total / maxDay) * 100}%` }]} />
                  <AppText variant="small" color={COLORS.textMuted}>
                    {d.day.slice(8)}
                  </AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText variant="caption" color={COLORS.textSecondary}>
              Aucune vente sur la période.
            </AppText>
          )}
        </View>

        <View style={styles.columns}>
          <View style={[styles.card, styles.col]}>
            <AppText variant="title">Meilleures ventes</AppText>
            {(s?.topProducts ?? []).length ? (
              s!.topProducts.map((t, i) => (
                <View key={t.productId ?? i} style={styles.rankRow}>
                  <AppText style={styles.rank}>{i + 1}</AppText>
                  <AppText variant="bodyMedium" style={styles.flex} numberOfLines={1}>
                    {t.name}
                  </AppText>
                  <AppText variant="caption" color={COLORS.textSecondary}>
                    {t.quantity} · {formatPrice(t.revenue)}
                  </AppText>
                </View>
              ))
            ) : (
              <AppText variant="caption" color={COLORS.textSecondary}>
                Pas encore de ventes.
              </AppText>
            )}
          </View>
          <View style={[styles.card, styles.col]}>
            <AppText variant="title">Produits populaires</AppText>
            {(s?.popularProducts ?? []).map((p) => (
              <View key={p.id} style={styles.rankRow}>
                <AppImage uri={p.coverUrl} style={styles.thumb} />
                <AppText variant="bodyMedium" style={styles.flex} numberOfLines={1}>
                  {p.name}
                </AppText>
                <AppText variant="caption" color={COLORS.textSecondary}>
                  ♥ {formatCount(p.likesCount)}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.nav}>
          {SECTIONS.map((sec) => (
            <PressableScale key={sec.href} onPress={() => router.push(sec.href)} style={styles.navItem} accessibilityLabel={sec.label}>
              <Ionicons name={sec.icon} size={22} color={COLORS.primaryBright} />
              <AppText variant="bodyMedium">{sec.label}</AppText>
              <AppText variant="small" color={COLORS.textSecondary}>
                {sec.hint}
              </AppText>
            </PressableScale>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.lg, paddingBottom: SPACING.huge },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 },
  bar: { width: '100%', minHeight: 4, borderRadius: 4, backgroundColor: COLORS.primary },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.lg },
  col: { flexGrow: 1, flexBasis: 300 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rank: { width: 22, color: COLORS.primaryBright, fontWeight: '800' },
  thumb: { width: 36, height: 36, borderRadius: RADIUS.xs },
  flex: { flex: 1 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  navItem: { flexGrow: 1, flexBasis: 160, padding: SPACING.lg, gap: 4, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.primaryBorder },
});
