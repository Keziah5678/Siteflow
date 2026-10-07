import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, FONTS, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  badge?: number;
  size?: number;
  variant?: 'square' | 'ghost' | 'round';
  color?: string;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Bouton icône à bordure (en-tête : recherche, panier…). */
export function IconButton({ icon, onPress, badge, size = 48, variant = 'square', color = COLORS.text, accessibilityLabel, style }: Props) {
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[
        { width: size, height: size },
        styles.base,
        variant === 'square' && styles.square,
        variant === 'round' && styles.round,
        style,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={color} />
      {badge ? (
        <View style={[styles.badge, SHADOWS.glowFuchsia]}>
          <AppText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  square: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.backgroundSecondary,
  },
  round: { borderRadius: RADIUS.pill, backgroundColor: COLORS.overlay },
  badge: {
    position: 'absolute',
    top: -7,
    right: -7,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.fuchsia,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: { ...TYPOGRAPHY.small, fontFamily: FONTS.bold, color: COLORS.white },
});
