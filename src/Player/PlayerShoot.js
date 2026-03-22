import { Projectile } from "../Weapons/Projectile.js";
import { Ammo } from "../Systems/Ammo.js";

export class PlayerShoot {
    constructor(player) {
        this.player = player;
        this.scene = player.scene;
        this.camera = player.camera;

        // Configuration tir
        this.fireRate = 200;
        this.lastFireTime = 0;

        // Système de munitions
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
            const forward = this.camera.getForwardRay();
            const direction = forward.direction.normalize();

            const spawnPos = this.camera.globalPosition.add(direction.scale(2.0));

            new Projectile(this.scene, spawnPos, direction, false);

            // Recul avec cap — délégué à Player pour respecter weaponMinZ
            if (this.player.weapon) {
                this.player.applyWeaponRecoil(0.1);
            }
        } else {
            console.log("RECHARGEMENT EN COURS !");
        }
    }
}