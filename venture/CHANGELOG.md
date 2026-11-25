# CHANGELOG

## [0.1.1] — 2026-11-25

### Ajouté
- Webhook Stripe : prise en charge de `customer.subscription.created` (abonnements créés hors Checkout).
- Client Stripe : respect de `HTTPS_PROXY` (réseaux d'entreprise, sandbox).

### Vérifié
- Parcours de paiement contre l'API Stripe réelle en mode test (voir TEST_REPORT.md).

## [0.1.0] — 2026-11-25 — Première version fonctionnelle (MVP phases 1 à 4)

### Ajouté
- Application Next.js 16 / Supabase autonome dans `venture/`.
- Schéma complet (32 tables) avec RLS, droits par colonne, triggers (compteurs, progression, notifications, limitation de débit) et RPC de transitions sécurisées.
- Authentification : inscription réservée aux majeurs, confirmation email, mots de passe forts, réinitialisation, anti-bot (honeypot + limites par IP).
- Profil, onboarding, confidentialité, export et suppression des données.
- Fil personnalisé et filtres ; création de projet (IA / règles / manuelle) ; page projet ; participation, candidatures, équipe.
- Espace collaboratif : tâches, étapes, calendrier, documents privés, responsabilités, VENTURE AI.
- Messagerie temps réel, pièces jointes, demandes de contact, blocage, signalement ; notifications temps réel.
- Matching explicable, recherche intelligente, Explorer (4 univers), carte MapLibre.
- Événements à la demande avec propositions d'organisateurs vérifiés.
- Comptes professionnels, statistiques agrégées anonymes, opportunités.
- Offres Free/Plus/Business, Stripe (mode test) avec webhook idempotent.
- Administration par rôles avec journal d'audit.
- PWA (manifeste, icônes, page hors ligne).
- Données de démonstration étiquetées (exemple du festival de Bretagne).
- Tests : 37 unitaires, 43 intégration, 20 E2E ; workflow CI manuel/PR.
- Documentation : README, CLAUDE, ROADMAP, TASKS, ARCHITECTURE, SECURITY, TEST_REPORT, DEPLOYMENT.

### Modifié (hors `venture/`)
- `tsconfig.json` et `eslint.config.mjs` racine : exclusion de `venture/` (application séparée).
