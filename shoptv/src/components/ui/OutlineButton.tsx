import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  size?: 'sm' | 'md';
  tone?: 'primary' | 'neutral' | 'danger';
  style?: StyleProp<ViewStyle>;
}

/** Bouton secondaire à contour néon (ex. « Me le rappeler »). */
export function OutlineButton({ label, onPress, icon, active, size = 'md', tone = 'primary', style }: Props) {
  const color = tone === 'danger' ? COLORS.danger : tone === 'neutral' ? COLORS.text : COLORS.text;
  const border = tone === 'danger' ? COLORS.danger : tone === 'neutral' ? COLORS.borderStrong : COLORS.primaryBorder;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { borderColor: border },
        active && { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryBright },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={size === 'sm' ? 14 : 18} color={active ? COLORS.primaryBright : color} /> : null}
      <AppText variant={size === 'sm' ? 'caption' : 'bodyMedium'} color={color} numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryFaint,
  },
  sm: { height: 34, paddingHorizontal: SPACING.md },
  md: { height: 46, paddingHorizontal: SPACING.lg },
});
