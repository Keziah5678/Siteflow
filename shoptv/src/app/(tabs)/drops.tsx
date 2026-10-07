import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { DropRow } from '@/components/drop/DropRow';
import { AppText, EmptyState, Screen, Segmented, Skeleton } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useDrops } from '@/features/drops/hooks';
import { useDropReminder } from '@/features/drops/useDropReminder';
import { useNow } from '@/hooks/useNow';
import { groupDrops } from '@/services/drops';
import type { DropStatus } from '@/types/models';

export default function DropsScreen() {
  const drops = useDrops();
  const reminder = useDropReminder();
  const [tab, setTab] = useState<DropStatus>('live');
  // Les drops changent de section automatiquement à l'échéance (horloge partagée).
  const minute = Math.floor(useNow() / 15_000);
  const groups = useMemo(() => groupDrops(drops.data ?? [], minute * 15_000), [drops.data, minute]);
  const activeTab = tab === 'live' && !groups.live.length && groups.upcoming.length && !drops.isLoading ? 'upcoming' : tab;

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <AppText variant="h1">Drops</AppText>
        <AppText variant="caption" color={COLORS.textSecondary} style={styles.sub}>
          Des produits d’exception, à prix réduit, pour quelques heures seulement.
        </AppText>
        <Segmented
          value={activeTab}
          onChange={setTab}
          options={[
            { value: 'live', label: 'EN COURS', count: groups.live.length },
            { value: 'upcoming', label: 'À VENIR', count: groups.upcoming.length },
            { value: 'ended', label: 'TERMINÉS', count: groups.ended.length },
          ]}
        />
      </Animated.View>
      <FlatList
        data={groups[activeTab]}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={drops.isRefetching} onRefresh={drops.refetch} tintColor={COLORS.primaryBright} />}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.lg }} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 70).duration(380)}>
            <DropRow
              drop={item}
              following={reminder.isFollowing(item.id)}
              onPress={() => router.push(`/drop/${item.id}`)}
              onToggleReminder={() => reminder.toggle(item)}
            />
          </Animated.View>
        )}
        ListEmptyComponent={
          drops.isLoading ? (
            <View style={{ gap: SPACING.lg }}>
              <Skeleton height={250} radius={RADIUS.lg} />
              <Skeleton height={250} radius={RADIUS.lg} />
            </View>
          ) : (
            <EmptyState
              icon="flash-outline"
              title={activeTab === 'live' ? 'Aucun drop en cours' : activeTab === 'upcoming' ? 'Aucun drop programmé' : 'Aucun drop terminé'}
              message="Active les rappels pour ne rien manquer des prochains drops."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.screen, paddingTop: SPACING.md, gap: SPACING.sm },
  sub: { marginBottom: SPACING.sm, fontSize: 14 },
  list: { padding: SPACING.screen, paddingBottom: SPACING.huge },
});
