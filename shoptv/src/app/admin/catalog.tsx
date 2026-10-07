import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FormSection, SwitchRow } from '@/components/admin/FormKit';
import { AppText, GradientButton, PressableScale, Screen, ScreenHeader, Segmented, TextField, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useBrands, useCategories } from '@/features/catalog/hooks';
import { confirmAction } from '@/lib/confirm';
import { deleteBrand, deleteCategory, saveBrand, saveCategory } from '@/services/admin';

type Tab = 'categories' | 'brands';

export default function AdminCatalog() {
  const [tab, setTab] = useState<Tab>('categories');
  const categories = useCategories();
  const brands = useBrands();
  const client = useQueryClient();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('grid-outline');
  const [image, setImage] = useState('');
  const [flag, setFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  const startEdit = (id: string | 'new') => {
    setEditing(id);
    if (tab === 'categories') {
      const c = categories.data?.find((x) => x.id === id);
      setName(c?.name ?? '');
      setIcon(c?.icon ?? 'grid-outline');
      setImage(c?.imageUrl ?? '');
      setFlag(c?.isPopular ?? false);
    } else {
      const b = brands.data?.find((x) => x.id === id);
      setName(b?.name ?? '');
      setImage(b?.logoUrl ?? '');
      setFlag(b?.isFeatured ?? false);
    }
  };

  const refresh = () => client.invalidateQueries();

  const save = async () => {
    if (name.trim().length < 2) return toast('Nom trop court.', 'error');
    setSaving(true);
    try {
      const id = editing === 'new' ? undefined : (editing ?? undefined);
      if (tab === 'categories') {
        const current = categories.data?.find((c) => c.id === id);
        await saveCategory({ name: name.trim(), icon: icon.trim() || 'grid-outline', isPopular: flag, parentId: current?.parentId ?? null, imageUrl: image.trim() || null }, id);
      } else {
        await saveBrand({ name: name.trim(), isFeatured: flag, monogram: '', logoUrl: image.trim() || null }, id);
      }
      await refresh();
      setEditing(null);
      toast('Enregistré', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = (id: string, label: string) =>
    confirmAction('Supprimer', `« ${label} » sera supprimé. Les produits liés seront détachés.`, async () => {
      try {
        await (tab === 'categories' ? deleteCategory(id) : deleteBrand(id));
        await refresh();
        toast('Supprimé', 'success');
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Suppression impossible', 'error');
      }
    });

  const items = tab === 'categories' ? (categories.data ?? []).map((c) => ({ id: c.id, label: c.name, meta: c.isPopular ? 'Populaire' : '' })) : (brands.data ?? []).map((b) => ({ id: b.id, label: b.name, meta: b.isFeatured ? 'Top marque' : '' }));

  return (
    <Screen wide>
      <ScreenHeader title="Catalogue" right={<GradientButton label="Ajouter" icon="add" size="sm" onPress={() => startEdit('new')} />} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Segmented
          value={tab}
          onChange={(t) => {
            setTab(t);
            setEditing(null);
          }}
          options={[
            { value: 'categories', label: 'Catégories', count: categories.data?.length },
            { value: 'brands', label: 'Marques', count: brands.data?.length },
          ]}
        />
        {editing ? (
          <FormSection title={editing === 'new' ? (tab === 'categories' ? 'Nouvelle catégorie' : 'Nouvelle marque') : 'Modifier'}>
            <TextField label="Nom" value={name} onChangeText={setName} />
            {tab === 'categories' ? <TextField label="Icône (nom Ionicons, ex. game-controller-outline)" value={icon} onChangeText={setIcon} autoCapitalize="none" /> : null}
            <TextField label={tab === 'categories' ? 'Image (URL ou chemin Storage)' : 'Logo (URL ou chemin Storage, optionnel)'} value={image} onChangeText={setImage} autoCapitalize="none" />
            <SwitchRow label={tab === 'categories' ? 'Catégorie populaire' : 'Top marque'} value={flag} onChange={setFlag} />
            <View style={styles.row}>
              <GradientButton label="Enregistrer" size="md" loading={saving} onPress={save} style={styles.flex} />
              <GradientButton label="Annuler" size="md" onPress={() => setEditing(null)} style={[styles.flex, styles.cancel]} />
            </View>
          </FormSection>
        ) : null}
        {items.map((it) => (
          <View key={it.id} style={styles.item}>
            <PressableScale onPress={() => startEdit(it.id)} style={styles.flex} accessibilityLabel={`Modifier ${it.label}`}>
              <AppText variant="bodyMedium">{it.label}</AppText>
              {it.meta ? (
                <AppText variant="small" color={COLORS.primaryBright}>
                  {it.meta}
                </AppText>
              ) : null}
            </PressableScale>
            <PressableScale onPress={() => remove(it.id, it.label)} hitSlop={8} accessibilityLabel="Supprimer">
              <Ionicons name="trash-outline" size={19} color={COLORS.danger} />
            </PressableScale>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.md, paddingBottom: SPACING.huge },
  row: { flexDirection: 'row', gap: SPACING.md },
  flex: { flex: 1 },
  cancel: { opacity: 0.6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.backgroundSecondary, borderWidth: 1, borderColor: COLORS.border },
});
