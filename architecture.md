# Architecture — PROJECT // ROGUE

Ce document décrit les principaux éléments architecturaux de l'application.

---

## Structure des fichiers

```
src/
├── main.js
├── Styles/
│   └── Game.css
├── Scenes/
│   ├── GameScene.js
│   ├── ProceduralMap.js
│   └── ProceduralMapData.js
├── Player/
│   ├── Player.js
│   └── PlayerShoot.js
├── Enemies/
│   ├── BaseEnemy.js
│   ├── StandardEnemy.js
│   ├── HeavyEnemy.js
│   ├── ScoutEnemy.js
│   ├── SpiderEnemy.js
│   ├── DroneEnemy.js
│   ├── BossEnemy.js
│   ├── BossEnemy2.js
│   ├── BossEnemy3.js
│   └── EnemyParticles.js
├── Systems/
│   ├── Health.js
│   ├── Ammo.js
│   ├── WaveManager.js
│   ├── NavigationManager.js
│   ├── LightingManager.js
│   ├── UpgradeManager.js
│   ├── ScoreManager.js
│   ├── WeaponManager.js
│   ├── MinimapManager.js
│   ├── SoundManager.js
│   ├── GamepadManager.js
│   └── SpecialRooms.js
├── Weapons/
│   ├── Projectile.js
│   ├── BasicDagger.js
│   ├── PlasmaShotgun.js
│   ├── QuantumSniper.js
│   └── VoidRocket.js
└── UI/
    ├── PlayerHUD.js
    ├── MainMenu.js
    ├── PauseMenu.js
    ├── GameOverScreen.js
    ├── GraphicsMenu.js
    ├── KeybindingsMenu.js
    ├── DebugPanel.js
    └── IntroSequence.js
```

---

## Hiérarchie des classes

PROJECT // ROGUE est une Single Page Application (SPA) sans framework UI. Le rendu 3D est entièrement géré par **Babylon.js** ; la logique métier est découpée en classes ES6 indépendantes, bundlées par **Vite**.

```
Navigateur
└── main.js  ← point d'entrée
     ├── GameScene            ← orchestrateur principal
     │    ├── ProceduralMap       ← génération & navigation de carte
     │    ├── Player              ← caméra, inputs, capacités
     │    │    └── PlayerShoot    ← tir, upgrades armes
     │    ├── WaveManager         ← spawn d'ennemis, vagues, salles spéciales
     │    │    ├── BaseEnemy × N  ← agents Recast ou fallback steering
     │    │    ├── SpiderEnemy    ← ennemi mural laser hitscan
     │    │    ├── DroneEnemy     ← ennemi volant projectiles
     │    │    ├── BossEnemy      ← ARCHON (3 phases)
     │    │    ├── BossEnemy2     ← NEXUS (3 phases)
     │    │    ├── BossEnemy3     ← VOIDBRINGER (3 phases)
     │    │    └── SpecialRooms   ← boutique, forge, défi
     │    ├── NavigationManager   ← navmesh Recast + crowd agents
     │    ├── LightingManager     ← éclairage dynamique + post-process
     │    ├── UpgradeManager      ← catalogue et sélection d'upgrades
     │    ├── ScoreManager        ← score, combo, streak, grade
     │    ├── WeaponManager       ← slots d'armes, switch, tir secondaire
     │    ├── MinimapManager      ← carte dynamique canvas 2D
     │    └── SoundManager        ← musique ambiante / boss, fade
     ├── GamepadManager           ← input manette, navigation menus
     └── UI
          ├── MainMenu            ← menu titre + paramètres
          ├── PauseMenu           ← overlay pause
          ├── GraphicsMenu        ← panneau post-process configurable
          ├── KeybindingsMenu     ← remapping clavier + visualiseur manette
          ├── IntroSequence       ← cinématique typewriter HTML/SVG
          └── DebugPanel          ← panneau F2 pour le jury / QA
```

---

## Modules principaux

### `GameScene` — Orchestrateur

`src/Scenes/GameScene.js`

