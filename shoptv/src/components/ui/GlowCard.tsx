import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { COLORS, GRADIENTS, RADIUS, SHADOWS } from '@/constants/theme';

interface Props {
  children: ReactNode;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Respiration lumineuse de la bordure néon. */
  animated?: boolean;
  glow?: boolean;
}

/** Carte à bordure néon dégradée (violet → fuchsia) et halo. */
export function GlowCard({ children, radius = RADIUS.xl, style, contentStyle, animated = false, glow = true }: Props) {
  const pulse = useSharedValue(0.75);
  useEffect(() => {
    if (animated) pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [animated, pulse]);
  const borderStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={[{ borderRadius: radius }, glow && SHADOWS.glowSoft, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, borderStyle]}>
        <LinearGradient colors={GRADIENTS.cardBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />
      </Animated.View>
      <View style={[styles.inner, { borderRadius: radius - 1.5 }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, margin: 1.5, overflow: 'hidden', backgroundColor: COLORS.backgroundSecondary },
});
