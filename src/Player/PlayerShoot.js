import * as BABYLON from "@babylonjs/core";
import { Projectile } from "../Weapons/Projectile.js";
import { Ammo } from "../Systems/Ammo.js";

export class PlayerShoot {
    constructor(player) {
        this.player = player;
        this.scene = player.scene;
        this.camera = player.camera;

        this.fireRate = 200;
        this.lastFireTime = 0;
        
        // Nouvelle variable pour l'amélioration
        this.multishotEnabled = false;

        this.daggerAmmo = new Ammo(5, 1000, (current, max) => {
            this.player.hud.updateAmmo(current, max);
        });

        this.player.hud.updateAmmo(5, 5);

        this._initShootControl();
    }

    // Initialise les contrôles de clic gauche pour tirer
    _initShootControl() {
        this.scene.onPointerDown = (evt) => {
            const engine = this.scene.getEngine();

            if (!engine.isPointerLock) {
                engine.enterPointerlock();
                return;
            }

            const now = Date.now();
            if (now - this.lastFireTime < this.fireRate) return;

            if (evt.button === 0) {
                this.lastFireTime = now;
                this.fireBasicDagger();
            }
        };
    }

    // Tire le projectile central et ajoute des tirs latéraux si l'amélioration est active
    fireBasicDagger() {
        if (this.daggerAmmo.consume()) {
            const forward = this.camera.getForwardRay();
            const direction = forward.direction.normalize();

            const spawnPos = this.camera.globalPosition.add(direction.scale(2.0));

            // Tir central classique
            new Projectile(this.scene, spawnPos, direction, false);

            // Si l'amélioration TIR DIVISÉ a été choisie, on tire à gauche et à droite
            if (this.multishotEnabled) {
                const spreadAngle = 0.15; // Ajuste cette valeur pour écarter plus ou moins les balles

                // Vecteur de la balle gauche
                const matrixLeft = BABYLON.Matrix.RotationY(-spreadAngle);
                const dirLeft = BABYLON.Vector3.TransformNormal(direction, matrixLeft);
                new Projectile(this.scene, spawnPos, dirLeft, false);

                // Vecteur de la balle droite
                const matrixRight = BABYLON.Matrix.RotationY(spreadAngle);
                const dirRight = BABYLON.Vector3.TransformNormal(direction, matrixRight);
                new Projectile(this.scene, spawnPos, dirRight, false);
            }

            if (this.player.weapon) {
                this.player.applyWeaponRecoil(0.1);
            }
        } else {
            console.log("RECHARGEMENT EN COURS !");
        }
    }
}