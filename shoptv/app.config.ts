import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Étend app.json avec des valeurs issues de l'environnement.
 * STRIPE_PUBLISHABLE_KEY n'a pas le préfixe EXPO_PUBLIC_ : on l'expose
 * explicitement via `extra` (clé publishable uniquement — jamais de secret).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  },
});
