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

        // ── Flags activés par upgrades ────────────────────────────────────────
        this.damageMultiplier  = 1;    // surcharge de puissance
        this.lastBulletBonus   = false; // coup final ×3 sur dernière balle
        this.piercing          = false; // perforation : traverse le 1er ennemi
        this.executionRefund   = false; // exécution : refund balle si kill <15% PV
        this.explosiveRounds   = false; // munitions explosives : AoE 1.5m

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

        // ── Calcul du multiplicateur de dégâts ────────────────────────────────
        const isLastBullet = this.lastBulletBonus && this.daggerAmmo.current === 0;
        const dmgMult      = (this.damageMultiplier ?? 1) * (isLastBullet ? 3 : 1);

        // ── Muzzle flash ──────────────────────────────────────────────────────
        EnemyParticles.muzzleFlash(this.scene, this.player.weapon);

        // ── Tir central ───────────────────────────────────────────────────────
        this._fireProjectile(spawnPos, direction, dmgMult);

        // ── Multishot ─────────────────────────────────────────────────────────
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
     * Tire un projectile avec le bon comportement selon les upgrades actifs.
     */
    _fireProjectile(spawnPos, direction, dmgMult = 1) {
        if (this.piercing) {
            this._firePiercingProjectile(spawnPos, direction, dmgMult);
        } else if (this.explosiveRounds) {
            this._fireExplosiveProjectile(spawnPos, direction, dmgMult);
        } else {
            // Projectile standard enrichi avec execution refund
            const proj = new Projectile(this.scene, spawnPos, direction, false, {
                damage:        dmgMult,
                onKill:        (killedMesh) => this._onKill(killedMesh),
                executionCheck: this.executionRefund ? (hp, max) => hp / max < 0.15 : null,
                onExecutionKill: () => this._refundAmmo(),
            });
        }
    }

    // ── Projectile perforant ──────────────────────────────────────────────────

    _firePiercingProjectile(spawnPos, direction, dmgMult) {
        // Raycast long qui traverse jusqu'à 2 ennemis
        const maxDist = 50;
        const ray     = new BABYLON.Ray(spawnPos, direction, maxDist);
        const hits    = [];

        // picksWithRay n'existe pas en Babylon — on fait plusieurs raycasts décalés
        let currentOrigin = spawnPos.clone();
        let enemiesHit    = 0;
        const maxPierces  = 2;

        const doRaycast = () => {
            if (enemiesHit >= maxPierces) return;

            const r   = new BABYLON.Ray(currentOrigin, direction, maxDist);
            const hit = this.scene.pickWithRay(r, (m) => {
                return m.isPickable && m !== null &&
                    (m.name === "enemyBody" || m.name === "enemyBodyHeavy" ||
                     m.name === "enemyBodyScout" || m.name === "weakPoint");
            });

            if (!hit.hit || !hit.pickedMesh) return;

            const mesh = hit.pickedMesh;

            // Appliquer les dégâts
            if (mesh.name === "weakPoint") {
                if (mesh.parent?._isBossBody) {
                    mesh.parent._takeDamage?.(1 * dmgMult);
                } else {
                    this._onKill(mesh);
                    if (!mesh.isDisposed()) mesh.parent?.dispose() ?? mesh.dispose();
                }
            } else {
                EnemyParticles.projectileImpact(this.scene, hit.pickedPoint ?? mesh.getAbsolutePosition(), BABYLON.Vector3.Up());
                if (!mesh.isDisposed()) {
                    this._onKill(mesh);
                    mesh.dispose();
                }
            }

            enemiesHit++;
            // Continuer le raycast depuis juste après cet ennemi
            if (hit.pickedPoint) {
                currentOrigin = hit.pickedPoint.add(direction.scale(0.5));
                doRaycast();
            }
        };

        doRaycast();

        // Flash visuel de la trajectoire (ligne cyan éphémère)
        EnemyParticles.muzzleFlash(this.scene, this.player.weapon);
    }

    // ── Projectile explosif ───────────────────────────────────────────────────

    _fireExplosiveProjectile(spawnPos, direction, dmgMult) {
        const proj = new Projectile(this.scene, spawnPos, direction, false);

        // On patch le onHit du projectile pour ajouter l'explosion
        const origObserver = proj.observer;
        const origUpdate   = proj.update.bind(proj);

        proj.update = () => {
            const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;
            const ray = new BABYLON.Ray(proj.mesh.position, proj.direction, proj.speed * deltaTime);
            const hit = this.scene.pickWithRay(ray, (m) => m.isPickable && m !== proj.mesh);

            if (hit.hit) {
                // Explosion AoE
                this._explodeAt(hit.pickedPoint ?? proj.mesh.position.clone(), 1.5, dmgMult);
                proj.destroy();
                return;
            }

            proj.mesh.position.addInPlace(proj.direction.scale(proj.speed * deltaTime));
            if (Date.now() - proj.spawnTime > proj.lifeTime) proj.destroy();
        };
    }

    _explodeAt(pos, radius, dmgMult) {
        // Particules
        EnemyParticles.projectileImpact(this.scene, pos, BABYLON.Vector3.Up());

        // Flash orange
        this.player._screenFlash?.("rgba(255,140,0,0.4)", 200);

        // Dégâts AoE
        const enemyNames = ["enemyBody","enemyBodyHeavy","enemyBodyScout","weakPoint"];
        this.scene.meshes.forEach(m => {
            if (!enemyNames.includes(m.name)) return;
            if (m.isDisposed()) return;
            const dist = BABYLON.Vector3.Distance(m.getAbsolutePosition(), pos);
            if (dist < radius) {
                if (m.name === "weakPoint" && m.parent?._isBossBody) {
                    m.parent._takeDamage?.(Math.round(1 * dmgMult));
                } else {
                    this._onKill(m);
                    if (!m.isDisposed()) m.dispose();
                }
            }
        });
    }

    // ── Callbacks kill ────────────────────────────────────────────────────────

    _onKill(mesh) {
        // Hook pour vol de vie etc.
        this.player.onEnemyKilled?.();
    }

    _refundAmmo() {
        // Recharge 1 balle
        this.daggerAmmo.current = Math.min(
            (this.daggerAmmo.current ?? 0) + 1,
            this.daggerAmmo.max ?? 5,
        );
        this.player.hud.updateAmmo(this.daggerAmmo.current, this.daggerAmmo.max);
    }
}