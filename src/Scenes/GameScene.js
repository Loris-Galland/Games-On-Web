import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { ProceduralMap } from "./ProceduralMap";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";

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

        // Créer l'écran de chargement HTML
        this._createLoadingScreen();

        this._tempCamera = new BABYLON.FreeCamera("tempCam", new BABYLON.Vector3(0,2,0), scene);

        await this._generateMap(scene, canvas);

        /*scene.debugLayer.show({
            embedMode: true, // s'affiche dans la page
        });*/

        return scene;
    }

    // ── Écran de chargement ──────────────────────

    _createLoadingScreen() {
        // Overlay sombre avec texte animé
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
      <div id="loadingTitle" style="
        font-size:28px; letter-spacing:6px; text-transform:uppercase;
        margin-bottom:24px; opacity:0.9;
      ">ENTERING SECTOR</div>
      <div id="loadingRoom" style="
        font-size:16px; letter-spacing:3px; color:#88ffdd;
        margin-bottom:32px;
      ">INITIALIZING...</div>
      <div style="
        width:280px; height:3px; background:#111; border:1px solid #00ffcc44;
        border-radius:2px; overflow:hidden;
      ">
        <div id="loadingBar" style="
          height:100%; background: linear-gradient(90deg,#00ffcc,#0088ff);
          width:0%; transition:width 0.1s linear;
          box-shadow: 0 0 8px #00ffcc;
        "></div>
      </div>
      <div id="loadingHint" style="
        font-size:11px; letter-spacing:2px; color:#556677;
        margin-top:24px; text-transform:uppercase;
      ">QUANTUM TELEPORTATION IN PROGRESS</div>
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

        // Barre de progression animée
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

    // ── Génération ───────────────────────────────

    async _generateMap(scene, canvas) {
        const seed = Math.floor(Date.now() / 1000);

        this.map = new ProceduralMap(scene, {
            seed,
            roomCount: 6,
            assetBase: "assets/models/",
        });

        // Callback appelé quand une salle est prête → téléporte le joueur
        this.map._onRoomReady = (room, idx, spawnPos) => {
            if (!this.player) return;

            // Téléportation près de la porte d'entrée (calculé dans ProceduralMap)
            this.player.camera.position = spawnPos ?? new BABYLON.Vector3(
                (room.worldX + room.cols / 2) * 4, 5, (room.worldZ + room.rows / 2) * 4,
            );

            // Forcer Babylon à recalculer toutes les matrices mondiales
            // (évite le bug "meshes invisibles" après changement de salle)
            scene.meshes.forEach(m => {
                if (m._worldMatrix) m.computeWorldMatrix(true);
            });

            // Rebuild l'octree pour le frustum culling avec les nouveaux meshes
            scene.createOrUpdateSelectionOctree(64);

            // Masquer l'écran de chargement
            this._finishLoading();
            console.log(`[GameScene] Joueur téléporté vers salle ${idx} (${room.type})`);
        };

        // Afficher écran de chargement initial
        await this._showLoading("spawn", 0);
        await this.map.generate();

        this.player = new Player(scene, canvas);
        this.player.camera.position = new BABYLON.Vector3(
            this.map.spawnPoint.x, 5, this.map.spawnPoint.z,
        );

        this._tempCamera.dispose();
        this._tempCamera = null;

        this.map.attachCamera(this.player.camera);

        // Intercepter les changements de salle pour afficher l'écran
        const origActivate = this.map._activateRoom.bind(this.map);
        this.map._activateRoom = async (idx) => {
            if (this.map._loading || idx === this.map._activeIdx) return;
            const room = this.map.rooms[idx];
            // Montrer l'écran de chargement AVANT le chargement
            this._showLoading(room.type, idx);
            await origActivate(idx);
        };

        this._finishLoading();
    }
}