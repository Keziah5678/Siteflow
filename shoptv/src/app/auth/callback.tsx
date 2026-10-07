import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, GradientButton } from '@/components/ui';
import { COLORS, SPACING } from '@/constants/theme';
import { exchangeAuthCode } from '@/services/auth';

/**
 * Retour des liens Supabase (confirmation d'email, OAuth, réinitialisation).
 * Le paramètre `code` (PKCE) est échangé contre une session.
 */
export default function AuthCallbackScreen() {
  const { code, next, error_description } = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(error_description ?? null);

  useEffect(() => {
    if (!code) {
      if (!error_description) router.replace('/home');
      return;
    }
    exchangeAuthCode(code)
      .then(() => router.replace(next === '/update-password' ? '/update-password' : '/home'))
      .catch((e) => setError(e instanceof Error ? e.message : 'Lien invalide ou expiré.'));
  }, [code, next, error_description]);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <AppText variant="h3" align="center">
            Lien invalide
          </AppText>
          <AppText variant="caption" color={COLORS.textSecondary} align="center">
            {error}
          </AppText>
          <GradientButton label="Retour à la connexion" onPress={() => router.replace('/login')} />
        </>
      ) : (
        <ActivityIndicator color={COLORS.primaryBright} size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: SPACING.screen, backgroundColor: COLORS.background },
});
