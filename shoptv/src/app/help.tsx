import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, OutlineButton, PressableScale, Screen, ScreenHeader } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

const FAQ = [
  { q: 'Qu’est-ce qu’un Drop ?', a: 'Un drop est une vente limitée dans le temps : une sélection de produits à prix réduit pendant quelques heures. Active « Me le rappeler » pour être prévenu.' },
  { q: 'Faut-il un compte pour regarder ?', a: 'Non. Tu peux découvrir les vidéos et les produits librement. Un compte est nécessaire pour commander, sauvegarder des favoris et suivre un drop.' },
  { q: 'Quels sont les délais de livraison ?', a: 'Ils sont indiqués sur chaque fiche produit (généralement 24 h à 4 jours). La livraison est offerte dès 50 € d’achat.' },
  { q: 'Comment retourner un produit ?', a: 'Tu disposes de 30 jours pour changer d’avis. Rends-toi dans Commandes, sélectionne la commande puis contacte le support.' },
  { q: 'Mes paiements sont-ils sécurisés ?', a: 'Oui. Les paiements sont traités par Stripe ; SHOPTV ne stocke jamais tes données bancaires.' },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Screen>
      <ScreenHeader title="Aide" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {FAQ.map((f, i) => (
          <PressableScale key={f.q} onPress={() => setOpen(open === i ? null : i)} scaleTo={0.99} style={styles.item} accessibilityLabel={f.q}>
            <View style={styles.head}>
              <AppText variant="bodyMedium" style={styles.flex}>
                {f.q}
              </AppText>
              <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textSecondary} />
            </View>
            {open === i ? (
              <Animated.View entering={FadeIn}>
                <AppText variant="caption" color={COLORS.textSecondary} style={styles.answer}>
                  {f.a}
                </AppText>
              </Animated.View>
            ) : null}
          </PressableScale>
        ))}
        <OutlineButton label="Contacter le support" icon="mail-outline" onPress={() => Linking.openURL('mailto:support@shoptv.app')} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.md, paddingBottom: SPACING.huge },
  item: { padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  flex: { flex: 1 },
  answer: { marginTop: SPACING.sm, lineHeight: 20 },
});
