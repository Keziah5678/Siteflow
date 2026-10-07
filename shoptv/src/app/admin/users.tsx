import { FlatList, StyleSheet, View } from 'react-native';

import { AppImage, AppText, Screen, ScreenHeader, Skeleton } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useAdminUsers } from '@/features/admin/hooks';

/** Liste des comptes. La promotion admin se fait en SQL (voir README) pour éviter toute escalade depuis l'app. */
export default function AdminUsers() {
  const users = useAdminUsers();
  return (
    <Screen wide>
      <ScreenHeader title={`Utilisateurs${users.data ? ` (${users.data.length})` : ''}`} />
      <FlatList
        data={users.data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={users.isLoading ? <Skeleton height={60} radius={RADIUS.md} /> : <AppText color={COLORS.textSecondary}>Aucun utilisateur.</AppText>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              {item.avatarUrl ? <AppImage uri={item.avatarUrl} style={StyleSheet.absoluteFill} /> : <AppText style={styles.initial}>{(item.fullName || item.email).slice(0, 1).toUpperCase()}</AppText>}
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">{item.fullName || '—'}</AppText>
              <AppText variant="small" color={COLORS.textSecondary}>
                {item.email}
              </AppText>
            </View>
            {item.role === 'admin' ? (
              <View style={styles.badge}>
                <AppText variant="small">Admin</AppText>
              </View>
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: SPACING.screen, gap: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  initial: { fontFamily: FONTS.bold, color: COLORS.primaryBright },
  flex: { flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryBorder },
});
