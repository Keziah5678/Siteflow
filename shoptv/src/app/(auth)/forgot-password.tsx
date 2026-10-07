import { router } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/components/layout/AuthShell';
import { GradientButton, TextField } from '@/components/ui';
import { sendPasswordReset } from '@/services/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Adresse email invalide.');
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Email envoyé" subtitle={`Si un compte existe pour ${email}, tu vas recevoir un lien pour choisir un nouveau mot de passe.`}>
        <GradientButton label="Retour à la connexion" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Indique ton email, on t’envoie un lien de réinitialisation.">
      <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={error} onSubmitEditing={submit} />
      <GradientButton label="Envoyer le lien" loading={loading} onPress={submit} />
    </AuthShell>
  );
}
