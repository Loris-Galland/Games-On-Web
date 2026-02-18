import * as BABYLON from "@babylonjs/core";

export class Player {
    constructor(scene, canvas) {
        this.scene = scene;
        this.canvas = canvas;

        // Configuration
        this.speed = 1.5;
        this.inertia = 0;
        this.tiltAmount = 0.05;
        this.tiltSpeed = 0.1;
        this.inputMap = {};

        // Camera
        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 2.5, -5), this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.checkCollisions = true;
        this.camera.applyGravity = true;
        this.camera.ellipsoid = new BABYLON.Vector3(1, 1, 1);
        this.camera.minZ = 0.1;
        this.camera.speed = this.speed;
        this.camera.inertia = this.inertia;
        this.camera.angularSensibility = 3000;

        // Contrôles
        this.camera.keysUp = [90, 87];
        this.camera.keysDown = [83];
        this.camera.keysLeft = [81, 65];
        this.camera.keysRight = [68];

        // Initialisation
        this._initInputs();
        this._initPointerLock();
        this._initWeapon();

        // Variables Animation
        this.currentTilt = 0;
        this.bobTimer = 0;

        // Boucle Update
        this.scene.registerBeforeRender(() => {
            this._updateCameraTilt();
            this._updateWeaponBobbing();
        });
    }

    _initInputs() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            const key = kbInfo.event.key.toLowerCase();
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.inputMap[key] = true;
            } else {
                this.inputMap[key] = false;
            }
            
            // Saut
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN && kbInfo.event.code === "Space") {
                this.camera.cameraDirection.y = 0.5;
            }
        });
    }

    _initWeapon() {
        const weaponMat = new BABYLON.StandardMaterial("weaponMat", this.scene);
        weaponMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);

        this.weapon = BABYLON.MeshBuilder.CreateBox("weapon", { width: 0.15, height: 0.2, depth: 0.6 }, this.scene);
        this.weapon.material = weaponMat;
        this.weapon.parent = this.camera;
        this.weaponOriginalPos = new BABYLON.Vector3(0.4, -0.4, 1);
        this.weapon.position = this.weaponOriginalPos.clone();
    }

    _updateCameraTilt() {
        let targetTilt = 0;

        // Logique Inclinaison
        if (this.inputMap["q"] || this.inputMap["a"]) {
            targetTilt = this.tiltAmount;
        } else if (this.inputMap["d"]) {
            targetTilt = -this.tiltAmount;
        }

        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, this.tiltSpeed);
        this.camera.rotation.z = this.currentTilt;
    }

    _updateWeaponBobbing() {
        // Logique Mouvement Arme
        const isMoving = this.inputMap["z"] || this.inputMap["w"] || this.inputMap["s"] || this.inputMap["q"] || this.inputMap["a"] || this.inputMap["d"];

        if (isMoving) {
            this.bobTimer += 0.2;
            const bobY = Math.sin(this.bobTimer) * 0.04;
            const bobX = Math.cos(this.bobTimer * 0.5) * 0.04;

            this.weapon.position.y = this.weaponOriginalPos.y + bobY;
            this.weapon.position.x = this.weaponOriginalPos.x + bobX;
        } else {
            this.weapon.position = BABYLON.Vector3.Lerp(this.weapon.position, this.weaponOriginalPos, 0.1);
            this.bobTimer = 0;
        }
    }

    _initPointerLock() {
        this.scene.onPointerDown = (evt) => {
            if (evt.button === 0) this.scene.getEngine().enterPointerlock();
        };
    }
}