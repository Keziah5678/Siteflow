# TASKS — état réel

Statuts : **Terminé et testé** · **En cours** · **À faire** · **Bloqué** (cause indiquée).
« Testé » = couvert par des tests automatisés (U = unitaires, I = intégration sur la vraie base, E = Playwright E2E) — voir [TEST_REPORT.md](TEST_REPORT.md).

## Phase 1 — Fondations

| Tâche | Statut | Tests |
|---|---|---|
| Projet Next.js 16 / TS strict / Tailwind v4 / ESLint | Terminé et testé | build, lint |
| Stack Supabase locale (Postgres, Auth, Realtime, Storage, Mailpit) | Terminé et testé | I, E |
| Schéma + RLS + droits par colonne | Terminé et testé | I (43) |
| Identité visuelle, logo V, thème sombre/clair, tokens | Terminé et testé | E (captures) |
| Navigation : 5 onglets mobile, sidebar + rail desktop | Terminé et testé | E |
| Inscription majeurs, vérification email, connexion, reset mot de passe | Terminé et testé (reset : manuel) | U, I, E |
| Onboarding et profil (compétences, intérêts, ambitions, ville, dispo, portfolio) | Terminé et testé | E |
| Confidentialité du profil (public/membres, découvrable, projets rejoints, localisation) | Terminé et testé | I, E |
| PWA (manifeste, icônes, service worker hors ligne) | Terminé (installation non testée sur appareil réel) | build |

## Phase 2 — Cœur social

| Tâche | Statut | Tests |
|---|---|---|
| Fil avec composeur et 7 filtres, « Pour toi » personnalisé | Terminé et testé | U, E |
| Création de projet (règles / IA / manuelle), modification, suppression | Terminé et testé | U, E |
| Page projet (Présentation, Équipe, Étapes, Discussion), actualités | Terminé et testé | E |
| Je suis intéressé / Je participe / Je peux aider | Terminé et testé | I, E |
| Candidatures : envoi, acceptation, refus, retrait | Terminé et testé (retrait : I) | I, E |
| Espace collaboratif : objectifs, tâches, étapes, calendrier, documents, responsabilités | Terminé et testé | I, E |
| Progression = étapes réellement terminées | Terminé et testé | I, E |
| Messagerie temps réel (projet, privée, groupe), pièces jointes | Terminé et testé (groupe & pièces jointes : I/manuel) | I, E |
| Demandes de contact, blocage, signalement | Terminé et testé | I, E |
| Notifications (in-app, temps réel, déduplication des messages) | Terminé et testé | I, E |
| Recommandations reçues (entre collaborateurs) | Terminé et testé (RLS) | I |

## Phase 3 — Intelligence

| Tâche | Statut | Tests |
|---|---|---|
| Matching explicable (compétences, intérêts, dispo, proximité, expérience) | Terminé et testé | U, I, E |
| Recherche intelligente (plein texte + floue + compétences) | Terminé et testé | I, E |
| Explorer : 4 univers, filtres | Terminé et testé | E |
| Carte interactive MapLibre | Terminé (moteur, marqueurs, popups testés ; tuiles OpenFreeMap non joignables depuis l'environnement de test) | manuel |
| VENTURE AI : 8 fonctionnalités, quotas, coûts, anti-invention | Terminé et testé avec fournisseur simulé | I |
| VENTURE AI : appel réel au fournisseur | **Bloqué** — `ANTHROPIC_API_KEY` non fournie | — |

## Phase 4 — Business & administration

| Tâche | Statut | Tests |
|---|---|---|
| Événements à la demande (étapes, propositions d'organisateurs vérifiés) | Terminé et testé | I |
| Comptes professionnels, statistiques agrégées, opportunités, réponses | Terminé et testé | I, E |
| Administration (signalements, modération, utilisateurs, projets, offres, paiements, coûts IA, paramètres, audit) avec rôles | Terminé et testé | I, E |
| Offres Free / Plus / Business, prix éditables | Terminé et testé | E |
| Stripe : webhook signé, idempotence, activation / résiliation | Terminé et testé (événements signés localement) | I |
| Stripe : session de paiement réelle en mode test | Terminé et testé contre l'API Stripe (mode test) : client et session Checkout créés par l'application ; abonnement payé avec la carte de test ; événements Stripe réels rejoués sur le webhook (activation, rejeu ignoré, résiliation) | manuel + I |
| Stripe : affichage de la page de paiement hébergée et portail client | Non vérifiable ici — `checkout.stripe.com` bloqué par le proxy du sandbox | — |
| Export / suppression des données personnelles | Terminé et testé | E |

## Phase 5 — À venir

| Tâche | Statut |
|---|---|
| Billetterie sécurisée (billets numériques, QR codes, commission 5 %) | À faire |
| Marketplace de prestations (commission 8 %) | À faire |
| Emails de notification (préférence enregistrée, envoi non implémenté) | À faire — nécessite un SMTP |
| Notifications push (Web Push / mobile) | À faire |
| Captcha à l'inscription | Bloqué — clé Turnstile/hCaptcha requise |
| Modération automatique (filtrage de contenu) | À faire |
| Applications iOS / Android (Expo ou Capacitor, réutilisant l'API Supabase) | À faire |
| Financement réglementé | Bloqué volontairement — partenaire agréé requis |

## Déploiement

| Tâche | Statut |
|---|---|
| Procédure de préproduction (Supabase + Vercel) documentée | Terminé ([DEPLOYMENT.md](DEPLOYMENT.md)) |
| Workflow CI GitHub Actions (déclenchement manuel / PR) | Terminé, non exécuté sur GitHub |
| Préproduction en ligne | **Bloqué** — aucun accès Supabase Cloud / Vercel dans cette session ; aucune dépense engagée |
