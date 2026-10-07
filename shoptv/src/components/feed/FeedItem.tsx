import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ActionRail } from '@/components/product/ActionRail';
import { AppImage, AppText, GradientButton, IconButton, PriceTag } from '@/components/ui';
import { COLORS, FONTS, GRADIENTS, RADIUS, SPACING } from '@/constants/theme';
import { useProductActions } from '@/features/catalog/useProductActions';
import { trackEvent } from '@/services/user-data';
import type { Product } from '@/types/models';

import { CommentsSheet } from './CommentsSheet';

interface Props {
  product: Product;
  width: number;
  height: number;
  /** Élément visible : lecture. */
  active: boolean;
  /** Élément voisin : lecteur créé et mis en tampon (préchargement). */
  preload: boolean;
  muted: boolean;
  onToggleMute: () => void;
  bottomInset: number;
}

/** Poster animé (léger zoom) quand la vidéo n'est pas disponible. */
function KenBurns({ uri }: { uri: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.12, { duration: 9000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <AppImage uri={uri} style={StyleSheet.absoluteFill} priority="high" />
    </Animated.View>
  );
}

function ProgressBar({ player }: { player: VideoPlayer }) {
  const progress = useSharedValue(0);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const d = player.duration;
    if (d > 0) progress.value = withTiming(currentTime / d, { duration: 250, easing: Easing.linear });
  });
  const style = useAnimatedStyle(() => ({ width: `${Math.min(1, progress.value) * 100}%` }));
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
}

function Player({ uri, poster, active, muted, onReady }: { uri: string; poster: string; active: boolean; muted: boolean; onReady: (p: VideoPlayer) => void }) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
    p.bufferOptions = { preferredForwardBufferDuration: 6 };
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setFailed(true);
    if (status === 'readyToPlay') setReady(true);
  });
  useEffect(() => {
    onReady(player);
  }, [player, onReady]);
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  useEffect(() => {
    if (failed) return;
    if (active) player.play();
    else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, player, failed]);

  return (
    <>
      <KenBurns uri={poster} />
      {!failed ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, !ready && styles.hidden]}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}
      {active && !failed ? <ProgressBar player={player} /> : null}
    </>
  );
}

export const FeedItem = memo(function FeedItem({ product, width, height, active, preload, muted, onToggleMute, bottomInset }: Props) {
  const actions = useProductActions(product);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const playerRef = useRef<VideoPlayer | null>(null);
  const startedAt = useRef<number | null>(null);

  // Temps de visionnage → moteur de recommandation.
  useEffect(() => {
    if (active) {
      startedAt.current = Date.now();
      trackEvent({ type: 'view_product', productId: product.id, categoryId: product.categoryId });
      setPaused(false);
      return () => {
        const seconds = startedAt.current ? (Date.now() - startedAt.current) / 1000 : 0;
        if (seconds >= 2) trackEvent({ type: 'watch', productId: product.id, categoryId: product.categoryId, value: Math.round(seconds) });
      };
    }
  }, [active, product.id, product.categoryId]);

  const onPlayerReady = useCallback((p: VideoPlayer) => {
    playerRef.current = p;
  }, []);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.playing) {
      p.pause();
      setPaused(true);
    } else {
      p.play();
      setPaused(false);
    }
  };

  const showPlayer = !!product.videoUrl && (active || preload);

  return (
    <View style={{ width, height, backgroundColor: COLORS.black }}>
      <Pressable onPress={togglePlay} style={StyleSheet.absoluteFill} accessibilityLabel={paused ? 'Lire' : 'Pause'}>
        {showPlayer ? (
          <Player uri={product.videoUrl!} poster={product.coverUrl} active={active && !paused} muted={muted} onReady={onPlayerReady} />
        ) : (
          <KenBurns uri={product.coverUrl} />
        )}
        <LinearGradient colors={GRADIENTS.scrimTop} style={styles.topScrim} />
        <LinearGradient colors={GRADIENTS.scrimBottom} locations={[0.45, 0.7, 1]} style={StyleSheet.absoluteFill} />
        {paused ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.pauseIcon}>
            <Ionicons name="play" size={40} color={COLORS.text} />
          </Animated.View>
        ) : null}
      </Pressable>

      <IconButton
        icon={muted ? 'volume-mute' : 'volume-high'}
        variant="round"
        size={42}
        accessibilityLabel={muted ? 'Activer le son' : 'Couper le son'}
        onPress={onToggleMute}
        style={styles.mute}
      />

      <ActionRail
        style={[styles.rail, { bottom: bottomInset + 190 }]}
        size={32}
        actions={[
          { key: 'like', icon: 'heart', active: actions.liked, count: product.likesCount + (actions.liked ? 1 : 0), label: 'J’aime', onPress: actions.like },
          { key: 'comments', icon: 'chatbubble-ellipses', count: product.commentsCount, label: 'Commentaires', onPress: () => setCommentsOpen(true) },
          { key: 'share', icon: 'arrow-redo', count: product.sharesCount, label: 'Partager', onPress: actions.share },
          { key: 'fav', icon: 'heart-outline', activeIcon: 'heart-circle', active: actions.favorite, label: 'Ajouter aux favoris', onPress: () => actions.toggleFavorite('product') },
          { key: 'save', icon: 'bookmark-outline', activeIcon: 'bookmark', active: actions.savedVideo, label: 'Sauvegarder la vidéo', onPress: () => actions.toggleFavorite('video') },
        ]}
      />

      <View style={[styles.info, { paddingBottom: bottomInset + SPACING.lg }]}>
        {product.brand ? (
          <View style={styles.brand}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.primaryBright} />
            <AppText variant="small">{product.brand.name}</AppText>
          </View>
        ) : null}
        <AppText style={styles.name} numberOfLines={2}>
          {product.name}
        </AppText>
        <PriceTag price={product.price} compareAt={product.compareAtPrice} discount={product.discountPercentage} size="md" />
        <AppText variant="caption" color={COLORS.textSecondary} numberOfLines={2} style={styles.tagline}>
          {product.tagline}
        </AppText>
        <View style={styles.ctaRow}>
          <IconButton icon="cart-outline" size={52} accessibilityLabel="Ajouter au panier" onPress={() => actions.addToCart(product.variants[0]?.id ?? null)} />
          <GradientButton label="Voir le produit" icon="bag-handle-outline" size="lg" style={styles.cta} onPress={() => router.push(`/product/${product.slug}`)} />
        </View>
      </View>

      {commentsOpen ? <CommentsSheet productId={product.id} count={product.commentsCount} visible onClose={() => setCommentsOpen(false)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  pauseIcon: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.veil,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: COLORS.track },
  progressFill: { height: '100%', backgroundColor: COLORS.primaryBright },
  mute: { position: 'absolute', right: SPACING.lg, top: 110 },
  rail: { position: 'absolute', right: SPACING.md },
  info: { position: 'absolute', left: 0, right: 72, bottom: 0, paddingHorizontal: SPACING.screen, gap: SPACING.sm },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.overlay,
  },
  name: { fontFamily: FONTS.bold, fontSize: 24, color: COLORS.text, letterSpacing: -0.3 },
  tagline: { fontSize: 14, lineHeight: 19 },
  ctaRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, marginRight: -60 },
  cta: { flex: 1 },
});
