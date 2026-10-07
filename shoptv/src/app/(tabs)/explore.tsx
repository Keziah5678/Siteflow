import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BrandBubble } from '@/components/brand/BrandBubble';
import { DropCard } from '@/components/drop/DropCard';
import { AppImage, AppText, CategoryTile, IconButton, PressableScale, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useBrands, useCategories } from '@/features/catalog/hooks';
import { useDrops } from '@/features/drops/hooks';
import { useDropReminder } from '@/features/drops/useDropReminder';
import { useNow } from '@/hooks/useNow';
import { useResponsive } from '@/hooks/useResponsive';
import { groupDrops } from '@/services/drops';
import { trackEvent } from '@/services/user-data';
import type { Category } from '@/types/models';

const SELECTIONS = [
  { key: 'gaming', title: 'Les indispensables Gaming', subtitle: 'Notre sélection pour les vrais joueurs.', category: 'gaming' },
  { key: 'tech', title: 'Tech premium', subtitle: 'Le meilleur des smartphones et de l’audio.', category: 'tech' },
];

export default function ExploreScreen() {
  const { innerWidth } = useResponsive();
  const categories = useCategories();
  const brands = useBrands(true);
  const drops = useDrops();
  const reminder = useDropReminder();
  // Re-calcul des statuts une fois par minute (le détail d'un drop a sa propre horloge).
  const minute = Math.floor(useNow() / 60_000);

  const topCategories = useMemo(() => (categories.data ?? []).filter((c) => !c.parentId), [categories.data]);
  const popular = useMemo(() => (categories.data ?? []).filter((c) => c.isPopular).slice(0, 6), [categories.data]);
  const upcoming = useMemo(() => {
    const g = groupDrops(drops.data ?? [], minute * 60_000);
    return [...g.live, ...g.upcoming];
  }, [drops.data, minute]);

  const tileWidth = (innerWidth - SPACING.md * 2) / 3;
  const openCategory = (c: Category) => {
    trackEvent({ type: 'view_category', categoryId: c.id });
    router.push({ pathname: '/search', params: { category: c.slug } });
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.pad}>
          <AppText variant="h1" style={styles.title}>
            Explorer
          </AppText>
          <View style={styles.searchRow}>
            <PressableScale onPress={() => router.push('/search')} scaleTo={0.98} style={styles.search} accessibilityLabel="Rechercher">
              <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
              <AppText variant="bodyMedium" color={COLORS.textSecondary} numberOfLines={1} style={styles.searchText}>
                Rechercher un produit, une marque…
              </AppText>
            </PressableScale>
            <IconButton icon="options-outline" size={50} accessibilityLabel="Filtres" onPress={() => router.push({ pathname: '/search', params: { filters: '1' } })} />
          </View>
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <CategoryTile label="Tous" icon="sparkles-outline" active onPress={() => router.push('/search')} width={72} />
          {topCategories.map((c) => (
            <CategoryTile key={c.id} label={c.name} icon={c.icon} onPress={() => openCategory(c)} width={72} />
          ))}
        </ScrollView>

        <View style={styles.pad}>
          <SectionHeader title="Catégories populaires" onAction={() => router.push('/search')} />
          <View style={styles.grid}>
            {categories.isLoading
              ? [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} width={tileWidth} height={tileWidth * 0.86} radius={RADIUS.md} />)
              : popular.map((c, i) => (
                  <Animated.View key={c.id} entering={FadeInDown.delay(60 * i).duration(380)}>
                    <PressableScale onPress={() => openCategory(c)} scaleTo={0.96} style={[styles.catTile, { width: tileWidth, height: tileWidth * 0.86 }]} accessibilityLabel={c.name}>
                      <AppImage uri={c.imageUrl} style={styles.catImage} />
                      <LinearGradient colors={[COLORS.primaryHazeSoft, COLORS.transparentBg]} style={StyleSheet.absoluteFill} />
                      <AppText variant="caption" style={styles.catLabel} numberOfLines={1}>
                        {c.name}
                      </AppText>
                    </PressableScale>
                  </Animated.View>
                ))}
          </View>
        </View>

        <View style={[styles.pad, styles.section]}>
          <SectionHeader title="Drops à venir" onAction={() => router.push('/drops')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {drops.isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} width={168} height={196} radius={RADIUS.md} />)
            : upcoming.map((d) => (
                <DropCard
                  key={d.id}
                  drop={d}
                  following={reminder.isFollowing(d.id)}
                  onPress={() => router.push(`/drop/${d.id}`)}
                  onToggleReminder={() => reminder.toggle(d)}
                />
              ))}
        </ScrollView>

        <View style={[styles.pad, styles.section]}>
          <SectionHeader title="Top marques" onAction={() => router.push('/search')} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {brands.isLoading
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={66} height={66} radius={33} />)
            : (brands.data ?? []).map((b) => (
                <BrandBubble key={b.id} brand={b} onPress={() => router.push({ pathname: '/search', params: { brand: b.slug } })} />
              ))}
        </ScrollView>

        <View style={[styles.pad, styles.section]}>
          <SectionHeader title="Nos sélections" onAction={() => router.push('/search')} />
          <View style={styles.selections}>
            {SELECTIONS.map((s) => {
              const cat = categories.data?.find((c) => c.slug === s.category);
              return (
                <PressableScale
                  key={s.key}
                  onPress={() => router.push({ pathname: '/search', params: { category: s.category } })}
                  scaleTo={0.98}
                  style={styles.selection}
                  accessibilityLabel={s.title}
                >
                  <AppImage uri={cat?.imageUrl} style={styles.selectionImage} />
                  <LinearGradient
                    colors={[COLORS.transparentSurface, COLORS.backgroundSecondary]}
                    start={{ x: 0.1, y: 0.5 }}
                    end={{ x: 0.45, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.selectionText}>
                    <AppText variant="bodyMedium" style={styles.selectionTitle} numberOfLines={1}>
                      {s.title}
                    </AppText>
                    <AppText variant="small" color={COLORS.textSecondary} numberOfLines={2}>
                      {s.subtitle}
                    </AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
                </PressableScale>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: SPACING.xxxl },
  pad: { paddingHorizontal: SPACING.screen },
  title: { marginTop: SPACING.md, marginBottom: SPACING.lg },
  searchRow: { flexDirection: 'row', gap: SPACING.md },
  search: {
    flex: 1,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  searchText: { flex: 1, fontSize: 14.5 },
  categories: { gap: SPACING.sm + 2, paddingHorizontal: SPACING.screen, paddingVertical: SPACING.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  catTile: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    justifyContent: 'flex-end',
  },
  catImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 28 },
  catLabel: {
    height: 28,
    lineHeight: 28,
    textAlign: 'center',
    fontFamily: FONTS.medium,
    backgroundColor: COLORS.backgroundSecondary,
  },
  section: { marginTop: SPACING.xxl },
  row: { gap: SPACING.md, paddingHorizontal: SPACING.screen },
  selections: { gap: SPACING.md },
  selection: {
    height: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.lg,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.backgroundSecondary,
  },
  selectionImage: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '36%' },
  selectionText: { flex: 1, marginLeft: '39%', marginRight: SPACING.sm, gap: 3 },
  selectionTitle: { fontSize: 14 },
});
