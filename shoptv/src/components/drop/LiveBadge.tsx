import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';

/** Pastille « EN DIRECT » clignotante pour les drops en cours. */
export function LiveBadge({ label = 'EN COURS', style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
  }, [o]);
  const dot = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View style={[styles.badge, style]}>
      <Animated.View style={[styles.dot, dot]} />
      <AppText style={styles.text}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.danger },
  text: { fontFamily: FONTS.bold, fontSize: 10.5, color: COLORS.text, letterSpacing: 0.8 },
});
