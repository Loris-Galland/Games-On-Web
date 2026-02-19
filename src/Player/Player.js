import * as BABYLON from "@babylonjs/core";

export class Player {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;

        // Caméra FPS
        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 2, -5), this.scene);
        
        // Réglages
        this.camera.attachControl(this.canvas, true);
        this.camera.speed = 3.5;
        this.camera.angularSensibility = 2000; 
        this.camera.inertia = 0; // Arrêt net
        this.camera.minZ = 0.1; 

        // Physique
        this.camera.checkCollisions = false;
        this.camera.applyGravity = true;
        this.camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);

        // Touches ZQSD
        this.camera.keysUp = [90, 87];    // Z, W
        this.camera.keysDown = [83];      // S
        this.camera.keysLeft = [81, 65];  // Q, A
        this.camera.keysRight = [68];     // D

        this._initPointerLock();
        this._initJump();
    }

    _initPointerLock() {
        this.scene.onPointerDown = (evt) => {
            if (evt.button === 0) this.scene.getEngine().enterPointerlock();
        };
    }

    _initJump() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                if (kbInfo.event.code === "Space") {
                    this.camera.cameraDirection.y = 0.5;
                }
            }
        });
    }
}