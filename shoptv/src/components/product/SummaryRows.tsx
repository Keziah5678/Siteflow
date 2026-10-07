import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { formatPrice } from '@/lib/format';
import { FREE_SHIPPING_THRESHOLD } from '@/services/orders';

interface Props {
  subtotal: number;
  shipping: number;
  total: number;
  savings?: number;
}

/** Récapitulatif sous-total / livraison / total. */
export function SummaryRows({ subtotal, shipping, total, savings }: Props) {
  return (
    <View style={styles.box}>
      <Row label="Sous-total" value={formatPrice(subtotal)} />
      <Row label="Livraison" value={shipping === 0 ? 'Offerte' : formatPrice(shipping)} highlight={shipping === 0} />
      {savings ? <Row label="Économies" value={`-${formatPrice(savings)}`} highlight /> : null}
      {shipping > 0 ? (
        <AppText variant="small" color={COLORS.textSecondary}>
          Plus que {formatPrice(Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal))} pour la livraison offerte.
        </AppText>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.row}>
        <AppText variant="h3">Total</AppText>
        <AppText style={styles.total}>{formatPrice(total)}</AppText>
      </View>
    </View>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="body" color={COLORS.textSecondary}>
        {label}
      </AppText>
      <AppText variant="bodyMedium" color={highlight ? COLORS.success : COLORS.text}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  total: { fontFamily: FONTS.extrabold, fontSize: 24, color: COLORS.primaryBright },
});
