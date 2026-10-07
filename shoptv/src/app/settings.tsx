import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppText, GradientButton, ListGroup, ListRow, Screen, ScreenHeader, TextField, toast } from '@/components/ui';
import { COLORS, SPACING } from '@/constants/theme';
import { useNotificationSettings } from '@/features/account/hooks';
import { isStripeConfigured, isSupabaseConfigured } from '@/lib/env';
import { qk } from '@/lib/query';
import { updateProfile } from '@/services/auth';
import { registerForPushNotifications, saveNotificationSettings } from '@/services/notifications';
import { useLibrary } from '@/store/library';
import { useSession } from '@/store/session';
import type { NotificationSettings } from '@/types/models';

const TOGGLES: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  { key: 'drops', label: 'Drops', hint: 'Drop imminent et drop disponible' },
  { key: 'priceDrops', label: 'Prix & stock', hint: 'Baisse de prix, produit favori de retour' },
  { key: 'orders', label: 'Commandes', hint: 'Confirmation, expédition, livraison' },
  { key: 'promotions', label: 'Promotions', hint: 'Offres exclusives SHOPTV' },
];

export default function SettingsScreen() {
  const { profile, status, userId } = useSession();
  const settings = useNotificationSettings();
  const client = useQueryClient();
  const [name, setName] = useState(profile?.fullName ?? '');
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<NotificationSettings | null>(null);
  const clearRecent = useLibrary((s) => s.clearRecentSearches);

  useEffect(() => {
    if (settings.data) setLocal(settings.data);
  }, [settings.data]);

  const toggle = async (key: keyof NotificationSettings, value: boolean) => {
    if (!local) return;
    const next = { ...local, [key]: value };
    setLocal(next);
    try {
      await saveNotificationSettings(next);
      if (value) registerForPushNotifications().catch(() => undefined);
      client.setQueryData(qk.notificationSettings(userId), next);
    } catch {
      setLocal(local);
      toast('Réglage non enregistré', 'error');
    }
  };

  const saveName = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: name.trim() });
      toast('Profil mis à jour', 'success');
    } catch {
      toast('Mise à jour impossible', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Paramètres" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {status === 'signedIn' ? (
          <View style={styles.section}>
            <AppText variant="title">Compte</AppText>
            <TextField label="Nom affiché" icon="person-outline" value={name} onChangeText={setName} />
            <TextField label="Email" icon="mail-outline" value={profile?.email ?? ''} editable={false} />
            <GradientButton label="Enregistrer" size="md" loading={saving} onPress={saveName} disabled={name.trim() === (profile?.fullName ?? '')} />
            <ListGroup>
              <ListRow icon="key-outline" label="Changer de mot de passe" onPress={() => router.push('/update-password')} />
            </ListGroup>
          </View>
        ) : null}

        {status === 'signedIn' && local ? (
          <View style={styles.section}>
            <AppText variant="title">Notifications</AppText>
            <ListGroup>
              {TOGGLES.map((t) => (
                <View key={t.key} style={styles.toggle}>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">{t.label}</AppText>
                    <AppText variant="small" color={COLORS.textSecondary}>
                      {t.hint}
                    </AppText>
                  </View>
                  <Switch
                    value={local[t.key]}
                    onValueChange={(v) => toggle(t.key, v)}
                    trackColor={{ true: COLORS.primary, false: COLORS.surfaceElevated }}
                    thumbColor={COLORS.white}
                    accessibilityLabel={t.label}
                  />
                </View>
              ))}
            </ListGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="title">Application</AppText>
          <ListGroup>
            <ListRow icon="trash-outline" label="Effacer l’historique de recherche" onPress={() => (clearRecent(), toast('Historique effacé'))} />
            <ListRow icon="server-outline" label="Données" value={isSupabaseConfigured ? 'Supabase' : 'Mode démo local'} />
            <ListRow icon="card-outline" label="Paiement en ligne" value={isStripeConfigured ? 'Stripe activé' : 'Non activé'} />
            <ListRow icon="information-circle-outline" label="Version" value="1.0.0" />
          </ListGroup>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, gap: SPACING.xxl, paddingBottom: SPACING.huge },
  section: { gap: SPACING.md },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  flex: { flex: 1 },
});
