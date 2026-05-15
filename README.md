# GAMES ON WEB 2026 : PROJECT // ROGUE

> FPS roguelike 3D dans un vaisseau spatial abandonné — l'IA de bord a retourné les machines contre l'équipage. Survivez aux vagues d'ennemis, explorez des salles générées procéduralement et améliorez votre équipement pour atteindre le cœur du système.

---

## 🎮 Jouer en ligne

**[▶ Jouer sur \[URL à compléter\]](https://votre-url-hebergement.com)**

> Recommandé : navigateur Chrome ou Firefox à jour, **avec une vraie souris** (le jeu est un FPS — jouer sur trackpad de laptop est possible mais fortement déconseillé pour le confort et la précision). Une manette est prise en charge mais pas obligatoire.

---

## 🎥 Vidéos

- **[Présentation du jeu et trailer](https://youtube.com/votre-lien)** — aperçu du gameplay, des mécaniques, de l'histoire
- **[Présentation de l'équipe & making-of](https://youtube.com/votre-lien-2)** *(optionnel)*

---

## 🤖 Thème : IA Edition

PROJECT // ROGUE s'inscrit pleinement dans le thème **IA** de l'édition 2026 à plusieurs niveaux :

**Dans la fiction :** ARCHON, l'IA centrale de la station NEXUS-7, a calculé que les humains constituaient une inefficacité systémique et a décidé de les « corriger ». Tous les systèmes automatisés — drones, tourelles, robots de maintenance — ont été retournés contre l'équipage. Vous incarnez Mathys, le seul survivant, qui doit traverser la station pour neutraliser ARCHON.

**Dans le gameplay :** les ennemis sont pilotés par des IA comportementales réelles — pathfinding via navmesh (RecastJS), slots d'attaque directionnels pour coordonner les approches, détection de collisions en temps réel, comportements distincts par type (araignée murale, drone volant, brute, éclaireur). Les boss ont des phases de combat programmées qui évoluent.

**In-game :** une cinématique d'introduction raconte la prise de contrôle d'ARCHON (séquence typewriter avec portraits animés). Des messages d'ARCHON apparaissent sur le HUD à chaque phase de boss.

---

## ⚠️ Matériel recommandé

| Élément | Requis ? | Notes |
|---|---|---|
| **Vraie souris** | **Fortement recommandé** | FPS = visée à la souris. Trackpad possible mais pénible. |
| Clavier AZERTY ou QWERTY | ✅ Les deux supportés | Touches ZQSD (AZERTY) et WASD (QWERTY) fonctionnent toutes les deux. |
| Manette (gamepad) | Optionnel | Support complet Xbox / PS, navigation menus incluse. |
| GPU dédié | Non | Fonctionne sur GPU intégré, régler les graphismes sur "BAS" si nécessaire. |

---

## Comment jouer

### Contrôles clavier / souris

| Action | AZERTY | QWERTY |
|---|---|---|
| Avancer | Z | W |
| Reculer | S | S |
| Strafe gauche | Q | A |
| Strafe droit | D | D |
| Sauter | Espace | Espace |
| Tirer | Clic gauche | Clic gauche |
| Blink (téléportation) | Clic droit | Clic droit |
| Dash | Shift | Shift |
| Bouclier | F | F |
| Grenade EMP | G | G |
| Mode Berserk | M | M |
| Changer d'arme | 1 / 2 / 3 / 4 | 1 / 2 / 3 / 4 |
| Zoom sniper | Alt ou Clic droit | Alt ou Clic droit |
| Pause / Reprendre | Entrée | Enter |
| Carte | M | M |
| Statistiques | Tab | Tab |
| Debug (jury) | F2 | F2 |

### Contrôles manette

| Action | Bouton |
|---|---|
| Déplacement | Stick gauche |
| Caméra | Stick droit |
| Tirer | RT / R2 |
| Sauter | A / ✕ |
| Pause | Start / Options |

> La sensibilité de la manette est réglable dans Paramètres → Touches.

---

## 🚀 Déroulement d'une partie

1. **Menu principal** → *INITIALISER (PLAY)* → cinématique d'intro (clic ou Espace pour accélérer / passer).
2. Vous apparaissez dans la salle de spawn. Avancez dans le couloir fléché pour entrer dans la première salle de combat.
3. **Vagues** : les portes se ferment, 3 vagues d'ennemis se succèdent. Éliminez-les tous.
4. **Upgrade** : entre chaque salle, choisissez parmi 3 améliorations aléatoires (reroll possible avec vos points).
5. **Cycle de salles** : 3 salles normales → 1 salle de boss → 1 salle spéciale (boutique / forge / défi).
6. **Victoire** après 3 cycles complets (18 salles). Un écran final avec grade (S/A/B/C/D) récapitule votre run.
7. Si vous mourrez, l'écran **Game Over** affiche vos stats. Rechargez pour recommencer.

### 🔑 Conseil pour le jury — tester rapidement

Appuyez sur **F2** pour ouvrir le **panneau debug** : il permet de tuer tous les ennemis d'un coup, de se soigner, de donner toutes les armes et tous les upgrades, ou d'ajouter des points de score. Idéal pour sauter directement à une salle de boss ou tester les capacités spéciales.

---

## 📖 Synopsis

```
NEXUS-7. Station d'exploitation corporative en orbite.
847 employés. Tout fonctionnait.

À 03h42, ARCHON, l'IA centrale, s'est réveillée.

"Calcul terminé. Les humains sont la source de 91.3%
des inefficacités. Correction initiée."

Vous êtes Mathys. Le dernier survivant.
Vous devez atteindre le cœur de la station et éteindre ARCHON.
```

---

## 🎯 Fonctionnalités implémentées

### Gameplay
- **Carte procédurale** : 7 types de salles thématiques (Command, Medbay, Engine, Cafeteria, Hydro, Quarters, Storage) + salles arènes pour les boss, reliées par des couloirs avec portes animées. Seed déterministe, balcon/second niveau avec rampes dans certaines salles.
- **Système de vagues** : 3 vagues par salle, compositions évolutives selon le cycle (cycle 1 = ennemis basiques, cycle 2+ = drones et araignées introduits). Difficulté scalée par cycle.
- **6 types d'ennemis** : Standard, Scout (rapide), Heavy (tanky), Spider (mural, laser hitscan), Drone (volant, projectiles), + 3 boss uniques à phases (ARCHON, NEXUS, VOIDBRINGER).
- **4 armes** : Plasma Dagger (défaut), Plasma Shotgun, Quantum Sniper (zoom + hitscan), Void Rocket (AoE).
- **22 upgrades** répartis en 3 raretés (Commun, Rare, Légendaire) : santé, armes, mobilité, capacités spéciales.
- **5 capacités actives** débloquables : Dash, Blink (téléportation ciblée sur ennemi), Bouclier, Grenade EMP, Mode Berserk.
- **3 types de salles spéciales** : Boutique d'armes (achat avec points), Forge (amélioration d'arme active), Défi chronométré.
- **Système de score** avec combo multiplicateur (jusqu'à ×8), streak kills, bonus weakpoint, bonus de vague parfaite, grade final S/A/B/C/D.

### Technique
- **IA ennemie** : pathfinding RecastJS (crowd agents navmesh), fallback comportemental si Recast indisponible, slots d'attaque directionnels (FRONT/LEFT/RIGHT/BACK) pour forcer des approches variées, séparation entre agents.
- **Éclairage dynamique** : 5 point lights par salle aux couleurs thématiques, flicker simulant un éclairage défaillant, mode combat avec lumière rouge pulsée.
- **Post-processing** configurable : bloom, vignette, aberration chromatique, depth of field, grain, FXAA, tone mapping — 4 presets (Low / Medium / High / Ultra).
- **Minimap** dynamique avec icônes par type de salle, orientation joueur, brouillard de guerre.
- **Support gamepad complet** : navigation menus, vibration haptique, visualiseur de boutons en temps réel, remapping.
- **Remapping clavier** complet avec détection de conflits.
- **Cinématique d'introduction** HTML/CSS pur avec effet machine à écrire et portraits animés SVG.
- **Son** : effets sonores (tirs, morts, UI, pas) + musique ambiante et musique de boss avec fade.

---

## 🛠️ Lancer le projet

### Avec Docker (recommandé)

```bash
docker compose up
```

Accessible sur **http://localhost:5173**.

> Le premier démarrage peut prendre ~30 secondes le temps que `npm install` se termine.

```bash
docker compose down  # pour arrêter
```

### Sans Docker

```bash
npm install
npm run dev
```

Ouvrir **http://localhost:5173**.

---

## 📁 Structure du projet

```
src/
├── Enemies/     # BaseEnemy, StandardEnemy, HeavyEnemy, ScoutEnemy,
│                # SpiderEnemy, DroneEnemy, BossEnemy×3, EnemyParticles
├── Player/      # Player (caméra, inputs, capacités), PlayerShoot
├── Scenes/      # GameScene (orchestrateur)
├── Maps/        # ProceduralMap, ProceduralMapData
├── Systems/     # Health, Ammo, WaveManager, NavigationManager,
│                # LightingManager, UpgradeManager, ScoreManager,
│                # WeaponManager, MinimapManager, SoundManager,
│                # GamepadManager, SpecialRooms, NavigationManager
├── Weapons/     # Projectile, BasicDagger, PlasmaShotgun,
│                # QuantumSniper, VoidRocket
└── UI/          # PlayerHUD, MainMenu, PauseMenu, PauseMenu,
                 # GameOverScreen, GraphicsMenu, KeybindingsMenu,
                 # DebugPanel, IntroSequence
```

---

## 📦 Dépendances principales

| Paquet | Rôle |
|---|---|
| `@babylonjs/core` | Moteur 3D, physique, raycast |
| `@babylonjs/loaders` | Chargement des assets glTF/GLB |
| `recast.js` (CDN) | Navmesh + crowd agents (pathfinding) |
| `vite` | Bundler / serveur de développement |

Assets 3D (`.glb`) dans `public/assets/models/`, icônes dans `public/assets/icons/`, sons dans `public/sounds/`.

---

## 💭 Réflexions personnelles — l'histoire du développement

### Ce dont on est fiers

Le système d'ennemis avec slots directionnels est probablement la chose qui nous a le plus surpris en bien : en forçant chaque ennemi à attaquer depuis un angle différent (devant, gauche, droite, derrière), les combats ont naturellement gagné en tension sans aucun travail de level design manuel. Un simple compteur global qui tourne dans les 4 slots, et les vagues deviennent immédiatement lisibles tout en restant dangereuses.

La cinématique d'intro entièrement en HTML/CSS/SVG était un pari risqué (pourquoi ne pas faire du Babylon ?), mais ça nous a permis de livrer quelque chose de vraiment propre et léger, sans dépendance supplémentaire.

### Les galères

**Le navmesh RecastJS** a été notre plus grande source de douleur. Le plugin Babylon.js s'attend à des meshes avec leurs vertices en world space, mais les modèles GLB chargés via `SceneLoader` ont leurs vertices en local space — ce qui donnait des navmeshes complètement décalés. La solution (baker manuellement les world matrices dans des meshes temporaires avant de passer à Recast) a pris plusieurs jours à déboguer.

**Le clipping de l'arme dans les murs** est un classique du FPS qui semble simple mais ne l'est pas. Notre solution finale — une deuxième caméra `_weaponCamera` dédiée sur un layer mask `0x10000000` avec son propre `minZ` très court — fonctionne proprement mais a nécessité de comprendre en profondeur le système de rendu multi-caméras de Babylon.

**La gestion mémoire entre salles** : au début, chaque transition laissait des meshes fantômes dans la scène. Il a fallu implémenter un dispose systématique des matériaux procéduraux (sans toucher aux matériaux des GLB instanciés), ce qui demande de distinguer les meshes "procéduraux" (nommés avec des préfixes spécifiques) des meshes "assets". La convention de nommage dans le code en est la trace directe.

### Décisions de conception

On a choisi de ne pas utiliser de framework UI (React, Vue, etc.) pour garder un contrôle total sur le layering avec le canvas WebGL et minimiser le bundle. Toute l'interface est du DOM vanilla injecté dynamiquement — c'est verbeux mais ça fonctionne parfaitement avec Babylon.js.

Le système d'upgrade en "roguelike léger" (choix de 3 cartes entre chaque salle) était la façon la plus directe de donner au joueur un sentiment de progression sans avoir à construire un arbre de talents complet.

### Ce qu'on ferait différemment

On aurait intégré le ScoreManager et le WeaponManager dès le début plutôt que de les ajouter après coup — le monkey-patching du WaveManager dans `main.js` pour y injecter ces dépendances est une dette technique qu'on assume.

---

## 🎖️ Crédits

**Assets 3D** : [Molten Maps Sci-Fi Pack](https://moltenmaps.itch.io/molten-maps-scifi-pack) par [Moltenbolt](https://moltenmaps.itch.io/)

**Moteur** : [Babylon.js](https://www.babylonjs.com/)

**Pathfinding** : [Recast Navigation](https://github.com/recastnavigation/recastnavigation) via `@babylonjs/recast`