# GAMES ON WEB : PROJECT // ROGUE

> FPS roguelike 3D dans un vaisseau spatial abandonné — survivez aux vagues d'ennemis, explorez des salles générées procéduralement et améliorez votre équipement.

---

## Aperçu

**PROJECT // ROGUE** est un jeu de tir à la première personne (FPS) développé avec [Babylon.js](https://www.babylonjs.com/) et [Vite](https://vitejs.dev/). Chaque run génère une suite de salles uniques reliées par des couloirs. À chaque salle, des vagues d'ennemis vous bloquent la progression jusqu'à leur élimination complète. Entre chaque salle, choisissez une amélioration pour renforcer votre personnage.

### Fonctionnalités principales

- **Carte procédurale** : salles thématiques (Command, Medbay, Engine, Cafeteria, Hydro, Quarters, Storage) générées à partir d'une seed aléatoire.
- **Système de vagues** : 5 vagues par salle avec compositions variées (Standard, Scout, Heavy).
- **IA ennemie** : pathfinding via RecastJS (crowd agents), slots d'attaque directionnels, séparation entre ennemis.
- **Système d'upgrades** : 6 améliorations disponibles à choisir entre chaque salle (santé, munitions, mobilité, multishot…).
- **Ambiance cyber** : éclairage dynamique par salle, mode combat pulsé, effets de particules.
- **HUD complet** : vie, munitions, vague en cours, FPS, écran de game over avec statistiques.

---

## Prérequis

- [Docker](https://www.docker.com/) et [Docker Compose](https://docs.docker.com/compose/) **OU**
- [Node.js](https://nodejs.org/) v18+ et npm

---

## Lancer le projet

### Avec Docker (recommandé)

```bash
docker compose up
```

L'application sera accessible sur **http://localhost:5173**.

> Le premier démarrage peut prendre une trentaine de secondes le temps que `npm install` se termine à l'intérieur du conteneur.

Pour arrêter :

```bash
docker compose down
```

### Sans Docker

```bash
npm install
npm run dev
```

Puis ouvrir **http://localhost:5173** dans votre navigateur.

---

## Comment jouer

| Action | Touche / Souris |
|---|---|
| Se déplacer | Z / W / S / Q / A / D |
| Regarder | Souris |
| Tirer | Clic gauche |
| Pause / Reprendre | Entrée |

### Déroulement d'une partie

1. **Menu principal** → cliquez sur *INITIALISER (PLAY)* puis cliquez dans la fenêtre pour capturer la souris.
2. Vous apparaissez dans la salle de spawn. Avancez dans le couloir pour entrer dans la première salle de combat.
3. **Vagues** : les portes se ferment, 5 vagues d'ennemis se succèdent. Éliminez-les tous.
4. **Upgrade** : une fois la salle nettoyée, choisissez parmi 3 améliorations aléatoires.
5. Passez dans le couloir suivant et répétez.
6. Si vous mourrez, l'écran de **Game Over** affiche vos statistiques. Rechargez la page pour recommencer.

---

## Structure du projet

```
src/
├── Enemies/          # IA ennemie (BaseEnemy, StandardEnemy, HeavyEnemy, ScoutEnemy, Particules)
├── Player/           # Caméra, contrôles, arme, tir (Player, PlayerShoot)
├── Scenes/           # Orchestration principale (GameScene)
├── Maps/             # Génération procédurale (ProceduralMap, ProceduralMapData)
├── Systems/          # Systèmes transverses (Health, Ammo, WaveManager, NavigationManager, LightingManager, UpgradeManager)
├── UI/               # Interfaces utilisateur (PlayerHUD, MainMenu, PauseMenu, GameOverScreen)
├── Weapons/          # Projectiles (Projectile)
└── Styles/           # CSS global (Game.css)
```

---

## Dépendances principales

| Paquet | Rôle |
|---|---|
| `@babylonjs/core` | Moteur 3D |
| `@babylonjs/loaders` | Chargement des assets glTF/GLB |
| `vite` | Bundler / serveur de développement |

Les assets 3D (fichiers `.glb`) doivent être placés dans `public/assets/models/` et les icônes dans `public/assets/icons/`.

---

## Fonctionnalités à venir

- **Design Sonore** : Intégration complète des effets sonores (armes, ennemis, interface) et d'une ambiance musicale.
- **Enrichissement du Gameplay** : Ajout de salles fonctionnelles (Boutiques d'armes, Salles de Défi, Stations d'amélioration spécifiques) et d'un affrontement final contre un Boss, et un système de scoring détaillé.
- **Jouabilité** : Prise en charge complète des manettes (gamepad) pour offrir plus de confort et de possibilités aux joueurs.
- **Narration** : Introduction d'une histoire fil rouge et intégration de cinématiques simples pour renforcer l'immersion dans l'univers.
- **Amélioration Visuelle** : Intégration de modèles 3D complets pour le stuff du joueur.
- **Paramètres Avancés** : Ajout d'options de personnalisation (réattribution des touches, réglages graphiques et sonores).

---

## Crédits assets
Les assets 3D utilisés dans ce projet : https://moltenmaps.itch.io/molten-maps-scifi-pack
Créé par : Moltenbolt, https://moltenmaps.itch.io/
