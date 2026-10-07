import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { GradientButton } from './GradientButton';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.icon, SHADOWS.glowSoft]}>
        <Ionicons name={icon} size={30} color={COLORS.primaryBright} />
      </View>
      <AppText variant="h3" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" color={COLORS.textSecondary} align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <GradientButton label={actionLabel} onPress={onAction} size="md" style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: SPACING.huge, paddingHorizontal: SPACING.xxl, gap: SPACING.sm },
  icon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    marginBottom: SPACING.sm,
  },
  message: { maxWidth: 300, lineHeight: 19 },
  button: { marginTop: SPACING.lg, alignSelf: 'stretch' },
});
