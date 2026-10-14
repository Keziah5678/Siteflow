# Appartement 3D — version Unity

Portage Unity de l'appartement explorable (studio, kitchenette, salle de bain, jardin avec spa),
reconstruit d'après les photos. Même plan, même mobilier, mêmes interactions que la version
navigateur (`../appartement-3d`), avec un contrôleur à la première personne basé sur le
`CharacterController` de Unity.

Tout est généré par code au lancement (géométrie, textures procédurales, matériaux, lumières) :
le dossier `Assets/Appartement` ne contient que des scripts, aucun modèle ni image à importer.

## Installer et lancer (5 minutes)

1. **Unity Hub → New project →** modèle **Universal 3D** (URP, recommandé) ou **3D (Built-In)**.
   Unity 2021.3 LTS ou plus récent (Unity 6 conseillé).
2. Fermez Unity, puis copiez le dossier `Assets/Appartement` de ce dépôt dans le dossier
   `Assets/` du nouveau projet.
3. Rouvrez le projet. Au premier chargement, le script d'éditeur crée automatiquement la scène
   `Assets/Appartement/Appartement.unity` (ajoutée aux Build Settings) et un matériau de référence.
   Sinon : menu **Appartement 3D → Préparer le projet**.
4. Ouvrez `Assets/Appartement/Appartement.unity` et appuyez sur **Play**
   (ou menu **Appartement 3D → Ouvrir la scène et jouer**).

Astuce : la scène `SampleScene` du modèle lance aussi l'appartement automatiquement.

Pour une application autonome : **File → Build Settings → Build** (Windows, macOS ou Linux).

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
| E ou clic gauche | interagir avec l'objet visé |
| R | revenir au point de départ |
| N | jour / nuit |
| L | lampe torche |
| F | plein écran |
| H | afficher / masquer les commandes |
| Échap | menu pause (sensibilité, vitesse, axe Y, sons, jour/nuit, plein écran) |

Fonctionne avec le nouveau **Input System** comme avec l'ancien **Input Manager** (détection automatique).
Avec le nouveau système, les touches sont lues par position physique : ZQSD sur AZERTY = WASD sur QWERTY.

## Interactions

Baie vitrée coulissante (accès au jardin), porte de salle de bain, portes d'armoire, réfrigérateur,
porte de douche — les collisions suivent l'animation · 7 interrupteurs (plafonnier, rubans LED,
tête de lit, cuisine, salle de bain, jardin ×2) · bougie · télévision · climatisation · table relevable ·
voilages · micro-ondes · machine à café · eau de la douche · bulles du spa · store banne · chasse d'eau.
La porte d'entrée est verrouillée. Le nom de la pièce s'affiche quand on y entre.

## Rendu

- **URP** : matériaux PBR « Lit », ombres douces, sondes de réflexion recalculées depuis la scène,
  ciel procédural, post-traitement (tone mapping neutre, halo des LED, adaptation de l'exposition
  intérieur/extérieur), anticrénelage SMAA.
- **Built-In** : même scène avec le shader Standard, sans post-traitement.
- Mode nuit : ciel étoilé, LED du jardin, éclairage du spa et de la lanterne.

## Architecture

```
Assets/Appartement/
  Scripts/
    AppartementGame.cs     point d'entrée : construction, états (accueil / jeu / pause), raccourcis
    Layout.cs              plan coté (repère du plan : X = est, Z = sud) + zones nommées
    ProceduralTextures.cs  parquet, marbres, bouclé, feutrine, lierre, gazon, rotin, feuilles, écran TV
    MaterialLibrary.cs     matériaux PBR compatibles URP et Built-In
    MeshGen.cs             boîtes, boîtes arrondies, cylindres, révolution, tores, arcs, surfaces
    Builder.cs             outils de modélisation, interactables, animations, groupes de lumières
    Architecture.cs        sols, murs, plafond à caisson, portes, baie vitrée
    Interior.cs            mobilier, cuisine, salle de bain, interrupteurs
    Garden.cs              jardin, spa, store banne, végétation
    EnvironmentController.cs soleil, ciel, nuit, sondes de réflexion
    PostFX.cs              post-traitement URP (résolu à l'exécution, compile aussi en Built-In)
    MirroredColliders.cs   collisions recopiées dans le repère monde (voir ci-dessous)
    PlayerController.cs    contrôleur FPS, réticule d'interaction, lampe torche
    GameInput.cs           clavier / souris, nouveau et ancien système d'entrées
    GameUI.cs              interface IMGUI (aucune dépendance)
    Effects.cs, SoundFx.cs particules (douche, bulles) et sons synthétisés
  Editor/AppartementMenu.cs création de la scène et du matériau de référence
```

**Repère** : le décor est décrit avec les mêmes cotes que la version navigateur (Z = sud) sous une
racine retournée en Z, ce qui donne une scène correctement orientée dans Unity. PhysX n'accepte pas
les échelles négatives : `MirroredColliders` recopie chaque collision dans le repère monde réel et
resynchronise celles qui bougent (portes, rideaux).

## Continuer

- **Dimensions** : tout part de `Layout.cs` et des cotes de `Architecture.cs`.
- **Vrais modèles 3D** : remplacez un meuble généré par un prefab (FBX / glTF importé) placé
  dans la scène ; ajoutez-lui un collider et, s'il doit réagir, un composant `Interactable`.
- **Réglages visuels** : intensités des lumières dans `Interior.cs` / `Garden.cs`, soleil et ciel
  dans `EnvironmentController.cs`, bloom et exposition dans `PostFX.cs`.

## Limites connues

- Je n'ai pas pu lancer Unity pour ce portage (pas d'éditeur dans l'environnement de développement).
  Le code a été **compilé** contre les assemblies de référence UnityEngine 2021.3 et UnityEditor,
  sans erreur ; la branche « nouveau Input System » n'a pas pu être compilée faute de l'assembly.
  Les premiers réglages visuels (intensités, exposition) peuvent demander un ajustement en jeu.
- En Built-In, les feuilles de végétation ne sont visibles que d'un côté (shader Standard).
- Pas de commandes tactiles dans la version Unity (cible : ordinateur).
