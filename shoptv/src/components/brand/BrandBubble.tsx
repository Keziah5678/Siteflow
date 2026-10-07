import { StyleSheet, View } from 'react-native';

import { AppImage, AppText, PressableScale } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { Brand } from '@/types/models';

/**
 * Pastille marque : logo depuis Supabase Storage si fourni,
 * sinon monogramme (aucun logo officiel reproduit).
 */
export function BrandBubble({ brand, onPress, size = 66 }: { brand: Brand; onPress: () => void; size?: number }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={brand.name} style={styles.wrap}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        {brand.logoUrl ? (
          <AppImage uri={brand.logoUrl} style={{ width: size * 0.6, height: size * 0.6 }} contentFit="contain" />
        ) : (
          <AppText style={[styles.mono, { fontSize: brand.monogram.length > 1 ? size * 0.3 : size * 0.4 }]}>{brand.monogram}</AppText>
        )}
      </View>
      <AppText variant="caption" numberOfLines={1} style={styles.name}>
        {brand.name}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: SPACING.sm, width: 74 },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
  },
  mono: { fontFamily: FONTS.display, color: COLORS.background, letterSpacing: -0.5 },
  name: { fontSize: 12.5 },
});
