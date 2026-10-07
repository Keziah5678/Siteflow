import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { MegaDropCard } from '@/components/drop/MegaDropCard';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { ProductTile } from '@/components/product/ProductTile';
import {
  AppText,
  CategoryTile,
  IconButton,
  Logo,
  PressableScale,
  Screen,
  SectionHeader,
  SelectSheet,
  Skeleton,
  type SelectOption,
} from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { flattenPages, useCategories, useForYou, useProductsInfinite } from '@/features/catalog/hooks';
import { useDrops } from '@/features/drops/hooks';
import { useResponsive } from '@/hooks/useResponsive';
import { pickFeaturedDrop } from '@/services/drops';
import { trackEvent } from '@/services/user-data';
import { selectCartCount, useCart } from '@/store/cart';
import type { Product, ProductSort } from '@/types/models';

const SORT_OPTIONS: SelectOption<ProductSort>[] = [
  { value: 'recommended', label: 'Recommandé', icon: 'sparkles-outline' },
  { value: 'newest', label: 'Nouveautés', icon: 'time-outline' },
  { value: 'discount', label: 'Meilleures remises', icon: 'pricetag-outline' },
  { value: 'price_asc', label: 'Prix croissant', icon: 'trending-up-outline' },
  { value: 'price_desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
];

export default function HomeScreen() {
  const { contentWidth } = useResponsive();
  const cartCount = useCart(selectCartCount);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<ProductSort>('recommended');
  const [sortOpen, setSortOpen] = useState(false);

  const categories = useCategories();
  const drops = useDrops();
  const forYou = useForYou(category, sort === 'recommended');
  const sorted = useProductsInfinite({ categorySlug: category, sort: sort === 'recommended' ? 'popular' : sort }, sort !== 'recommended');
  const feed = sort === 'recommended' ? forYou : sorted;
  const products = useMemo(() => flattenPages<Product>(feed.data), [feed.data]);
  const deals = useProductsInfinite({ sort: 'discount', limit: 6 });

  const topCategories = useMemo(() => (categories.data ?? []).filter((c) => !c.parentId), [categories.data]);
  const featured = useMemo(() => pickFeaturedDrop(drops.data ?? []), [drops.data]);

  const selectCategory = (slug: string | null) => {
    setCategory(slug);
    const cat = categories.data?.find((c) => c.slug === slug);
    if (cat) trackEvent({ type: 'view_category', categoryId: cat.id });
  };

  const openVideo = useCallback(
    (p: Product) => router.push({ pathname: '/feed/[id]', params: { id: p.id, ...(category ? { category } : {}) } }),
    [category],
  );

  const refresh = () => Promise.all([feed.refetch(), drops.refetch(), categories.refetch()]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={refresh} tintColor={COLORS.primaryBright} />}
      >
        {/* En-tête */}
        <Animated.View entering={FadeInDown.duration(450)} style={styles.header}>
          <Logo tagline />
          <View style={styles.headerActions}>
            <IconButton icon="search-outline" accessibilityLabel="Rechercher" onPress={() => router.push('/search')} />
            <IconButton icon="bag-handle-outline" accessibilityLabel="Panier" badge={cartCount} onPress={() => router.push('/cart')} />
          </View>
        </Animated.View>

        {/* Catégories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
          <CategoryTile label="Tout" icon="sparkles-outline" active={!category} onPress={() => selectCategory(null)} />
          {categories.isLoading
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} width={66} height={64} radius={RADIUS.md} />)
            : topCategories.map((c) => (
                <CategoryTile key={c.id} label={c.name} icon={c.icon} active={category === c.slug} onPress={() => selectCategory(c.slug)} />
              ))}
        </ScrollView>

        {/* Mega Drop */}
        <View style={styles.section}>
          {drops.isLoading ? (
            <Skeleton height={270} radius={RADIUS.xl} />
          ) : featured ? (
            <MegaDropCard drop={featured} onPress={() => router.push(`/drop/${featured.id}`)} />
          ) : null}
        </View>

        {/* Pour toi */}
        <View style={[styles.section, styles.forYouHeader]}>
          <SectionHeader
            title="Pour toi"
            style={styles.noMargin}
            right={
              <PressableScale onPress={() => setSortOpen(true)} style={styles.sortPill} accessibilityLabel="Trier">
                <AppText variant="caption">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</AppText>
                <Ionicons name="chevron-down" size={14} color={COLORS.text} />
              </PressableScale>
            }
          />
        </View>
        <ProductCarousel
          products={products}
          containerWidth={contentWidth}
          loading={feed.isLoading}
          loadingMore={feed.isFetchingNextPage}
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onOpenVideo={openVideo}
        />
        {!feed.isLoading && !products.length ? (
          <AppText variant="caption" color={COLORS.textSecondary} align="center" style={styles.empty}>
            Aucun produit dans cette catégorie pour le moment.
          </AppText>
        ) : null}

        {/* Bonnes affaires */}
        <View style={[styles.section, styles.dealsSection]}>
          <SectionHeader title="Prix en chute" onAction={() => router.push({ pathname: '/search', params: { sort: 'discount' } })} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsRow}>
            {flattenPages<Product>(deals.data).map((p) => (
              <ProductTile key={p.id} product={p} width={148} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <SelectSheet visible={sortOpen} title="Trier « Pour toi »" options={SORT_OPTIONS} value={sort} onSelect={setSort} onClose={() => setSortOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: SPACING.xxxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.md,
  },
  headerActions: { flexDirection: 'row', gap: SPACING.md },
  categories: { gap: SPACING.sm + 2, paddingHorizontal: SPACING.screen, paddingVertical: SPACING.lg + 2 },
  section: { paddingHorizontal: SPACING.screen, marginTop: SPACING.xs },
  forYouHeader: { marginTop: SPACING.xxl, marginBottom: SPACING.md },
  noMargin: { marginBottom: 0 },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md + 2,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  empty: { paddingVertical: SPACING.xxl },
  dealsSection: { marginTop: SPACING.xxl },
  dealsRow: { gap: SPACING.md, paddingRight: SPACING.screen },
});
