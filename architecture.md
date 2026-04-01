# Architecture — PROJECT // ROGUE

Ce document décrit les principaux éléments architecturaux de l'application.

---

## Vue d'ensemble

PROJECT // ROGUE est une Single Page Application (SPA) sans framework UI. Le rendu 3D est entièrement géré par **Babylon.js** ; la logique métier est découpée en classes ES6 indépendantes, bundlées par **Vite**.

```
Navigateur
└── main.js  ← point d'entrée
     ├── GameScene          ← orchestrateur principal
     │    ├── ProceduralMap      ← génération & navigation de carte
     │    ├── Player             ← caméra, inputs, arme
     │    ├── WaveManager        ← spawn d'ennemis & vagues
     │    ├── NavigationManager  ← navmesh Recast + crowd agents
     │    ├── LightingManager    ← éclairage dynamique + post-process
     │    └── UpgradeManager     ← catalogue et sélection d'upgrades
     └── UI (MainMenu, PauseMenu)
```

---

## Modules principaux

### `GameScene` — Orchestrateur

`src/Scenes/GameScene.js`

Point central du jeu. Il :
- Crée le moteur Babylon.js et la scène.
- Lance la génération de la carte (`ProceduralMap.generate()`).
- Instancie tous les systèmes dans le bon ordre (carte → joueur → lumières → vagues → navigation).
- Reçoit les callbacks de transition de salle de `ProceduralMap` et coordonne les autres systèmes en conséquence.
- Gère la pause (flag `isPaused`) et le menu d'upgrade entre les salles (`_waitForUpgradeChoice`).

**Relations** : agrège tous les autres systèmes. Aucun autre module ne connaît `GameScene`.

---

### `ProceduralMap` — Génération de la carte

`src/Maps/ProceduralMap.js` + `ProceduralMapData.js`

Responsable de :
- **Génération de la chaîne de salles** (`_buildChain`) : positionne les salles et calcule les couloirs à partir d'un seed déterministe (LCG simple).
- **Construction géométrique** (`_buildRoom`, `_buildFloor2`, `_buildCorridorGeometry`) : instancie les assets GLB via `SceneLoader`, place les colliders invisibles, construit le second niveau/balcon et les rampes.
- **Activation des salles** (`_activateRoom`) : active/désactive les `TransformNode` pour ne rendre que la salle courante + ses couloirs adjacents. Les salles déjà visitées sont mises en cache (`_builtRooms`).
- **Détection des triggers** (`_setupTriggerLoop`) : chaque frame, vérifie si la caméra est dans un volume de transition et déclenche `_activateRoom`.

`ProceduralMapData.js` contient uniquement des données : dimensions, assets par couleur, patterns de props par type de salle (`QUAD_PATTERNS`) et configurations de second niveau (`LAYOUTS`).

---

### `Player` — Joueur

`src/Player/Player.js`

Encapsule la `UniversalCamera` de Babylon.js. Gère :
- Les inputs clavier (ZQSD/WASD + espace pour sauter).
- Le bob de l'arme et l'inclinaison de la caméra lors des déplacements latéraux.
- La logique de saut par raycast.
- La caméra secondaire (`_weaponCamera`) sur un layer mask dédié pour éviter le clipping de l'arme dans les murs.
- La délégation à `Health` (dégâts/mort) et `PlayerShoot` (tir).
- L'affichage du Game Over via `GameOverScreen`.

---

### `PlayerShoot` — Tir

`src/Player/PlayerShoot.js`

Gère :
- La cadence de tir (fire rate).
- La consommation de munitions via `Ammo`.
- L'instanciation des `Projectile`.
- Le multishot (activable par upgrade).
- Le muzzle flash (particules via `EnemyParticles`).

---

### `WaveManager` — Gestion des vagues

`src/Systems/WaveManager.js`

À chaque entrée dans une salle (`enterRoom`) :
1. Supprime les ennemis restants et les portes de la salle précédente.
2. Spawne deux barrières physiques (portes) bloquant l'entrée et la sortie.
3. Lance les vagues séquentiellement (`_launchNextWave`).

