import { StyleSheet, View } from 'react-native';

import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props<T extends string> {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}

/** Contrôle segmenté (onglets internes : En cours / À venir / Terminés…). */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.item, active && styles.active]}
          >
            <AppText style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {o.label}
              {o.count !== undefined ? ` · ${o.count}` : ''}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  item: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.xs },
  active: { backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.primaryBright },
  label: { fontFamily: FONTS.semibold, fontSize: 12.5, color: COLORS.textSecondary, letterSpacing: 0.4 },
  labelActive: { color: COLORS.text },
});
