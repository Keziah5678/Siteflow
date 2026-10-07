import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Countdown } from '@/components/drop/Countdown';
import { LiveBadge } from '@/components/drop/LiveBadge';
import { ProductTile } from '@/components/product/ProductTile';
import { AppImage, AppText, EmptyState, GradientButton, IconButton, OutlineButton, SectionHeader, Skeleton } from '@/components/ui';
import { COLORS, FONTS, GRADIENTS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';
import { useProductsByIds } from '@/features/catalog/hooks';
import { useDrop } from '@/features/drops/hooks';
import { useDropReminder } from '@/features/drops/useDropReminder';
import { useNow } from '@/hooks/useNow';
import { useResponsive } from '@/hooks/useResponsive';
import { DROP_STATUS_LABEL, getDropStatus, getDropTarget } from '@/lib/drops';
import { formatDate, formatDropMoment } from '@/lib/format';

/** Barre de progression animée de la fenêtre de vente d'un drop en cours. */
function LiveProgress({ start, end, now }: { start: number; end: number; now: number }) {
  const ratio = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const style = useAnimatedStyle(() => ({ width: withTiming(`${ratio * 100}%`, { duration: 900 }) }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]}>
        <LinearGradient colors={GRADIENTS.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export default function DropDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { innerWidth } = useResponsive();
  const drop = useDrop(id);
  const d = drop.data;
  const products = useProductsByIds(d?.productIds ?? []);
  const reminder = useDropReminder();
  const now = useNow();

  if (drop.isLoading) {
    return (
      <View style={styles.root}>
        <Skeleton height={380} radius={0} />
      </View>
    );
  }
  if (!d) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <EmptyState icon="flash-off-outline" title="Drop introuvable" actionLabel="Voir les drops" onAction={() => router.replace('/drops')} />
      </View>
    );
  }

  const status = getDropStatus(d, now);
  const target = getDropTarget(d, now);
  const following = reminder.isFollowing(d.id);
  const tileWidth = (innerWidth - SPACING.md) / 2;
  const firstProduct = products.data?.[0];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.huge }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <AppImage uri={d.imageUrl} style={StyleSheet.absoluteFill} priority="high" />
          <LinearGradient colors={GRADIENTS.scrimBottom} locations={[0.2, 0.65, 1]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={[COLORS.primaryHaze, 'transparent']} start={{ x: 0, y: 1 }} end={{ x: 0.7, y: 0.2 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.heroTop, { top: insets.top + SPACING.sm }]}>
            <IconButton icon="chevron-back" variant="round" size={42} accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/drops'))} />
          </View>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.heroContent}>
            {status === 'live' ? (
              <LiveBadge />
            ) : (
              <View style={styles.status}>
                <AppText style={styles.statusText}>{DROP_STATUS_LABEL[status].toUpperCase()}</AppText>
              </View>
            )}
            <AppText style={styles.title}>{d.title}</AppText>
            <AppText variant="bodyMedium" color={COLORS.textSecondary}>
              {d.subtitle}
            </AppText>
          </Animated.View>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primaryBright} />
              <AppText variant="bodyMedium">
                {status === 'ended' ? `Terminé le ${formatDate(d.endsAt)}` : `${status === 'live' ? 'A commencé' : 'Commence'} ${formatDropMoment(d.startsAt).toLowerCase()}`}
              </AppText>
            </View>
            {target ? (
              <>
                <AppText variant="caption" color={COLORS.textSecondary}>
                  {status === 'live' ? 'Se termine dans' : 'Ouverture dans'}
                </AppText>
                <Countdown target={target} />
              </>
            ) : null}
            {status === 'live' ? <LiveProgress start={new Date(d.startsAt).getTime()} end={new Date(d.endsAt).getTime()} now={now} /> : null}
            <View style={styles.actions}>
              {status !== 'ended' ? (
                <OutlineButton
                  label={following ? 'Rappel activé' : 'Me le rappeler'}
                  icon={following ? 'notifications' : 'notifications-outline'}
                  active={following}
                  onPress={() => reminder.toggle(d)}
                  style={styles.flex}
                />
              ) : null}
              {firstProduct ? (
                <GradientButton
                  label="Regarder"
                  icon="play"
                  size="md"
                  style={styles.flex}
                  onPress={() => router.push({ pathname: '/feed/[id]', params: { id: firstProduct.id } })}
                />
              ) : null}
            </View>
          </View>

          <AppText variant="body" color={COLORS.textSecondary} style={styles.description}>
            {d.description}
          </AppText>

          <SectionHeader title={`Produits du drop (${d.productIds.length})`} />
          {products.isLoading ? (
            <Skeleton height={tileWidth * 1.4} radius={RADIUS.md} />
          ) : (
            <View style={styles.grid}>
              {(products.data ?? []).map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 60)}>
                  <ProductTile product={p} width={tileWidth} />
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  hero: { height: 400, width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', justifyContent: 'flex-end' },
  heroTop: { position: 'absolute', left: SPACING.lg },
  heroContent: { padding: SPACING.screen, gap: SPACING.sm },
  status: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryBorder },
  statusText: { fontFamily: FONTS.bold, fontSize: 10.5, color: COLORS.text, letterSpacing: 0.8 },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    lineHeight: 40,
    color: COLORS.text,
    textShadowColor: COLORS.glowText,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  body: { width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center', paddingHorizontal: SPACING.screen, gap: SPACING.lg },
  card: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.primaryBorder },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: COLORS.surface, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: SPACING.md },
  flex: { flex: 1 },
  description: { lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
});