Point central du jeu. Il :
- Crée le moteur Babylon.js et la scène (fog, gravity, collision).
- Lance la génération de la carte (`ProceduralMap.generate()`).
- Instancie tous les systèmes dans le bon ordre (carte → joueur → lumières → vagues → navigation).
- Reçoit les callbacks de transition de salle (`_onRoomReady`) et coordonne en cascade LightingManager, NavigationManager et WaveManager.
- Gère la pause (`isPaused`) et le menu d'upgrade entre les salles (`_waitForUpgradeChoice`).
- Calcule le type de salle (spawn / normal / boss / shop / forge / challenge) selon la position dans les cycles.

**Relations** : agrège tous les autres systèmes. Aucun autre module ne connaît `GameScene`.

---

### `ProceduralMap` — Génération de la carte

`src/Maps/ProceduralMap.js` + `ProceduralMapData.js`

Responsable de :
- **Génération de la chaîne de salles** (`_buildChain`) : positionne les salles et calcule les couloirs à partir d'un seed déterministe (LCG — Linear Congruential Generator).
- **Construction géométrique** (`_buildRoom`, `_buildFloor2`, `_buildCorridorGeometry`) : instancie les assets GLB via `SceneLoader`, place les colliders invisibles, construit le second niveau/balcon et les rampes. Les murs s'ouvrent là où passent les couloirs (openings calculées par `_side()`).
- **Activation des salles** (`_activateRoom`) : dispose la salle précédente entièrement (meshes + matériaux procéduraux), reconstruit la suivante. Une seule salle active à la fois pour économiser la mémoire GPU.
- **Détection des triggers** (`_setupTriggerLoop`) : chaque frame, vérifie si la caméra entre dans un volume de transition et déclenche `_activateRoom` avec un cooldown anti-rebond.
- **Flèches de navigation** au sol à l'entrée de chaque couloir (DynamicTexture + pulse d'opacité).

`ProceduralMapData.js` contient uniquement des données : dimensions, assets par couleur, patterns de props par type de salle (`QUAD_PATTERNS`) et configurations de second niveau (`LAYOUTS`).

---

### `Player` — Joueur

`src/Player/Player.js`

Encapsule la `UniversalCamera` de Babylon.js. Gère :
- Les inputs clavier AZERTY et QWERTY simultanément (touches Z/W, Q/A, etc.).
- Le bob de l'arme et l'inclinaison de la caméra lors des déplacements latéraux.
- La logique de saut par raycast (indépendante de `applyGravity` interne).
- La caméra secondaire (`_weaponCamera`) sur un layer mask `0x10000000` pour éviter le clipping de l'arme dans les murs.
- La délégation à `Health` (dégâts/mort) et `PlayerShoot` (tir).
- **Capacités actives** : Dash (Shift), Blink (clic droit, téléportation sur ennemi ciblé), Bouclier (F, invincibilité 2s), Grenade EMP (G, ralentit ennemis), Mode Berserk (M, dégâts ×2 + vitesse +30% + invincibilité 10s).
- Lissage de la souris (`_installMouseSmoothing`) pour couper les pics de `movementX/Y` parasites.

---

### `PlayerShoot` — Tir

`src/Player/PlayerShoot.js`

Gère :
- La cadence de tir (fire rate configurable par upgrade).
- La consommation de munitions via `Ammo` (rechargement automatique).
- L'instanciation des `Projectile` ou des variantes (perforant, explosif).
- Le multishot (activable par upgrade — 3 projectiles en éventail).
- Le muzzle flash (particules via `EnemyParticles`).
- Le multiplicateur de dégâts (upgrades, mode Berserk, "dernière balle").

---

### `WaveManager` — Gestion des vagues et structure de progression

`src/Systems/WaveManager.js`

Structure de progression sur 3 cycles de 5 salles chacun (15 salles de combat + 3 boss + 3 spéciales = 18 salles totales) :

```
Cycle N :
  Salle 1,2,3 → Combat (3 vagues, compositions escaladées)
  Salle 4     → Boss (ARCHON / NEXUS / VOIDBRINGER selon cycle)
  Salle 5     → Spéciale (Boutique C1 / Forge C2 / Défi C3)
```

À chaque `enterRoom` :
1. Dispose les ennemis et portes résiduels.
2. Spawne deux portes physiques bloquant la progression.
3. Lance les vagues ou déclenche le boss/salle spéciale selon le type.

