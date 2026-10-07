import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText, PressableScale, SelectSheet } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="title">{title}</AppText>
      {children}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <AppText variant="bodyMedium">{label}</AppText>
        {hint ? (
          <AppText variant="small" color={COLORS.textSecondary}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: COLORS.primary, false: COLORS.surfaceElevated }} thumbColor={COLORS.white} accessibilityLabel={label} />
    </View>
  );
}

export function SelectField({ label, value, options, onChange }: { label: string; value: string | null; options: { value: string; label: string }[]; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={styles.selectWrap}>
      <AppText variant="caption" color={COLORS.textSecondary}>
        {label}
      </AppText>
      <PressableScale onPress={() => setOpen(true)} style={styles.select} accessibilityLabel={label}>
        <AppText variant="bodyMedium" style={styles.flex} color={current ? COLORS.text : COLORS.textMuted}>
          {current?.label ?? 'Aucun'}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
      </PressableScale>
      <SelectSheet
        visible={open}
        title={label}
        value={value ?? '__none'}
        options={[{ value: '__none', label: 'Aucun' }, ...options]}
        onSelect={(v) => onChange(v === '__none' ? null : v)}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

export function StatCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primaryBright} />
      </View>
      <AppText variant="h2">{value}</AppText>
      <AppText variant="small" color={COLORS.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  flex: { flex: 1 },
  selectWrap: { gap: 6 },
  select: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.backgroundSecondary },
  stat: { flexGrow: 1, flexBasis: 150, padding: SPACING.lg, gap: 4, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.primaryBorder },
  statIcon: { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft, marginBottom: 4 },
});
