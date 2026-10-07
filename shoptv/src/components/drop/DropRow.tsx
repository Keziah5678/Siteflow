import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { AppImage, AppText, GlowCard, OutlineButton, PressableScale } from '@/components/ui';
import { COLORS, FONTS, GRADIENTS, RADIUS, SPACING } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { DROP_STATUS_LABEL, getDropStatus, getDropTarget } from '@/lib/drops';
import { formatDate, formatDropMoment } from '@/lib/format';
import type { Drop } from '@/types/models';

import { Countdown } from './Countdown';
import { LiveBadge } from './LiveBadge';

interface Props {
  drop: Drop;
  following: boolean;
  onPress: () => void;
  onToggleReminder: () => void;
}

/** Carte large d'un drop (page Drops) : statut, date, compte à rebours, rappel. */
export function DropRow({ drop, following, onPress, onToggleReminder }: Props) {
  const now = useNow();
  const status = getDropStatus(drop, now);
  const target = getDropTarget(drop, now);

  return (
    <PressableScale container onPress={onPress} scaleTo={0.98} accessibilityLabel={drop.title}>
      <GlowCard radius={RADIUS.lg} glow={status === 'live'} style={[styles.card, status === 'ended' && styles.ended]}>
        <AppImage uri={drop.imageUrl} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={GRADIENTS.scrimBottom} locations={[0, 0.45, 0.95]} style={StyleSheet.absoluteFill} />
        <View style={styles.top}>
          {status === 'live' ? (
            <LiveBadge />
          ) : (
            <View style={styles.status}>
              <AppText style={styles.statusText}>{DROP_STATUS_LABEL[status].toUpperCase()}</AppText>
            </View>
          )}
          <View style={styles.count}>
            <Ionicons name="cube-outline" size={13} color={COLORS.text} />
            <AppText variant="small">{drop.productIds.length} produits</AppText>
          </View>
        </View>
        <View style={styles.bottom}>
          <AppText style={styles.title}>{drop.title}</AppText>
          <AppText variant="caption" color={COLORS.textSecondary} numberOfLines={1}>
            {drop.subtitle}
          </AppText>
          <View style={styles.meta}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.primaryBright} />
            <AppText variant="caption">
              {status === 'ended' ? `Terminé le ${formatDate(drop.endsAt)}` : status === 'live' ? `En cours depuis ${formatDropMoment(drop.startsAt).toLowerCase()}` : formatDropMoment(drop.startsAt)}
            </AppText>
          </View>
          <View style={styles.actions}>
            {target ? <Countdown target={target} size="sm" /> : <View />}
            {status !== 'ended' ? (
              <OutlineButton
                label={following ? 'Rappel activé' : 'Me le rappeler'}
                icon={following ? 'notifications' : 'notifications-outline'}
                active={following}
                size="sm"
                onPress={onToggleReminder}
                style={styles.reminder}
              />
            ) : null}
          </View>
        </View>
      </GlowCard>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { height: 250 },
  ended: { opacity: 0.6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.md },
  status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryBorder },
  statusText: { fontFamily: FONTS.bold, fontSize: 10.5, color: COLORS.text, letterSpacing: 0.8 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.overlay },
  bottom: { flex: 1, justifyContent: 'flex-end', padding: SPACING.lg, gap: 3 },
  title: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.sm, gap: SPACING.sm },
  reminder: { backgroundColor: COLORS.overlay },
});
