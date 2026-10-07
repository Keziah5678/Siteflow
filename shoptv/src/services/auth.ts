/**
 * Authentification Supabase : email/mot de passe, Apple, Google (OAuth PKCE),
 * mot de passe oublié, profil. En mode démo, un compte local est créé.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { ENV } from '@/lib/env';
import { STORAGE_BUCKETS, supabase } from '@/lib/supabase';
import { useDemoAccount } from '@/store/demo-account';
import { useSession } from '@/store/session';
import type { Address, Profile } from '@/types/models';

import { mapProfile } from './mappers';

WebBrowser.maybeCompleteAuthSession();

export const authRedirectUrl = () => Linking.createURL('/auth/callback');

async function loadProfile(userId: string, email: string): Promise<Profile> {
  const client = supabase!;
  const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (data) return mapProfile(data);
  return { id: userId, email, fullName: '', avatarUrl: null, role: 'user', addresses: [] };
}

/** À appeler une fois au démarrage : restaure la session et écoute les changements. */
export function initAuth(): () => void {
  const session = useSession.getState();
  if (!supabase) {
    const demoProfile = useDemoAccount.getState().profile;
    if (demoProfile) session.setSignedIn(demoProfile, true);
    else session.setSignedOut();
    return () => {};
  }

  const client = supabase;
  const apply = async (user: { id: string; email?: string } | null) => {
    if (!user) {
      useSession.getState().setSignedOut();
      return;
    }
    try {
      const profile = await loadProfile(user.id, user.email ?? '');
      useSession.getState().setSignedIn(profile);
    } catch {
      useSession.getState().setSignedIn({ id: user.id, email: user.email ?? '', fullName: '', avatarUrl: null, role: 'user', addresses: [] });
    }
  };

  client.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
  const { data: sub } = client.auth.onAuthStateChange((event, s) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // Différé : ne jamais appeler l'API Supabase dans le callback lui-même.
      setTimeout(() => apply(s?.user ?? null), 0);
    }
  });
  return () => sub.subscription.unsubscribe();
}

function signInDemo(email: string, fullName?: string) {
  const profile: Profile = {
    id: 'e0000000-0000-4000-8000-000000000001',
    email,
    fullName: fullName || email.split('@')[0],
    avatarUrl: null,
    // En démo, le compte local a accès à l'administration pour tester toutes les fonctions.
    role: 'admin',
    addresses: useDemoAccount.getState().profile?.addresses ?? [],
  };
  useDemoAccount.getState().setProfile(profile);
  useSession.getState().setSignedIn(profile, true);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  if (!supabase) return signInDemo(email);
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translateAuthError(error.message));
}

/** Renvoie `true` si une confirmation par email est nécessaire. */
export async function signUpWithEmail(fullName: string, email: string, password: string): Promise<boolean> {
  if (!supabase) {
    signInDemo(email, fullName);
    return false;
  }
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw new Error(translateAuthError(error.message));
  return !data.session;
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: Linking.createURL('/auth/callback', { queryParams: { next: '/update-password' } }),
  });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function updatePassword(password: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function exchangeAuthCode(code: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(translateAuthError(error.message));
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Sign in with Apple natif (iOS) → jeton d'identité vérifié par Supabase. */
export async function signInWithApple(): Promise<void> {
  if (!supabase) return signInDemo('apple@demo.shoptv.app', 'Utilisateur Apple');
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Connexion Apple annulée.');
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
  if (error) throw new Error(translateAuthError(error.message));
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name) await supabase.auth.updateUser({ data: { full_name: name } });
}

export const isGoogleSignInEnabled = () => ENV.googleAuthEnabled;

/** Google via OAuth PKCE dans un navigateur sécurisé (nécessite la configuration Supabase). */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return signInDemo('google@demo.shoptv.app', 'Utilisateur Google');
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (Platform.OS === 'web' || !data.url) return;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;
  const code = new URL(result.url).searchParams.get('code');
  if (code) await exchangeAuthCode(code);
}

export async function signOut(): Promise<void> {
  if (!supabase) {
    useDemoAccount.getState().setProfile(null);
    useSession.getState().setSignedOut();
    return;
  }
  await supabase.auth.signOut();
  useSession.getState().setSignedOut();
}

export async function updateProfile(patch: { fullName?: string; addresses?: Address[]; avatarUrl?: string | null }): Promise<Profile> {
  const current = useSession.getState().profile;
  if (!current) throw new Error('Non connecté');
  const next: Profile = {
    ...current,
    fullName: patch.fullName ?? current.fullName,
    addresses: patch.addresses ?? current.addresses,
    avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : current.avatarUrl,
  };
  if (!supabase) {
    useDemoAccount.getState().setProfile(next);
    useSession.getState().setProfile(next);
    return next;
  }
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.addresses !== undefined) row.addresses = patch.addresses;
  if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
  const { data, error } = await supabase.from('profiles').update(row).eq('id', current.id).select().single();
  if (error) throw error;
  const profile = mapProfile(data);
  useSession.getState().setProfile(profile);
  return profile;
}

/** Envoie un avatar dans `avatars/<uid>/…` et met à jour le profil. */
export async function uploadAvatar(localUri: string, mimeType = 'image/jpeg'): Promise<Profile> {
  const current = useSession.getState().profile;
  if (!current) throw new Error('Non connecté');
  if (!supabase) return updateProfile({ avatarUrl: localUri });
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const path = `${current.id}/avatar-${Date.now()}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from(STORAGE_BUCKETS.avatars).upload(path, body, { contentType: mimeType, upsert: true });
  if (error) throw error;
  return updateProfile({ avatarUrl: `${STORAGE_BUCKETS.avatars}/${path}` });
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet email.';
  if (m.includes('email not confirmed')) return 'Confirmez votre email avant de vous connecter.';
  if (m.includes('password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (m.includes('rate limit')) return 'Trop de tentatives, réessayez dans quelques minutes.';
  if (m.includes('provider is not enabled')) return 'Ce mode de connexion n’est pas activé dans Supabase.';
  return message;
}
