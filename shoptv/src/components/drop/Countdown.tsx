import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useCountdown } from '@/hooks/useCountdown';
import { pad2 } from '@/lib/format';

interface Props {
  target: number | null;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/** Compte à rebours en temps réel (HH : MM : SS, ou J : HH : MM au-delà de 24 h). */
export function Countdown({ target, size = 'md', style }: Props) {
  const c = useCountdown(target);
  const units =
    c.days > 0
      ? [
          [c.days, 'Jours'],
          [c.hours, 'Heures'],
          [c.minutes, 'Minutes'],
        ]
      : [
          [c.hours, 'Heures'],
          [c.minutes, 'Minutes'],
          [c.seconds, 'Secondes'],
        ];
  const digit = size === 'sm' ? 18 : 24;
  return (
    <View style={[styles.box, size === 'sm' && styles.boxSm, style]} accessibilityRole="timer" accessibilityLabel={units.map(([v, l]) => `${v} ${l}`).join(', ')}>
      {units.map(([value, label], i) => (
        <View key={label as string} style={styles.row}>
          {i > 0 ? <AppText style={[styles.sep, { fontSize: digit }]}>:</AppText> : null}
          <View style={styles.unit}>
            <AppText style={[styles.digit, { fontSize: digit }]}>{pad2(value as number)}</AppText>
            <AppText style={styles.label}>{label as string}</AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.overlay,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  boxSm: { paddingVertical: SPACING.xs + 2, paddingHorizontal: SPACING.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  unit: { alignItems: 'center', minWidth: 40 },
  digit: { fontFamily: FONTS.bold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  sep: { fontFamily: FONTS.bold, color: COLORS.text, marginHorizontal: 4 },
  label: { fontFamily: FONTS.regular, fontSize: 9.5, color: COLORS.textSecondary, marginTop: 1 },
});
