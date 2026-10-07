import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressForm, EMPTY_ADDRESS, validateAddress } from '@/components/layout/AddressForm';
import { SummaryRows } from '@/components/product/SummaryRows';
import { AppImage, AppText, GradientButton, PressableScale, Screen, ScreenHeader, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useCartSummary } from '@/features/cart/hooks';
import { formatPrice } from '@/lib/format';
import { updateProfile } from '@/services/auth';
import { placeOrder } from '@/services/orders';
import { isOnlinePaymentEnabled, PAYMENT_METHODS, payOrder, type PaymentMethodId } from '@/services/payments';
import { useSession } from '@/store/session';
import type { Address } from '@/types/models';

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const client = useQueryClient();
  const { profile, status, isDemo } = useSession();
  const summary = useCartSummary();
  const saved = profile?.addresses ?? [];
  const [selected, setSelected] = useState<number | 'new'>(saved.length ? 0 : 'new');
  const [address, setAddress] = useState<Address>({ ...EMPTY_ADDRESS, fullName: profile?.fullName ?? '' });
  const [method, setMethod] = useState<PaymentMethodId>('card');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signedOut') return <Redirect href="/login" />;
  const data = summary.data;
  if (data && !data.lines.length && !submitting) return <Redirect href="/cart" />;

  const submit = async () => {
    const shipping = selected === 'new' ? address : saved[selected];
    const err = validateAddress(shipping);
    if (err) return toast(err, 'error');
    setSubmitting(true);
    try {
      if (selected === 'new') await updateProfile({ addresses: [shipping, ...saved].slice(0, 5) }).catch(() => undefined);
      const orderId = await placeOrder(shipping, method);
      let paidOnline = false;
      if (!isDemo && isOnlinePaymentEnabled()) paidOnline = (await payOrder(orderId)) === 'paid';
      client.invalidateQueries({ queryKey: ['orders'] });
      toast(isDemo || paidOnline ? 'Commande confirmée 🎉' : 'Commande enregistrée', 'success');
      router.replace({ pathname: '/orders/[id]', params: { id: orderId, success: '1' } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Commande impossible.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Paiement" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
          <Step n={1} title="Livraison" />
          {saved.map((a, i) => (
            <Choice key={i} active={selected === i} onPress={() => setSelected(i)} icon="home-outline" title={a.fullName} subtitle={`${a.line1}, ${a.postalCode} ${a.city}`} />
          ))}
          {saved.length ? <Choice active={selected === 'new'} onPress={() => setSelected('new')} icon="add-circle-outline" title="Nouvelle adresse" /> : null}
          {selected === 'new' ? <AddressForm value={address} onChange={setAddress} /> : null}

          <Step n={2} title="Paiement" />
          {PAYMENT_METHODS.map((m) => (
            <Choice key={m.id} active={method === m.id} onPress={() => setMethod(m.id)} icon={m.icon} title={m.label} />
          ))}
          <View style={styles.secure}>
            <Ionicons name="lock-closed" size={14} color={COLORS.success} />
            <AppText variant="small" color={COLORS.textSecondary} style={styles.flex}>
              {isOnlinePaymentEnabled()
                ? 'Paiement sécurisé par Stripe. Aucune donnée bancaire ne transite par SHOPTV.'
                : isDemo
                  ? 'Mode démo : le paiement est simulé.'
                  : 'Paiement en ligne non activé : la commande sera enregistrée « en attente de paiement ».'}
            </AppText>
          </View>

          <Step n={3} title="Récapitulatif" />
          {data?.lines.map((l) => (
            <View key={`${l.productId}:${l.variantId}`} style={styles.item}>
              <AppImage uri={l.product.coverUrl} style={styles.itemImg} />
              <View style={styles.flex}>
                <AppText variant="bodyMedium" numberOfLines={1}>
                  {l.product.name}
                </AppText>
                <AppText variant="small" color={COLORS.textSecondary}>
                  {l.variantLabel ? `${l.variantLabel} · ` : ''}Qté {l.quantity}
                </AppText>
              </View>
              <AppText variant="bodyMedium">{formatPrice(l.lineTotal)}</AppText>
            </View>
          ))}
          {data ? <SummaryRows {...data} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.md }]}>
        <GradientButton
          label={data ? `Payer ${formatPrice(data.total)}` : 'Payer'}
          icon="shield-checkmark-outline"
          loading={submitting}
          onPress={submit}
          style={styles.pay}
        />
      </View>
    </Screen>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <AppText variant="small">{n}</AppText>
      </View>
      <AppText variant="h3">{title}</AppText>
    </View>
  );
}

function Choice({ active, onPress, icon, title, subtitle }: { active: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <PressableScale haptic onPress={onPress} style={[styles.choice, active && styles.choiceActive]} accessibilityRole="radio" accessibilityState={{ checked: active }}>
      <Ionicons name={icon} size={20} color={active ? COLORS.primaryBright : COLORS.textSecondary} />
      <View style={styles.flex}>
        <AppText variant="bodyMedium">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" color={COLORS.textSecondary} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? COLORS.primaryBright : COLORS.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: SPACING.screen, gap: SPACING.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  choice: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.backgroundSecondary },
  choiceActive: { borderColor: COLORS.primaryBright, backgroundColor: COLORS.primarySoft },
  secure: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  itemImg: { width: 48, height: 48, borderRadius: RADIUS.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: SPACING.md, paddingHorizontal: SPACING.screen, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border },
  pay: { alignSelf: 'stretch' },
});
