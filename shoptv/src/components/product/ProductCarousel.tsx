import { memo, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { Skeleton } from '@/components/ui';
import { COLORS, RADIUS } from '@/constants/theme';
import type { Product } from '@/types/models';

import { ProductHeroCard } from './ProductHeroCard';

const GAP = 14;

interface Props {
  products: Product[];
  containerWidth: number;
  loading: boolean;
  loadingMore: boolean;
  onEndReached: () => void;
  onOpenVideo: (product: Product) => void;
}

const CarouselItem = memo(function CarouselItem({
  product,
  index,
  scrollX,
  itemWidth,
  height,
  onOpenVideo,
}: {
  product: Product;
  index: number;
  scrollX: SharedValue<number>;
  itemWidth: number;
  height: number;
  onOpenVideo: (p: Product) => void;
}) {
  const interval = itemWidth + GAP;
  const style = useAnimatedStyle(() => {
    const position = scrollX.value / interval - index;
    return {
      opacity: interpolate(Math.abs(position), [0, 1], [1, 0.55], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(Math.abs(position), [0, 1], [1, 0.9], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[{ width: itemWidth, marginRight: GAP }, style]}>
      <ProductHeroCard product={product} width={itemWidth} height={height} onOpenVideo={() => onOpenVideo(product)} />
    </Animated.View>
  );
});

/** Carrousel « Pour toi » : cartes centrées, voisines réduites, défilement aimanté, pagination infinie. */
export function ProductCarousel({ products, containerWidth, loading, loadingMore, onEndReached, onOpenVideo }: Props) {
  const itemWidth = Math.round(containerWidth * 0.8);
  const height = Math.round(itemWidth * 1.62);
  const sidePadding = (containerWidth - itemWidth) / 2;
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Product>) => (
      <CarouselItem product={item} index={index} scrollX={scrollX} itemWidth={itemWidth} height={height} onOpenVideo={onOpenVideo} />
    ),
    [scrollX, itemWidth, height, onOpenVideo],
  );

  if (loading) {
    return (
      <View style={[styles.skeletonRow, { paddingHorizontal: sidePadding }]}>
        <Skeleton width={itemWidth} height={height} radius={RADIUS.xl} />
      </View>
    );
  }

  return (
    <Animated.FlatList
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={renderItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={itemWidth + GAP}
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={{ paddingLeft: sidePadding, paddingRight: sidePadding - GAP }}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={onEndReached}
      onEndReachedThreshold={1.5}
      initialNumToRender={3}
      windowSize={5}
      maxToRenderPerBatch={3}
      removeClippedSubviews
      getItemLayout={(_, index) => ({ length: itemWidth + GAP, offset: (itemWidth + GAP) * index, index })}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primaryBright} style={{ height, width: 60 }} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  skeletonRow: { flexDirection: 'row' },
});
