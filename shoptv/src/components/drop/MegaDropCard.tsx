import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppImage, AppText, GlowCard, GradientButton, PressableScale } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { getDropStatus, getDropTarget } from '@/lib/drops';
import { formatDropMoment } from '@/lib/format';
import type { Drop } from '@/types/models';

import { Countdown } from './Countdown';
import { LiveBadge } from './LiveBadge';

interface Props {
  drop: Drop;
  onPress: () => void;
}

/** Grande carte « MEGA DROP » de l'accueil (compte à rebours réel, statut automatique). */
export function MegaDropCard({ drop, onPress }: Props) {
  const now = useNow();
  const status = getDropStatus(drop, now);
  const target = getDropTarget(drop, now);
  const moment = status === 'live' ? 'EN COURS' : formatDropMoment(drop.startsAt).toUpperCase();

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(120)}>
      <PressableScale container onPress={onPress} scaleTo={0.985} accessibilityLabel={`${drop.title}, ${moment}`}>
        <GlowCard animated radius={RADIUS.xl} style={styles.card}>
          <AppImage uri={drop.imageUrl} style={styles.image} />
          <LinearGradient
            colors={[COLORS.backgroundSecondary, COLORS.surfaceFade, COLORS.transparentSurface]}
            locations={[0, 0.45, 0.85]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={[COLORS.primaryHaze, COLORS.primaryClear]} start={{ x: 0, y: 1 }} end={{ x: 0.6, y: 0.3 }} style={StyleSheet.absoluteFill} />
          <View style={styles.content}>
            {status === 'live' ? <LiveBadge style={styles.live} /> : null}
            <AppText style={styles.title} numberOfLines={1}>
              {drop.title}
            </AppText>
            <AppText style={styles.moment}>{moment}</AppText>
            <AppText variant="caption" style={styles.subtitle} numberOfLines={2}>
              {drop.subtitle}
            </AppText>
            <GradientButton label="Voir les produits" size="sm" onPress={onPress} style={styles.button} />
            {target ? <Countdown target={target} style={styles.countdown} /> : null}
          </View>
        </GlowCard>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { height: 270 },
  image: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '62%' },
  content: { flex: 1, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, justifyContent: 'center' },
  live: { marginBottom: SPACING.sm },
  title: {
    fontFamily: FONTS.display,
    fontSize: 27,
    lineHeight: 36,
    color: COLORS.text,
    letterSpacing: 0.5,
    textShadowColor: COLORS.glowText,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  moment: { fontFamily: FONTS.displayBold, fontSize: 14, lineHeight: 20, color: COLORS.text, marginTop: 4, letterSpacing: 0.6 },
  subtitle: { marginTop: SPACING.sm, width: '58%', lineHeight: 19, fontSize: 14 },
  button: { alignSelf: 'flex-start', marginTop: SPACING.md, minWidth: 150 },
  countdown: { marginTop: SPACING.md },
});