Les compositions de vague (`WAVE_COMPOSITIONS_C1` / `C2`) définissent les types, counts et speed multipliers. Le cycle 2+ introduit Drones et Spiders. La difficulté scale avec `_diffMult = 1 + (cycle-1) × 0.35`.

---

### Ennemis — Architecture et comportements

#### `BaseEnemy` + sous-classes (`StandardEnemy`, `HeavyEnemy`, `ScoutEnemy`)

`src/Enemies/BaseEnemy.js`

Architecture en **héritage** : `BaseEnemy` fournit toute la logique ; les sous-classes ne surchargent que `_getConfig()`.

- **Système de slots directionnels** : chaque ennemi reçoit un slot (FRONT / LEFT / RIGHT / BACK) par ordre global d'apparition (`_enemySpawnCounter`). Cela force des approches depuis 4 directions différentes sans coordination explicite.
- **Phase waypoint → phase attack** : l'ennemi rejoint d'abord un point intermédiaire imposé par son slot (via `_relativePoint` dans le repère du joueur), puis orbite à `encircleRadius`.
- **Mode Recast** : si le navmesh est prêt, l'ennemi est un crowd agent. La position Y est extraite du navmesh, pas de la physique Babylon.
- **Mode fallback** : steering comportemental (évitement de murs multi-raycast, séparation entre agents, gestion des pentes, anti-stuck avec saut automatique).
- **Recul sécurisé** (`_applyKnockback`) : 5 directions raycastées pour trouver la meilleure direction de recul sans traverser les murs.

#### `SpiderEnemy`

`src/Enemies/SpiderEnemy.js`

Ennemi "mural" : se colle sur les murs et le plafond via raycast multicouche, tire un laser hitscan vers le joueur, puis se repositionne instantanément sur une autre surface avec un marqueur de destination visible avant l'apparition.

#### `DroneEnemy`

`src/Enemies/DroneEnemy.js`

Drone volant à hauteur fixe (`FLOAT_HEIGHT`), orbite autour du joueur, tire des projectiles physiques avec vérification de proximité joueur. Lumière de position pulsée attachée.

#### Boss (`BossEnemy`, `BossEnemy2`, `BossEnemy3`)

Chaque boss a 3 phases de combat (invincible) séparées par des transitions de 5s (vulnérable — weakpoint visible — particules vertes). L'invincibilité est levée uniquement pendant ces fenêtres.

| Boss | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| ARCHON | Sauts sur le joueur (×5) | Lasers projectiles + mouvement | Flotte + invoque une vague de minions |
| NEXUS | Mines télééguidées (×6) | Barrage circulaire (12 proj + 3 ciblés) | Laser tournant accéléré |
| VOIDBRINGER | Charges (×4, telegraphiées) | Spin berserker continu + zone de dégâts | Stomps + ondes + dash frénétiques |

---

### `NavigationManager` — Pathfinding

`src/Systems/NavigationManager.js`

Encapsule le `RecastJSPlugin` de Babylon.js (chargé via CDN global `recast.js`).

- `buildForRoom(meshes)` : **bake les world matrices** des meshes de sol dans des meshes temporaires (correction indispensable — les GLB ont leurs vertices en local space), construit le navmesh, crée un crowd de 30 agents.
- `addAgent` / `removeAgent` / `setAgentTarget` / `getAgentVelocity` : API simple utilisée par `BaseEnemy`.
- `update(dt)` : appelé chaque frame depuis `GameScene`.

Le navmesh est reconstruit à chaque changement de salle.

---

### `LightingManager` — Éclairage et post-processing

`src/Systems/LightingManager.js`

- **Lumières de salle** : 5 `PointLight` aux couleurs de la palette thématique (bleue, verte, grise, orange, rouge). Intensité et portée scalées avec la taille de la salle (`sizeFactor = sqrt(cols×rows / 64)`).
- **Flicker** : une lumière aléatoire oscille avec deux fréquences superposées + spike aléatoire ponctuel.
- **Mode combat** (`setCombatMode`) : `PointLight` rouge centrale qui pulse agressivement (fréquence 5.5 Hz).
- **Post-processing** (`DefaultRenderingPipeline`) : bloom, vignette, contrast/exposure, tone mapping, FXAA, aberration chromatique, depth of field, grain cinématique, sharpening. 4 presets (Low / Medium / High / Ultra) + mode custom.

