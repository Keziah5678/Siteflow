import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AddressForm, EMPTY_ADDRESS, validateAddress } from '@/components/layout/AddressForm';
import { AppText, EmptyState, GradientButton, OutlineButton, PressableScale, Screen, ScreenHeader, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { updateProfile } from '@/services/auth';
import { useSession } from '@/store/session';
import type { Address } from '@/types/models';

export default function AddressesScreen() {
  const { profile, status } = useSession();
  const [draft, setDraft] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  if (status === 'signedOut' || !profile) return <Redirect href="/login" />;
  const addresses = profile.addresses;

  const save = async (next: Address[]) => {
    setSaving(true);
    try {
      await updateProfile({ addresses: next });
      setDraft(null);
      toast('Adresses mises à jour', 'success');
    } catch {
      toast('Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Adresses" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!addresses.length && !draft ? <EmptyState icon="location-outline" title="Aucune adresse" message="Ajoute une adresse pour commander plus vite." /> : null}
        {addresses.map((a, i) => (
          <View key={i} style={styles.card}>
            <Ionicons name={i === 0 ? 'home' : 'location-outline'} size={20} color={COLORS.primaryBright} />
            <View style={styles.flex}>
              <AppText variant="bodyMedium">
                {a.fullName}
                {i === 0 ? '  · Par défaut' : ''}
              </AppText>
              <AppText variant="caption" color={COLORS.textSecondary}>
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ''} — {a.postalCode} {a.city}, {a.country}
              </AppText>
            </View>
            <PressableScale onPress={() => save(addresses.filter((_, j) => j !== i))} accessibilityLabel="Supprimer l’adresse" hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </PressableScale>
          </View>
        ))}
        {draft ? (
          <>
            <AddressForm value={draft} onChange={setDraft} />
            <GradientButton
              label="Enregistrer l’adresse"
              loading={saving}
              onPress={() => {
                const err = validateAddress(draft);
                if (err) return toast(err, 'error');
                save([...addresses, draft].slice(0, 5));
              }}
            />
          </>
        ) : (
          <OutlineButton label="Ajouter une adresse" icon="add" onPress={() => setDraft({ ...EMPTY_ADDRESS, fullName: profile.fullName })} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.md, paddingBottom: SPACING.huge },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  flex: { flex: 1, gap: 2 },
});
