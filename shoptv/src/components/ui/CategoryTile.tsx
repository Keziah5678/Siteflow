import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { COLORS, GRADIENTS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

interface Props {
  label: string;
  icon: string;
  active?: boolean;
  onPress?: () => void;
  width?: number;
}

/** Tuile catégorie (icône + libellé) — active : dégradé violet lumineux. */
export function CategoryTile({ label, icon, active, onPress, width = 66 }: Props) {
  const iconName = (icon in Ionicons.glyphMap ? icon : 'grid-outline') as keyof typeof Ionicons.glyphMap;
  return (
    <PressableScale
      haptic
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      style={[styles.tile, { width }, active && SHADOWS.glow]}
    >
      {active ? (
        <LinearGradient colors={GRADIENTS.primaryButton} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.radius]} />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.radius, styles.border, active && styles.borderActive]} />
      <Ionicons name={iconName} size={22} color={COLORS.text} />
      <AppText variant="caption" numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
  },
  radius: { borderRadius: RADIUS.md },
  border: { borderWidth: 1, borderColor: COLORS.borderStrong },
  borderActive: { borderColor: COLORS.highlightStrong },
  label: { fontSize: 12.5 },
});
