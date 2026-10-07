import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { COLORS, FONTS, GRADIENTS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type IconName = keyof typeof Ionicons.glyphMap;

interface Props {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Halo lumineux animé (respiration). */
  pulse?: boolean;
}

const HEIGHT = { sm: 38, md: 50, lg: 56 } as const;

/** Bouton principal lumineux (dégradé violet → fuchsia + halo). */
export function GradientButton({ label, onPress, icon, size = 'lg', loading, disabled, style, pulse = false }: Props) {
  const glow = useSharedValue(0.55);
  useEffect(() => {
    if (pulse) glow.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const height = HEIGHT[size];
  return (
    <PressableScale
      haptic
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[{ height, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.glow, SHADOWS.glow, { borderRadius: size === 'sm' ? RADIUS.pill : RADIUS.md }, glowStyle]} />
      <LinearGradient
        colors={GRADIENTS.primaryButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: size === 'sm' ? RADIUS.pill : RADIUS.md }]}
      >
        <View style={styles.highlight} />
        {loading ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <View style={styles.row}>
            {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 20} color={COLORS.white} /> : null}
            <AppText variant={size === 'sm' ? 'caption' : 'button'} style={size === 'sm' && styles.smLabel}>
              {label}
            </AppText>
          </View>
        )}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  glow: { backgroundColor: COLORS.primary },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.highlightBorder,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: COLORS.highlight,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  smLabel: { fontFamily: FONTS.semibold },
});
