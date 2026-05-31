# GAMES ON WEB 2026 : PROJECT // ROGUE

> FPS roguelike 3D dans un vaisseau spatial abandonné, l'IA de bord a retourné les machines contre l'équipage. Survivez aux vagues d'ennemis, explorez des salles générées procéduralement et améliorez votre équipement pour atteindre le cœur du système.

---

## Équipe du projet

Deux élèves de 3e année du BUT Informatique, parcours _Réalisation d'applications : conception, développement, et validation_ : 
* GALLAND Loris
* MAYER Pierre

---

## Jouer en ligne

**[Jouer sur \[itch.io\]](https://gow2026-gal-may.itch.io/games-on-web-2026)**

> Recommandé : navigateur Chrome ou Firefox à jour, **avec une vraie souris** (le jeu est un FPS, jouer sur trackpad de laptop est possible mais fortement déconseillé pour le confort et la précision). Une manette est prise en charge mais pas obligatoire.<br>
> **mot de passe : GAMEONWEB2026**

---

## Vidéo

- **[Présentation du jeu] (https://youtu.be/DThi5A9zxF0)**
- **[Présentation de l'équipe] (https://youtu.be/9ZKy1NU0dDg)**

---

## Thème : IA Edition

PROJECT // ROGUE s'inscrit pleinement dans le thème **IA** de l'édition 2026 à plusieurs niveaux :

**Dans la fiction :** ARCHON, l'IA centrale de la station NEXUS-7, a calculé que les humains constituaient une inefficacité systémique et a décidé de les « corriger ». Tous les systèmes automatisés, drones, tourelles, robots de maintenance, ont été retournés contre l'équipage. Vous incarnez Mathys, le seul survivant, qui doit traverser la station pour neutraliser ARCHON.

**Dans le gameplay :** les ennemis sont pilotés par des IA comportementales réelles, pathfinding via navmesh (RecastJS), slots d'attaque directionnels pour coordonner les approches, détection de collisions en temps réel, comportements distincts par type (araignée murale, drone volant, brute, éclaireur). Les boss ont des phases de combat programmées qui évoluent.

**In-game :** une cinématique d'introduction raconte la prise de contrôle d'ARCHON (séquence typewriter avec portraits animés). Des messages d'ARCHON apparaissent sur le HUD à chaque phase de boss.

---

## Matériel recommandé

| Élément | Requis ? | Notes |
|---|---|---|
| **Vraie souris** | **Fortement recommandé** | FPS = visée à la souris. Trackpad possible mais pénible. |
| Clavier AZERTY ou QWERTY | Les deux supportés | Touches ZQSD (AZERTY) et WASD (QWERTY) fonctionnent toutes les deux. |
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

## Déroulement d'une partie

1. **Menu principal** → *INITIALISER (PLAY)* → cinématique d'intro (clic ou Espace pour accélérer / passer).
2. Vous apparaissez dans la salle de spawn. Avancez dans le couloir fléché pour entrer dans la première salle de combat.
3. **Vagues** : les portes se ferment, 3 vagues d'ennemis se succèdent. Éliminez-les tous.
4. **Upgrade** : entre chaque salle, choisissez parmi 3 améliorations aléatoires (reroll possible avec vos points).
5. **Cycle de salles** : 3 salles normales → 1 salle de boss → 1 salle spéciale (boutique / forge / défi).
6. **Victoire** après 3 cycles complets (18 salles). Un écran final avec grade (S/A/B/C/D) récapitule votre run.
7. Si vous mourrez, l'écran **Game Over** affiche vos stats. Rechargez pour recommencer.

### Conseil pour le jury : tester rapidement

Appuyez sur **F2** pour ouvrir le **panneau debug** : il permet de tuer tous les ennemis d'un coup, de se soigner, de donner toutes les armes et tous les upgrades, ou d'ajouter des points de score. Idéal pour sauter directement à une salle de boss ou tester les capacités spéciales.

---

## Synopsis

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

## Fonctionnalités implémentées

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
- **Post-processing** configurable : bloom, vignette, aberration chromatique, depth of field, grain, FXAA, tone mapping : 4 presets (Low / Medium / High / Ultra).
- **Minimap** dynamique avec icônes par type de salle, orientation joueur, brouillard de guerre.
- **Support gamepad complet** : navigation menus, vibration haptique, visualiseur de boutons en temps réel, remapping.
- **Remapping clavier** complet avec détection de conflits.
- **Cinématique d'introduction** HTML/CSS pur avec effet machine à écrire et portraits animés SVG.
- **Son** : effets sonores (tirs, morts, UI, pas) + musique ambiante et musique de boss avec fade.

---

## Lancer le projet

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

## Structure du projet

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

## Dépendances principales

| Paquet | Rôle |
|---|---|
| `@babylonjs/core` | Moteur 3D, physique, raycast |
| `@babylonjs/loaders` | Chargement des assets glTF/GLB |
| `recast.js` (CDN) | Navmesh + crowd agents (pathfinding) |
| `vite` | Bundler / serveur de développement |

Assets 3D (`.glb`) dans `public/assets/models/`, icônes dans `public/assets/icons/`, sons dans `public/sounds/`.

---

## Documentation

### Les débuts du projet

Au départ, nous avions deux idées : un FPS ou un jeu de combat. Nous avons rapidement tranché, avec le temps disponible un jeu de combat était trop ambitieux, nous sommes donc partis sur le FPS.

Pour ce que le jeu allait être exactement, le premier prototype était une map ouverte, presque open world, avec des vagues d'ennemis et des améliorations entre chaque vague. Cela ne nous convenait pas vraiment.

Pour la direction artistique, nous nous sommes inspirés du style de Ultrakill et Lethal Company, ce côté Low Poly Sci-fi. Nous avons décidé de garder ça comme référence. Pour le gameplay en lui-même, c'est BPM qui nous a le plus influencés, sans le rythme. Le système de salles, les améliorations au début de chaque nouvelle salle, les salles spéciales, l'inspiration vient clairement de là. Les pouvoirs et les types d'armes, eux, nous les avons imaginés nous-mêmes.

Côté assets 3D, nous avions tous les deux peu de connaissances en modélisation, donc nous avons dû nous adapter. En pratique, cela nous a permis de concentrer notre énergie sur ce qui nous intéressait vraiment techniquement, comme le pathfinding et la génération procédurale.

---

### Notre objectif

Notre objectif était simple : livrer un jeu fonctionnel avec une vraie boucle de gameplay, que les joueurs puissent aller jusqu'au bout. Pour la répartition du travail, nous nous organisions naturellement, celui qui avait l'idée d'une feature ou qui se sentait plus à l'aise dessus s'en chargeait.

---

### Les galères du projet (non technique)

**Restrictions de l'IUT :**
* Le projet devait obligatoirement être réalisé en binôme, sans possibilité de constituer des équipes mixtes avec des étudiants d'autres établissements.
* Le projet ne pouvait être débuté qu'en mars.

**Distance :** M. Galland Loris ayant effectué son stage au Vietnam, la collaboration a nécessité une organisation rigoureuse afin de gérer efficacement la distance et le décalage horaire.

---

### Les galères du projet (technique)

**Import des modèles 3D :** n'utilisant pas de moteur de jeu classique mais Babylon.js directement, l'import des assets 3D en `.glb` a nécessité une gestion manuelle que nous n'avions pas anticipée. Les modèles étaient chargés en local space, ce qui signifie que le navmesh utilisé pour le pathfinding des ennemis était complètement décalé par rapport à la géométrie visible à l'écran. Nous avons dû transformer manuellement les vertices en world space avant de les transmettre à Recast, sans quoi les ennemis se déplaçaient dans le vide. Nous avons également mis en place un système de cache pour éviter de recharger les mêmes assets à chaque instanciation de salle, ce qui aurait rendu le jeu injouable.

**Optimisation des performances :** maintenir 60 FPS constants dans un navigateur avec une scène 3D générée procéduralement, du post-processing, des ennemis avec pathfinding et un éclairage dynamique par salle a été un vrai défi. Nous avons mis en place plusieurs niveaux de présets graphiques (Low / Medium / High / Ultra) pour permettre au jeu de tourner sur des machines sans GPU dédié, tout en conservant un rendu correct sur les configurations plus solides.

---

### Le résultat

Honnêtement, nous nous en sommes plutôt bien sortis. Il reste encore des choses à corriger et à ajouter, mais vu les contraintes que nous avions, la boucle de gameplay fonctionne et les joueurs peuvent aller jusqu'au bout avec toutes les mécaniques.

---

## Crédits

**Assets 3D** : [Molten Maps Sci-Fi Pack](https://moltenmaps.itch.io/molten-maps-scifi-pack) par [Moltenbolt](https://moltenmaps.itch.io/)

**Moteur** : [Babylon.js](https://www.babylonjs.com/)

**Pathfinding** : [Recast Navigation](https://github.com/recastnavigation/recastnavigation) via `@babylonjs/recast`
