import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS, SPACING } from '@/constants/theme';
import { formatPrice } from '@/lib/format';

import { AppText } from './AppText';
import { DiscountBadge } from './DiscountBadge';

interface Props {
  price: number;
  compareAt?: number | null;
  discount?: number;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

const SIZES = { sm: [13, 17], md: [18, 26], lg: [24, 34] } as const;

/** Ancien prix barré + nouveau prix lumineux (+ remise optionnelle). */
export function PriceTag({ price, compareAt, discount, size = 'md', style }: Props) {
  const [oldSize, newSize] = SIZES[size];
  return (
    <View style={[styles.row, style]}>
      {compareAt && compareAt > price ? (
        <AppText style={[styles.old, { fontSize: oldSize }]}>{formatPrice(compareAt)}</AppText>
      ) : null}
      <AppText style={[styles.price, { fontSize: newSize }]}>{formatPrice(price)}</AppText>
      {discount ? <DiscountBadge value={discount} size={size === 'lg' ? 'md' : 'sm'} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flexWrap: 'wrap' },
  old: { fontFamily: FONTS.medium, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  price: {
    fontFamily: FONTS.extrabold,
    color: COLORS.primaryBright,
    letterSpacing: -0.5,
    textShadowColor: COLORS.glowText,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
});
