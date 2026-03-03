import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { WaveManager } from "../Systems/WaveManager";
import { ProceduralMap } from "./ProceduralMap";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";

export class GameScene {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this.engine = new BABYLON.Engine(canvas, true, {
            limitDeviceRatio: 1,
            doNotHandleContextLost: true,
        });

        // Résolution réduite = gain de perf majeur
        this.engine.setHardwareScalingLevel(2);

        this.scene = this._createScene(canvas);

        this.engine.runRenderLoop(() => this.scene.render());
        window.addEventListener("resize", () => this.engine.resize());
    }

    _createScene(canvas) {
        const scene = new BABYLON.Scene(this.engine);

        scene.gravity           = new BABYLON.Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;

        // Désactiver le picking inutile à chaque frame
        scene.skipPointerMovePicking = true;
        scene.pointerMovePredicate   = () => false;

        // UNE seule lumière, pas de shadows, pas de HDR, pas de post-process
        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity   = 1.0;
        light.diffuse     = new BABYLON.Color3(0.9, 0.95, 1.0);
        light.groundColor = new BABYLON.Color3(0.2, 0.2, 0.3);

        scene.imageProcessingConfiguration.toneMappingEnabled = false;

        // Caméra temporaire pendant le chargement async
        this._tempCamera = new BABYLON.FreeCamera("tempCam", new BABYLON.Vector3(0, 2, 0), scene);

        this._generateMap(scene, canvas);

        scene.debugLayer.show({
            embedMode: true, // s'affiche dans la page
        });

        return scene;
    }

    async _generateMap(scene, canvas) {
        const seed = Math.floor(Date.now() / 1000);

        const map = new ProceduralMap(scene, {
            seed,
            roomCount: 8,
            tileSize:  4,
            assetBase: "assets/models/",
        });

        await map.generate();

        this.player = new Player(scene, canvas);
        this.player.camera.position = new BABYLON.Vector3(map.spawnPoint.x, 5, map.spawnPoint.z);

        this._tempCamera.dispose();
        this._tempCamera = null;

        // Octree = frustum culling automatique, ne rend que ce qui est visible
        scene.createOrUpdateSelectionOctree(64);

        /*const waveManager = new WaveManager(scene, this.player, this.player.hud);
        setTimeout(() => waveManager.startNextWave(), 2000);*/
    }
}