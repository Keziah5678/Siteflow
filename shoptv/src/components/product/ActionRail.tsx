import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { AppText, PressableScale } from '@/components/ui';
import { COLORS, FONTS, SPACING } from '@/constants/theme';
import { formatCount } from '@/lib/format';

export interface RailAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  count?: number;
  label: string;
  onPress: () => void;
}

function RailButton({ action, size }: { action: RailAction; size: number }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <PressableScale
      haptic
      accessibilityLabel={action.label}
      accessibilityState={{ selected: !!action.active }}
      onPress={() => {
        scale.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1));
        action.onPress();
      }}
      style={styles.item}
    >
      <Animated.View style={style}>
        <Ionicons
          name={action.active && action.activeIcon ? action.activeIcon : action.icon}
          size={size}
          color={action.active ? COLORS.fuchsia : COLORS.text}
          style={styles.icon}
        />
      </Animated.View>
      {action.count !== undefined ? <AppText style={styles.count}>{formatCount(action.count)}</AppText> : null}
    </PressableScale>
  );
}

/** Colonne d'actions sociales (likes, commentaires, partage, favoris). */
export function ActionRail({ actions, size = 30, style }: { actions: RailAction[]; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.rail, style]}>
      {actions.map((a) => (
        <RailButton key={a.key} action={a} size={size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { alignItems: 'center', gap: SPACING.lg },
  item: { alignItems: 'center', gap: 2 },
  icon: { textShadowColor: COLORS.scrimSoft, textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  count: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.text, textShadowColor: COLORS.scrim, textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
});
