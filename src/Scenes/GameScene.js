import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { ProceduralMap } from "./ProceduralMap";
import { WaveManager } from "../Systems/WaveManager";
import { NavigationManager } from "../Systems/NavigationManager";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";
import { UpgradeManager } from "../Systems/UpgradeManager";

export class GameScene {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.canvas = canvas;
        this.engine = new BABYLON.Engine(canvas, true, {
            limitDeviceRatio: 1,
            doNotHandleContextLost: true,
        });
        this.engine.setHardwareScalingLevel(2);
        this._loadingScreen = null;
    }

    async _init() {
        this.scene = await this._createScene(this.canvas);
        this.engine.runRenderLoop(() => {
            this.scene.render();
            if (this.player) this.player.hud.updateFps(this.engine);
            if (this.navManager) this.navManager.update(this.engine.getDeltaTime() / 1000);
        });
        window.addEventListener("resize", () => this.engine.resize());
    }

    async _createScene(canvas) {
        const scene = new BABYLON.Scene(this.engine);

        scene.gravity           = new BABYLON.Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;
        scene.skipPointerMovePicking = true;
        scene.pointerMovePredicate   = () => false;

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0,1,0), scene);
        light.intensity   = 1.0;
        light.diffuse     = new BABYLON.Color3(0.9, 0.95, 1.0);
        light.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3);
        scene.imageProcessingConfiguration.toneMappingEnabled = false;

        this._createLoadingScreen();

        this._tempCamera = new BABYLON.FreeCamera("tempCam", new BABYLON.Vector3(0,2,0), scene);

        await this._generateMap(scene, canvas);

        //scene.debugLayer.show({ embedMode: true });

        return scene;
    }

    // ── Écran de chargement ──────────────────────────────────────────────

    _createLoadingScreen() {
        const overlay = document.createElement("div");
        overlay.id    = "loadingOverlay";
        overlay.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      background: #000;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      font-family:'Courier New',monospace;
      color:#00ffcc;
      transition: opacity 0.5s ease;
      pointer-events:none;
      opacity:0;
    `;
        overlay.innerHTML = `
      <div id="loadingTitle" style="font-size:28px;letter-spacing:6px;text-transform:uppercase;margin-bottom:24px;opacity:0.9;">ENTERING SECTOR</div>
      <div id="loadingRoom" style="font-size:16px;letter-spacing:3px;color:#88ffdd;margin-bottom:32px;">INITIALIZING...</div>
      <div style="width:280px;height:3px;background:#111;border:1px solid #00ffcc44;border-radius:2px;overflow:hidden;">
        <div id="loadingBar" style="height:100%;background:linear-gradient(90deg,#00ffcc,#0088ff);width:0%;transition:width 0.1s linear;box-shadow:0 0 8px #00ffcc;"></div>
      </div>
      <div id="loadingHint" style="font-size:11px;letter-spacing:2px;color:#556677;margin-top:24px;text-transform:uppercase;">QUANTUM TELEPORTATION IN PROGRESS</div>
    `;
        document.body.appendChild(overlay);
        this._loadingScreen = overlay;
    }

    async _showLoading(roomType, roomIdx) {
        const overlay = this._loadingScreen;
        if (!overlay) return;
        const names = {
            spawn:"SPAWN ZONE", command:"COMMAND CENTER", medbay:"MEDICAL BAY",
            engine:"ENGINE ROOM", cafeteria:"CAFETERIA", hydro:"HYDROPONICS",
            quarters:"CREW QUARTERS", storage:"STORAGE UNIT", default:"SECTOR",
        };
        overlay.querySelector("#loadingRoom").textContent =
            `${names[roomType] ?? "SECTOR"} — ZONE ${String(roomIdx).padStart(3,"0")}`;
        overlay.style.opacity = "1";

        const bar = overlay.querySelector("#loadingBar");
        bar.style.width = "0%";
        return new Promise(resolve => {
            let pct = 0;
            const interval = setInterval(() => {
                pct = Math.min(pct + Math.random() * 18 + 5, 95);
                bar.style.width = pct + "%";
                if (pct >= 95) { clearInterval(interval); resolve(); }
            }, 80);
        });
    }

    _finishLoading() {
        const overlay = this._loadingScreen;
        if (!overlay) return;
        const bar = overlay.querySelector("#loadingBar");
        bar.style.width = "100%";
        setTimeout(() => { overlay.style.opacity = "0"; }, 300);
    }

    // ── Calcul des positions de portes ───────────────────────────────────

    /**
     * Retourne { pos, rotY } pour une porte placée exactement à l'ouverture du mur,
     * centrée sur la tuile de couloir `tile`.
     * T = 4 (taille d'une tuile en unités monde)
     */
    _doorInfoFromTile(room, tile, side) {
        const T = 4;
        // Centre X/Z de la tuile de couloir en coordonnées monde
        const tx = (tile.x + 0.5) * T;
        const tz = (tile.z + 0.5) * T;

        switch (side) {
            case "N": return { pos: new BABYLON.Vector3(tx, 0, room.worldZ * T),              rotY: 0           };
            case "S": return { pos: new BABYLON.Vector3(tx, 0, (room.worldZ + room.rows) * T), rotY: 0          };
            case "W": return { pos: new BABYLON.Vector3(room.worldX * T, 0, tz),               rotY: Math.PI / 2 };
            case "E": return { pos: new BABYLON.Vector3((room.worldX + room.cols) * T, 0, tz), rotY: Math.PI / 2 };
            default:  return null;
        }
    }

    /**
     * Détermine de quel côté de `room` débouche la tuile `tile`.
     */
    _sideOf(room, tile) {
        if (tile.z === room.worldZ - 1          && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "N";
        if (tile.z === room.worldZ + room.rows  && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "S";
        if (tile.x === room.worldX - 1          && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "W";
        if (tile.x === room.worldX + room.cols  && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "E";
        return null;
    }

    // ── Génération ───────────────────────────────────────────────────────

    async _generateMap(scene, canvas) {
        const seed = Math.floor(Date.now() / 1000);

        this.map = new ProceduralMap(scene, {
            seed,
            roomCount: 6,
            assetBase: "assets/models/",
        });

        this.map._onRoomReady = (room, idx, spawnPos, spawnInfo) => {
            if (!this.player) return;

            this.player.camera.position = spawnPos ?? new BABYLON.Vector3(
                (room.worldX + room.cols / 2) * 4, 5, (room.worldZ + room.rows / 2) * 4,
            );

            scene.meshes.forEach(m => {
                if (m._worldMatrix) m.computeWorldMatrix(true);
            });

            // ── Notifier le WaveManager ──────────────────────────────────
            if (this.waveManager && idx !== 0) {
                const corridors = this.map.corridors;
                const cIn  = idx > 0                       ? corridors[idx - 1] : null;
                const cOut = idx < corridors.length        ? corridors[idx]     : null;

                // Position de la porte d'entrée — basée sur la tuile réelle du couloir
                let entryPos = null, entryRotY = 0;
                if (cIn && cIn.tiles.length) {
                    const lastTile = cIn.tiles[cIn.tiles.length - 1];
                    const side     = this._sideOf(room, lastTile);
                    if (side) {
                        const info = this._doorInfoFromTile(room, lastTile, side);
                        if (info) { entryPos = info.pos; entryRotY = info.rotY; }
                    }
                }

                // Position de la porte de sortie — basée sur la tuile réelle du couloir
                let exitPos = null, exitRotY = 0;
                if (cOut && cOut.tiles.length) {
                    const firstTile = cOut.tiles[0];
                    const side      = this._sideOf(room, firstTile);
                    if (side) {
                        const info = this._doorInfoFromTile(room, firstTile, side);
                        if (info) { exitPos = info.pos; exitRotY = info.rotY; }
                    }
                }

                // Centre de la salle pour le spawn des ennemis
                const T = 4;
                const roomCenter = new BABYLON.Vector3(
                    (room.worldX + room.cols / 2) * T,
                    0,
                    (room.worldZ + room.rows / 2) * T,
                );

                // Collecter les meshes walkable de la salle (sols + rampes, avec collisions)
                // On prend uniquement les meshes visibles de la salle active (nœud de la salle)
                const roomNode = this.map._builtRooms.get(idx);
                const walkable = roomNode
                    ? roomNode.getChildMeshes(false).filter(m =>
                        m.isVisible &&
                        m.getTotalVertices() > 0 &&
                        !m.name.startsWith("w") &&   // pas les murs
                        !m.name.startsWith("f2") &&  // pas les colliders balcon invisibles
                        !m.name.startsWith("fRDC")   // pas le sol invisible (collider plat)
                    )
                    : [];
                // Construire le navmesh de manière asynchrone puis notifier le WaveManager
                if (this.navManager && walkable.length > 0) {
                    this.navManager.buildForRoom(walkable).then(() => {
                        // Optionnel : afficher le debug navmesh (commenter en prod)
                        //this.navManager.showDebug(true);
                        this.waveManager.enterRoom(idx, entryPos, exitPos, entryRotY, exitRotY, roomCenter, this.navManager);
                    });
                } else {
                    this.waveManager.enterRoom(idx, entryPos, exitPos, entryRotY, exitRotY, roomCenter, null);
                }
            }

            this._finishLoading();
        };

        await this._showLoading("spawn", 0);
        await this.map.generate();

        this.player = new Player(scene, canvas);
        this.player.camera.position = new BABYLON.Vector3(
            this.map.spawnPoint.x, 5, this.map.spawnPoint.z,
        );

        // Teste le système d'amélioration dynamique avec la touche U
    this.upgradeManager = new UpgradeManager(this.player);

    window.addEventListener("keydown", (evt) => {
      if (evt.key.toLowerCase() === 'u') {
        document.exitPointerLock();

        const randomCards = this.upgradeManager.getRandomUpgrades(3);

        this.player.hud.showUpgradeScreen(randomCards, (choix) => {
          console.log("Tu as choisi :", choix.name);
          choix.apply(this.player);
          scene.getEngine().enterPointerlock();
        });
      }
    });

        // Initialiser le WaveManager après avoir créé le Player
        this.waveManager = new WaveManager(scene, this.player, this.player.hud);

        // Initialiser le NavigationManager Recast (charge le WASM une seule fois)
        this.navManager = new NavigationManager(scene);
        await this.navManager.init();

        this._tempCamera.dispose();
        this._tempCamera = null;

        this.map.attachCamera(this.player.camera);

        const origActivate = this.map._activateRoom.bind(this.map);
        this.map._activateRoom = async (idx, comingFromIdx = null) => {
            if (this.map._loading || idx === this.map._activeIdx) return;
            const room = this.map.rooms[idx];
            this._showLoading(room.type, idx);
            await origActivate(idx, comingFromIdx);
        };

        this._finishLoading();
    }
}