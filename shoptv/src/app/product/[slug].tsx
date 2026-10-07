import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionRail } from '@/components/product/ActionRail';
import { InlineVideo } from '@/components/product/InlineVideo';
import { ProductTile } from '@/components/product/ProductTile';
import { ReviewSheet } from '@/components/product/ReviewSheet';
import {
  AppImage,
  AppText,
  EmptyState,
  GradientButton,
  IconButton,
  OutlineButton,
  PressableScale,
  PriceTag,
  SectionHeader,
  Skeleton,
  Stars,
} from '@/components/ui';
import { COLORS, FONTS, GRADIENTS, LAYOUT, RADIUS, SPACING } from '@/constants/theme';
import { useProduct, useSimilarProducts } from '@/features/catalog/hooks';
import { useProductActions } from '@/features/catalog/useProductActions';
import { useReviews } from '@/features/social/hooks';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDate, formatRating } from '@/lib/format';
import { trackEvent } from '@/services/user-data';
import { selectCartCount, useCart } from '@/store/cart';
import type { ProductMedia } from '@/types/models';

function GallerySegment({ active, done }: { active: boolean; done: boolean }) {
  const style = useAnimatedStyle(() => ({ width: withTiming(active || done ? '100%' : '0%', { duration: active ? 400 : 0 }) }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, style]} />
    </View>
  );
}

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { contentWidth, height } = useResponsive();
  const product = useProduct(slug);
  const p = product.data;
  const actions = useProductActions(p);
  const similar = useSimilarProducts(p);
  const reviews = useReviews(p?.id);
  const requireAuth = useRequireAuth();
  const cartCount = useCart(selectCartCount);

  const [mediaIndex, setMediaIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const galleryRef = useRef<FlatList<ProductMedia>>(null);

  const heroHeight = Math.min(Math.round(height * 0.56), 560);
  const media = useMemo<ProductMedia[]>(() => {
    if (!p) return [];
    if (p.media.length) return p.media;
    return [{ id: 'cover', productId: p.id, type: 'image', url: p.coverUrl, sortOrder: 0 }];
  }, [p]);

  useEffect(() => {
    if (!p) return;
    trackEvent({ type: 'view_product', productId: p.id, categoryId: p.categoryId });
    setVariantId(p.variants[0]?.id ?? null);
  }, [p]);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / contentWidth);
    if (i !== mediaIndex) {
      setMediaIndex(i);
      setPlaying(false);
    }
  };

  const selectMedia = (i: number) => {
    setMediaIndex(i);
    setPlaying(false);
    galleryRef.current?.scrollToIndex({ index: i, animated: true });
  };

  if (product.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={styles.body}>
          <Skeleton height={28} width="70%" />
          <Skeleton height={18} width="40%" />
          <Skeleton height={36} width="55%" />
        </View>
      </View>
    );
  }

  if (!p) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <EmptyState icon="cube-outline" title="Produit introuvable" message="Il a peut-être été retiré du catalogue." actionLabel="Retour à l’accueil" onAction={() => router.replace('/home')} />
      </View>
    );
  }

  const variantGroups = p.variants.reduce<Record<string, typeof p.variants>>((acc, v) => {
    (acc[v.label] ??= []).push(v);
    return acc;
  }, {});
  const stockLabel = p.stock <= 0 ? 'Rupture de stock' : p.stock < 20 ? 'Stock limité' : 'En stock';
  const tileWidth = 150;

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* Galerie photos / vidéos */}
        <View style={{ height: heroHeight, width: contentWidth, alignSelf: 'center' }}>
          <FlatList
            ref={galleryRef}
            data={media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m) => m.id}
            onMomentumScrollEnd={onGalleryScroll}
            getItemLayout={(_, i) => ({ length: contentWidth, offset: contentWidth * i, index: i })}
            renderItem={({ item, index }) => (
              <PressableScale
                scaleTo={1}
                onPress={() => item.type === 'video' && setPlaying(true)}
                style={{ width: contentWidth, height: heroHeight }}
                accessibilityLabel={item.type === 'video' ? 'Lire la vidéo' : `Photo ${index + 1}`}
              >
                <AppImage uri={item.type === 'video' ? (item.posterUrl ?? p.coverUrl) : item.url} style={StyleSheet.absoluteFill} priority={index === 0 ? 'high' : 'normal'} />
                {item.type === 'video' && playing && index === mediaIndex && !videoFailed ? (
                  <InlineVideo uri={item.url} onError={() => setVideoFailed(true)} />
                ) : null}
                {item.type === 'video' && !(playing && index === mediaIndex) ? (
                  <View style={styles.playWrap}>
                    <View style={styles.play}>
                      <Ionicons name="play" size={34} color={COLORS.text} style={styles.playIcon} />
                    </View>
                  </View>
                ) : null}
              </PressableScale>
            )}
          />
          <LinearGradient colors={GRADIENTS.scrimTop} style={styles.heroTop} pointerEvents="none" />
          <LinearGradient colors={[COLORS.transparentBg, COLORS.background]} style={styles.heroBottom} pointerEvents="none" />

          <View style={[styles.heroHeader, { paddingTop: insets.top + SPACING.sm }]} pointerEvents="box-none">
            <View style={styles.segments}>
              {media.map((m, i) => (
                <GallerySegment key={m.id} active={i === mediaIndex} done={i < mediaIndex} />
              ))}
            </View>
            <View style={styles.heroButtons}>
              <IconButton icon="chevron-back" variant="round" size={40} accessibilityLabel="Retour" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
              <View style={styles.heroRight}>
                <IconButton icon="bag-handle-outline" variant="round" size={40} badge={cartCount} accessibilityLabel="Panier" onPress={() => router.push('/cart')} />
                <IconButton icon="ellipsis-vertical" variant="round" size={40} accessibilityLabel="Partager" onPress={actions.share} />
              </View>
            </View>
          </View>

          <ActionRail
            style={styles.heroRail}
            actions={[
              { key: 'like', icon: 'heart', active: actions.liked, count: p.likesCount + (actions.liked ? 1 : 0), label: 'J’aime', onPress: actions.like },
              { key: 'comments', icon: 'chatbubble-ellipses', count: p.commentsCount, label: 'Commentaires', onPress: () => router.push({ pathname: '/feed/[id]', params: { id: p.id } }) },
              { key: 'share', icon: 'arrow-redo', count: p.sharesCount, label: 'Partager', onPress: actions.share },
            ]}
          />
        </View>

        <View style={[styles.body, { width: contentWidth }]}>
          {/* Miniatures */}
          {media.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {media.map((m, i) => (
                <PressableScale key={m.id} onPress={() => selectMedia(i)} style={[styles.thumb, i === mediaIndex && styles.thumbActive]} accessibilityLabel={`Média ${i + 1}`}>
                  <AppImage uri={m.type === 'video' ? (m.posterUrl ?? p.coverUrl) : m.url} style={StyleSheet.absoluteFill} />
                  {m.type === 'video' ? (
                    <View style={styles.thumbPlay}>
                      <Ionicons name="play" size={12} color={COLORS.text} />
                    </View>
                  ) : null}
                </PressableScale>
              ))}
            </ScrollView>
          ) : null}

          <Animated.View entering={FadeInDown.duration(400)} style={styles.titleBlock}>
            {p.brand ? (
              <AppText variant="caption" color={COLORS.link} onPress={() => router.push({ pathname: '/search', params: { brand: p.brand!.slug } })}>
                {p.brand.name}
              </AppText>
            ) : null}
            <AppText style={styles.name}>{p.name}</AppText>
            <View style={styles.ratingRow}>
              <Stars value={p.rating} />
              <AppText variant="bodyMedium">{formatRating(p.rating)}</AppText>
              <AppText variant="caption" color={COLORS.textSecondary}>
                ({p.reviewCount.toLocaleString('fr-FR')} avis)
              </AppText>
            </View>
            <PriceTag price={p.price} compareAt={p.compareAtPrice} discount={p.discountPercentage} size="lg" style={styles.price} />
          </Animated.View>

          <View style={styles.chips}>
            <InfoChip icon="shield-checkmark-outline" label={stockLabel} warn={p.stock < 20} />
            <InfoChip icon="bus-outline" label={p.shippingInfo} />
            <InfoChip icon="ribbon-outline" label={p.warranty} />
          </View>

          <AppText variant="body" color={COLORS.textSecondary} style={styles.description}>
            {p.description}
          </AppText>

          {Object.entries(variantGroups).map(([label, variants]) => (
            <View key={label} style={styles.variantRow}>
              <AppText variant="bodyMedium" style={styles.variantLabel}>
                {label}
              </AppText>
              <View style={styles.variants}>
                {variants.map((v) =>
                  v.colorHex ? (
                    <PressableScale
                      key={v.id}
                      haptic
                      onPress={() => setVariantId(v.id)}
                      accessibilityLabel={v.value}
                      accessibilityState={{ selected: variantId === v.id }}
                      style={[styles.swatchRing, variantId === v.id && styles.swatchActive]}
                    >
                      <View style={[styles.swatch, { backgroundColor: v.colorHex }]} />
                    </PressableScale>
                  ) : (
                    <PressableScale
                      key={v.id}
                      haptic
                      onPress={() => setVariantId(v.id)}
                      accessibilityState={{ selected: variantId === v.id }}
                      style={[styles.pill, variantId === v.id && styles.pillActive]}
                    >
                      <AppText variant="caption">{v.value}</AppText>
                    </PressableScale>
                  ),
                )}
              </View>
            </View>
          ))}

          {p.features.length ? (
            <View style={styles.section}>
              <SectionHeader title="Caractéristiques" />
              <View style={styles.features}>
                {p.features.map((f) => (
                  <View key={f} style={styles.feature}>
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.primaryBright} />
                    <AppText variant="body" style={styles.flex}>
                      {f}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <SectionHeader
              title="Avis clients"
              right={<OutlineButton label="Donner mon avis" size="sm" icon="create-outline" onPress={() => requireAuth(() => setReviewOpen(true), 'review')} />}
            />
            <View style={styles.reviewSummary}>
              <AppText style={styles.bigRating}>{formatRating(p.rating)}</AppText>
              <View>
                <Stars value={p.rating} size={18} />
                <AppText variant="caption" color={COLORS.textSecondary}>
                  {p.reviewCount.toLocaleString('fr-FR')} avis vérifiés
                </AppText>
              </View>
            </View>
            {(reviews.data ?? []).map((r) => (
              <View key={r.id} style={styles.review}>
                <View style={styles.reviewHead}>
                  <Stars value={r.rating} size={13} />
                  <AppText variant="small" color={COLORS.textSecondary}>
                    {r.authorName} · {formatDate(r.createdAt)}
                  </AppText>
                </View>
                {r.title ? <AppText variant="bodyMedium">{r.title}</AppText> : null}
                <AppText variant="caption" color={COLORS.textSecondary} style={styles.reviewBody}>
                  {r.body}
                </AppText>
              </View>
            ))}
          </View>

          {(similar.data ?? []).length ? (
            <View style={styles.section}>
              <SectionHeader title="Produits similaires" onAction={() => router.push({ pathname: '/search', params: { category: p.category?.slug ?? '' } })} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similar}>
                {(similar.data ?? []).map((s) => (
                  <ProductTile key={s.id} product={s} width={tileWidth} />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Barre d'achat fixe */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={styles.barInner}>
          <IconButton icon="cart-outline" size={54} badge={cartCount} accessibilityLabel="Voir le panier" onPress={() => router.push('/cart')} />
          <GradientButton
            label={p.stock > 0 ? 'Ajouter au panier' : 'Rupture de stock'}
            icon="bag-add-outline"
            disabled={p.stock <= 0}
            pulse
            style={styles.flex}
            onPress={() => actions.addToCart(variantId)}
          />
        </View>
      </View>

      {reviewOpen ? <ReviewSheet productId={p.id} visible onClose={() => setReviewOpen(false)} /> : null}
    </View>
  );
}

function InfoChip({ icon, label, warn }: { icon: keyof typeof Ionicons.glyphMap; label: string; warn?: boolean }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={14} color={warn ? COLORS.warning : COLORS.text} />
      <AppText variant="small" style={styles.chipText}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  heroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 90 },
  heroHeader: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: SPACING.lg, gap: SPACING.md },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: COLORS.trackStrong, overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: COLORS.primaryBright },
  heroButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  heroRight: { flexDirection: 'row', gap: SPACING.sm },
  heroRail: { position: 'absolute', right: SPACING.lg, bottom: 40 },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.veil,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  playIcon: { marginLeft: 4 },
  body: { alignSelf: 'center', maxWidth: LAYOUT.maxContentWidth, paddingHorizontal: SPACING.screen, gap: SPACING.lg },
  thumbs: { gap: SPACING.sm + 2, paddingTop: SPACING.xs },
  thumb: { width: 84, height: 60, borderRadius: RADIUS.sm, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface },
  thumbActive: { borderWidth: 2, borderColor: COLORS.primaryBright },
  thumbPlay: { position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.overlay },
  titleBlock: { gap: SPACING.xs + 2 },
  name: { fontFamily: FONTS.bold, fontSize: 26, color: COLORS.text, letterSpacing: -0.4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  price: { marginTop: SPACING.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    height: 34,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  chipText: { fontSize: 12.5 },
  description: { lineHeight: 23 },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, flexWrap: 'wrap' },
  variantLabel: { minWidth: 70 },
  variants: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', flex: 1 },
  swatchRing: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.borderStrong },
  swatchActive: { borderColor: COLORS.primaryBright },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border },
  pill: { paddingHorizontal: SPACING.md + 2, height: 36, justifyContent: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.backgroundSecondary },
  pillActive: { borderColor: COLORS.primaryBright, backgroundColor: COLORS.primarySoft },
  section: { marginTop: SPACING.md },
  features: { gap: SPACING.sm + 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  flex: { flex: 1 },
  reviewSummary: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, marginBottom: SPACING.md },
  bigRating: { fontFamily: FONTS.extrabold, fontSize: 40, color: COLORS.text },
  review: { paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  reviewBody: { lineHeight: 19 },
  similar: { gap: SPACING.md },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: SPACING.md,
    backgroundColor: COLORS.glassStrong,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  barInner: { flexDirection: 'row', gap: SPACING.md, width: '100%', maxWidth: LAYOUT.maxContentWidth, paddingHorizontal: SPACING.screen },
});
