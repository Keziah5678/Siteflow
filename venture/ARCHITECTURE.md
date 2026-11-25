# Architecture

## Stack (versions vérifiées à l'installation)

| Couche | Choix | Version |
|---|---|---|
| Framework | Next.js App Router, React, TypeScript strict (`noUncheckedIndexedAccess`) | 16.3.5 / 19.2.8 / 6.0 |
| UI | Tailwind CSS v4, composants maison à l'API shadcn/ui, Lucide | 4.3 / 1.80 |
| Données | Supabase : Postgres 17, Auth, Realtime, Storage | CLI 3.4.0 |
| Paiements | Stripe (mode test) | stripe-node 23 |
| Carte | MapLibre GL + style OpenFreeMap (sans clé) | 6.19 |
| IA | SDK Anthropic, sorties structurées validées par Zod | `claude-opus-5-5` par défaut |
| Tests | Vitest, Playwright | 5.1 / 1.65 |

### Décisions documentées (absentes du cahier des charges)

1. **Emplacement** : le dépôt contient déjà d'autres applications (Seedflow à la racine, `shoptv/`, `appartement-*`). VENTURE vit dans `venture/` comme application autonome ; la racine ignore ce dossier dans son lint/tsconfig.
2. **shadcn/ui** : plutôt que dépendre du registre en ligne, les primitives (`Button`, `Field`, `Dialog` natif `<dialog>`, `Badge`, `Tabs`…) sont écrites dans `src/components/ui` avec la même philosophie (composants possédés, variantes typées). Aucune dépendance Radix nécessaire.
3. **Langue** : interface en français (langue du cahier des charges).
4. **Localisation** : liste de ~130 villes intégrée (`src/lib/cities.ts`). Aucun appel à un service de géocodage tiers ; coordonnées arrondies à ~1 km en base. Les coordonnées personnelles sont dans `profile_private`, jamais exposées (distance calculée côté SQL).
5. **Catégories** : `business`, `event`, `people` (rencontres, voyage, sport, communauté), `creation`, `opportunity` — alignées sur les filtres du fil et les univers d'Explorer.
6. **Candidature** = « Je peux aider ». « Je participe » est une manifestation de participation (événements, activités), distincte de l'appartenance à l'équipe.
7. **Messagerie directe** : possible entre membres d'un même projet, ou après acceptation d'une demande de contact (anti-spam).
8. **IA sans fournisseur** : un structurateur à base de règles (`src/lib/heuristics.ts`) est proposé et étiqueté « Suggestions automatiques — sans intelligence artificielle ».
9. **Prix Stripe** : `price_data` dynamique depuis `plan_settings` pour que les tarifs soient modifiables depuis l'administration sans toucher au tableau de bord Stripe.

## Structure

```
venture/
├─ supabase/
│  ├─ migrations/      0001 schéma · 0002 triggers & RPC · 0003 RLS & droits · 0004 storage & realtime
│  ├─ seed.sql         données de démonstration (is_demo)
│  └─ config.jsonc     Auth : confirmation email, mots de passe ≥ 10 car. mixtes
├─ src/
│  ├─ proxy.ts         rafraîchissement de session + routes protégées (Next 16)
│  ├─ app/
│  │  ├─ (auth)/       login, signup, reset-password, update-password
│  │  ├─ (main)/       fil, explore, create, projects/[id](/space|/edit), messages, u/[username],
│  │  │                notifications, settings, ai, business, pricing, opportunities/[id], admin, legal, onboarding
│  │  ├─ api/          ai, stripe/{checkout,portal,webhook}, account/{export,delete}
│  │  └─ auth/callback confirmation email / PKCE
│  ├─ components/      ui, layout, feed, project, space, messages, profile, explore, business, admin, settings
│  └─ lib/
│     ├─ actions/      Server Actions (auth, projets, social, admin)
│     ├─ ai/           provider (interface) · anthropic · prompts · schemas · service (quotas, contexte réel)
│     ├─ supabase/     clients serveur / navigateur / proxy, types générés
│     ├─ matching.ts   score explicable (pur, testé)
│     ├─ heuristics.ts structuration sans IA
│     ├─ validation.ts schémas Zod
│     └─ stripe.ts     client + application des événements
└─ tests/              unit/ · integration/ (base réelle) · e2e/ (Playwright)
```

## Modèle de données (principal)

- `profiles` (public, contrôlé par l'utilisateur) / `profile_private` (date de naissance, coordonnées, client Stripe)
- `projects` → `project_members`, `milestones`, `tasks`, `project_updates`, `comments`, `calendar_events`, `project_documents`
- `project_engagements` (interested / participating), `applications`
- `event_details`, `organizer_proposals`
- `conversations` (direct / group / project) → `conversation_participants`, `messages`; `contact_requests`, `blocks`
- `notifications`, `reports`, `endorsements`, `opportunities`, `opportunity_responses`
- `plan_settings`, `app_settings`, `subscriptions`, `payments`, `stripe_events`, `ai_usage`, `admin_audit_log`, `rate_limit_hits`

Les compteurs (`interest_count`, `member_count`, `milestones_done`…) et les notifications sont maintenus **uniquement par des triggers**. Les transitions (accepter une candidature, répondre à une demande de contact, modérer…) passent par des RPC qui revérifient les permissions.

## VENTURE AI

`src/lib/ai/service.ts` :
1. vérifie le quota mensuel (`ai_quota()`, crédits par offre éditables en admin) ;
2. charge **uniquement** les données que l'utilisateur a le droit de voir (client RLS), réservé aux membres du projet ;
3. appelle le fournisseur (interface `AIProvider`, implémentation Anthropic, sorties structurées Zod, repli serveur en cas de refus) ;
4. post-filtre : les identifiants de personnes/opportunités absents des données fournies sont supprimés ;
5. enregistre l'usage (tokens réels) via le rôle service.

L'IA ne fait que proposer : ajouter des étapes ou contacter quelqu'un passe par une action explicite, soumise aux mêmes permissions.

## Temps réel

`postgres_changes` sur `messages`, `notifications`, `tasks`, `milestones` (publication `supabase_realtime`). Realtime applique la RLS : seuls les participants reçoivent les événements.
