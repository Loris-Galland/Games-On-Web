import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { WorldBuilder } from "./WorldBuilder";
import "@babylonjs/loaders/glTF";
import {Color3} from "@babylonjs/core";

export class Game {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error("ERREUR FATALE : Impossible de trouver le canvas avec l'ID '" + canvasId + "'");
            return;
        }

        try {
            this.engine = new BABYLON.Engine(canvas, true);
        } catch (e) {
            console.error("ERREUR MOTEUR : Le moteur Babylon n'a pas pu démarrer.", e);
            return;
        }

        this.engine.setHardwareScalingLevel(1.5);


        if (!this.engine) {
            console.error("ERREUR : this.engine est indéfini avant la création de la scène !");
            return;
        }

        this._createScene(canvas).then((scene) => {
            this.scene = scene;

            this.engine.runRenderLoop(() => {
                this.scene.render();
            });
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    async _createScene(canvas) {
        const scene = new BABYLON.Scene(this.engine);

        scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 1;

        const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(-1, -2, -1), scene);
        dirLight.intensity = 0.5;

        const wb = new WorldBuilder(scene, {
            collisions: true,
            defaultColor: new BABYLON.Color3(0.45, 0.45, 0.45),
        });

        await wb.loadAsset("ville", {
            folder: "/assets/models/",
            file: "Game.glb",
            position: new BABYLON.Vector3(0, -10, 0),
            rotation: new BABYLON.Vector3(0, Math.PI, 0),
            scaling:  new BABYLON.Vector3(1, 1, 1),
        });


        this.player = new Player(scene, canvas);

        return scene;
    }
}