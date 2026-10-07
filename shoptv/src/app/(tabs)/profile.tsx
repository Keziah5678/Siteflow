import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthPrompt } from '@/components/layout/AuthPrompt';
import { AppImage, AppText, GlowCard, ListGroup, ListRow, PressableScale, Screen, toast } from '@/components/ui';
import { COLORS, FONTS, RADIUS, SPACING } from '@/constants/theme';
import { useOrders, useUnreadCount } from '@/features/account/hooks';
import { isSupabaseConfigured } from '@/lib/env';
import { signOut, uploadAvatar } from '@/services/auth';
import { useLibrary } from '@/store/library';
import { selectIsAdmin, useSession } from '@/store/session';

export default function ProfileScreen() {
  const { profile, status, isDemo } = useSession();
  const isAdmin = useSession(selectIsAdmin);
  const favoritesCount = useLibrary((s) => s.favorites.length);
  const orders = useOrders();
  const unread = useUnreadCount();
  const [uploading, setUploading] = useState(false);
  const signedIn = status === 'signedIn' && profile;

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      await uploadAvatar(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      toast('Photo de profil mise à jour', 'success');
    } catch {
      toast('Échec de l’envoi de la photo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const confirmSignOut = () => {
    const run = () => signOut().then(() => toast('À bientôt 👋'));
    if (Platform.OS === 'web') return run();
    Alert.alert('Déconnexion', 'Veux-tu vraiment te déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: run },
    ]);
  };

  const initials = (profile?.fullName || profile?.email || '?')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText variant="h1" style={styles.title}>
          Profil
        </AppText>

        {signedIn ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <GlowCard radius={RADIUS.xl} contentStyle={styles.card}>
              <PressableScale onPress={pickAvatar} style={styles.avatar} accessibilityLabel="Changer la photo de profil">
                {profile.avatarUrl ? (
                  <AppImage uri={profile.avatarUrl} style={StyleSheet.absoluteFill} />
                ) : (
                  <AppText style={styles.initials}>{initials}</AppText>
                )}
                <View style={styles.camera}>
                  {uploading ? <ActivityIndicator size="small" color={COLORS.text} /> : <Ionicons name="camera" size={13} color={COLORS.text} />}
                </View>
              </PressableScale>
              <View style={styles.identity}>
                <AppText variant="h3" numberOfLines={1}>
                  {profile.fullName || 'Membre SHOPTV'}
                </AppText>
                <AppText variant="caption" color={COLORS.textSecondary} numberOfLines={1}>
                  {profile.email}
                </AppText>
                <View style={styles.tags}>
                  {isAdmin ? <Tag label="Admin" /> : null}
                  {isDemo ? <Tag label="Mode démo" /> : null}
                </View>
              </View>
            </GlowCard>
            <View style={styles.stats}>
              <Stat value={orders.data?.length ?? 0} label="Commandes" onPress={() => router.push('/orders')} />
              <Stat value={favoritesCount} label="Favoris" onPress={() => router.push('/favorites')} />
              <Stat value={unread} label="Non lues" onPress={() => router.push('/notifications')} />
            </View>
          </Animated.View>
        ) : (
          <AuthPrompt title="Bienvenue sur SHOPTV" message="Crée ton compte pour commander, sauvegarder tes favoris et suivre les drops." />
        )}

        {!isSupabaseConfigured ? (
          <View style={styles.demo}>
            <Ionicons name="flask-outline" size={16} color={COLORS.warning} />
            <AppText variant="small" color={COLORS.textSecondary} style={styles.flex}>
              Mode démo : Supabase n’est pas configuré, les données restent sur cet appareil.
            </AppText>
          </View>
        ) : null}

        {signedIn ? (
          <ListGroup>
            <ListRow icon="receipt-outline" label="Commandes" onPress={() => router.push('/orders')} />
            <ListRow icon="heart-outline" label="Favoris" onPress={() => router.push('/favorites')} />
            <ListRow icon="notifications-outline" label="Notifications" badge={unread} onPress={() => router.push('/notifications')} />
            <ListRow icon="location-outline" label="Adresses" value={`${profile.addresses.length}`} onPress={() => router.push('/addresses')} />
            <ListRow icon="card-outline" label="Moyens de paiement" onPress={() => router.push('/payment-methods')} />
          </ListGroup>
        ) : null}

        <ListGroup>
          <ListRow icon="settings-outline" label="Paramètres" onPress={() => router.push('/settings')} />
          <ListRow icon="help-buoy-outline" label="Aide" onPress={() => router.push('/help')} />
          <ListRow icon="document-text-outline" label="Conditions" onPress={() => router.push('/terms')} />
          {isAdmin ? <ListRow icon="speedometer-outline" label="Administration" onPress={() => router.push('/admin')} /> : null}
        </ListGroup>

        {signedIn ? (
          <ListGroup>
            <ListRow icon="log-out-outline" label="Déconnexion" danger onPress={confirmSignOut} />
          </ListGroup>
        ) : null}

        <AppText variant="small" color={COLORS.textMuted} align="center">
          SHOPTV · v1.0.0
        </AppText>
      </ScrollView>
    </Screen>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <AppText style={styles.tagText}>{label}</AppText>
    </View>
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.stat} accessibilityLabel={`${value} ${label}`}>
      <AppText style={styles.statValue}>{value}</AppText>
      <AppText variant="small" color={COLORS.textSecondary}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.screen, paddingBottom: SPACING.huge, gap: SPACING.lg },
  title: { marginTop: SPACING.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, padding: SPACING.lg },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 2,
    borderColor: COLORS.primaryBright,
  },
  initials: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.text },
  camera: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
  },
  identity: { flex: 1, gap: 2 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryBorder },
  tagText: { fontFamily: FONTS.semibold, fontSize: 11, color: COLORS.text },
  stats: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontFamily: FONTS.extrabold, fontSize: 20, color: COLORS.text },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },
  flex: { flex: 1 },
});
