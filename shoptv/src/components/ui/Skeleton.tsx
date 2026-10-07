import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { COLORS, GRADIENTS, RADIUS } from '@/constants/theme';

interface Props {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Bloc de chargement avec reflet animé. */
export function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm, style }: Props) {
  const x = useSharedValue(-1);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [x]);
  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: `${x.value * 100}%` }] }));
  return (
    <View style={[{ width, height, borderRadius: radius }, styles.base, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, shimmer]}>
        <LinearGradient colors={GRADIENTS.shimmer} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: COLORS.surface, overflow: 'hidden' },
});
