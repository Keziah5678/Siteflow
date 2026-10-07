import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({ title, actionLabel = 'Voir tout', onAction, right, style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <AppText variant="h2" style={styles.title}>
        {title}
      </AppText>
      {right ??
        (onAction ? (
          <Pressable onPress={onAction} hitSlop={10} style={styles.action} accessibilityRole="link">
            <AppText variant="caption" color={COLORS.link}>
              {actionLabel}
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={COLORS.link} />
          </Pressable>
        ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  title: { fontSize: 20 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
