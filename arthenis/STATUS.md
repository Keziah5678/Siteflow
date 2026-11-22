# ARTHENIS — audit et état des fonctionnalités

État au 22/11/2026. Chaque ligne indique comment elle a été vérifiée. Une
fonctionnalité annoncée sans test n'est pas considérée comme livrée.

## 1. Audit de la bêta (`Keziah5678/Arthenis-beta`, commit `70adde0`)

| Constat | Conséquence | Suite donnée |
|---|---|---|
| Toute l'application tient dans `app/ArthenisApp.tsx` (509 lignes, 73 Ko), aucun test | Difficile à faire évoluer et à vérifier | Architecture modulaire, 25 tests unitaires, 58 tests RLS, 5 tests de bout en bout |
| Le schéma de base (`worlds`, `regions`, `characters`, `timeline_events`…) n'est **pas** dans les migrations : il a été créé à la main dans Supabase | Base non reproductible | Migration v2 complète et idempotente, plus un import des tables bêta |
| Moteur de cohérence : expressions régulières, deux issues seulement (accept / reject), et **accepte tout** dès que l'IA échoue | Ni WARNING, ni loi citée, ni histoire prise en compte | Guardian déterministe VALID / WARNING / CONFLICT ; l'IA ne peut ni baisser un verdict ni inventer une loi |
| « Temps » : +1 jour, un texte générique, puis un tampon `last_evolution` posé sur la première région / civilisation / personnage venus | Aucune simulation réelle | Time Engine déterministe à prévisualiser puis appliquer, de façon atomique |
| Carte : canvas 2D procédural et déterministe, de bonne qualité, mais pas en 3D | — | Conservée comme repli sans WebGL ; nouvelle carte 3D construite sur les **mêmes** fonctions de terrain |
| URL Supabase codée en dur en repli dans `api/world-engine` ; dépendances en `latest` | Fragilité | Supprimé ; versions figées |
| Aucune protection de l'histoire (UPDATE / DELETE libres pour les éditeurs) | Histoire effaçable | DELETE révoqué, révisions append-only, événements immuables |

