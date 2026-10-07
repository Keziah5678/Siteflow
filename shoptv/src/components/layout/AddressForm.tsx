import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/ui';
import { SPACING } from '@/constants/theme';
import type { Address } from '@/types/models';

export const EMPTY_ADDRESS: Address = { fullName: '', line1: '', line2: '', postalCode: '', city: '', country: 'France', phone: '' };

export function validateAddress(a: Address): string | null {
  if (a.fullName.trim().length < 2) return 'Indique le nom du destinataire.';
  if (a.line1.trim().length < 4) return 'Indique une adresse valide.';
  if (!/^[0-9A-Za-z -]{3,10}$/.test(a.postalCode.trim())) return 'Code postal invalide.';
  if (a.city.trim().length < 2) return 'Indique la ville.';
  return null;
}

export function AddressForm({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <View style={styles.form}>
      <TextField label="Nom complet" icon="person-outline" value={value.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" />
      <TextField label="Adresse" icon="location-outline" value={value.line1} onChangeText={set('line1')} autoComplete="street-address" />
      <TextField label="Complément (optionnel)" value={value.line2 ?? ''} onChangeText={set('line2')} />
      <View style={styles.row}>
        <View style={styles.postal}>
          <TextField label="Code postal" value={value.postalCode} onChangeText={set('postalCode')} keyboardType="number-pad" autoComplete="postal-code" />
        </View>
        <View style={styles.flex}>
          <TextField label="Ville" value={value.city} onChangeText={set('city')} />
        </View>
      </View>
      <TextField label="Pays" value={value.country} onChangeText={set('country')} />
      <TextField label="Téléphone (optionnel)" icon="call-outline" value={value.phone ?? ''} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  postal: { width: 130 },
  flex: { flex: 1 },
});