---

### `ScoreManager` — Scoring

`src/Systems/ScoreManager.js`

- Points de base par type d'ennemi (Standard 100 / Scout 180 / Heavy 350 / Boss 5000).
- Multiplicateur de combo jusqu'à ×8 (8 paliers, étiquettes DOUBLE → ARCHON).
- Décroissance du combo après 4.5s d'inactivité (interval 100ms).
- Streak kills (multi-kill < 1s → bonus progressif).
- Bonus weakpoint (×2.5), bonus de vague parfaite (+800), bonus vitesse, bonus phase boss.
- Grade final S/A/B/C/D calculé sur le score total.

---

### `WeaponManager` — Gestion des armes

`src/Systems/WeaponManager.js`

- 4 slots (slot 0 = dagger natif, slots 1–3 = armes secondaires obtenues en boutique).
- Switch par touches 1–4 ou molette. Masquage/affichage atomique via `setVisible()` sur toutes les pièces du mesh.
- Chaque arme secondaire (`PlasmaShotgun`, `QuantumSniper`, `VoidRocket`) est une classe autonome avec ses propres stats, mesh, son et rechargement.

---

### `MinimapManager` — Minimap

`src/Systems/MinimapManager.js`

Canvas 2D (160×160 px) rendu en overlay DOM. Affiche les 5 salles les plus proches (activeIdx ±2) en projection réelle depuis les coordonnées `worldX/worldZ`. Icônes différentes par type de salle (spawn, normal, boss, shop, forge, challenge). Triangle joueur orienté selon le yaw de la caméra. Brouillard de guerre (visited / revealed / unknown). Touche M pour masquer.

---

### `GamepadManager` — Support manette

`src/Systems/GamepadManager.js`

- Détection automatique du layout (Xbox / PS / Logitech / générique).
- Mouvement via `KeyboardEvent` synthétiques sur le canvas (même vitesse que le clavier, respect des collisions Babylon).
- Navigation menus par D-pad / stick gauche avec répétition sur maintien, stick droit pour les sliders, bouton A pour activer, bouton B pour remonter.
- Remapping de tous les boutons d'action, réglage sensibilité et zone morte.
- Visualiseur temps réel dans le panneau Touches (polling 50ms).
- Vibration haptique sur tir, saut, navigation.

---

### `SpecialRooms` — Salles spéciales

`src/Systems/SpecialRooms.js`

Trois types :
- **`WeaponShopRoom`** : socles avec armes flottantes, zone de proximité pour ramassage, déduction de score.
- **`ForgeRoom`** : terminaux holographiques avec upgrades spécifiques à l'arme active (shotgun / sniper / rocket / générique).
- **`ChallengeRoom`** : timer countdown, objectif de kills, bonus de score si réussite dans le temps imparti. La salle de défi du cycle 3 déclenche l'écran de victoire si réussie.

---

### `IntroSequence` — Cinématique d'introduction

`src/UI/IntroSequence.js`

Séquence narrative entièrement en HTML/CSS/SVG. 11 étapes : scènes illustrées (SVG procéduraux représentant la station, le couloir, la salle serveur en alerte), boîtes de dialogue avec portraits animés (ARCHON / Mathys), écrans noirs. Effet machine à écrire avec curseur clignotant, skip sur clic/espace. Aucune dépendance Babylon.js.

---

### Systèmes utilitaires

| Classe | Fichier | Rôle |
|---|---|---|
| `Health` | `Systems/Health.js` | Vie courante, dégâts, soin, callbacks mort/dégâts |
| `Ammo` | `Systems/Ammo.js` | Munitions courantes, recharge automatique par interval |
| `UpgradeManager` | `Systems/UpgradeManager.js` | 22 upgrades en 3 raretés, tirage pondéré, mémorisation des acquis, exclusion des légendaires déjà obtenus |
| `SoundManager` | `Systems/SoundManager.js` | Musique ambiante/boss avec fade cross, volume master |
| `EnemyParticles` | `Enemies/EnemyParticles.js` | Factory de ParticleSystem (spawn warning, death, muzzle flash, impact) |

---

### UI

