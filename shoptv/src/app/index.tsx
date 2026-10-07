import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, Logo } from '@/components/ui';
import { COLORS, SHADOWS } from '@/constants/theme';
import { useLibrary } from '@/store/library';
import { useSession } from '@/store/session';

/** Splash animé : logo néon, puis redirection (onboarding ou accueil). */
export default function SplashRoute() {
  const status = useSession((s) => s.status);
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);
  const halo = useSharedValue(0.3);
  const bar = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.6)) });
    halo.value = withRepeat(withSequence(withTiming(1, { duration: 800 }), withTiming(0.4, { duration: 800 })), -1);
    bar.value = withDelay(200, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }));
  }, [opacity, scale, halo, bar]);

  useEffect(() => {
    if (status === 'loading') return;
    const t = setTimeout(() => {
      router.replace(useLibrary.getState().hasSeenOnboarding ? '/home' : '/onboarding');
    }, 1300);
    return () => clearTimeout(t);
  }, [status]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.splashTop, COLORS.background]} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.8 }} />
      <Animated.View style={[styles.halo, SHADOWS.glow, haloStyle]} />
      <Animated.View style={[styles.center, logoStyle]}>
        <Logo size={44} />
        <AppText variant="caption" color={COLORS.textSecondary} style={styles.tagline}>
          Le shopping devient un spectacle.
        </AppText>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  center: { alignItems: 'center' },
  halo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: COLORS.primaryTint },
  tagline: { marginTop: 10, fontSize: 14 },
  track: { marginTop: 36, width: 140, height: 3, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primaryBright },
});
