import { StyleSheet, View } from 'react-native';

import { AppImage, AppText, OutlineButton, PressableScale } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { getDropStatus } from '@/lib/drops';
import { formatDropMoment } from '@/lib/format';
import type { Drop } from '@/types/models';

interface Props {
  drop: Drop;
  following: boolean;
  onPress: () => void;
  onToggleReminder: () => void;
  width?: number;
}

/** Carte compacte « Drops à venir » (Explorer). */
export function DropCard({ drop, following, onPress, onToggleReminder, width = 168 }: Props) {
  const live = getDropStatus(drop, useNow()) === 'live';
  return (
    <PressableScale container onPress={onPress} scaleTo={0.97} style={[styles.card, { width }]} accessibilityLabel={drop.title}>
      <AppImage uri={drop.imageUrl} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={styles.top}>
        <AppText style={styles.title} numberOfLines={1}>
          {drop.title}
        </AppText>
        <AppText variant="caption" numberOfLines={1} color={live ? COLORS.fuchsia : COLORS.text}>
          {live ? '● En cours' : formatDropMoment(drop.startsAt)}
        </AppText>
      </View>
      <OutlineButton
        label={following ? 'Rappel activé' : 'Me le rappeler'}
        icon={following ? 'notifications' : 'notifications-outline'}
        active={following}
        size="sm"
        onPress={onToggleReminder}
        style={styles.button}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 196,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  shade: { backgroundColor: COLORS.veilLight },
  top: { gap: 2 },
  title: {
    fontFamily: FONTS.extrabold,
    fontSize: 16,
    color: COLORS.primaryBright,
    textShadowColor: COLORS.glowText,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  button: { backgroundColor: COLORS.overlay },
});
