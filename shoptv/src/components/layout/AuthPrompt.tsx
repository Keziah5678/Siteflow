import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, GlowCard, GradientButton, OutlineButton } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

/** Invitation à se connecter (fonctions réservées aux membres). */
export function AuthPrompt({ title, message }: { title: string; message: string }) {
  return (
    <GlowCard radius={RADIUS.xl} contentStyle={styles.inner}>
      <AppText variant="h3">{title}</AppText>
      <AppText variant="caption" color={COLORS.textSecondary} style={styles.message}>
        {message}
      </AppText>
      <View style={styles.actions}>
        <GradientButton label="Se connecter" size="md" onPress={() => router.push('/login')} style={styles.flex} />
        <OutlineButton label="Créer un compte" onPress={() => router.push('/register')} style={styles.flex} />
      </View>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  inner: { padding: SPACING.xl, gap: SPACING.sm },
  message: { lineHeight: 19, fontSize: 14 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md },
  flex: { flex: 1 },
});
