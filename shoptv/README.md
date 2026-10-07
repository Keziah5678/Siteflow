# SHOPTV — le shopping devient un spectacle

Application mobile de shopping vidéo (iOS, Android, Web) : les produits se découvrent en vidéos courtes verticales, des **Drops** à durée limitée créent l'événement, et le flux « Pour toi » se personnalise au fil de la navigation.

- **Expo SDK 57** · React Native 0.86 · React 19 · TypeScript strict
- **Expo Router** (routes dans `src/app`) · **React Native Reanimated 4** · **expo-video** · **expo-image**
- **Supabase** (PostgreSQL, Auth, Storage, RLS) · **Zustand** (état local) · **TanStack Query** (cache et pagination)
- **Stripe** (Checkout hébergé via Edge Function, aucune clé secrète dans l'app)

> **Fonctionne immédiatement sans configuration** : sans variables Supabase, l'app démarre en **mode démo** avec un catalogue local réaliste (18 produits, 6 drops, avis, commentaires). Un compte local, avec accès admin, permet de tester favoris, panier, commandes, notifications et administration. Dès que `.env` est renseigné, toutes les données passent par Supabase.

---

## 1. Structure des fichiers

```
shoptv/
├── app.json / app.config.ts       Config Expo (schéma, plugins, Stripe → extra)
├── .env.example                   Variables d'environnement (clés publiques uniquement)
├── scripts/generate-seed.ts       Génère supabase/seed.sql depuis le catalogue démo
├── supabase/
│   ├── migrations/
│   │   ├── 20261007000001_schema.sql    Tables, index, triggers, RPC (commande, stats, reco…)
│   │   └── 20261007000002_security.sql  RLS sur toutes les tables + buckets Storage
│   ├── seed.sql                         Données de démonstration
│   └── functions/
│       ├── create-checkout-session/     Edge Function Stripe Checkout
│       └── stripe-webhook/              Webhook Stripe → commande payée
└── src/
    ├── app/                       NAVIGATION (Expo Router) — un fichier = un écran
    │   ├── _layout.tsx            Racine : polices, providers, session, toasts
    │   ├── index.tsx              Splash animé
    │   ├── onboarding.tsx         Onboarding (3 slides)
    │   ├── (tabs)/                Accueil · Explorer · Drops · Favoris · Profil (+ tab bar)
    │   ├── (auth)/                Connexion · Inscription · Mot de passe oublié · Nouveau mot de passe
    │   ├── auth/callback.tsx      Retour des liens email / OAuth (PKCE)
    │   ├── feed/[id].tsx          Flux vidéo vertical plein écran
    │   ├── product/[slug].tsx     Page produit
    │   ├── drop/[id].tsx          Détail d'un drop
    │   ├── search.tsx             Recherche instantanée + page de résultats
    │   ├── cart.tsx · checkout.tsx
    │   ├── orders/                Commandes + détail (suivi)
    │   ├── notifications.tsx · settings.tsx · addresses.tsx
    │   ├── payment-methods.tsx · help.tsx · terms.tsx · +not-found.tsx
    │   └── admin/                 Administration séparée (garde admin)
    │       ├── index.tsx          Tableau de bord (ventes, stats, populaires)
    │       ├── products.tsx · product/[id].tsx   CRUD produits + upload photo/vidéo
    │       ├── drops.tsx · drop/[id].tsx         CRUD drops + association produits
    │       ├── catalog.tsx        Catégories & marques
    │       ├── orders.tsx         Commandes (changement de statut)
    │       └── users.tsx          Utilisateurs
    ├── components/                UI réutilisable (aucun accès aux données)
    │   ├── ui/                    Design system : boutons lumineux, cartes néon, textes, champs…
    │   ├── product/ drop/ feed/ brand/ navigation/ layout/ admin/
    ├── constants/theme.ts         COLORS · GRADIENTS · FONTS · TYPOGRAPHY · SPACING · RADIUS · SHADOWS · ANIMATIONS
    ├── features/                  Hooks métier (TanStack Query) par domaine
    ├── hooks/                     useNow (horloge partagée), useCountdown, useDebounce, useRequireAuth…
    ├── lib/                       env, client Supabase, médias, formatage, dates, partage
    ├── services/                  ACCÈS AUX DONNÉES (Supabase ou base démo) + logique métier
    │   ├── catalog · drops · search · social · orders · payments · notifications
    │   ├── auth · user-data (favoris/likes/panier sync) · admin
    │   ├── recommendations.ts     Moteur « Pour toi » interchangeable
    │   ├── mappers.ts · demo-db.ts
    ├── store/                     Zustand : session, panier, bibliothèque, compte démo
    ├── data/demo-catalog.ts       Catalogue démo (source unique : app + seed SQL)
    └── types/models.ts            Modèles de domaine
```

Séparation : **UI** (`components`) → **hooks métier** (`features`) → **services** (données/Supabase) → **stores** (état). Les composants n'importent jamais le catalogue ni Supabase directement.

## 2. Installation

```bash
cd shoptv
npm install
cp .env.example .env      # optionnel : sans .env, mode démo
npx expo start
```

Puis `i` (simulateur iOS), `a` (émulateur Android), `w` (navigateur) ou scannez le QR code.

> Expo Go permet d'essayer l'app rapidement. Pour Apple Sign-In, les notifications push distantes et des tests fidèles à la production, utilisez un **development build** (voir §7).

Scripts utiles :

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérification TypeScript |
| `npm run export:web` | Build web de production |
| `npm run seed:generate` | Régénère `supabase/seed.sql` depuis `src/data/demo-catalog.ts` |
| `npx expo-doctor` | Diagnostic du projet |

## 3. Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | pour Supabase | URL du projet (`https://xxxx.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | pour Supabase | Clé **publishable** (`sb_publishable_…`) ou anon key |
| `STRIPE_PUBLISHABLE_KEY` | pour le paiement | Clé **publishable** Stripe (`pk_test_…`), injectée via `app.config.ts` |
| `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` | non | `true` pour afficher « Continuer avec Google » |

**Jamais dans l'app** : `service_role`, `sk_live_…`, secret de webhook. Ces secrets vivent uniquement dans les secrets des Edge Functions Supabase.

## 4. SQL Supabase

Tout le SQL est dans `supabase/` et a été **exécuté et testé sur PostgreSQL 16** (RLS, création de commande, anti-escalade de rôle, notifications automatiques).

- **Tables** : `profiles`, `products`, `categories`, `brands`, `product_media`, `favorites`, `cart_items`, `orders`, `order_items`, `drops`, `drop_products`, `notifications`, `reviews`, `likes`, `comments`, `user_preferences`, plus `drop_follows` (drops suivis) et `user_events` (signaux de recommandation).
- **Produits** : tous les champs demandés ; `discount_percentage` est une **colonne calculée** (toujours cohérente avec les prix).
- **Index** : clés étrangères, tri popularité / nouveautés / prix / remise, index **trigram** (`pg_trgm`) pour la recherche instantanée.
- **RLS activée partout** : catalogue en lecture publique, écriture réservée aux admins (`is_admin()`), données personnelles limitées à leur propriétaire. Un utilisateur ne peut pas se promouvoir admin (trigger).
- **RPC** :
  - `place_order(adresse, moyen)` — crée la commande **côté serveur** : prix lus en base, stock vérifié et décrémenté, panier vidé ;
  - `for_you_products(limit, offset)` — recommandations (affinité catégorie pondérée et décroissante dans le temps + popularité + remise) ;
  - `admin_stats()` — ventes, commandes, utilisateurs, ventes/jour, meilleures ventes ;
  - `increment_share`, `notify_drop_events` (à planifier avec pg_cron).
- **Triggers** : profil créé à l'inscription, compteurs likes/commentaires, note moyenne, notifications « baisse de prix », « retour en stock », « commande » / « livraison ».
- **Storage** : buckets publics `product-images`, `product-videos`, `avatars` ; écriture admin pour les médias produits, chaque utilisateur n'écrit que dans `avatars/<son id>/`.

## 5. Lancer l'application

```bash
npx expo start            # dev (Expo Go / dev build / web)
npx expo start --web      # web uniquement
```

L'accueil, le flux vidéo, les drops, l'explorateur, la recherche, le panier, le paiement (simulé en démo), les commandes et l'admin fonctionnent dès le premier lancement.

## 6. Connecter Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. **SQL Editor** → exécutez dans l'ordre :
   `supabase/migrations/20261007000001_schema.sql`, `supabase/migrations/20261007000002_security.sql`, puis `supabase/seed.sql` (données de démo).
   *(ou avec la CLI : `supabase link` puis `supabase db push` et `supabase db seed`)*
3. **Settings → API** : copiez l'URL et la clé publishable dans `.env`, puis relancez `npx expo start -c`.
4. **Authentication → URL Configuration** : ajoutez les URLs de redirection `shoptv://auth/callback` et, pour le web, `http://localhost:8081/auth/callback`.
5. **Créez votre compte** dans l'app, puis promouvez-le administrateur dans le SQL Editor :
   ```sql
   update public.profiles set role = 'admin' where email = 'vous@exemple.fr';
   ```
6. *(recommandé)* Notifications de drops automatiques : activez l'extension **pg_cron** puis
   ```sql
   select cron.schedule('shoptv-drops', '* * * * *', 'select public.notify_drop_events()');
   ```
7. **Médias** : depuis l'admin (produit → « Ajouter une photo / vidéo »), les fichiers sont envoyés dans Storage et référencés sous la forme `product-images/<id>/…`. Les URLs publiques sont résolues dynamiquement (`src/lib/media.ts`) ; les URLs du prototype peuvent être remplacées progressivement.

### Connexions Apple et Google
- **Apple** (iOS) : Authentication → Providers → Apple, avec le Bundle ID `com.shoptv.app`. Le bouton n'apparaît que sur iOS.
- **Google** : Authentication → Providers → Google (client OAuth web), puis `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

### Activer Stripe
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```
Créez dans Stripe un webhook vers `https://<projet>.supabase.co/functions/v1/stripe-webhook` (événement `checkout.session.completed`) et renseignez `STRIPE_PUBLISHABLE_KEY`. Le parcours devient : commande créée côté serveur → page Stripe Checkout sécurisée → webhook → commande « Payée ». Sans Stripe, les commandes restent « En attente de paiement ».

## 7. Préparer iOS et Android

1. Identifiants déjà configurés : `com.shoptv.app` (iOS et Android), schéma `shoptv://`.
2. Installez EAS et liez le projet :
   ```bash
   npm i -g eas-cli && eas login
   eas init                     # crée le projet EAS ; reportez l'ID dans extra.eas.projectId si demandé (requis pour les push)
   eas build:configure
   ```
3. Development build (Apple Sign-In, push, tests natifs) :
   ```bash
   eas build --profile development --platform ios      # ou android
   ```
4. Production et publication :
   ```bash
   eas build --platform all
   eas submit --platform ios && eas submit --platform android
   ```
5. Push : iOS nécessite une clé APNs (gérée par EAS), Android une configuration FCM (`google-services.json`, voir la doc Expo Notifications).
6. Remplacez `assets/icon.png`, `assets/splash-icon.png` et les icônes adaptatives Android par la marque finale.

## 8. Éléments restant à configurer manuellement

- [ ] Projet Supabase + exécution du SQL + `.env` (§6) — sinon mode démo.
- [ ] Promotion du premier administrateur (SQL ci-dessus).
- [ ] Médias définitifs : les images/vidéos de démo proviennent d'URLs publiques (Unsplash, échantillons vidéo Google) **pour le prototype uniquement** ; les remplacer par vos médias dans Supabase Storage.
- [ ] Providers Apple / Google dans Supabase.
- [ ] Stripe : clés, Edge Functions, webhook (§6).
- [ ] pg_cron pour les notifications de drops serveur ; projet EAS + APNs/FCM pour les push distants (les rappels de drops **locaux** fonctionnent déjà).
- [ ] Icônes et splash de marque, textes légaux (`src/app/terms.tsx` est un modèle à faire valider).
- [ ] Les marques sont affichées en **monogrammes** : n'utilisez des logos officiels que si vous disposez des droits.

## Architecture des fonctionnalités clés

- **Drops** : le statut (à venir / en cours / terminé) est **calculé à partir des dates** (`lib/drops.ts` côté app, `drop_status()` côté SQL) avec une horloge partagée (`hooks/useNow.ts`) : il change automatiquement à l'échéance, sans tâche planifiée.
- **Flux vidéo** : `FlatList` paginée verticale ; seule la vidéo visible joue (muette par défaut), la suivante et la précédente sont **préchargées** (lecteur créé et mis en tampon) ; temps de visionnage remonté au moteur de recommandation.
- **Recommandation** : interface `RecommendationEngine` (`services/recommendations.ts`) avec un moteur heuristique local et un moteur SQL ; remplaçable par un moteur ML sans toucher à l'UI.
- **Panier** : local et persistant pour les invités, synchronisé avec `cart_items` dès la connexion (fusion du panier invité).
- **Performance** : pagination/infinite scroll partout (jamais le catalogue complet), cache TanStack Query, images en cache disque (`expo-image`), listes virtualisées, animations sur le thread UI (Reanimated).
