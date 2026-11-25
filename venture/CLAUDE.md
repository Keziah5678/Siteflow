@AGENTS.md

# VENTURE — règles permanentes du projet

> Ce fichier conserve les règles fondamentales du cahier des charges. Il s'applique à toute session future.

## Vision (ne jamais trahir)

**VENTURE** — *Dream. Connect. Build.* — transforme les ambitions individuelles en réalisations collectives.
VENTURE n'est pas un réseau social pour regarder la vie des autres : c'est un réseau social pour construire la sienne.

Flux central, que toute fonctionnalité doit servir :
**ENVIE → PUBLICATION → COMMUNAUTÉ → RESSOURCES → ORGANISATION → RÉALISATION**

- Un nouvel utilisateur comprend le concept en < 30 s et publie son premier projet en < 1 min.
- Les likes et abonnés ne sont pas au centre. La réputation repose sur les contributions et réalisations.
- Interactions principales : « Je suis intéressé », « Je participe », « Je peux aider », commenter, partager.

## Interdits absolus

- Aucun faux chiffre. Les données de démonstration sont toujours marquées `is_demo` et affichées « Donnée de démonstration ».
- Aucun bouton sans fonctionnalité ou trompeur. Si une fonctionnalité dépend d'une clé absente, l'interface le dit (ex. « Bientôt disponible »).
- Ne jamais prétendre qu'une fonctionnalité est terminée si elle est simulée. `TASKS.md` reflète l'état réel.
- Ne jamais masquer une erreur, désactiver TypeScript strict, une règle de lint ou un test pour « faire passer ».
- Pas d'emojis comme icônes : Lucide uniquement.
- Ne pas copier Instagram, TikTok ou LinkedIn ; pas d'interface « template SaaS » générique ; dégradés discrets uniquement (`.v-glow`).
- VENTURE AI n'invente jamais partenaires, utilisateurs, financements ou résultats ; il ne publie, n'envoie et ne paie rien sans action explicite de l'utilisateur.
- Un score de compatibilité n'est jamais présenté comme une garantie de réussite.
- Ne jamais vendre de données personnelles ; contenus sponsorisés toujours signalés.
- Financement réglementé désactivé tant qu'aucun partenaire agréé n'est en place (verrouillé dans le code admin).
- Ne jamais présenter l'application comme juridiquement conforme sans validation.
- Ne jamais engager de dépense ni supprimer de données existantes sans accord explicite.

## Identité visuelle

Fond `#09090B`, secondaire `#141418`, cartes `#19191F`, violet `#7C3AED` / `#A78BFA`, texte `#FFFFFF` / `#A1A1AA`, bordures `#27272A`, succès `#22C55E`.
Mode sombre par défaut, mode clair disponible (`[data-theme="light"]`). Inter (auto-hébergée). Tokens dans `src/app/globals.css`.
Mobile : exactement 5 onglets (Accueil, Explorer, Créer — central et mis en avant —, Messages, Profil).
Desktop : barre latérale gauche, fil central, colonne droite (tendances, opportunités).

## Règles techniques

- **Next.js 16** : lire `node_modules/next/dist/docs/` avant d'écrire du code. `proxy.ts` (pas `middleware.ts`), `params`/`searchParams`/`cookies()` asynchrones, helpers `PageProps<'/route'>`.
- **La sécurité vit dans la base** : RLS sur toutes les tables, droits `UPDATE`/`INSERT` par colonne, transitions d'état via RPC `SECURITY DEFINER` qui revérifient les permissions. L'UI n'est jamais la seule barrière.
- Toute nouvelle table : `enable row level security` + politiques + `grant` colonne par colonne + tests dans `tests/integration/rls.test.ts`.
- Toute entrée utilisateur est validée côté serveur avec Zod (`src/lib/validation.ts`).
- La clé `SUPABASE_SERVICE_ROLE_KEY` n'est utilisée que dans des modules `server-only`, après vérification de l'identité.
- Messages d'erreur DB : codes `VENTURE_*` traduits dans `src/lib/errors.ts`.
- La progression d'un projet = étapes réellement terminées (`milestones_done / milestones_total`, maintenus par trigger).

## Protocole anti-erreurs

Avant : lire les fichiers concernés, vérifier dépendances et docs, définir les critères de réussite.
Après : `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e`, tester permissions, erreurs et mobile, puis mettre à jour `TASKS.md`, `TEST_REPORT.md`, `CHANGELOG.md`.

## Commandes

```bash
npx supabase start          # stack locale (Postgres, Auth, Realtime, Storage, Mailpit)
npx supabase db reset       # réapplique migrations + seed
npm run db:types            # régénère src/lib/supabase/database.types.ts
npm run dev                 # http://localhost:3000
npm test                    # unitaires + intégration (base locale requise)
npm run build && npm run test:e2e
```
