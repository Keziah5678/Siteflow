import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedItem } from '@/components/feed/FeedItem';
import { AppText, EmptyState, IconButton } from '@/components/ui';
import { COLORS, FONTS, LAYOUT, SPACING } from '@/constants/theme';
import { flattenPages, useForYou, useProduct, useProductsByIds } from '@/features/catalog/hooks';
import { useLibrary } from '@/store/library';
import type { Product } from '@/types/models';

/**
 * Flux vidéo vertical plein écran.
 * - swipe vertical = produit suivant (pagination aimantée)
 * - seule la vidéo visible joue ; la suivante est préchargée
 * - muet par défaut, son activable
 * - pagination infinie via le moteur de recommandation
 */
export default function FeedScreen() {
  const { id, category, saved } = useLocalSearchParams<{ id: string; category?: string; saved?: string }>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Hauteur réelle du conteneur (barres système, modale web…) : chaque page = 1 écran exact.
  const [measured, setMeasured] = useState(0);
  const height = measured || windowHeight;
  const width = Math.min(windowWidth, LAYOUT.maxContentWidth);
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  // Sélecteur stable (référence du store), dérivation mémoïsée : évite les boucles de rendu.
  const favorites = useLibrary((s) => s.favorites);
  const savedIds = useMemo(() => (saved ? favorites.filter((f) => f.kind === 'video').map((f) => f.productId) : []), [saved, favorites]);
  const savedVideos = useProductsByIds(savedIds);
  const start = useProduct(id);
  const feed = useForYou(category ?? null, !saved);

  const items = useMemo<Product[]>(() => {
    if (saved) {
      const list = savedVideos.data ?? [];
      const i = list.findIndex((p) => p.id === id);
      return i > 0 ? [...list.slice(i), ...list.slice(0, i)] : list;
    }
    const rest = flattenPages<Product>(feed.data).filter((p) => p.id !== id);
    return start.data ? [start.data, ...rest] : rest;
  }, [saved, savedVideos.data, feed.data, start.data, id]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setActiveIndex(first.index);
  }).current;

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const loading = saved ? savedVideos.isLoading : start.isLoading && feed.isLoading;

  return (
    <View style={styles.root} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.height))}>
      {loading || !measured ? (
        <ActivityIndicator color={COLORS.primaryBright} style={styles.loader} />
      ) : !items.length ? (
        <EmptyState icon="videocam-off-outline" title="Aucune vidéo" message="Ce flux est vide pour le moment." actionLabel="Retour" onAction={() => router.back()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          style={{ width }}
          renderItem={({ item, index }) => (
            <FeedItem
              product={item}
              width={width}
              height={height}
              active={index === activeIndex}
              preload={index === activeIndex + 1 || index === activeIndex - 1}
              muted={muted}
              onToggleMute={toggleMute}
              bottomInset={insets.bottom}
            />
          )}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          onEndReachedThreshold={2}
          onEndReached={() => !saved && feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        />
      )}

      <View style={[styles.top, { top: insets.top + SPACING.sm, width }]} pointerEvents="box-none">
        <IconButton icon="chevron-down" variant="round" size={42} accessibilityLabel="Fermer" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
        <AppText style={styles.title}>{saved ? 'Sauvegardées' : 'Pour toi'}</AppText>
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.black, alignItems: 'center' },
  loader: { flex: 1 },
  top: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.text,
    textShadowColor: COLORS.scrim,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
  placeholder: { width: 42 },
});