**Repris de la bêta** : `lib/world/identity.ts` (bible visuelle, légèrement
étendu pour accepter des choix explicites de la constitution),
`lib/world/terrain.ts`, `lib/world/placeholder.ts`,
`lib/world/TerrainCanvas.tsx`, `lib/ai/images.ts` (prompts d'images),
`lib/ai/models.ts` et `lib/ai/errors.ts` (repli de modèle, messages
d'erreur), les illustrations de `public/art`, la palette et les titres en
Georgia.

## 2. Critères de validation

Vérifiés par `tests/e2e/journey.spec.ts`, `studio.spec.ts` et `mobile.spec.ts` (Chromium, mode local) :

| Critère | État |
|---|---|
| Un utilisateur peut créer son compte | ✅ e2e |
| Il peut créer un univers et définir ses lois (assistant en 5 étapes, univers vierge) | ✅ e2e |
| La carte est utilisable (WebGL, création directe sur le terrain) | ✅ e2e + captures |
| Il peut ajouter des éléments | ✅ e2e |
| Guardian détecte les incohérences (magie, loi fondamentale du créateur) | ✅ e2e + 12 tests unitaires |
| Les données survivent au rechargement | ✅ e2e |
| La reconnexion restaure le monde | ✅ e2e |
| Le temps peut avancer (100 ans, prévisualisation puis application) | ✅ e2e |
| Les conséquences sont enregistrées (décès, événements, révisions) | ✅ e2e + tests unitaires |
| Les autorisations sont respectées (intrus bloqué, lecteur en lecture seule, contributeur limité aux propositions) | ✅ e2e + 58 tests RLS |
| Les erreurs ne détruisent pas les données (écritures atomiques, simulation périmée refusée, verrou optimiste) | ✅ RLS + tests unitaires |
| Fonctionne sur mobile et sur ordinateur (pas de défilement horizontal, carte 3D sur Pixel 7) | ✅ e2e |
| Le build de production réussit | ✅ `next build` |

## 3. État par fonctionnalité

✅ opérationnel et testé · 🟡 implémenté, vérifié partiellement · ⛔ absent ou bloqué

| Domaine | État | Détail |
|---|---|---|
| Landing, inscription / connexion, profil | ✅ | Supabase Auth en mode hébergé, PBKDF2 local sinon |
| Bibliothèque, mondes publics, invitations en attente | ✅ | |
| Création d'univers : 10 types, époque, réalisme, physique, magie, technologie (plafond, listes autorisée / interdite), créatures, divinités, espèces, PNJ, climat, géographie, ressources, calendrier, lois fondamentales avec mots interdits, mode de contribution, visibilité | ✅ | |
| Hiérarchie Univers → … → Lieux, échelles facultatives, imbrication contrôlée | ✅ | Atlas en arbre, Guardian refuse une imbrication qui remonte d'échelle |
| Carte 3D : terrain par tuiles avec 3 niveaux de détail, zoom, déplacement, rotation, plein écran, 5 échelles, sélection, création au clic, territoires, frontières, arcs guerre / alliance / commerce, étiquettes selon l'échelle, villes dimensionnées par leur population, ruines | ✅ | Captures vérifiées |
| Carte blanche pour les univers vierges, révélation progressive animée | ✅ | e2e + capture |
| Vue cosmique (galaxies, systèmes, planètes) et descente vers la surface d'une planète | ✅ | e2e (`studio.spec.ts`) |
| Guardian déterministe : magie, créatures, divinités, espèces, PNJ, anachronismes techniques gradués, supraluminique, lois du créateur, hiérarchie, doublons, références aux morts et aux détruits, naissances futures, longévité, ville en mer | ✅ | |
| Second avis IA de Guardian, « Inspire-moi », World Brain IA, narration IA | 🟡 | Routes protégées et replis testés ; **non exercés avec une vraie clé** (aucune clé dans cet environnement) |
| World Brain déterministe : récupération de faits, chemin entre deux entités, dossiers, contexte pour l'IA | ✅ | Tests unitaires + e2e |
| Amendement de la constitution : analyse d'impact, historique, tensions, événement | ✅ | e2e + RLS |
| Time Engine : vieillissement, mortalité par espèce, successions, démographie logistique, technologie plafonnée, stabilité et révolutions, guerres / paix / alliances, croissance et déclin des villes, ressources et épuisement, migrations, catastrophes selon le climat, quêtes échues, naissances (si PNJ autorisés) | ✅ | Déterministe ; tests unitaires + e2e |
| Chronologie, corrections et révisions assumées traçables, versions précédentes | ✅ | e2e (révisions) + RLS (corrections) |
| Personnages, créatures, civilisations, religions, langues, technologies, ressources, objets, quêtes : création, dossier, relations, changement de statut | ✅ | e2e : création, dossier, relation de guerre, changement de statut inscrit dans l'histoire |
| Collaboration : 5 rôles, invitations, propositions, validation, journal d'activité, notifications in-app | ✅ | e2e + RLS |
| Temps réel | 🟡 | Supabase Realtime (abonnement aux tables du monde) et synchronisation entre onglets en local. Pas de présence ni de curseurs partagés |
| Génération d'images intégrée (bible visuelle, quotas, bucket privé, réutilisation) | 🟡 | Code prêt, non exercé sans `OPENAI_API_KEY` ; sans clé, illustrations dérivées de la bible visuelle |
| Dépôt Supabase côté TypeScript | 🟡 | SQL et RLS testés sur PostgreSQL 16 ; le client TS n'a pas tourné contre un vrai projet Supabase |
| Notifications par e-mail, envoi d'e-mail d'invitation | ⛔ | L'invité voit l'invitation en se connectant avec cette adresse |
| Économie de marché, commerce chiffré, langues simulées | ⛔ | Modélisés comme entités et relations, sans règles de simulation dédiées |

## 4. Limites connues

- **Guardian n'est pas imposé par la base.** RLS garantit qui peut écrire, que
  l'histoire est immuable et que seul le créateur change les lois ; la
  cohérence elle-même est vérifiée dans l'interface et à la validation des
  propositions. Un éditeur malveillant qui appellerait l'API directement
  pourrait écrire du contenu incohérent, sans pouvoir effacer l'histoire.
- **Mode local** : stockage limité par le navigateur (environ 5 Mo pour les
  données) ; ce n'est pas une frontière de sécurité.
- **Simulation** : jusqu'à 240 pas par prévisualisation ; une très longue
  durée (plus de 240 ans) est donc simulée par pas de plusieurs années.

## 5. Ce qui a bloqué, précisément

| Action | Blocage | Contournement |
|---|---|---|
| Pousser dans `Keziah5678/Arthenis-beta` | Dépôt lisible seulement (accès public en lecture) depuis cette session | Travail livré dans `Keziah5678/Siteflow`, dossier `arthenis/`, branche `claude/arthenis-world-creation-u8b7hv` |
| Appliquer les migrations au projet Supabase | Aucun connecteur Supabase dans cette session | Migrations testées sur PostgreSQL 16 local, avec une imitation de Supabase et une reconstitution du schéma bêta |
| Déployer sur Vercel | Connecteur Vercel installé mais à reconnecter | Instructions dans le README (Root Directory `arthenis`) |
| Tester l'IA réelle (texte et images) | Aucune clé API dans l'environnement | Replis déterministes testés ; routes IA validées par le typage et le build |
| Inspecter `arthenis-beta.vercel.app` et `arthenis-source.zip` | Archive non fournie ; audit fait sur le code source du dépôt | — |
