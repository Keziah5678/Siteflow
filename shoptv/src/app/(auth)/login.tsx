import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/components/layout/AuthShell';
import { SocialAuthButtons } from '@/components/layout/SocialAuthButtons';
import { AppText, GradientButton, TextField, toast } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { signInWithEmail } from '@/services/auth';

const REASONS: Record<string, string> = {
  favorite: 'Connecte-toi pour ajouter des favoris.',
  like: 'Connecte-toi pour aimer ce produit.',
  drop: 'Connecte-toi pour suivre ce drop.',
  checkout: 'Connecte-toi pour finaliser ta commande.',
  comment: 'Connecte-toi pour commenter.',
  review: 'Connecte-toi pour donner ton avis.',
};

export default function LoginScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Adresse email invalide.');
    if (password.length < 6) return setError('Mot de passe trop court (6 caractères minimum).');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      toast('Bon retour sur SHOPTV ✨', 'success');
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Connexion" subtitle={(reason && REASONS[reason]) || 'Retrouve tes favoris, ton panier et tes drops suivis.'}>
      <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <TextField
        label="Mot de passe"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        error={error}
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <AppText variant="caption" color={COLORS.link} align="right" onPress={() => router.push('/forgot-password')}>
        Mot de passe oublié ?
      </AppText>
      <GradientButton label="Se connecter" loading={loading} onPress={submit} />
      <SocialAuthButtons onDone={() => done()} />
      <AppText variant="caption" color={COLORS.textSecondary} align="center" onPress={() => router.replace('/register')}>
        Pas encore de compte ? <AppText variant="caption" color={COLORS.link}>Créer un compte</AppText>
      </AppText>
    </AuthShell>
  );
}
