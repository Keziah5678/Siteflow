import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';

type Tone = 'success' | 'error' | 'info';
interface ToastState {
  message: string | null;
  tone: Tone;
  key: number;
  show: (message: string, tone?: Tone) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  key: 0,
  show: (message, tone = 'info') => set((s) => ({ message, tone, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

/** Raccourci utilisable hors composants (services, callbacks). */
export const toast = (message: string, tone: Tone = 'info') => useToast.getState().show(message, tone);

const ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'sparkles',
};

export function ToastHost() {
  const { message, tone, key, hide } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [message, key, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + SPACING.sm }]}>
      <Animated.View key={key} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp} style={[styles.toast, SHADOWS.glowSoft]}>
        <Ionicons name={ICON[tone]} size={20} color={tone === 'error' ? COLORS.danger : tone === 'success' ? COLORS.success : COLORS.primaryBright} />
        <AppText variant="bodyMedium" style={styles.text} numberOfLines={2}>
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    maxWidth: 420,
    marginHorizontal: SPACING.screen,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.glassStrong,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  text: { flexShrink: 1, fontSize: 14 },
});