| Classe | Rôle |
|---|---|
| `PlayerHUD` | Vie, munitions, armes, score/combo, vague, boss bar, abilities cooldowns, challenge timer, popups flottants, minimap, indicateur de sortie, panneau Tab (stats + upgrades acquis), écran d'upgrade |
| `MainMenu` | Menu titre + paramètres (sensibilité, volume) + sous-panneaux graphismes / touches |
| `PauseMenu` | Overlay pause (Entrée) avec les mêmes sous-panneaux |
| `GraphicsMenu` | 8 sections de contrôles post-processing, prévisualisation live, 4 presets, rollback sur annulation |
| `KeybindingsMenu` | Remapping clavier (2 slots par action, détection conflits), onglet manette (sensibilité, remapping boutons, visualiseur temps réel) |
| `GameOverScreen` | Overlay game over effet glitch CRT, grade, stats détaillées, kills par type |
| `DebugPanel` | Panneau F2 : kill all, soin, points, armes, tous upgrades — trié par rareté |

Toute l'UI est en **HTML/CSS pur**, injectée dans le DOM au-dessus du canvas Babylon.js. Les overlays utilisent `pointer-events: none` sauf quand ils doivent capturer les clics.

---

## Flux de données simplifié

```
main.js
  │
  ├─ GameScene._init()
  │     └─ _generateMap()
  │           ├─ ProceduralMap.generate()     → salles + couloirs construits
  │           ├─ LightingManager.init()       → pipeline post-process
  │           ├─ Player instancié             → caméra attachée à la carte
  │           ├─ UpgradeManager instancié
  │           ├─ WaveManager instancié
  │           └─ NavigationManager.init()     → Recast chargé (CDN)
  │
  └─ ProceduralMap._onRoomReady (callback par salle)
        ├─ LightingManager.setRoom()          → lumières thématiques
        ├─ MinimapManager.onRoomEnter()
        ├─ [upgrade screen si salle normale]
        ├─ player.camera.position = spawnPos
        ├─ NavigationManager.buildForRoom()   → navmesh bakéd
        └─ WaveManager.enterRoom()
              ├─ _spawnDoors()
              └─ selon type de salle :
                   normal   → _launchNextWave() → BaseEnemy × N
                   boss     → BossEnemy (cycle 1/2/3)
                   shop     → WeaponShopRoom.activate()
                   forge    → ForgeRoom.activate()
                   challenge → ChallengeRoom.start()
```

---

## Choix techniques notables

- **Pas de framework UI** : DOM vanilla pour contrôle total du layering avec le canvas WebGL et bundle minimal.
- **Cache de SceneLoader** : les assets GLB sont chargés une seule fois (`_cache` Map) et instanciés (`instantiateModelsToScene`) à chaque placement — pas de re-téléchargement.
- **Bake world matrices pour Recast** : les meshes GLB ont leurs vertices en local space ; on crée des meshes temporaires avec les vertices transformés en world space avant de passer à `createNavMesh`. Sans ce bake, le navmesh est complètement décalé par rapport à la géométrie visible.
- **Seed déterministe (LCG)** : la génération de la carte utilise un Linear Congruential Generator plutôt que `Math.random()`, permettant de rejouer une seed exacte.
- **Layer masks arme** : l'arme est rendue par une caméra dédiée (`_weaponCamera`, `layerMask = 0x10000000`) avec `minZ = 0.05` pour éviter le clipping dans les murs, indépendamment de la caméra joueur.
- **Fallback pathfinding** : si Recast est indisponible (CDN inaccessible), les ennemis utilisent un steering comportemental complet (steering + séparation + pentes + anti-stuck), garantissant la jouabilité partout.
- **Convention de nommage des meshes** : les meshes procéduraux (sol, murs, toit) ont des préfixes fixes (`fRDC_`, `wN_`, `wS_`, `roof_`…) permettant de les identifier pour le dispose sélectif des matériaux sans toucher aux assets GLB instanciés.
- **Touches virtuelles pour la manette** : le `GamepadManager` dispatche des `KeyboardEvent` synthétiques sur le canvas pour le mouvement — la caméra `UniversalCamera` les traite exactement comme des touches physiques, avec la même vitesse, les mêmes collisions et la même gravité.