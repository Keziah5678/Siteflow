# Appartement 3D — studio & jardin spa explorable

Reconstruction 3D temps réel (Three.js / WebGL 2) d'un studio avec jardin privatif,
d'après 8 photographies. On s'y déplace librement à la première personne, comme dans un jeu PC.
Ce n'est ni une vidéo ni une visite à points cliquables : c'est un vrai espace continu, avec collisions.

## Lancer le projet

Prérequis : Node.js 20 ou plus récent.

```bash
cd appartement-3d
npm install
npm run dev          # ouvre http://localhost:5173
```

Autres commandes :

| Commande | Rôle |
|---|---|
| `npm run build` | build de production dans `dist/` (site statique, hébergeable partout) |
| `npm run build:single` | un seul fichier HTML autonome dans `dist-single/` (à ouvrir ou partager tel quel) |
| `npm run preview` | sert le build de production |
| `npm run typecheck` | vérification TypeScript stricte |
| `npm run test:e2e` | tests de bout en bout dans Chromium (lancez `npm run dev` avant) |

Paramètres d'URL : `?q=haute|moyenne|basse` (qualité graphique), `?fps` (compteur d'images).

## Commandes

| Touche | Action |
|---|---|
| Z / W | avancer |
| S | reculer |
| Q / A | aller à gauche |
| D | aller à droite |
| Souris | regarder (360°) |
| Maj | courir |
| Espace | sauter |
| E (ou clic gauche) | interagir avec l'objet visé |
| R | revenir au point de départ |
| N | jour / nuit |
| L | lampe torche |
| F | plein écran |
| H | afficher / masquer les commandes |
| Échap | libérer la souris et ouvrir le menu |

Les touches fonctionnent en AZERTY et en QWERTY. Sur téléphone ou tablette, un joystick
(à gauche), le glissement du doigt (pour regarder) et un bouton **E** remplacent clavier et souris.

Le menu (Échap ou ☰) permet de régler la sensibilité de la souris et la vitesse de marche,
d'inverser l'axe vertical, de couper les sons, de changer la qualité et de basculer jour/nuit.

## Ce qui est reconstruit

| Pièce | Éléments (d'après les photos) |
|---|---|
| Chambre · séjour | parquet chêne clair, plafond à caisson avec gorge LED, plafonnier ondulé, tête de lit capitonnée à 4 panneaux avec lattes bois et LED, lit à sommier bouclé, couette drapée, serviette roulée, chevets gris + bougie, climatiseur, table basse à plateau relevable, armoire chêne à 2 portes, TV murale sur bras, baie vitrée coulissante noire, voilages gris |
| Kitchenette | estrade en marbre blanc, meubles anthracite à poignées barres, crédence et plan en marbre noir veiné, évier et robinet noirs, plaque, bouilloire, micro-ondes, machine à café, réfrigérateur top sous plan, réglette LED et spots |
| Salle de bain | marbre blanc au sol et aux murs, miroir festonné rétroéclairé (vrai reflet en qualité haute), vasque suspendue, WC, douche à parois vitrées et profilés noirs, colonne de douche noire, tapis noir |
| Jardin | gazon synthétique, murs végétaux sur soubassement blanc, LED verticales, bananiers et fougères, spa octogonal gonflable et entourage en résine tressée, banquette blanche laquée, table et lanterne, store banne orange, chauffe-eau, groupe de climatisation |

Zones non visibles sur les photos (entrée, environs, placards) : complétées de façon plausible.
Les dimensions sont estimées (studio d'environ 3,6 × 4,4 m, hauteur 2,7 m) ; elles ne sont pas mesurées.

## Interactions

Baie vitrée, porte de salle de bain, portes d'armoire, réfrigérateur et porte de douche (s'ouvrent ;
les collisions suivent l'animation) · interrupteurs du plafonnier, des rubans LED, de la tête de lit,
de la cuisine, de la salle de bain et du jardin · bougie · télévision · climatisation · table relevable ·
voilages · micro-ondes · machine à café · douche (eau animée) · bulles du spa · store banne · chasse d'eau.
La porte d'entrée est verrouillée (l'immeuble n'est pas modélisé). Le nom de la pièce s'affiche quand on y entre.

## Architecture du code

```
src/
  main.ts                    démarrage, boucle de jeu, états (accueil / jeu / pause), souris, tactile
  core/Renderer.ts           WebGL2, HDR, MSAA, ombres douces, bloom, tone mapping neutre
  core/Sound.ts              petits sons synthétisés (pas, portes, interrupteurs)
  core/utils.ts              projection UV métrique, aléatoire déterministe, amortissements
  player/Input.ts            clavier (ZQSD + WASD), souris, joystick tactile
  player/Player.ts           contrôleur FPS : accélération, collisions, marches, gravité, saut
  physics/Colliders.ts       collisions capsule contre boîtes et cylindres, hauteur du sol
  interaction/Interactions.ts rayon depuis le réticule, animations réversibles (Toggle)
  world/layout.ts            plan coté de l'appartement + zones nommées
  world/textures.ts          textures procédurales (parquet, marbres, bouclé, lierre, gazon…)
  world/materials.ts         matériaux PBR
  world/Builder.ts           outils de modélisation (boîtes, arrondis, arcs, LED)
  world/Architecture.ts      sols, murs, plafonds, portes, baie vitrée
  world/Interior.ts          mobilier et équipements intérieurs + interrupteurs
  world/Garden.ts            jardin, spa, store, végétation, arrière-plan
  world/Environment.ts       soleil, ciel, jour/nuit, reflets capturés depuis la scène
  world/LightGroup.ts        groupes de lumières pilotés par interrupteur
  ui/UI.ts, ui/styles.css    interface
scripts/e2e.mjs              tests automatisés
scripts/shots.mjs            captures d'écran des points de vue des photos
```

Toutes les textures sont générées au chargement : aucun fichier image externe, le projet est autonome.

## Continuer à l'améliorer

- **Ajuster les dimensions** : tout part de `world/layout.ts` (murs, baie, cuisine, salle de bain, jardin).
- **Remplacer un meuble par un vrai modèle** : exportez-le en `.glb` depuis Blender, placez-le dans
  `public/models/`, chargez-le avec `GLTFLoader` (`three/addons/loaders/GLTFLoader.js`) dans
  `Interior.ts` et gardez l'appel `b.col.addObject(objet)` pour sa collision.
- **Textures photo** : remplacez une fonction de `textures.ts` par `new THREE.TextureLoader().load(...)`
  (images en `public/textures/`), en conservant `texture.repeat` = 1 / taille réelle en mètres.
- **Nouvelle interaction** : `makeInteractable(objet, { label, action })` et, pour une animation,
  `new Toggle(durée, k => …)` ajoutée à `b.updaters`.
- **Nouvelle lumière commandée** : créez un `LightGroup`, enregistrez-le dans `ctx.lights`,
  puis branchez-le sur un `switchPlate(...)`.
