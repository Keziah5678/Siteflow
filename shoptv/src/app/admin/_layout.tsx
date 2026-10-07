import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { selectIsAdmin, useSession } from '@/store/session';

/**
 * Espace d'administration séparé. La garde côté client améliore l'UX ;
 * la vraie protection est la RLS Supabase (is_admin()) côté base.
 */
export default function AdminLayout() {
  const status = useSession((s) => s.status);
  const isAdmin = useSession(selectIsAdmin);

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primaryBright} />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="lock-closed-outline"
          title="Accès réservé"
          message="Cet espace est réservé aux administrateurs SHOPTV."
          actionLabel={status === 'signedIn' ? 'Retour' : 'Se connecter'}
          onAction={() => (status === 'signedIn' ? router.replace('/home') : router.replace('/login'))}
        />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background }, animation: 'slide_from_right' }} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
});
