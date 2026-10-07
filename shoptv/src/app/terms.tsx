import { ScrollView, StyleSheet } from 'react-native';

import { AppText, Screen, ScreenHeader } from '@/components/ui';
import { COLORS, SPACING } from '@/constants/theme';

const SECTIONS = [
  ['1. Objet', 'Les présentes conditions régissent l’utilisation de l’application SHOPTV et les achats qui y sont réalisés.'],
  ['2. Compte', 'La découverte des contenus est libre. La création d’un compte est requise pour commander, sauvegarder des favoris et suivre des drops. Tu es responsable de la confidentialité de tes identifiants.'],
  ['3. Prix et drops', 'Les prix sont indiqués en euros TTC. Les prix des drops sont valables uniquement pendant la période affichée et dans la limite des stocks disponibles.'],
  ['4. Paiement', 'Le paiement est traité par un prestataire certifié (Stripe). SHOPTV ne conserve aucune donnée bancaire.'],
  ['5. Livraison et rétractation', 'Les délais sont indiqués sur chaque fiche produit. Tu disposes d’un délai de 30 jours pour exercer ton droit de rétractation.'],
  ['6. Données personnelles', 'Tes données sont utilisées pour gérer ton compte, tes commandes et personnaliser le flux « Pour toi ». Tu peux demander leur suppression à tout moment via le support.'],
];

export default function TermsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Conditions" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <AppText variant="small" color={COLORS.textMuted}>
          Modèle à faire valider par un juriste avant publication.
        </AppText>
        {SECTIONS.map(([title, body]) => (
          <AppText key={title} variant="body" color={COLORS.textSecondary}>
            <AppText variant="title">{title}</AppText>
            {'\n'}
            {body}
          </AppText>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.lg, paddingBottom: SPACING.huge },
});
