import * as BABYLON from "@babylonjs/core";
import { Projectile }     from "../Weapons/Projectile.js";
import { Ammo }           from "../Systems/Ammo.js";
import { EnemyParticles } from "../Enemies/EnemyParticles.js";

export class PlayerShoot {
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;
        this.camera = player.camera;

        this.fireRate      = 200;
        this.lastFireTime  = 0;
        this.multishotEnabled = false;

        this.daggerAmmo = new Ammo(5, 1000, (current, max) => {
            this.player.hud.updateAmmo(current, max);
        });

        this.player.hud.updateAmmo(5, 5);

        this._initShootControl();
    }

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

    fireBasicDagger() {
        if (this.daggerAmmo.consume()) {
            const forward   = this.camera.getForwardRay();
            const direction = forward.direction.normalize();
            const spawnPos  = this.camera.globalPosition.add(direction.scale(2.0));

            // ── Muzzle flash sur le weapon mesh ──────────────────────────────
            EnemyParticles.muzzleFlash(this.scene, this.player.weapon);

            // ── Tir central ───────────────────────────────────────────────────
            new Projectile(this.scene, spawnPos, direction, false);

            // ── Multishot ─────────────────────────────────────────────────────
            if (this.multishotEnabled) {
                const spreadAngle = 0.15;

                const dirLeft = BABYLON.Vector3.TransformNormal(
                    direction,
                    BABYLON.Matrix.RotationY(-spreadAngle),
                );
                new Projectile(this.scene, spawnPos, dirLeft, false);

                const dirRight = BABYLON.Vector3.TransformNormal(
                    direction,
                    BABYLON.Matrix.RotationY(spreadAngle),
                );
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