import { router } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/components/layout/AuthShell';
import { GradientButton, TextField, toast } from '@/components/ui';
import { updatePassword } from '@/services/auth';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError('8 caractères minimum.');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await updatePassword(password);
      toast('Mot de passe mis à jour', 'success');
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Nouveau mot de passe">
      <TextField label="Nouveau mot de passe" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <TextField label="Confirmation" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secureTextEntry error={error} onSubmitEditing={submit} />
      <GradientButton label="Enregistrer" loading={loading} onPress={submit} />
    </AuthShell>
  );
}
