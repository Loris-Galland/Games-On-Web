import * as BABYLON from "@babylonjs/core";
import { Projectile }     from "../Weapons/Projectile.js";
import { Ammo }           from "../Systems/Ammo.js";
import { EnemyParticles } from "../Enemies/EnemyParticles.js";

export class PlayerShoot {
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;
        this.camera = player.camera;

        this.fireRateMs       = 200;
        this.lastFireTime     = 0;
        this.multishotEnabled = false;
        this._enabled         = true;

        this._shootSfx = new Audio("sounds/sfx/shoot.wav");
        this._shootSfx.volume = 0.1;

        this.damageMultiplier = 1;
        this.lastBulletBonus  = false;
        this.piercing         = false;
        this.executionRefund  = false;
        this.explosiveRounds  = false;

        this.daggerAmmo = new Ammo(5, 1000, (current, max) => {
            this.player.hud.updateAmmo(current, max);
        });

        this.player.hud.updateAmmo(5, 5);
        this._initShootControl();
    }

    _initShootControl() {
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
            const evt = pointerInfo.event;

            const engine = this.scene.getEngine();
            if (!engine.isPointerLock) {
                engine.enterPointerlock();
                return;
            }

            if (!this._enabled) return;
            if (evt.button !== 0) return;

            if (evt.type !== "mousedown" && evt.type !== "pointerdown") return;
            if (Math.abs(evt.movementX ?? 0) > 10 || Math.abs(evt.movementY ?? 0) > 10) return;

            const now = Date.now();
            if (now - this.lastFireTime < this.fireRateMs) return;

            this.lastFireTime = now;
            this.fireBasicDagger();
        });
    }

    fireBasicDagger() {
        if (!this.daggerAmmo.consume()) {
            console.log("RECHARGEMENT EN COURS !");
            return;
        }

        const forward   = this.camera.getForwardRay();
        const direction = forward.direction.normalize();
        const spawnPos  = this.camera.globalPosition.add(direction.scale(2.0));

        const isLastBullet = this.lastBulletBonus && this.daggerAmmo.current === 0;
        const dmgMult      = (this.damageMultiplier ?? 1) * (isLastBullet ? 3 : 1);

        this._shootSfx.currentTime = 0;
        this._shootSfx.play().catch(() => {});

        EnemyParticles.muzzleFlash(this.scene, this.player.weapon);
        this._fireProjectile(spawnPos, direction, dmgMult);

        if (this.multishotEnabled) {
            const spreadAngle = 0.15;
            const dirLeft  = BABYLON.Vector3.TransformNormal(direction, BABYLON.Matrix.RotationY(-spreadAngle));
            const dirRight = BABYLON.Vector3.TransformNormal(direction, BABYLON.Matrix.RotationY( spreadAngle));
            this._fireProjectile(spawnPos, dirLeft,  dmgMult);
            this._fireProjectile(spawnPos, dirRight, dmgMult);
        }

        if (this.player.weapon) this.player.applyWeaponRecoil(0.1);
    }

    /**
     * @param {BABYLON.Vector3} spawnPos
     * @param {BABYLON.Vector3} direction
     * @param {number} dmgMult
     */
    _fireProjectile(spawnPos, direction, dmgMult = 1) {
        if (this.piercing) {
            this._firePiercingProjectile(spawnPos, direction, dmgMult);
        } else if (this.explosiveRounds) {
            this._fireExplosiveProjectile(spawnPos, direction, dmgMult);
        } else {
            new Projectile(this.scene, spawnPos, direction, false);
        }
    }

    /**
     * @param {BABYLON.Vector3} spawnPos
     * @param {BABYLON.Vector3} direction
     * @param {number} dmgMult
     */
    _firePiercingProjectile(spawnPos, direction, dmgMult) {
        let currentOrigin = spawnPos.clone();
        let enemiesHit    = 0;
        const maxPierces  = 2;
        const maxDist     = 50;

        const doRaycast = () => {
            if (enemiesHit >= maxPierces) return;

            const ray = new BABYLON.Ray(currentOrigin, direction, maxDist);
            const hit = this.scene.pickWithRay(ray, (m) =>
                m.isPickable &&
                (m.name === "enemyBody" || m.name === "enemyBodyHeavy" ||
                 m.name === "enemyBodyScout" || m.name === "weakPoint")
            );

            if (!hit.hit || !hit.pickedMesh) return;

            const mesh     = hit.pickedMesh;
            const hitPoint = hit.pickedPoint ?? mesh.getAbsolutePosition();

            EnemyParticles.projectileImpact(this.scene, hitPoint, BABYLON.Vector3.Up());

            if (mesh.name === "weakPoint") {
                if (mesh.parent?._isBossBody) {
                    mesh.parent._takeDamage?.(Math.ceil(dmgMult));
                } else if (mesh.parent && !mesh.parent.isDisposed()) {
                    mesh.parent.dispose();
                }
                return;
            } else {
                if (typeof mesh._takeDamage === "function") {
                    mesh._takeDamage(Math.ceil(dmgMult));
                } else if (mesh.parent && typeof mesh.parent._takeDamage === "function") {
                    mesh.parent._takeDamage(Math.ceil(dmgMult));
                } else {
                    if (!mesh.isDisposed()) mesh.dispose();
                }
            }

            enemiesHit++;

            if (hit.pickedPoint) {
                currentOrigin = hit.pickedPoint.add(direction.scale(0.3));
                doRaycast();
            }
        };

        doRaycast();
        EnemyParticles.muzzleFlash(this.scene, this.player.weapon);
    }


    /**
     * @param {BABYLON.Vector3} spawnPos
     * @param {BABYLON.Vector3} direction
     * @param {number} dmgMult
     */
    _fireExplosiveProjectile(spawnPos, direction, dmgMult) {
        const proj = new Projectile(this.scene, spawnPos, direction, false);

        const origUpdate = proj.update.bind(proj);
        proj.update = () => {
            const dt  = this.scene.getEngine().getDeltaTime() / 1000;
            const ray = new BABYLON.Ray(proj.mesh.position, proj.direction, proj.speed * dt);
            const hit = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== proj.mesh);

            if (hit.hit) {
                this._explodeAt(hit.pickedPoint ?? proj.mesh.position.clone(), 1.5, dmgMult);
                proj.destroy();
                return;
            }

            proj.mesh.position.addInPlace(proj.direction.scale(proj.speed * dt));
            if (Date.now() - proj.spawnTime > proj.lifeTime) proj.destroy();
        };
    }

    /**
     * @param {FlowGraphDataConnection<Vector3>|Vector3|FlowGraphDataConnection<Nullable<Vector3>>|BABYLON.Vector3} pos
     * @param {number} radius
     * @param {number} dmgMult
     */
    _explodeAt(pos, radius, dmgMult) {
        EnemyParticles.projectileImpact(this.scene, pos, BABYLON.Vector3.Up());

        const enemyNames = ["enemyBody", "enemyBodyHeavy", "enemyBodyScout", "weakPoint"];
        this.scene.meshes.forEach(m => {
            if (!enemyNames.includes(m.name) || m.isDisposed()) return;
            if (BABYLON.Vector3.Distance(m.getAbsolutePosition(), pos) >= radius) return;

            if (m.name === "weakPoint" && m.parent?._isBossBody) {
                m.parent._takeDamage?.(Math.round(dmgMult));
            } else if (typeof m._takeDamage === "function") {
                m._takeDamage(Math.ceil(dmgMult));
            } else if (m.parent && typeof m.parent._takeDamage === "function") {
                m.parent._takeDamage(Math.ceil(dmgMult));
            } else if (!m.isDisposed()) {
                m.dispose();
            }
        });
    }

    _onKill() {
        this.player.onEnemyKilled?.();
    }

    _refundAmmo() {
        this.daggerAmmo.current = Math.min(
            (this.daggerAmmo.current ?? 0) + 1,
            this.daggerAmmo.max ?? 5,
        );
        this.player.hud.updateAmmo(this.daggerAmmo.current, this.daggerAmmo.max);
    }
}