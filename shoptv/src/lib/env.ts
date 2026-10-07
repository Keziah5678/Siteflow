import Constants from 'expo-constants';

/**
 * Configuration publique de l'application.
 * Seules des clés PUBLIQUES (publishable/anon) transitent ici ;
 * la sécurité des données repose sur la Row Level Security de Supabase.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { stripePublishableKey?: string };

export const ENV = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  stripePublishableKey: extra.stripePublishableKey ?? '',
  googleAuthEnabled: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
} as const;

/** Vrai lorsque Supabase est configuré ; sinon l'app tourne en mode démo local. */
export const isSupabaseConfigured = /^https?:\/\//.test(ENV.supabaseUrl) && ENV.supabaseKey.length > 20;

export const isStripeConfigured = /^pk_(test|live)_/.test(ENV.stripePublishableKey);
