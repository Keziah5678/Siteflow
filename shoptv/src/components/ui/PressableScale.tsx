import * as Haptics from 'expo-haptics';
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ANIMATIONS } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  /**
   * `container` : carte cliquable contenant d'autres boutons. Évite un
   * <button> imbriqué sur le web (HTML invalide) ; le natif n'est pas affecté.
   */
  container?: boolean;
}

/** Micro-interaction standard : légère compression au toucher + retour haptique. */
export function PressableScale({ style, scaleTo = ANIMATIONS.pressScale, haptic = false, container = false, onPressIn, onPressOut, onPress, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole={container && Platform.OS === 'web' ? undefined : 'button'}
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, ANIMATIONS.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, ANIMATIONS.spring);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress?.(e);
      }}
      style={[style, animated]}
    />
  );
}
