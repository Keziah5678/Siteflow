import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BrandBubble } from '@/components/brand/BrandBubble';
import { ProductTile } from '@/components/product/ProductTile';
import { AppText, EmptyState, IconButton, PressableScale, Screen, SectionHeader, SelectSheet, Skeleton, type SelectOption } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { flattenPages, useBrands, useCategories, useProductsInfinite } from '@/features/catalog/hooks';
import { useInstantSearch } from '@/features/search/hooks';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDropMoment } from '@/lib/format';
import { TRENDING_SEARCHES } from '@/services/search';
import { useLibrary } from '@/store/library';
import type { Product, ProductSort } from '@/types/models';

const SORTS: SelectOption<ProductSort>[] = [
  { value: 'popular', label: 'Popularité', icon: 'flame-outline' },
  { value: 'newest', label: 'Nouveautés', icon: 'time-outline' },
  { value: 'discount', label: 'Meilleures remises', icon: 'pricetag-outline' },
  { value: 'price_asc', label: 'Prix croissant', icon: 'trending-up-outline' },
  { value: 'price_desc', label: 'Prix décroissant', icon: 'trending-down-outline' },
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string; brand?: string; sort?: ProductSort; filters?: string }>();
  const { innerWidth } = useResponsive();
  const [text, setText] = useState(params.q ?? '');
  const [category, setCategory] = useState<string | null>(params.category || null);
  const [brand, setBrand] = useState<string | null>(params.brand || null);
  const [sort, setSort] = useState<ProductSort>(params.sort ?? 'popular');
  const [sheet, setSheet] = useState<null | 'sort' | 'category'>(params.filters ? 'category' : null);
  const recent = useLibrary((s) => s.recentSearches);
  const addRecent = useLibrary((s) => s.addRecentSearch);
  const clearRecent = useLibrary((s) => s.clearRecentSearches);

  const categories = useCategories();
  const brands = useBrands();
  const instant = useInstantSearch(text);
  const term = instant.term;
  const hasQuery = term.length >= 2 || !!category || !!brand;
  const products = useProductsInfinite({ search: term.length >= 2 ? term : undefined, categorySlug: category, brandSlug: brand, sort, limit: 12 }, hasQuery);
  const items = useMemo(() => flattenPages<Product>(products.data), [products.data]);

  const tileWidth = (innerWidth - SPACING.md) / 2;
  const categoryName = categories.data?.find((c) => c.slug === category)?.name;
  const brandName = brands.data?.find((b) => b.slug === brand)?.name;
  const results = instant.data;

  const header = (
    <View style={styles.headerBlock}>
      {(category || brand || hasQuery) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip icon="swap-vertical" label={SORTS.find((s) => s.value === sort)?.label ?? ''} onPress={() => setSheet('sort')} />
          <Chip icon="grid-outline" label={categoryName ?? 'Catégorie'} active={!!category} onPress={() => setSheet('category')} onClear={category ? () => setCategory(null) : undefined} />
          {brand ? <Chip icon="ribbon-outline" label={brandName ?? brand} active onClear={() => setBrand(null)} /> : null}
        </ScrollView>
      )}
      {term.length >= 2 && results ? (
        <Animated.View entering={FadeIn} style={styles.instant}>
          {results.brands.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {results.brands.map((b) => (
                <BrandBubble key={b.id} brand={b} size={52} onPress={() => setBrand(b.slug)} />
              ))}
            </ScrollView>
          ) : null}
          {results.categories.length ? (
            <View style={styles.wrapRow}>
              {results.categories.map((c) => (
                <Chip key={c.id} icon="grid-outline" label={c.name} onPress={() => setCategory(c.slug)} />
              ))}
            </View>
          ) : null}
          {results.drops.map((d) => (
            <PressableScale key={d.id} onPress={() => router.push(`/drop/${d.id}`)} style={styles.dropRow} accessibilityLabel={d.title}>
              <Ionicons name="flash" size={18} color={COLORS.fuchsia} />
              <AppText variant="bodyMedium" style={styles.flex}>
                {d.title}
              </AppText>
              <AppText variant="small" color={COLORS.textSecondary}>
                {formatDropMoment(d.startsAt)}
              </AppText>
            </PressableScale>
          ))}
        </Animated.View>
      ) : null}
      {hasQuery ? (
        <AppText variant="caption" color={COLORS.textSecondary}>
          {products.isLoading ? 'Recherche…' : `${items.length}${products.hasNextPage ? '+' : ''} produit(s)`}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <View style={styles.bar}>
        <IconButton icon="chevron-back" size={46} accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        <View style={styles.inputWrap}>
          <Ionicons name="search-outline" size={19} color={COLORS.textSecondary} />
          <TextInput
            value={text}
            onChangeText={setText}
            autoFocus={!params.category && !params.brand && !params.sort}
            placeholder="Rechercher un produit, une marque…"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="search"
            onSubmitEditing={() => addRecent(text)}
            style={styles.input}
            selectionColor={COLORS.primaryBright}
          />
          {instant.isFetching || instant.isTyping ? <ActivityIndicator size="small" color={COLORS.primaryBright} /> : null}
          {text ? (
            <Pressable onPress={() => setText('')} hitSlop={8} accessibilityLabel="Effacer">
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <IconButton icon="options-outline" size={46} accessibilityLabel="Filtres" onPress={() => setSheet('category')} />
      </View>

      {hasQuery ? (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          key="grid"
          ListHeaderComponent={header}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.list}
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <ProductTile product={item} width={tileWidth} />}
          onEndReached={() => products.hasNextPage && !products.isFetchingNextPage && products.fetchNextPage()}
          onEndReachedThreshold={0.6}
          ListFooterComponent={products.isFetchingNextPage ? <ActivityIndicator color={COLORS.primaryBright} style={styles.footer} /> : null}
          ListEmptyComponent={
            products.isLoading ? (
              <View style={styles.column}>
                <Skeleton width={tileWidth} height={tileWidth * 1.4} radius={RADIUS.md} />
                <Skeleton width={tileWidth} height={tileWidth * 1.4} radius={RADIUS.md} />
              </View>
            ) : (
              <EmptyState icon="search-outline" title="Aucun résultat" message="Essaie un autre mot-clé ou retire un filtre." />
            )
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {recent.length ? (
            <View style={styles.block}>
              <SectionHeader title="Récentes" actionLabel="Effacer" onAction={clearRecent} />
              <View style={styles.wrapRow}>
                {recent.map((r) => (
                  <Chip key={r} icon="time-outline" label={r} onPress={() => setText(r)} />
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.block}>
            <SectionHeader title="Tendances" />
            <View style={styles.wrapRow}>
              {TRENDING_SEARCHES.map((t) => (
                <Chip key={t} icon="trending-up" label={t} onPress={() => setText(t)} />
              ))}
            </View>
          </View>
          <View style={styles.block}>
            <SectionHeader title="Catégories" />
            <View style={styles.wrapRow}>
              {(categories.data ?? []).map((c) => (
                <Chip key={c.id} icon={c.icon as keyof typeof Ionicons.glyphMap} label={c.name} onPress={() => setCategory(c.slug)} />
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      <SelectSheet visible={sheet === 'sort'} title="Trier par" options={SORTS} value={sort} onSelect={setSort} onClose={() => setSheet(null)} />
      <SelectSheet
        visible={sheet === 'category'}
        title="Catégorie"
        options={[{ value: '__all', label: 'Toutes les catégories', icon: 'apps-outline' }, ...(categories.data ?? []).map((c) => ({ value: c.slug, label: c.name, icon: c.icon as keyof typeof Ionicons.glyphMap }))]}
        value={category ?? '__all'}
        onSelect={(v) => setCategory(v === '__all' ? null : v)}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function Chip({ icon, label, active, onPress, onClear }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress?: () => void; onClear?: () => void }) {
  return (
    <PressableScale haptic onPress={onPress ?? onClear} style={[styles.chip, active && styles.chipActive]} accessibilityLabel={label}>
      <Ionicons name={icon in Ionicons.glyphMap ? icon : 'pricetag-outline'} size={14} color={active ? COLORS.primaryBright : COLORS.textSecondary} />
      <AppText style={styles.chipText}>{label}</AppText>
      {onClear ? <Ionicons name="close" size={14} color={COLORS.text} onPress={onClear} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md },
  inputWrap: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.backgroundSecondary,
  },
  input: { flex: 1, minWidth: 0, height: '100%', color: COLORS.text, fontFamily: FONTS.regular, fontSize: 15, outlineStyle: 'none' } as object,
  list: { paddingHorizontal: SPACING.screen, paddingBottom: SPACING.huge, gap: SPACING.lg },
  column: { gap: SPACING.md },
  headerBlock: { gap: SPACING.md, marginBottom: SPACING.xs },
  chips: { gap: SPACING.sm },
  instant: { gap: SPACING.md },
  row: { gap: SPACING.md },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  dropRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  flex: { flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  chipActive: { borderColor: COLORS.primaryBright, backgroundColor: COLORS.primarySoft },
  chipText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.text },
  block: { gap: SPACING.xs },
  footer: { paddingVertical: SPACING.lg },
});
