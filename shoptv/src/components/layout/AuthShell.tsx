import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, Logo } from '@/components/ui';
import { COLORS, LAYOUT, SPACING } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/env';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.splashTop, COLORS.background]} style={styles.glow} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xxl }]} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <IconButton icon="close" size={42} accessibilityLabel="Fermer" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))} />
          </View>
          <Animated.View entering={FadeInDown.duration(450)} style={styles.head}>
            <Logo size={26} />
            <AppText variant="h1" style={styles.title}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="body" color={COLORS.textSecondary}>
                {subtitle}
              </AppText>
            ) : null}
            {!isSupabaseConfigured ? (
              <AppText variant="small" color={COLORS.warning}>
                Mode démo : un compte local (avec accès admin) est créé sur cet appareil.
              </AppText>
            ) : null}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.body}>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACING.screen, width: '100%', maxWidth: LAYOUT.maxContentWidth, alignSelf: 'center' },
  top: { alignItems: 'flex-end' },
  head: { gap: SPACING.sm, marginTop: SPACING.lg, marginBottom: SPACING.xxl },
  title: { marginTop: SPACING.lg },
  body: { gap: SPACING.md },
});
