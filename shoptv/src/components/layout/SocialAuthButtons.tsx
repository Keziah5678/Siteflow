import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, OutlineButton, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/env';
import { isAppleSignInAvailable, isGoogleSignInEnabled, signInWithApple, signInWithGoogle } from '@/services/auth';

/** Apple (iOS natif) et Google (si activé dans Supabase via EXPO_PUBLIC_GOOGLE_AUTH_ENABLED). */
export function SocialAuthButtons({ onDone }: { onDone: () => void }) {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    isAppleSignInAvailable().then(setApple).catch(() => setApple(false));
  }, []);
  const google = isGoogleSignInEnabled() || !isSupabaseConfigured;

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      onDone();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      toast(e instanceof Error ? e.message : 'Connexion impossible', 'error');
    }
  };

  if (!apple && !google) return null;
  return (
    <View style={styles.wrap}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <AppText variant="small" color={COLORS.textMuted}>
          ou
        </AppText>
        <View style={styles.line} />
      </View>
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={RADIUS.md}
          style={styles.apple}
          onPress={() => run(signInWithApple)}
        />
      ) : null}
      {google ? <OutlineButton label="Continuer avec Google" icon="logo-google" tone="neutral" onPress={() => run(signInWithGoogle)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md, marginTop: SPACING.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  apple: { height: 50, width: '100%' },
});
