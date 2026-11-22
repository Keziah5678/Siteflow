# ARTHENIS — Where worlds are born

Plateforme de création et de simulation d'univers vivants. Chaque monde a ses
propres lois, sa mémoire (World Brain), son gardien de cohérence (Guardian AI),
son temps (Time Engine) et une carte 3D qui en est le cœur.

> Ce dossier reprend la bêta `Keziah5678/Arthenis-beta` (identité visuelle,
> terrain procédural, prompts d'images, direction artistique) et la restructure
> en architecture modulaire. Voir [STATUS.md](./STATUS.md) pour l'audit de
> l'existant et l'état honnête de chaque fonctionnalité.

## Démarrer

```bash
cd arthenis
npm install
cp .env.example .env.local   # facultatif : sans Supabase, mode local
npm run dev                  # http://localhost:3000
```

Sans variables Supabase, l'application tourne en **mode local** : comptes et
mondes sont stockés dans le navigateur (localStorage + IndexedDB pour les
images). Tout le produit est utilisable, mais ce n'est pas une frontière de
sécurité. Avec Supabase, chaque appel passe sous le JWT de l'utilisateur et la
sécurité est assurée par les politiques RLS.

## Vérifier

```bash
npm run lint         # ESLint
npm run typecheck    # TypeScript strict
npm test             # Vitest — moteurs Guardian, Time Engine, World Brain, permissions (25 tests)
npm run test:db      # PostgreSQL jetable : migrations x2 (idempotence) + 58 tests RLS
npm run build        # build de production
npm run test:e2e     # Playwright — parcours complet desktop + mobile (après build)
```

`test:db` nécessite PostgreSQL 14+ installé localement (`initdb`, `pg_ctl`,
`psql`). Il reconstruit aussi le schéma bêta avec des données, pour tester
l'import.

## Architecture

```
lib/engine/        Domaine pur, sans I/O — testé unitairement
  types.ts           Modèle : monde, constitution, entités, relations, événements, révisions…
  constitution.ts    Lois du monde, préréglages par type, calendrier, identité visuelle dérivée
  hierarchy.ts       Univers → Galaxie → Système → Planète → Continent → Pays → Région → Ville → Village → Lieu
  guardian.ts        Moteur de cohérence : VALID / WARNING / CONFLICT, lois citées, alternatives, analyse d'amendement
  simulation.ts      Time Engine déterministe : prévisualiser puis appliquer
  brain.ts           World Brain : récupération de faits, chemins de relations, dossiers
  permissions.ts     Matrice des rôles (miroir des politiques SQL)
lib/world/         Repris de la bêta : identité visuelle, terrain procédural, placeholders, atlas 2D
lib/ai/            Prompt d'images (bêta), client des routes IA
lib/data/          Couche données : interface Repository, implémentations locale et Supabase
lib/server/        Serveur uniquement : fournisseurs IA, authentification, quotas, limitation de débit
app/api/ai/*       guardian (second avis), brain, narrate, suggest, image — tous protégés
components/map/    Carte 3D (React Three Fiber) : terrain par tuiles avec LOD, révélation, vue cosmique
components/studio/ World Studio : éditeur + Guardian, dossiers, sections
supabase/          Migrations v2 (+ import bêta), tests RLS
tests/             unit (Vitest), e2e (Playwright)
```

### Principes

- **Les données structurées sont la source de vérité.** L'IA lit le canon,
  ne le remplace pas ; sans clé IA, tous les moteurs fonctionnent en mode
  déterministe.
- **Aucune constitution universelle.** Chaque monde porte ses lois dans
  `worlds.constitution` ; Guardian ne juge qu'à partir d'elles.
- **L'histoire ne s'efface pas.** Pas de DELETE sur le canon (révoqué en SQL),
  révisions append-only, événements immuables, corrections et révisions
  assumées traçables, le temps ne recule pas.
- **Le créateur est l'autorité suprême.** Seul lui amende la constitution ;
  chaque amendement est historisé avec son analyse d'impact, et les éléments
  qui la contredisent sont marqués « en tension », jamais supprimés.

## Base de données (Supabase)

Appliquer dans l'ordre :

1. `supabase/migrations/20261122000100_arthenis_v2_schema.sql`
2. `supabase/migrations/20261122000200_arthenis_legacy_import.sql`

Les deux sont idempotentes et compatibles avec la base bêta : `worlds`,
`world_members` et `profiles` sont étendues, les anciennes politiques sont
remplacées, les tables bêta (`regions`, `characters`…) sont importées dans
`entities` sans être supprimées. Les migrations bêta d'origine sont conservées
dans `supabase/legacy-migrations/` pour référence.

Fonctions transactionnelles (SECURITY INVOKER sauf mention) :
`arthenis_save_entity` (verrou optimiste), `arthenis_apply_simulation`
(refuse une prévisualisation périmée), `arthenis_amend_constitution` (definer,
créateur uniquement), `arthenis_correct_event` (definer, admin+),
`arthenis_review_proposal`, `arthenis_accept_invitation` (definer, adresse
vérifiée). Bucket privé `arthenis-assets`, lu par URL signée.

## Variables d'environnement

Voir `.env.example`. Les clés IA ne sont lues que côté serveur
(`lib/server/config.ts`) et ne sont jamais envoyées au navigateur.

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Mode hébergé |
| `ARTHENIS_TEXT_PROVIDER` | `openai`, `anthropic` ou `none` |
| `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_SIZE` | Texte et images |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_TEXT_MODEL` | Texte (défaut `claude-opus-5-5`) |
| `ARTHENIS_DAILY_IMAGE_LIMIT`, `ARTHENIS_DAILY_TEXT_LIMIT`, `ARTHENIS_RATE_LIMIT_PER_MINUTE` | Garde-fous de coût |
| `ARTHENIS_ALLOW_ANONYMOUS_AI` | Autorise l'IA sans comptes en production (défaut : non) |

## Déployer sur Vercel

Projet Vercel avec **Root Directory = `arthenis`**, framework Next.js, les
variables ci-dessus. `GET /api/health` indique la configuration active sans
exposer de secret.
