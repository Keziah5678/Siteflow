import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { COLORS, FONTS, RADIUS } from '@/constants/theme';

export function QuantityStepper({ value, onChange, max = 20 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <View style={styles.wrap}>
      <PressableScale haptic onPress={() => onChange(value - 1)} style={styles.btn} accessibilityLabel={value <= 1 ? 'Supprimer' : 'Diminuer'}>
        <Ionicons name={value <= 1 ? 'trash-outline' : 'remove'} size={16} color={value <= 1 ? COLORS.danger : COLORS.text} />
      </PressableScale>
      <AppText style={styles.value}>{value}</AppText>
      <PressableScale haptic onPress={() => value < max && onChange(value + 1)} style={[styles.btn, value >= max && styles.disabled]} accessibilityLabel="Augmenter">
        <Ionicons name="add" size={16} color={COLORS.text} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface },
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  value: { minWidth: 24, textAlign: 'center', fontFamily: FONTS.semibold, fontSize: 15, color: COLORS.text },
});
