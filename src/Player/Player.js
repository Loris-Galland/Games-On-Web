import * as BABYLON from "@babylonjs/core";
import { PlayerShoot }    from "./PlayerShoot";
import { Health }         from "../Systems/Health";
import { PlayerHUD }      from "../UI/PlayerHUD";
import { GameOverScreen } from "../UI/GameOverScreen";

export class Player {
    constructor(scene, canvas) {
        this.scene  = scene;
        this.canvas = canvas;

        this.speed     = 0.3;
        this.inputMap  = {};
        this.maxHealth = 10;
        this.isDead    = false;

        this.getStatsCallback = null;

        // ── Caméra ────────────────────────────────────────────────────────────
        this.camera = new BABYLON.UniversalCamera(
            "playerCam",
            new BABYLON.Vector3(0, 1.5, 0),
            this.scene,
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.checkCollisions = true;
        this.camera.applyGravity    = true;
        this.camera.ellipsoid       = new BABYLON.Vector3(0.25, 1.5, 0.25);
        this.camera.ellipsoidOffset = new BABYLON.Vector3(0, 1.5, 0);
        this.camera.slopLimit       = 90;
        this.camera.stepOffset      = 0.4;
        this.camera.minZ            = 0.1;
        this.camera.speed           = this.speed;
        this.camera.angularSensibility = 5000;
        this.camera.layerMask       = 0x0FFFFFFF;

        this.camera.keysUp    = [90, 87];
        this.camera.keysDown  = [83];
        this.camera.keysLeft  = [81, 65];
        this.camera.keysRight = [68];

        this._initInputs();
        this._initWeapon();

        this.hud             = new PlayerHUD(this.maxHealth);
        this._gameOverScreen = new GameOverScreen();

        this.health = new Health(
            this.maxHealth,
            (current) => this.hud.updateHealth(current),
            () => this._onDeath(),
        );
        this.shootController = new PlayerShoot(this);

        this.currentTilt = 0;
        this.bobTimer    = 0;
        this.jumpForce   = 0;

        // Référence au GamepadManager (injectée depuis main.js après construction)
        this.gamepad = null;

        this.scene.registerBeforeRender(() => {
            if (this.isDead) return;
            this._updateCameraTilt();
            this._updateWeaponBobbing();
            this._updateJump();
            this._updateWeaponRecoilRecovery();
        });
    }

    // ── Mort ──────────────────────────────────────────────────────────────────

    _onDeath() {
        if (this.isDead) return;
        this.isDead = true;
        this.camera.detachControl();
        const stats = this.getStatsCallback ? this.getStatsCallback() : {};
        setTimeout(() => { this._gameOverScreen.show(stats); }, 600);
    }

    // ── Inputs clavier ────────────────────────────────────────────────────────

    _initInputs() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (this.isDead) return;
            const key = kbInfo.event.key.toLowerCase();
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.inputMap[key] = true;
                if (kbInfo.event.code === "Space") this._jump();
                if (kbInfo.event.code === "KeyK")  this.health.takeDamage(1);
            } else {
                this.inputMap[key] = false;
            }
        });
    }

    // ── Saut ──────────────────────────────────────────────────────────────────

    _jump() {
        if (this.jumpForce > 0) return;
        const ray = new BABYLON.Ray(
            this.camera.position,
            new BABYLON.Vector3(0, -1, 0),
            1.15,
        );
        const hit = this.scene.pickWithRay(
            ray,
            (mesh) => mesh.checkCollisions && mesh.name !== "weapon",
        );
        if (hit.hit) this.jumpForce = 0.4;
    }

    _updateJump() {
        if (this.jumpForce > 0) {
            this.camera.cameraDirection.y += this.jumpForce;
            this.jumpForce -= 0.02;
            if (this.jumpForce <= 0) this.jumpForce = 0;
        }
    }

    // ── Arme ─────────────────────────────────────────────────────────────────

    _initWeapon() {
        const weaponMat = new BABYLON.StandardMaterial("weaponMat", this.scene);
        weaponMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);

        this.weapon = BABYLON.MeshBuilder.CreateBox(
            "weapon",
            { width: 0.15, height: 0.2, depth: 0.6 },
            this.scene,
        );
        this.weapon.material         = weaponMat;
        this.weapon.parent           = this.camera;
        this.weaponOriginalPos       = new BABYLON.Vector3(0.4, -0.4, 1);
        this.weapon.position         = this.weaponOriginalPos.clone();
        this.weaponMinZ              = 0.6;
        this.weapon.layerMask        = 0x10000000;

        this._weaponCamera = new BABYLON.FreeCamera("weaponCam", BABYLON.Vector3.Zero(), this.scene);
        this._weaponCamera.parent    = this.camera;
        this._weaponCamera.minZ      = 0.05;
        this._weaponCamera.maxZ      = 5;
        this._weaponCamera.layerMask = 0x10000000;

        this.scene.activeCameras = [this.camera, this._weaponCamera];

        this.scene.onBeforeCameraRenderObservable.add((cam) => {
            if (cam === this._weaponCamera) {
                this.scene.getEngine().clear(null, false, true, false);
            }
        });
    }

    applyWeaponRecoil(amount) {
        if (!this.weapon) return;
        const newZ = this.weapon.position.z - amount;
        this.weapon.position.z = Math.max(newZ, this.weaponMinZ);
    }

    _updateWeaponRecoilRecovery() {
        if (!this.weapon) return;
        if (this.weapon.position.z < this.weaponOriginalPos.z) {
            this.weapon.position.z = BABYLON.Scalar.Lerp(
                this.weapon.position.z,
                this.weaponOriginalPos.z,
                0.15,
            );
            if (Math.abs(this.weapon.position.z - this.weaponOriginalPos.z) < 0.001) {
                this.weapon.position.z = this.weaponOriginalPos.z;
            }
        }
    }

    // ── Tilt caméra (clavier + manette) ──────────────────────────────────────

    _updateCameraTilt() {
        // La manette injecte inputMap["a"] / inputMap["d"] directement dans GamepadManager
        let targetTilt = 0;
        if (this.inputMap["q"] || this.inputMap["a"]) targetTilt =  0.05;
        else if (this.inputMap["d"])                  targetTilt = -0.05;
        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, 0.1);
        this.camera.rotation.z = this.currentTilt;
    }

    // ── Bobbing arme (clavier + manette) ─────────────────────────────────────

    _updateWeaponBobbing() {
        const isMovingKb =
            this.inputMap["z"] || this.inputMap["w"] || this.inputMap["s"] ||
            this.inputMap["q"] || this.inputMap["a"] || this.inputMap["d"];

        // inputMap["_gp_move"] est mis à jour par GamepadManager
        const isMoving = isMovingKb || this.inputMap["_gp_move"];

        if (isMoving) {
            this.bobTimer += 0.2;
            this.weapon.position.y = this.weaponOriginalPos.y + Math.sin(this.bobTimer) * 0.04;
            this.weapon.position.x = this.weaponOriginalPos.x + Math.cos(this.bobTimer * 0.5) * 0.04;
        } else {
            this.weapon.position.x = BABYLON.Scalar.Lerp(this.weapon.position.x, this.weaponOriginalPos.x, 0.1);
            this.weapon.position.y = BABYLON.Scalar.Lerp(this.weapon.position.y, this.weaponOriginalPos.y, 0.1);
            this.bobTimer = 0;
        }
    }
}