import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * VoidRocket
 * ----------
 * Lance-roquettes à projectiles lents, explosion de zone (AoE).
 * Détruit tous les ennemis dans un rayon. Danger de splash self.
 *
 * Usage :
 *   const rl = new VoidRocket(player);
 *   rl.fire();
 *   rl.destroy();
 */
export class VoidRocket {
    /** @param {import('../Player/Player').Player} player */
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;

        // Stats
        this.fireRate       = 1400;
        this.projectileSpeed = 18;
        this.explosionRadius = 5.5;
        this.projectileLife  = 3500; // ms
        this.ammoMax        = 1;
        this.currentAmmo    = 1;
        this.reloadTime     = 2800;
        this.selfDamageMin  = 1.5;   // distance mini safe

        this.lastFireTime  = 0;
        this._reloading    = false;
        this._reloadTimer  = null;

        this._buildMesh();
    }

    // ── Mesh ─────────────────────────────────────────────────────────────────

    _buildMesh() {
        const mat = new BABYLON.StandardMaterial("rlMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.25, 0.05, 0.35);
        mat.emissiveColor = new BABYLON.Color3(0.4, 0, 0.6);

        this.mesh = BABYLON.MeshBuilder.CreateBox("weaponRocket", { width: 0.24, height: 0.2, depth: 0.7 }, this.scene);
        this.mesh.material  = mat;
        this.mesh.parent    = this.player.camera;
        this.mesh.position  = new BABYLON.Vector3(0.4, -0.4, 1.0);
        this.mesh.layerMask = 0x10000000;

        // Tube lanceur
        const tubeMat = new BABYLON.StandardMaterial("rlTubeMat", this.scene);
        tubeMat.diffuseColor  = new BABYLON.Color3(0.12, 0.02, 0.18);
        tubeMat.emissiveColor = new BABYLON.Color3(0.3, 0, 0.5);

        this.tube = BABYLON.MeshBuilder.CreateCylinder("rlTube", { diameter: 0.18, height: 0.7, tessellation: 10 }, this.scene);
        this.tube.material   = tubeMat;
        this.tube.parent     = this.mesh;
        this.tube.position   = new BABYLON.Vector3(0, 0, 0.35);
        this.tube.rotation.x = Math.PI / 2;
        this.tube.layerMask  = 0x10000000;

        // Indicateur de charge (sphère à l'avant)
        const chargeMat = new BABYLON.StandardMaterial("rlChargeMat", this.scene);
        chargeMat.emissiveColor   = new BABYLON.Color3(0.8, 0, 1);
        chargeMat.disableLighting = true;

        this.chargeGlow = BABYLON.MeshBuilder.CreateSphere("rlGlow", { diameter: 0.13 }, this.scene);
        this.chargeGlow.material   = chargeMat;
        this.chargeGlow.parent     = this.mesh;
        this.chargeGlow.position   = new BABYLON.Vector3(0, 0, 0.72);
        this.chargeGlow.layerMask  = 0x10000000;
    }

    // ── Tir ─────────────────────────────────────────────────────────────────

    fire() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate) return false;
        if (this._reloading || this.currentAmmo <= 0) {
            this._startReload();
            return false;
        }

        this.lastFireTime = now;
        this.currentAmmo--;

        const cam     = this.player.camera;
        const forward = cam.getForwardRay().direction.normalize();
        const spawnPos = cam.globalPosition.add(forward.scale(2.0));

        EnemyParticles.muzzleFlash(this.scene, this.mesh);
        this.player.applyWeaponRecoil?.(0.3);
        cam.rotation.x -= 0.02;

        this._spawnRocket(spawnPos, forward.clone());

        if (this.currentAmmo <= 0) this._startReload();
        this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "VOID ROCKET", this._reloading);

        return true;
    }

    _spawnRocket(pos, dir) {
        // Mesh roquette
        const rocketMesh = BABYLON.MeshBuilder.CreateCylinder("rocket", { diameter: 0.12, height: 0.45, tessellation: 8 }, this.scene);
        rocketMesh.position = pos;
        rocketMesh.isPickable = false;
        rocketMesh.alwaysSelectAsActiveMesh = true;

        const rMat = new BABYLON.StandardMaterial("rocketMat", this.scene);
        rMat.emissiveColor = new BABYLON.Color3(0.7, 0, 1);
        rMat.disableLighting = true;
        rocketMesh.material = rMat;

        // Orient
        rocketMesh.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionRH(dir, BABYLON.Vector3.Up());
        rocketMesh.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);

        const spawnTime = Date.now();
        const speed     = this.projectileSpeed;
        const scene     = this.scene;
        const radius    = this.explosionRadius;
        const lifeTime  = this.projectileLife;
        let   exploded  = false;

        // Trainée de particules
        const emitter = rocketMesh;
        const trail = new BABYLON.ParticleSystem("rocketTrail", 60, scene);
        trail.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
        trail.emitter         = emitter;
        trail.minEmitBox      = BABYLON.Vector3.Zero();
        trail.maxEmitBox      = BABYLON.Vector3.Zero();
        trail.color1          = new BABYLON.Color4(0.8, 0, 1, 1);
        trail.color2          = new BABYLON.Color4(0.4, 0, 0.6, 0.6);
        trail.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        trail.minSize         = 0.08;
        trail.maxSize         = 0.22;
        trail.minLifeTime     = 0.15;
        trail.maxLifeTime     = 0.4;
        trail.emitRate        = 80;
        trail.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        trail.direction1      = new BABYLON.Vector3(-0.5, -0.5, -2);
        trail.direction2      = new BABYLON.Vector3( 0.5,  0.5, -5);
        trail.minEmitPower    = 2;
        trail.maxEmitPower    = 5;
        trail.gravity         = BABYLON.Vector3.Zero();
        trail.updateSpeed     = 0.025;
        trail.start();

        const explode = (impactPos) => {
            if (exploded) return;
            exploded = true;
            trail.stop();

            // Explosion visuelle
            this._spawnExplosion(impactPos);

            // AoE dommages : dispose tous les ennemis dans le rayon
            const meshesToKill = [];
            scene.meshes.forEach(m => {
                if (!m || m.isDisposed()) return;
                if (["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) {
                    const dist = BABYLON.Vector3.Distance(m.position, impactPos);
                    if (dist <= radius) meshesToKill.push(m);
                }
                // Boss
                if (m._isBossBody && BABYLON.Vector3.Distance(m.position, impactPos) <= radius) {
                    m._takeDamage?.(35);
                }
            });
            meshesToKill.forEach(m => { if (!m.isDisposed()) m.dispose(); });

            // Splash self-damage si joueur trop proche
            const playerDist = BABYLON.Vector3.Distance(this.player.camera.globalPosition, impactPos);
            if (playerDist < this.selfDamageMin && this.player.health && !this.player.isDead) {
                this.player.health.takeDamage(1);
            }

            setTimeout(() => {
                trail.dispose();
                if (!rocketMesh.isDisposed()) rocketMesh.dispose();
            }, 600);
        };

        const obs = scene.onBeforeRenderObservable.add(() => {
            if (exploded || rocketMesh.isDisposed()) { scene.onBeforeRenderObservable.remove(obs); return; }

            const dt  = scene.getEngine().getDeltaTime() / 1000;
            const ray = new BABYLON.Ray(rocketMesh.position, dir, speed * dt * 2);
            const hit = scene.pickWithRay(ray, m => m.checkCollisions && m !== rocketMesh);

            if (hit.hit) {
                explode(hit.pickedPoint ?? rocketMesh.position.clone());
                scene.onBeforeRenderObservable.remove(obs);
                return;
            }

            rocketMesh.position.addInPlace(dir.scale(speed * dt));

            if (Date.now() - spawnTime > lifeTime) {
                explode(rocketMesh.position.clone());
                scene.onBeforeRenderObservable.remove(obs);
            }
        });
    }

    _spawnExplosion(pos) {
        // Burst principal
        const emitter = BABYLON.MeshBuilder.CreateBox("_expEmitter", { size: 0.01 }, this.scene);
        emitter.position   = pos.clone();
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const tex = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", this.scene);

        const burst = new BABYLON.ParticleSystem("rocketBurst", 120, this.scene);
        burst.particleTexture = tex;
        burst.emitter         = emitter;
        burst.minEmitBox      = new BABYLON.Vector3(-0.5, -0.2, -0.5);
        burst.maxEmitBox      = new BABYLON.Vector3( 0.5,  0.5,  0.5);
        burst.color1          = new BABYLON.Color4(1, 0.6, 0, 1);
        burst.color2          = new BABYLON.Color4(0.6, 0, 0.8, 0.9);
        burst.colorDead       = new BABYLON.Color4(0.1, 0, 0.1, 0);
        burst.minSize         = 0.25;
        burst.maxSize         = 0.85;
        burst.minLifeTime     = 0.3;
        burst.maxLifeTime     = 0.7;
        burst.emitRate        = 0;
        burst.manualEmitCount = 120;
        burst.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        burst.direction1      = new BABYLON.Vector3(-6, 0, -6);
        burst.direction2      = new BABYLON.Vector3( 6, 6,  6);
        burst.minEmitPower    = 6;
        burst.maxEmitPower    = 16;
        burst.gravity         = new BABYLON.Vector3(0, -5, 0);
        burst.updateSpeed     = 0.02;
        burst.start();

        // Shockwave ring (plane qui s'étend)
        this._spawnShockwave(pos);

        setTimeout(() => {
            burst.stop();
            setTimeout(() => {
                burst.dispose(); tex.dispose(); emitter.dispose();
            }, 800);
        }, 60);
    }

    _spawnShockwave(pos) {
        const ring = BABYLON.MeshBuilder.CreateDisc("shockwave", { radius: 0.1, tessellation: 32 }, this.scene);
        ring.position    = pos.clone();
        ring.rotation.x  = Math.PI / 2;
        ring.isPickable  = false;

        const mat = new BABYLON.StandardMaterial("shockMat", this.scene);
        mat.emissiveColor  = new BABYLON.Color3(0.7, 0, 1);
        mat.backFaceCulling = false;
        mat.alpha          = 0.7;
        ring.material      = mat;

        const maxR  = this.explosionRadius;
        const start = Date.now();
        const dur   = 400;

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / dur, 1);
            const r = t * maxR;
            ring.scaling = new BABYLON.Vector3(r, r, r);
            mat.alpha    = 0.7 * (1 - t);
            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(obs);
                ring.dispose();
            }
        });
    }

    // ── Rechargement ─────────────────────────────────────────────────────────

    _startReload() {
        if (this._reloading || this.currentAmmo >= this.ammoMax) return;
        this._reloading = true;
        this.player.hud?.updateWeaponAmmo?.(0, this.ammoMax, "RECHARGEMENT...", true);

        this._reloadTimer = setTimeout(() => {
            this.currentAmmo = this.ammoMax;
            this._reloading  = false;
            this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "VOID ROCKET", false);
        }, this.reloadTime);
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    destroy() {
        clearTimeout(this._reloadTimer);
        if (this.chargeGlow && !this.chargeGlow.isDisposed()) this.chargeGlow.dispose();
        if (this.tube       && !this.tube.isDisposed())       this.tube.dispose();
        if (this.mesh       && !this.mesh.isDisposed())       this.mesh.dispose();
    }
}
