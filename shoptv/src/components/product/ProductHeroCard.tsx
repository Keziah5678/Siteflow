import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppImage, AppText, DiscountBadge, GlowCard, GradientButton, PressableScale, PriceTag } from '@/components/ui';
import { COLORS, FONTS, GRADIENTS, RADIUS, SPACING } from '@/constants/theme';
import { useProductActions } from '@/features/catalog/useProductActions';
import type { Product } from '@/types/models';

import { ActionRail } from './ActionRail';

interface Props {
  product: Product;
  width: number;
  height: number;
  onOpenVideo: () => void;
}

/** Grande carte produit du flux « Pour toi » (fidèle à la maquette). */
export const ProductHeroCard = memo(function ProductHeroCard({ product, width, height, onOpenVideo }: Props) {
  const actions = useProductActions(product);
  const openProduct = () => router.push(`/product/${product.slug}`);

  return (
    <GlowCard radius={RADIUS.xl} style={{ width, height }}>
      <PressableScale onPress={onOpenVideo} scaleTo={0.99} style={styles.media} accessibilityLabel={`Voir la vidéo ${product.name}`}>
        <AppImage uri={product.coverUrl} style={StyleSheet.absoluteFill} priority="high" />
        <LinearGradient colors={GRADIENTS.card} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={GRADIENTS.scrimBottom} locations={[0.35, 0.72, 1]} style={StyleSheet.absoluteFill} />
        {product.videoUrl ? (
          <View style={styles.play}>
            <Ionicons name="play" size={13} color={COLORS.text} />
            <AppText variant="small">Vidéo</AppText>
          </View>
        ) : null}
      </PressableScale>

      <DiscountBadge value={product.discountPercentage} style={styles.badge} />
      <PressableScale haptic onPress={() => actions.toggleFavorite('product')} style={styles.fav} accessibilityLabel="Ajouter aux favoris">
        <Ionicons name={actions.favorite ? 'heart' : 'heart-outline'} size={26} color={actions.favorite ? COLORS.fuchsia : COLORS.text} />
      </PressableScale>

      <ActionRail
        style={styles.rail}
        actions={[
          { key: 'like', icon: 'heart', activeIcon: 'heart', active: actions.liked, count: product.likesCount + (actions.liked ? 1 : 0), label: 'J’aime', onPress: actions.like },
          { key: 'comments', icon: 'chatbubble-ellipses', count: product.commentsCount, label: 'Commentaires', onPress: onOpenVideo },
          { key: 'share', icon: 'arrow-redo', count: product.sharesCount, label: 'Partager', onPress: actions.share },
        ]}
      />

      <View style={styles.bottom}>
        <AppText variant="h3" style={styles.name} numberOfLines={1}>
          {product.name}
        </AppText>
        <AppText variant="caption" color={COLORS.textSecondary} numberOfLines={1} style={styles.tagline}>
          {product.tagline}
        </AppText>
        <PriceTag price={product.price} compareAt={product.compareAtPrice} size="md" style={styles.price} />
        <GradientButton label="Voir le produit" icon="bag-handle-outline" size="md" onPress={openProduct} style={styles.cta} />
        <View style={styles.footer}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText}>TV</AppText>
          </View>
          <View style={styles.footerText}>
            <View style={styles.channel}>
              <AppText style={styles.channelName}>SHOPTV</AppText>
              <Ionicons name="checkmark-circle" size={14} color={COLORS.primaryBright} />
            </View>
            <AppText variant="small" color={COLORS.textSecondary} numberOfLines={1}>
              Découvre {product.name} et ses nouveautés
            </AppText>
          </View>
          <AppText variant="small" color={COLORS.link} onPress={openProduct}>
            plus
          </AppText>
        </View>
      </View>
    </GlowCard>
  );
});

const styles = StyleSheet.create({
  media: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  play: {
    position: 'absolute',
    top: 58,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.overlay,
  },
  badge: { position: 'absolute', top: SPACING.lg, left: SPACING.lg },
  fav: { position: 'absolute', top: SPACING.md, right: SPACING.md, padding: 4 },
  rail: { position: 'absolute', right: SPACING.md, top: '36%' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.lg, paddingTop: 0 },
  name: { fontSize: 20, fontFamily: FONTS.semibold, marginRight: 56 },
  tagline: { marginTop: 3, fontSize: 14 },
  price: { marginTop: SPACING.sm },
  cta: { marginTop: SPACING.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  avatarText: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.primaryBright },
  footerText: { flex: 1 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  channelName: { fontFamily: FONTS.bold, fontSize: 13.5, color: COLORS.text },
});
