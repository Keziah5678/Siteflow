# VENTURE — Dream. Connect. Build.

VENTURE est un réseau social pour **construire la vie que l'on veut vivre** : chacun publie ce qu'il souhaite réaliser (créer une entreprise, organiser un festival, monter une équipe, lancer une marque…), la communauté s'y intéresse, propose ses compétences et rejoint le projet, puis l'équipe s'organise jusqu'à la réalisation, avec l'aide de VENTURE AI.

**ENVIE → PUBLICATION → COMMUNAUTÉ → RESSOURCES → ORGANISATION → RÉALISATION**

## Fonctionnalités (état réel : voir [TASKS.md](TASKS.md))

| Domaine | Contenu |
|---|---|
| Comptes | Inscription réservée aux majeurs (contrôle en base), vérification d'email, réinitialisation du mot de passe, profil complet, confidentialité, export et suppression des données |
| Fil | « Qu'aimerais-tu réaliser ? », filtres Pour toi / Business / Événements / Rencontres / Création / Opportunités / À proximité, fil personnalisé |
| Projets | Création en < 1 min (VENTURE AI, suggestions automatiques ou manuelle), page projet (Présentation, Équipe, Étapes, Discussion), statuts, actualités, commentaires |
| Participation | Je suis intéressé · Je participe · Je peux aider (candidature) · acceptation · équipe |
| Espace collaboratif | Objectifs, tâches (kanban), étapes (progression réelle), calendrier, documents privés, responsabilités, discussion d'équipe, VENTURE AI |
| Messagerie | Temps réel (Supabase Realtime), privée / groupe / projet, pièces jointes, demandes de contact, blocage, signalement |
| VENTURE AI | Structuration d'idée, feuille de route, analyse et prochaines actions, coûts, business plan, organisation d'événement, partenaires, profils compatibles — quotas mensuels par offre |
| Matching | Algorithme explicable (compétences, intérêts, ambitions, disponibilités, proximité, expérience), contrôle de la visibilité |
| Explorer | Univers Business / Events / People / Opportunities, recherche intelligente, filtres, carte interactive (MapLibre) |
| Événements à la demande | Intérêt sans engagement, objectif, lieu/prix/dates envisagés, propositions d'organisateurs vérifiés, étapes proposé → préparation → confirmé / annulé |
| Entreprises | Compte pro, statistiques agrégées anonymes, publication d'opportunités, réponses |
| Monétisation | Free / Plus 9,99 € / Business 49,99 € (prix modifiables en admin), Stripe en mode test |
| Administration | Signalements, modération, utilisateurs, projets & événements, abonnements & paiements, coûts IA, paramètres, journal d'audit — permissions modérateur / admin / super-admin |
| PWA | Manifeste, icônes, service worker (page hors ligne) |

## Démarrage rapide

Prérequis : Node.js ≥ 20.9, Docker.

```bash
cd venture
npm install                       # copie aussi le worker MapLibre dans public/
npx supabase start                # Postgres, Auth, Realtime, Storage, Mailpit (emails)
cp .env.example .env.local        # puis coller les clés affichées par `supabase start`
npx supabase db reset             # migrations + données de démonstration
npm run dev                       # http://localhost:3000
```

Les emails (confirmation, mot de passe) arrivent dans Mailpit : http://127.0.0.1:54324.

Pour donner un rôle d'administration à un compte (local) :

```sql
update public.profiles set platform_role = 'superadmin' where username = 'votre_pseudo';
```

## Tests

```bash
npm run typecheck && npm run lint
npm test               # 80 tests unitaires + intégration (RLS, Stripe, IA) sur la base locale
npm run build && npm run test:e2e   # 20 scénarios Playwright, dont le parcours d'acceptation complet
```

Résultats détaillés : [TEST_REPORT.md](TEST_REPORT.md).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — stack, structure, modèle de données, décisions
- [SECURITY.md](SECURITY.md) — modèle de sécurité, RLS, limites connues
- [DEPLOYMENT.md](DEPLOYMENT.md) — préproduction et production (Supabase + Vercel)
- [ROADMAP.md](ROADMAP.md) · [TASKS.md](TASKS.md) · [CHANGELOG.md](CHANGELOG.md)
- [CLAUDE.md](CLAUDE.md) — règles permanentes pour les sessions de développement
