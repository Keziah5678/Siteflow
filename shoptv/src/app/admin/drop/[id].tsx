import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { FormSection, SwitchRow } from '@/components/admin/FormKit';
import { AppImage, AppText, GradientButton, PressableScale, Screen, ScreenHeader, TextField, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAdminProducts } from '@/features/admin/hooks';
import { useDrop } from '@/features/drops/hooks';
import { fromLocalInput, toLocalInput } from '@/lib/dates';
import { formatPrice } from '@/lib/format';
import { saveDrop } from '@/services/drops';

export default function AdminDropForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const drop = useDrop(isNew ? undefined : id);
  const products = useAdminProducts();
  const client = useQueryClient();
  const tomorrow20 = new Date();
  tomorrow20.setDate(tomorrow20.getDate() + 1);
  tomorrow20.setHours(20, 0, 0, 0);

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    imageUrl: '',
    start: toLocalInput(tomorrow20.toISOString()),
    end: toLocalInput(new Date(tomorrow20.getTime() + 4 * 3_600_000).toISOString()),
    isMega: false,
    productIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = drop.data;
    if (!d) return;
    setForm({
      title: d.title,
      subtitle: d.subtitle,
      description: d.description,
      imageUrl: d.imageUrl,
      start: toLocalInput(d.startsAt),
      end: toLocalInput(d.endsAt),
      isMega: d.isMega,
      productIds: d.productIds,
    });
  }, [drop.data]);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleProduct = (pid: string) =>
    setForm((f) => ({ ...f, productIds: f.productIds.includes(pid) ? f.productIds.filter((x) => x !== pid) : [...f.productIds, pid] }));

  const submit = async () => {
    const startsAt = fromLocalInput(form.start);
    const endsAt = fromLocalInput(form.end);
    if (!form.title.trim()) return toast('Le titre est obligatoire.', 'error');
    if (!startsAt || !endsAt) return toast('Dates au format AAAA-MM-JJ HH:mm.', 'error');
    setSaving(true);
    try {
      await saveDrop(
        {
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          description: form.description.trim(),
          imageUrl: form.imageUrl.trim(),
          startsAt,
          endsAt,
          isMega: form.isMega,
          productIds: form.productIds,
        },
        isNew ? undefined : id,
      );
      await client.invalidateQueries();
      toast(isNew ? 'Drop créé' : 'Drop mis à jour', 'success');
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen wide>
      <ScreenHeader title={isNew ? 'Nouveau drop' : 'Modifier le drop'} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <FormSection title="Drop">
            <TextField label="Titre" value={form.title} onChangeText={set('title')} placeholder="MEGA DROP" />
            <TextField label="Sous-titre" value={form.subtitle} onChangeText={set('subtitle')} />
            <TextField label="Description" value={form.description} onChangeText={set('description')} multiline style={styles.multi} />
            <TextField label="Image (URL ou chemin Storage)" value={form.imageUrl} onChangeText={set('imageUrl')} autoCapitalize="none" />
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Début (AAAA-MM-JJ HH:mm)" value={form.start} onChangeText={set('start')} />
              </View>
              <View style={styles.flex}>
                <TextField label="Fin (AAAA-MM-JJ HH:mm)" value={form.end} onChangeText={set('end')} />
              </View>
            </View>
            <SwitchRow label="Mega Drop" hint="Mis en avant sur l’accueil" value={form.isMega} onChange={set('isMega')} />
          </FormSection>

          <FormSection title={`Produits associés (${form.productIds.length})`}>
            {(products.data ?? []).map((p) => {
              const selected = form.productIds.includes(p.id);
              return (
                <PressableScale key={p.id} onPress={() => toggleProduct(p.id)} style={[styles.product, selected && styles.productOn]} accessibilityState={{ checked: selected }} accessibilityRole="checkbox">
                  <AppImage uri={p.coverUrl} style={styles.thumb} />
                  <AppText variant="bodyMedium" style={styles.flex} numberOfLines={1}>
                    {p.name}
                  </AppText>
                  <AppText variant="small" color={COLORS.textSecondary}>
                    {formatPrice(p.price)}
                  </AppText>
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? COLORS.primaryBright : COLORS.textMuted} />
                </PressableScale>
              );
            })}
          </FormSection>

          <GradientButton label={isNew ? 'Créer le drop' : 'Enregistrer'} icon="save-outline" loading={saving} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: SPACING.screen, gap: SPACING.lg, paddingBottom: SPACING.huge },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  product: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  productOn: { borderColor: COLORS.primaryBright, backgroundColor: COLORS.primarySoft },
  thumb: { width: 40, height: 40, borderRadius: RADIUS.xs },
});
