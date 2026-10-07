import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Screen, ScreenHeader } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { isOnlinePaymentEnabled, PAYMENT_METHODS } from '@/services/payments';

/**
 * Les moyens de paiement sont gérés par Stripe (aucune donnée bancaire
 * n'est stockée par SHOPTV). Cette page présente les options disponibles.
 */
export default function PaymentMethodsScreen() {
  const enabled = isOnlinePaymentEnabled();
  return (
    <Screen>
      <ScreenHeader title="Moyens de paiement" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.banner, !enabled && styles.bannerOff]}>
          <Ionicons name={enabled ? 'shield-checkmark' : 'information-circle-outline'} size={22} color={enabled ? COLORS.success : COLORS.warning} />
          <AppText variant="caption" color={COLORS.textSecondary} style={styles.flex}>
            {enabled
              ? 'Paiements sécurisés par Stripe. Tes cartes sont enregistrées chez Stripe, jamais sur nos serveurs.'
              : 'Le paiement en ligne sera disponible dès l’activation de Stripe (clé publishable + Edge Function).'}
          </AppText>
        </View>
        {PAYMENT_METHODS.map((m) => (
          <View key={m.id} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name={m.icon} size={20} color={COLORS.text} />
            </View>
            <AppText variant="bodyMedium" style={styles.flex}>
              {m.label}
            </AppText>
            <AppText variant="small" color={enabled ? COLORS.success : COLORS.textMuted}>
              {enabled ? 'Disponible' : 'Bientôt'}
            </AppText>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.md },
  banner: { flexDirection: 'row', gap: SPACING.md, alignItems: 'center', padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.successSoft, borderWidth: 1, borderColor: COLORS.successBorder },
  bannerOff: { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warningBorder },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  icon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceElevated },
  flex: { flex: 1 },
});