Chaque vague est définie dans `WAVE_COMPOSITIONS` (types d'ennemis, counts, multiplicateurs de vitesse). Les ennemis apparaissent avec un effet d'avertissement (`EnemyParticles.spawnWarning`) puis sont instanciés après un délai. Quand tous les ennemis d'une vague sont morts (mesh disposé), la vague suivante commence. Après la 5ème vague, les portes s'ouvrent et `GameScene` déclenche l'écran d'upgrade.

---

### `BaseEnemy` / Sous-classes — IA ennemie

`src/Enemies/BaseEnemy.js`, `StandardEnemy.js`, `HeavyEnemy.js`, `ScoutEnemy.js`

Architecture en **héritage** : `BaseEnemy` fournit toute la logique de déplacement et de comportement ; les sous-classes ne surchargent que `_getConfig()` pour définir les paramètres (taille, vitesse, couleur, rayon d'orbite…).

Comportement :
- **Système de slots** : chaque ennemi reçoit un slot directionnel (FRONT / LEFT / RIGHT / BACK) par ordre d'apparition. Cela force les ennemis à attaquer de directions différentes.
- **Phases** : phase `waypoint` (l'ennemi rejoint un point intermédiaire imposé par son slot) puis phase `attack` (l'ennemi orbite autour du joueur à `encircleRadius`).
- **Pathfinding** : si le `NavigationManager` est prêt, l'ennemi est un crowd agent Recast. Sinon, il utilise un mode fallback (steering + séparation entre ennemis + gestion des pentes).
- **Recul** (`_applyKnockback`) : après un tir, l'ennemi est repoussé avec un raycast pour éviter de traverser les murs.

---

### `NavigationManager` — Pathfinding

`src/Systems/NavigationManager.js`

Encapsule le `RecastJSPlugin` de Babylon.js (chargé via CDN global `recast.js`).

- `buildForRoom(meshes)` : bake les world matrices des meshes de sol, construit le navmesh, crée un crowd de 30 agents max.
- `addAgent` / `removeAgent` / `setAgentTarget` : API simple utilisée par `BaseEnemy`.
- `update(dt)` : appelé chaque frame depuis `GameScene` pour mettre à jour la simulation Recast.

Le navmesh est reconstruit à chaque changement de salle (les géométries sont différentes).

---

### `LightingManager` — Éclairage

`src/Systems/LightingManager.js`

- Crée une `HemisphericLight` globale très sombre + 5 `PointLight` par salle (4 en croix au plafond + 1 centrale basse) aux couleurs de la palette thématique de la salle.
- **Flicker** : une lumière aléatoire par salle oscille rapidement pour simuler un éclairage défaillant.
- **Pulse** : les autres lumières ont une variation douce et lente.
- **Mode combat** (`setCombatMode`) : une `PointLight` rouge centrale pulse agressivement pendant les vagues.
- **Post-processing** : `DefaultRenderingPipeline` avec bloom, vignette et légère correction colorimétrique.

---

### Systèmes utilitaires

| Classe | Fichier | Rôle |
|---|---|---|
| `Health` | `Systems/Health.js` | Vie courante, dégâts, soin, callbacks mort/dégâts |
| `Ammo` | `Systems/Ammo.js` | Munitions courantes, recharge automatique par interval |
| `UpgradeManager` | `Systems/UpgradeManager.js` | Catalogue des 6 upgrades, tirage aléatoire de 3 cartes |
| `Projectile` | `Weapons/Projectile.js` | Déplacement par raycast frame-by-frame, détection d'impact, dispatch selon cible |
| `EnemyParticles` | `Enemies/EnemyParticles.js` | Factory de ParticleSystem (spawn warning, death, muzzle flash, impact) |

---

### UI

| Classe | Rôle |
|---|---|
| `PlayerHUD` | Barres de vie et de munitions, message de vague, compteur FPS, écran d'upgrade |
| `MainMenu` | Menu principal + panneau de paramètres (sensibilité, volume) |
| `PauseMenu` | Overlay pause (Entrée) avec les mêmes paramètres |
| `GameOverScreen` | Overlay game over avec effet glitch CRT et statistiques |

Toute l'UI est en **HTML/CSS pur**, injectée dans le DOM au-dessus du canvas Babylon.js. Les overlays utilisent `pointer-events: none` sauf quand ils doivent capturer les clics.

---

## Flux de données simplifié

```
main.js
  │
  ├─ GameScene._init()
  │     └─ _generateMap()
  │           ├─ ProceduralMap.generate()   → salles + couloirs construits
  │           ├─ Player instancié           → caméra attachée à la carte
  │           ├─ WaveManager instancié
  │           └─ NavigationManager.init()
  │
  └─ ProceduralMap._onRoomReady (callback)
        ├─ LightingManager.setRoom()
        ├─ NavigationManager.buildForRoom()
        └─ WaveManager.enterRoom()
              ├─ _spawnDoors()
              └─ _launchNextWave()
                    └─ BaseEnemy (× N) instanciés
                          └─ NavigationManager.addAgent()
```

---

## Choix techniques notables

- **Pas de framework UI** : toute l'interface est du DOM vanilla pour minimiser les dépendances et garder le contrôle sur le layering avec le canvas WebGL.
- **Cache de SceneLoader** : les assets GLB sont chargés une seule fois et instanciés (`instantiateModelsToScene`) à chaque placement, ce qui évite de re-télécharger les fichiers.
- **Seed déterministe** : la génération de la carte utilise un LCG (Linear Congruential Generator) plutôt que `Math.random()`, ce qui permettrait de rejouer une seed exacte.
- **Layer masks** : l'arme du joueur est rendue sur une caméra dédiée (`_weaponCamera`) avec un layer mask `0x10000000` pour éviter le clipping dans les murs.
- **Fallback pathfinding** : si Recast n'est pas disponible (CDN inaccessible, navigateur trop ancien), les ennemis utilisent un steering comportemental simple, assurant la jouabilité dans tous les cas.