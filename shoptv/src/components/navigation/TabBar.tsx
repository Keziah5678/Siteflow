import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { ANIMATIONS, COLORS, FONTS, LAYOUT, SHADOWS } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export const TAB_META: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  home: { label: 'Accueil', icon: 'home-outline', activeIcon: 'home' },
  explore: { label: 'Explorer', icon: 'compass-outline', activeIcon: 'compass' },
  drops: { label: 'Drops', icon: 'bag-handle-outline', activeIcon: 'bag-handle' },
  favorites: { label: 'Favoris', icon: 'heart-outline', activeIcon: 'heart' },
  profile: { label: 'Profil', icon: 'person-outline', activeIcon: 'person' },
};

function TabItem({ name, focused, onPress, onLongPress }: { name: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const meta = TAB_META[name] ?? { label: name, icon: 'ellipse-outline', activeIcon: 'ellipse' };
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: ANIMATIONS.duration.normal });
  }, [focused, progress]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + progress.value * 0.08 }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.9, transform: [{ scale: 0.6 + progress.value * 0.4 }] }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={styles.item}
    >
      <Animated.View style={[styles.glow, SHADOWS.glow, glowStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? meta.activeIcon : meta.icon} size={24} color={focused ? COLORS.primaryBright : COLORS.textSecondary} />
      </Animated.View>
      <AppText style={[styles.label, focused && styles.labelActive]}>{meta.label}</AppText>
    </Pressable>
  );
}

/** Barre de navigation inférieure SHOPTV (néon sur l'onglet actif). */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <TabItem
              key={route.key}
              name={route.name}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Platform.OS === 'web' ? COLORS.background : COLORS.glassStrong,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  inner: { flexDirection: 'row', width: '100%', maxWidth: LAYOUT.maxContentWidth, height: LAYOUT.tabBarHeight },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  glow: { position: 'absolute', top: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primaryGlow },
  label: { fontFamily: FONTS.medium, fontSize: 11.5, color: COLORS.textSecondary },
  labelActive: {
    color: COLORS.primaryBright,
    fontFamily: FONTS.semibold,
    textShadowColor: COLORS.glowText,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
});
