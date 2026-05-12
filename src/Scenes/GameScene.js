import * as BABYLON from "@babylonjs/core";
import { Player }          from "../Player/Player";
import { ProceduralMap }   from "./ProceduralMap";
import { WaveManager }     from "../Systems/WaveManager";
import { NavigationManager } from "../Systems/NavigationManager";
import { LightingManager } from "../Systems/LightingManager";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";
import { UpgradeManager }  from "../Systems/UpgradeManager";
import { MinimapManager } from '../Systems/MinimapManager';
import { KeybindingsMenu } from "../UI/KeybindingsMenu";
import { IntroSequence } from "../UI/IntroSequence";


function _getRoomTypeForUpgrade(roomIdx) {
    if (roomIdx === 0) return "spawn";
    const cycleLen   = 5;
    const posInCycle = ((roomIdx - 1) % cycleLen) + 1; // 1..5
    const cycle      = Math.ceil(roomIdx / cycleLen);
    if (posInCycle <= 3) return "normal";
    if (posInCycle === 4) return "boss";
    if (cycle === 1) return "shop";
    if (cycle === 2) return "forge";
    return "challenge";
}

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
        // upgradeManager est instancié après la création du player dans _generateMap
        this.upgradeManager = null;
        this.minimap = null;

        this.isInUpgrade = false;
        this.isPaused = false;

        this.soundManager = null;

        this.visitedRooms = new Set();
    }

    async _init() {
        this.scene = await this._createScene(this.canvas);
        this.engine.runRenderLoop(() => {
            if (this.isPaused) return;
            this.scene.render();
            if (this.player)         this.player.hud.updateFps(this.engine);
            if (this.navManager)     this.navManager.update(this.engine.getDeltaTime() / 1000);
            if (this.lightingManager) this.lightingManager.update(this.engine.getDeltaTime() / 1000);
            if (this.minimap) this.minimap.update();
        });
        window.addEventListener("resize", () => this.engine.resize());
    }

    async _createScene(canvas) {
        const scene = new BABYLON.Scene(this.engine);

        scene.gravity           = new BABYLON.Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;
        scene.skipPointerMovePicking = true;
        scene.pointerMovePredicate   = () => false;

        // ── Ambiance de base : sombre, le LightingManager prend le relais ──────
        // On garde une hémisphérique minimaliste en fallback avant l'init du LM
        const fallback = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        fallback.intensity = 0.15;
        scene.imageProcessingConfiguration.toneMappingEnabled = false;

        // ── Couleur de fond scène (évite le blanc par défaut) ─────────────────
        scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);
        scene.ambientColor = new BABYLON.Color3(0.02, 0.02, 0.04);

        // ── Brouillard linéaire léger pour la profondeur ──────────────────────
        scene.fogMode    = BABYLON.Scene.FOGMODE_LINEAR;
        scene.fogColor   = new BABYLON.Color3(0.02, 0.02, 0.06);
        scene.fogStart   = 30;
        scene.fogEnd     = 90;

        this._createLoadingScreen();

        this._tempCamera = new BABYLON.FreeCamera("tempCam", new BABYLON.Vector3(0, 2, 0), scene);

        await this._generateMap(scene, canvas);

        return scene;
    }

    // ── Écran de chargement ──────────────────────────────────────────────────

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
            spawn: "SPAWN ZONE", command: "COMMAND CENTER", medbay: "MEDICAL BAY",
            engine: "ENGINE ROOM", cafeteria: "CAFETERIA", hydro: "HYDROPONICS",
            quarters: "CREW QUARTERS", storage: "STORAGE UNIT", default: "SECTOR",
        };
        overlay.querySelector("#loadingRoom").textContent =
            `${names[roomType] ?? "SECTOR"} — ZONE ${String(roomIdx).padStart(3, "0")}`;
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

    // ── Calcul des positions de portes ───────────────────────────────────────

    _doorInfoFromTile(room, tile, side) {
        const T = 4;
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

    _sideOf(room, tile) {
        if (tile.z === room.worldZ - 1         && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "N";
        if (tile.z === room.worldZ + room.rows  && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "S";
        if (tile.x === room.worldX - 1         && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "W";
        if (tile.x === room.worldX + room.cols  && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "E";
        return null;
    }

    // ── Génération ───────────────────────────────────────────────────────────

    async _generateMap(scene, canvas) {
        const seed = Math.floor(Date.now() / 1000);

        this.map = new ProceduralMap(scene, {
            seed,
            roomCount: 18,
            assetBase: "assets/models/",
        });

        // ── LightingManager ───────────────────────────────────────────────────
        this.lightingManager = new LightingManager(scene, this.engine);
        this.lightingManager.init();

        this.map._onRoomReady = async (room, idx, spawnPos, spawnInfo) => {
            if (!this.player) return;
            this._finishLoading();

            const isNew = !this.visitedRooms.has(idx);
            this.visitedRooms.add(idx);

            if(idx !== 0 && idx !== 1 && spawnInfo.comingBack !== true && isNew){
            const roomType = _getRoomTypeForUpgrade(idx);
            if (roomType === "normal") {
                await this._waitForUpgradeChoice(scene);
            }
        }

            this.player.camera.position = spawnPos ?? new BABYLON.Vector3(
                (room.worldX + room.cols / 2) * 4, 2, (room.worldZ + room.rows / 2) * 4,
            );

            scene.meshes.forEach(m => {
                if (m._worldMatrix) m.computeWorldMatrix(true);
            });

            // ── Mise à jour lumières pour la nouvelle salle ───────────────
            this.lightingManager.setRoom(room);
            if (this.minimap) this.minimap.onRoomEnter(idx);

            // ── Notifier le WaveManager ───────────────────────────────────
            if (this.waveManager && idx !== 0) {
                const corridors = this.map.corridors;
                const cIn  = idx > 0                 ? corridors[idx - 1] : null;
                const cOut = idx < corridors.length   ? corridors[idx]    : null;

                let entryPos = null, entryRotY = 0;
                if (cIn && cIn.tiles.length) {
                    const lastTile = cIn.tiles[cIn.tiles.length - 1];
                    const side     = this._sideOf(room, lastTile);
                    if (side) {
                        const info = this._doorInfoFromTile(room, lastTile, side);
                        if (info) { entryPos = info.pos; entryRotY = info.rotY; }
                    }
                }

                let exitPos = null, exitRotY = 0;
                if (cOut && cOut.tiles.length) {
                    const firstTile = cOut.tiles[0];
                    const side      = this._sideOf(room, firstTile);
                    if (side) {
                        const info = this._doorInfoFromTile(room, firstTile, side);
                        if (info) { exitPos = info.pos; exitRotY = info.rotY; }
                    }
                }

                const T = 4;
                const roomCenter = new BABYLON.Vector3(
                    (room.worldX + room.cols / 2) * T,
                    0,
                    (room.worldZ + room.rows / 2) * T,
                );

                const roomNode = this.map._builtRooms.get(idx);
                const walkable = roomNode
                    ? roomNode.getChildMeshes(false).filter(m =>
                        m.isVisible &&
                        m.getTotalVertices() > 0 &&
                        !m.name.startsWith("w") &&
                        !m.name.startsWith("f2") &&
                        !m.name.startsWith("fRDC")
                    )
                    : [];

                if (this.navManager && walkable.length > 0) {
                    this.navManager.buildForRoom(walkable).then(() => {
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
        this.player.keybindings = KeybindingsMenu.DEFAULT_KB_BINDINGS.map(a => ({ ...a, keys: [...a.keys] }));
        this.player.camera.position = new BABYLON.Vector3(
            this.map.spawnPoint.x, 2, this.map.spawnPoint.z,
        );

        // ── UpgradeManager (nécessite this.player) ────────────────────────
        this.upgradeManager = new UpgradeManager(this.player);
        this._setupTabKey();

        // ── Stats pour le Game Over ───────────────────────────────────────
        this.player.getStatsCallback = () => ({
            wavesCleared: this.waveManager ? this.waveManager.currentWave : 0,
            roomsCleared: this.waveManager ? this.waveManager._clearedRooms.size : 0,
        });

        // ── Pipeline post-process sur la caméra joueur ────────────────────
        if (this.lightingManager._pipeline) {
            this.lightingManager._pipeline.addCamera(this.player.camera);
        }

        // ── WaveManager ───────────────────────────────────────────────────
        this.waveManager = new WaveManager(scene, this.player, this.player.hud);

        // Monkey-patch APRÈS instanciation pour capturer les bonnes références
        const _wm = this.waveManager;
        const _lm = this.lightingManager;

        const origLaunch = _wm._launchNextWave.bind(_wm);
        _wm._launchNextWave = () => {
            origLaunch();
            if (_lm) _lm.setCombatMode(_wm.isWaveActive);
            if (!_wm._boss) this.soundManager?.playMusic("ambient"); 
        };

        const origClear = _wm._clearEnemies.bind(_wm);
        _wm._clearEnemies = () => {
            origClear();
            if (_lm) _lm.setCombatMode(false);
        };

        const origOpen = _wm._openDoors.bind(_wm);
        _wm._openDoors = () => {
            origOpen();
            if (_lm) _lm.setCombatMode(false);
        };

        // ── Navigation ────────────────────────────────────────────────────
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

        /*scene.debugLayer.show({
            embedMode: true, // s'affiche dans la page
        })*/


        // Lumières de la salle de spawn (room 0)
        this.lightingManager.setRoom(this.map.rooms[0]);
        this.minimap = new MinimapManager(this.map, this.player, this.waveManager);
        this.minimap.onRoomEnter(0);
    }

    _waitForUpgradeChoice(scene) {
    this.isInUpgrade = true;
    this.map._paused = true;
    document.exitPointerLock();

    return new Promise(resolve => {
        const doShow = (upgrades) => {
            this.player.hud.showUpgradeScreen(
                upgrades,
                (choix) => {
                    this.upgradeManager.applyUpgrade(choix); // ← mémorise + applique
                    scene.getEngine().enterPointerlock();
                    this.map._paused = false;
                    this.isInUpgrade = false;
                    resolve();
                },
                800,
                () => this.scoreManager?.totalScore ?? 0,
                () => {
                    const score = this.scoreManager?.totalScore ?? 0;
                    if (score < 800) return false;
                    this.scoreManager.totalScore -= 800;
                    this.player.hud.updateScore?.(this.scoreManager.totalScore);
                    document.getElementById("upgrade-overlay")?.remove();
                    doShow(this.upgradeManager.getRandomUpgrades(3));
                    return true;
                },
            );
        };

        doShow(this.upgradeManager.getRandomUpgrades(3));
    });
}

_setupTabKey() {
    window.addEventListener("keydown", (e) => {
        if (e.code === "Tab" && !this.isInUpgrade && !this.isPaused) {
            e.preventDefault();
            const stats    = this.upgradeManager?.getPlayerStats() ?? {};
            const acquired = this.upgradeManager?.acquiredUpgrades  ?? [];
            this.player?.hud?.toggleStatsPanel(stats, acquired);
        }
    });
}

}