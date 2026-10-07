import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS, GRADIENTS, RADIUS, SHADOWS } from '@/constants/theme';

import { AppText } from './AppText';

export function DiscountBadge({ value, size = 'md', style }: { value: number; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  if (!value) return null;
  return (
    <LinearGradient
      colors={GRADIENTS.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.badge, size === 'sm' && styles.sm, SHADOWS.glowSoft, style]}
    >
      <AppText style={[styles.text, size === 'sm' && styles.smText]}>-{value}%</AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.xs, alignSelf: 'flex-start' },
  sm: { paddingHorizontal: 7, paddingVertical: 2 },
  text: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.white },
  smText: { fontSize: 12 },
});
