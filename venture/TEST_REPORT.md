# TEST REPORT

**Date** : 2026-11-25 · **Environnement** : stack Supabase locale (Postgres 17.12, GoTrue avec confirmation email, Realtime, Storage, Mailpit), `next build` + `next start`, Chromium headless.

## Résultat global

| Contrôle | Commande | Résultat |
|---|---|---|
| TypeScript strict | `npm run typecheck` | ✅ 0 erreur |
| Lint | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Unitaires | `npx vitest run tests/unit` | ✅ 37 / 37 |
| Intégration (vraie base, vrais JWT) | `npx vitest run tests/integration` | ✅ 44 / 44 (36 RLS/règles métier + 8 Stripe/IA) |
| Build production | `npm run build` | ✅ 34 routes |
| E2E Playwright | `npm run test:e2e` | ✅ 20 / 20 |

Total : **81 tests Vitest + 20 scénarios E2E**, exécutés après `supabase db reset` (base propre).

## Critères d'acceptation (cahier des charges §24)

Parcours exécuté dans le navigateur par **deux comptes réels** (`tests/e2e/acceptance.spec.ts`) :

| # | Étape | Résultat |
|---|---|---|
| 1 | Créer chacun un compte (email de confirmation réel reçu dans Mailpit, lien cliqué) | ✅ |
| 2 | Compléter leur profil | ✅ |
| 3 | Publier un projet (suggestions automatiques, modifiées avant publication) | ✅ |
| 4 | Retrouver le projet depuis le fil et la recherche | ✅ |
| 5 | Manifester son intérêt | ✅ |
| 6 | Candidater (« Je peux aider ») — accès à l'espace refusé avant acceptation | ✅ |
| 7 | Accepter la candidature (après notification) | ✅ |
| 8 | Rejoindre l'équipe | ✅ |
| 9 | Échanger des messages — reçus **en temps réel** sans rechargement | ✅ |
| 10 | Créer des tâches (avec assignation) | ✅ |
| 11 | Terminer des étapes — progression 40 % = 2/5 étapes | ✅ |
| 12 | Recevoir des notifications | ✅ |
| 13 | Utiliser VENTURE AI si le fournisseur est configuré | ⚠️ Fournisseur **non configuré** : l'interface l'indique clairement (vérifié E2E) ; la logique IA (quotas, contexte, filtrage des identifiants inventés, refus non-membres) est testée en intégration avec un fournisseur simulé |
| 14 | Recommandations pertinentes avec explication | ✅ |
| 15 | Retrouver ses projets après déconnexion / reconnexion | ✅ |

## Cas complémentaires

| Cas | Couverture |
|---|---|
| Utilisateurs non authentifiés | E2E : redirection `/create` → login, espace projet inaccessible ; I : lecture publique limitée, `profile_private` refusé |
| Accès non autorisés | I : 36 tests RLS (modifier/supprimer le projet d'autrui, lire candidatures/tâches/messages/fichiers d'une autre équipe, usurper l'expéditeur, s'auto-attribuer plan/rôle, RPC admin) ; E : `/admin` → 404 pour un membre |
| Formulaires invalides | E2E : email invalide, mot de passe faible, mineur, CGU ; U : schémas Zod, nombres vides ≠ 0 |
| Erreurs réseau | UI : messages en échec marqués « Échec de l'envoi », indicateur de reconnexion temps réel, page d'erreur globale, page hors ligne PWA, carte avec repli explicite — **non automatisé** (vérification manuelle) |
| Données inexistantes | E2E : projet inexistant → 404 |
| Écrans de chargement | squelettes `(main)/loading.tsx`, états `pending` des boutons — vérification visuelle |
| Paiements mode test | I : webhook (signature absente/forgée refusée, activation via `checkout.session.completed` et `customer.subscription.created`, rejeu ignoré, un seul paiement, résiliation → free). **API Stripe réelle (mode test)** : depuis l'application, « Choisir Plus » crée le client Stripe et une session Checkout (abonnement, 9,99 €, `livemode=false`) ; abonnement payé avec `pm_card_visa` (facture `paid`) ; les événements réels `customer.subscription.created` / `deleted` récupérés chez Stripe et rejoués sur le webhook local passent le plan à `plus` puis `free`, le rejeu est ignoré ; données de test supprimées ensuite. Non vérifiable : la page hébergée `checkout.stripe.com` (bloquée par le proxy du sandbox) |
| Formats d'écran | E2E mobile 390×844 : 5 onglets, pas de défilement horizontal ; captures desktop 1440×900 (sombre et clair) inspectées |
| Signalements et blocages | I + E2E : signalement, file de modération, masquage, suspension, blocage empêchant les messages |
| Limitation de débit | I : 31ᵉ commentaire en 10 min refusé ; E2E : 6ᵉ inscription/heure depuis la même IP refusée (constaté) |
| Administration | E2E : chaque onglet, édition d'un prix répercutée sur `/pricing` ; I : séparation admin / super-admin |
| Données personnelles | E2E : export JSON (401 sans session), suppression du compte effective |

## Anomalies trouvées et corrigées pendant les tests

1. **Confirmation email inactive** : le conteneur Auth avait démarré avant la modification de la configuration → comptes auto-confirmés. Détecté par l'E2E, stack redémarrée, comportement vérifié.
2. **Seed incompatible avec l'API d'administration Auth** (colonnes de jetons NULL) → `listUsers` échouait. Corrigé.
3. **Champs numériques vides convertis en 0** (ex. prix « 0 € ») → préprocesseur dédié.
4. **Matching** : « Photographes » ne correspondait pas à « Photographie » → racinisation légère FR/EN.
5. **Worker MapLibre** non chargé après bundling → worker servi depuis `/public/maplibre` (`setWorkerUrl`).
6. Initiales d'avatar avec ponctuation, accords singulier/pluriel, débordement de libellés.
7. Couverture de projet acceptant une URL tierce ; fichiers de projets orphelins après suppression de compte → corrigés.

## Non vérifiable dans cet environnement

- Appel réel à l'API IA (clé absente).
- Page de paiement hébergée Stripe (`checkout.stripe.com` bloqué par le proxy du sandbox).
- Tuiles cartographiques OpenFreeMap (hôte bloqué par le proxy réseau du bac à sable) : moteur, marqueurs et popups vérifiés avec un style local intercepté.
- Installation PWA sur appareil réel, Safari/Firefox (seul Chromium testé).
