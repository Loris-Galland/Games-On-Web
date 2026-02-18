import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";

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

        this.scene = this._createScene(canvas);

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    _createScene(canvas) {
        const scene = new BABYLON.Scene(this.engine);
        
        scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;

        const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 50, height: 50}, scene);
        ground.checkCollisions = true;
        const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
        groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        ground.material = groundMat;

        const box = BABYLON.MeshBuilder.CreateBox("crate", {size: 2}, scene);
        box.position = new BABYLON.Vector3(5, 1, 5);
        box.checkCollisions = true;
        const boxMat = new BABYLON.StandardMaterial("boxMat", scene);
        boxMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
        box.material = boxMat;

        this.player = new Player(scene, canvas);

        return scene;
    }
}