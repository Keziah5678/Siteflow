import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { FormSection, SelectField, SwitchRow } from '@/components/admin/FormKit';
import { AppImage, AppText, GradientButton, OutlineButton, Screen, ScreenHeader, TextField, toast } from '@/components/ui';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAdminProducts } from '@/features/admin/hooks';
import { useBrands, useCategories } from '@/features/catalog/hooks';
import { discountOf } from '@/lib/format';
import { saveProduct, uploadProductMedia, type ProductInput } from '@/services/admin';
import type { ProductVariant } from '@/types/models';

/** Variantes saisies une par ligne : « Couleur:Noir:#111111 » ou « Taille:42 ». */
function parseVariants(text: string): ProductVariant[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [label, value, colorHex] = line.split(':').map((s) => s.trim());
      return { id: `${(value ?? label).toLowerCase().replace(/\W+/g, '-')}-${i}`, label: value ? label : 'Option', value: value ?? label, ...(colorHex ? { colorHex } : {}) };
    });
}
const variantsToText = (v: ProductVariant[]) => v.map((x) => [x.label, x.value, x.colorHex].filter(Boolean).join(':')).join('\n');

const toNumber = (s: string) => Number(s.replace(',', '.'));

export default function AdminProductForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const products = useAdminProducts();
  const categories = useCategories();
  const brands = useBrands();
  const client = useQueryClient();
  const existing = products.data?.find((p) => p.id === id);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    tagline: '',
    description: '',
    price: '',
    compareAt: '',
    stock: '10',
    categoryId: null as string | null,
    brandId: null as string | null,
    shippingInfo: 'Livraison 2-4 jours',
    warranty: 'Garantie 2 ans',
    features: '',
    variants: '',
    coverUrl: '',
    videoUrl: '',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | 'image' | 'video'>(null);

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      slug: existing.slug,
      tagline: existing.tagline,
      description: existing.description,
      price: String(existing.price),
      compareAt: existing.compareAtPrice ? String(existing.compareAtPrice) : '',
      stock: String(existing.stock),
      categoryId: existing.categoryId,
      brandId: existing.brandId,
      shippingInfo: existing.shippingInfo,
      warranty: existing.warranty,
      features: existing.features.join('\n'),
      variants: variantsToText(existing.variants),
      coverUrl: existing.coverUrl,
      videoUrl: existing.videoUrl ?? '',
      isActive: existing.isActive,
    });
  }, [existing]);

  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const price = toNumber(form.price);
  const compareAt = form.compareAt ? toNumber(form.compareAt) : null;

  const submit = async () => {
    if (!form.name.trim()) return toast('Le nom est obligatoire.', 'error');
    if (!(price >= 0) || Number.isNaN(price)) return toast('Prix invalide.', 'error');
    setSaving(true);
    try {
      const input: ProductInput = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        price,
        compareAtPrice: compareAt && compareAt > price ? compareAt : null,
        stock: Math.max(0, Math.round(toNumber(form.stock) || 0)),
        categoryId: form.categoryId,
        brandId: form.brandId,
        shippingInfo: form.shippingInfo.trim(),
        warranty: form.warranty.trim(),
        features: form.features.split('\n').map((s) => s.trim()).filter(Boolean),
        variants: parseVariants(form.variants),
        coverUrl: form.coverUrl.trim(),
        videoUrl: form.videoUrl.trim() || null,
        isActive: form.isActive,
      };
      const saved = await saveProduct(input, isNew ? undefined : id);
      await client.invalidateQueries();
      toast(isNew ? 'Produit créé' : 'Produit mis à jour', 'success');
      if (isNew) router.replace(`/admin/product/${saved.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (type: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [type === 'image' ? 'images' : 'videos'], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(type);
    try {
      const ref = await uploadProductMedia(id, asset.uri, type, asset.mimeType ?? (type === 'image' ? 'image/jpeg' : 'video/mp4'));
      if (type === 'image' && !form.coverUrl) set('coverUrl')(ref);
      if (type === 'video') set('videoUrl')(ref);
      await client.invalidateQueries();
      toast(type === 'image' ? 'Photo ajoutée' : 'Vidéo ajoutée', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Envoi impossible', 'error');
    } finally {
      setUploading(null);
    }
  };

  return (
    <Screen wide>
      <ScreenHeader title={isNew ? 'Nouveau produit' : 'Modifier le produit'} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <FormSection title="Informations">
            <TextField label="Nom" value={form.name} onChangeText={set('name')} />
            <TextField label="Slug (auto si vide)" value={form.slug} onChangeText={set('slug')} autoCapitalize="none" />
            <TextField label="Accroche (description courte)" value={form.tagline} onChangeText={set('tagline')} />
            <TextField label="Description" value={form.description} onChangeText={set('description')} multiline style={styles.multi} />
          </FormSection>

          <FormSection title="Prix & stock">
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField label="Prix (€)" value={form.price} onChangeText={set('price')} keyboardType="decimal-pad" />
              </View>
              <View style={styles.flex}>
                <TextField label="Ancien prix (€)" value={form.compareAt} onChangeText={set('compareAt')} keyboardType="decimal-pad" />
              </View>
              <View style={styles.flex}>
                <TextField label="Stock" value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" />
              </View>
            </View>
            <AppText variant="small" color={COLORS.textSecondary}>
              Réduction calculée : -{discountOf(price || 0, compareAt)} %
            </AppText>
            <View style={styles.row}>
              <View style={styles.flex}>
                <SelectField label="Catégorie" value={form.categoryId} onChange={set('categoryId')} options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
              </View>
              <View style={styles.flex}>
                <SelectField label="Marque" value={form.brandId} onChange={set('brandId')} options={(brands.data ?? []).map((b) => ({ value: b.id, label: b.name }))} />
              </View>
            </View>
            <TextField label="Livraison" value={form.shippingInfo} onChangeText={set('shippingInfo')} />
            <TextField label="Garantie" value={form.warranty} onChangeText={set('warranty')} />
            <SwitchRow label="Produit actif" hint="Visible dans l’app" value={form.isActive} onChange={set('isActive')} />
          </FormSection>

          <FormSection title="Caractéristiques & variantes">
            <TextField label="Caractéristiques (une par ligne)" value={form.features} onChangeText={set('features')} multiline style={styles.multi} />
            <TextField label="Variantes — « Couleur:Noir:#111111 » ou « Taille:42 »" value={form.variants} onChangeText={set('variants')} multiline style={styles.multi} autoCapitalize="none" />
          </FormSection>

          <FormSection title="Médias">
            {form.coverUrl ? <AppImage uri={form.coverUrl} style={styles.preview} /> : null}
            <TextField label="Image principale (URL ou chemin Storage)" value={form.coverUrl} onChangeText={set('coverUrl')} autoCapitalize="none" />
            <TextField label="Vidéo (URL ou chemin Storage)" value={form.videoUrl} onChangeText={set('videoUrl')} autoCapitalize="none" />
            {isNew ? (
              <AppText variant="small" color={COLORS.textSecondary}>
                Enregistre le produit pour pouvoir envoyer des photos et vidéos vers Supabase Storage.
              </AppText>
            ) : (
              <View style={styles.row}>
                <OutlineButton label={uploading === 'image' ? 'Envoi…' : 'Ajouter une photo'} icon="image-outline" onPress={() => upload('image')} style={styles.flex} />
                <OutlineButton label={uploading === 'video' ? 'Envoi…' : 'Ajouter une vidéo'} icon="videocam-outline" onPress={() => upload('video')} style={styles.flex} />
              </View>
            )}
            {existing?.media.length ? (
              <AppText variant="small" color={COLORS.textSecondary}>
                Galerie : {existing.media.filter((m) => m.type === 'image').length} photo(s), {existing.media.filter((m) => m.type === 'video').length} vidéo(s)
              </AppText>
            ) : null}
          </FormSection>

          <GradientButton label={isNew ? 'Créer le produit' : 'Enregistrer'} icon="save-outline" loading={saving} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: SPACING.screen, gap: SPACING.lg, paddingBottom: SPACING.huge },
  row: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap' },
  multi: { minHeight: 90, textAlignVertical: 'top' },
  preview: { width: 120, height: 120, borderRadius: RADIUS.md },
});
