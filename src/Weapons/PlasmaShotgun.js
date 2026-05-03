import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * PlasmaShotgun
 * -------------
 * Tir en rafale : 7 projectiles en éventail, rechargement lent.
 * Dégâts élevés à courte portée, dispersion aléatoire à longue portée.
 *
 * Usage :
 *   const gun = new PlasmaShotgun(player);
 *   gun.fire();
 *   gun.destroy();
 */
export class PlasmaShotgun {
    /** @param {import('../Player/Player').Player} player */
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;

        // Stats
        this.pellets        = 7;
        this.spreadAngle    = 0.22;   // radians max dispersion
        this.fireRate       = 700;    // ms entre chaque coup
        this.projectileSpeed = 28;
        this.projectileLife  = 800;   // ms
        this.ammoMax        = 2;
        this.currentAmmo    = 2;
        this.reloadTime     = 2400;   // ms

        this.lastFireTime   = 0;
        this._reloading     = false;
        this._reloadTimer   = null;

        // Apparence
        this._buildMesh();
    }

    // ── Mesh visuel de l'arme ────────────────────────────────────────────────

    _buildMesh() {
        const mat = new BABYLON.StandardMaterial("sgMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.6, 0.15, 0.05);
        mat.emissiveColor = new BABYLON.Color3(0.3, 0.05, 0);

        // Corps
        this.mesh = BABYLON.MeshBuilder.CreateBox("weaponShotgun", { width: 0.22, height: 0.18, depth: 0.55 }, this.scene);
        this.mesh.material   = mat;
        this.mesh.parent     = this.player.camera;
        this.mesh.position   = new BABYLON.Vector3(0.4, -0.4, 1.0);
        this.mesh.layerMask  = 0x10000000;

        // Canon évasé
        const barrelMat = new BABYLON.StandardMaterial("sgBarrelMat", this.scene);
        barrelMat.diffuseColor  = new BABYLON.Color3(0.3, 0.08, 0.02);
        barrelMat.emissiveColor = new BABYLON.Color3(0.5, 0.1, 0);

        this.barrel = BABYLON.MeshBuilder.CreateCylinder("sgBarrel", { diameterTop: 0.12, diameterBottom: 0.08, height: 0.22, tessellation: 8 }, this.scene);
        this.barrel.material   = barrelMat;
        this.barrel.parent     = this.mesh;
        this.barrel.position   = new BABYLON.Vector3(0, 0, 0.38);
        this.barrel.rotation.x = Math.PI / 2;
        this.barrel.layerMask  = 0x10000000;
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

        const forward = this.player.camera.getForwardRay().direction.normalize();
        const spawnPos = this.player.camera.globalPosition.add(forward.scale(1.8));

        EnemyParticles.muzzleFlash(this.scene, this.mesh);

        // Kick caméra
        this.player.camera.rotation.x -= 0.025;
        this.player.applyWeaponRecoil?.(0.18);

        // Spawn pellets
        for (let i = 0; i < this.pellets; i++) {
            const angleH = (Math.random() - 0.5) * this.spreadAngle;
            const angleV = (Math.random() - 0.5) * this.spreadAngle * 0.6;

            let dir = BABYLON.Vector3.TransformNormal(forward, BABYLON.Matrix.RotationY(angleH));
            dir = BABYLON.Vector3.TransformNormal(dir, BABYLON.Matrix.RotationX(angleV));
            dir.normalize();

            this._spawnPellet(spawnPos.clone(), dir);
        }

        if (this.currentAmmo <= 0) this._startReload();

        // Notify HUD
        this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "PLASMA SHOTGUN", this._reloading);

        return true;
    }

    _spawnPellet(pos, dir) {
        const mesh = BABYLON.MeshBuilder.CreateSphere("pellet", { diameter: 0.07 }, this.scene);
        mesh.position = pos;
        mesh.isPickable = false;
        mesh.alwaysSelectAsActiveMesh = true;

        const mat = new BABYLON.StandardMaterial("pelletMat", this.scene);
        mat.emissiveColor = new BABYLON.Color3(1, 0.35, 0);
        mat.disableLighting = true;
        mesh.material = mat;

        const spawnTime = Date.now();
        const speed = this.projectileSpeed;
        const lifeTime = this.projectileLife;
        const scene = this.scene;

        const obs = scene.onBeforeRenderObservable.add(() => {
            if (mesh.isDisposed()) { scene.onBeforeRenderObservable.remove(obs); return; }

            const dt = scene.getEngine().getDeltaTime() / 1000;
            const ray = new BABYLON.Ray(mesh.position, dir, speed * dt * 1.5);
            const hit = scene.pickWithRay(ray, m => m.isPickable && m !== mesh);

            if (hit.hit) {
                this._onPelletHit(hit);
                scene.onBeforeRenderObservable.remove(obs);
                mesh.dispose();
                return;
            }

            mesh.position.addInPlace(dir.scale(speed * dt));

            if (Date.now() - spawnTime > lifeTime) {
                scene.onBeforeRenderObservable.remove(obs);
                mesh.dispose();
            }
        });
    }

    _onPelletHit(hit) {
        const m = hit.pickedMesh;
        if (!m) return;

        const impactPos = hit.pickedPoint ?? this.mesh.position.clone();
        const normal    = hit.getNormal(true) ?? BABYLON.Vector3.Up();

        if (m.name === "weakPoint") {
            if (m.parent) m.parent.dispose();
        } else if (["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) {
            EnemyParticles.projectileImpact(this.scene, impactPos, normal);
        } else {
            EnemyParticles.projectileImpact(this.scene, impactPos, normal);
        }
    }

    // ── Rechargement ─────────────────────────────────────────────────────────

    _startReload() {
        if (this._reloading || this.currentAmmo >= this.ammoMax) return;
        this._reloading = true;
        this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "RECHARGEMENT...", true);

        this._reloadTimer = setTimeout(() => {
            this.currentAmmo = this.ammoMax;
            this._reloading  = false;
            this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "PLASMA SHOTGUN", false);
        }, this.reloadTime);
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    destroy() {
        clearTimeout(this._reloadTimer);
        if (this.barrel && !this.barrel.isDisposed()) this.barrel.dispose();
        if (this.mesh   && !this.mesh.isDisposed())   this.mesh.dispose();
    }
}
