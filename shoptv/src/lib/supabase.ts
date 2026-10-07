import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { ENV, isSupabaseConfigured } from './env';

/**
 * Client Supabase unique. `null` en mode démo (variables absentes).
 * Les services doivent passer par `requireSupabase()` ou tester `supabase`.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(ENV.supabaseUrl, ENV.supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase n’est pas configuré (voir .env.example).');
  return supabase;
}

// Rafraîchissement du token uniquement quand l'app est au premier plan (recommandation Supabase).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const STORAGE_BUCKETS = {
  productImages: 'product-images',
  productVideos: 'product-videos',
  avatars: 'avatars',
} as const;
