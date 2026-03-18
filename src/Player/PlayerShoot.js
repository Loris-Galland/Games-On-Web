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

    // Ecoute le clic souris
    _initShootControl() {
        this.scene.onPointerDown = (evt) => {
            const engine = this.scene.getEngine();

            // Verrouille la souris
            if (!engine.isPointerLock) {
                engine.enterPointerlock();
                return;
            }

            // Vérifie le cooldown
            const now = Date.now();
            if (now - this.lastFireTime < this.fireRate) return;

            // Tirer
            if (evt.button === 0) {
                this.lastFireTime = now;
                this.fireBasicDagger();
            }
        };
    }

    // Logique du tir
    fireBasicDagger() {
        // Tente d'utiliser une balle
        if (this.daggerAmmo.consume()) {
            // Rayon depuis le centre exact de l'écran (crosshair)
            const forward = this.camera.getForwardRay();
            const direction = forward.direction.normalize();

            // Point de spawn : légèrement devant la caméra pour éviter
            // toute collision immédiate avec le mesh weapon ou les murs proches
            const spawnPos = this.camera.globalPosition.add(direction.scale(2.0));

            new Projectile(this.scene, spawnPos, direction, false);

            if (this.player.weapon) {
                this.player.weapon.position.z -= 0.1;
            }
        } else {
            console.log("RECHARGEMENT EN COURS !");
        }
    }
}