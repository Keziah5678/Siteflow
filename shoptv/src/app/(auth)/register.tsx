import { router } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/components/layout/AuthShell';
import { SocialAuthButtons } from '@/components/layout/SocialAuthButtons';
import { AppText, GradientButton, TextField, toast } from '@/components/ui';
import { COLORS } from '@/constants/theme';
import { signUpWithEmail } from '@/services/auth';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Indique ton prénom.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Adresse email invalide.');
    if (password.length < 8) return setError('8 caractères minimum pour le mot de passe.');
    setLoading(true);
    try {
      const needsConfirmation = await signUpWithEmail(name, email, password);
      if (needsConfirmation) setSent(true);
      else {
        toast('Bienvenue sur SHOPTV 🎉', 'success');
        done();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Vérifie tes emails" subtitle={`Un lien de confirmation a été envoyé à ${email}. Ouvre-le pour activer ton compte.`}>
        <GradientButton label="J’ai confirmé, me connecter" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Créer un compte" subtitle="Commande, sauvegarde tes coups de cœur et ne rate plus aucun drop.">
      <TextField label="Prénom" icon="person-outline" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextField
        label="Mot de passe"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={error}
        onSubmitEditing={submit}
      />
      <GradientButton label="Créer mon compte" loading={loading} onPress={submit} />
      <SocialAuthButtons onDone={done} />
      <AppText variant="small" color={COLORS.textMuted} align="center">
        En créant un compte, tu acceptes nos <AppText variant="small" color={COLORS.link} onPress={() => router.push('/terms')}>conditions</AppText>.
      </AppText>
      <AppText variant="caption" color={COLORS.textSecondary} align="center" onPress={() => router.replace('/login')}>
        Déjà membre ? <AppText variant="caption" color={COLORS.link}>Se connecter</AppText>
      </AppText>
    </AuthShell>
  );
}
