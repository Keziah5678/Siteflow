import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  badge?: number;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
}

export function ListRow({ icon, label, value, badge, onPress, danger, right }: Props) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} disabled={!onPress} style={styles.row} accessibilityLabel={label}>
      <View style={[styles.icon, danger && styles.iconDanger]}>
        <Ionicons name={icon} size={19} color={danger ? COLORS.danger : COLORS.primaryBright} />
      </View>
      <AppText variant="bodyMedium" style={styles.label} color={danger ? COLORS.danger : COLORS.text}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="caption" color={COLORS.textSecondary} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="small">{badge}</AppText>
        </View>
      ) : null}
      {right ?? (onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} /> : null)}
    </PressableScale>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, minHeight: 56, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icon: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  iconDanger: { backgroundColor: COLORS.dangerSoft },
  label: { flex: 1, fontSize: 15 },
  value: { maxWidth: 140 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.fuchsia },
});
