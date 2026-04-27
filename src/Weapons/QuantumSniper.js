import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * QuantumSniper
 * -------------
 * Fusil hitscan avec zoom FOV, rayon laser visible, délai de charge.
 * One-shot tout (weakpoint comme corps), mais lent à recharger.
 *
 * Usage :
 *   const sniper = new QuantumSniper(player);
 *   sniper.startCharge();   // clic maintenu (optionnel)
 *   sniper.fire();
 *   sniper.cancelZoom();
 */
export class QuantumSniper {
    /** @param {import('../Player/Player').Player} player */
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;

        // Stats
        this.fireRate     = 1200;  // ms
        this.ammoMax      = 3;
        this.currentAmmo  = 3;
        this.reloadTime   = 3000;
        this.chargeTime   = 350;   // ms avant tir autorisé
        this.maxRange     = 120;   // unités monde

        this.lastFireTime = 0;
        this._reloading   = false;
        this._zoomed      = false;
        this._baseFov     = 0.8;   // FOV par défaut Babylon (radians)
        this._zoomFov     = 0.22;
        this._chargeStart = null;
        this._reloadTimer = null;

        // Rayon laser persistant (brièvement visible)
        this._laserMesh   = null;

        this._buildMesh();
    }

    // ── Mesh ─────────────────────────────────────────────────────────────────

    _buildMesh() {
        const mat = new BABYLON.StandardMaterial("snpMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.15, 0.3);
        mat.emissiveColor = new BABYLON.Color3(0, 0.3, 0.6);

        this.mesh = BABYLON.MeshBuilder.CreateBox("weaponSniper", { width: 0.1, height: 0.12, depth: 0.85 }, this.scene);
        this.mesh.material  = mat;
        this.mesh.parent    = this.player.camera;
        this.mesh.position  = new BABYLON.Vector3(0.38, -0.42, 1.1);
        this.mesh.layerMask = 0x10000000;

        // Scope
        const scopeMat = new BABYLON.StandardMaterial("scopeMat", this.scene);
        scopeMat.diffuseColor  = new BABYLON.Color3(0, 0.5, 1);
        scopeMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);

        this.scope = BABYLON.MeshBuilder.CreateCylinder("snpScope", { diameter: 0.09, height: 0.28, tessellation: 10 }, this.scene);
        this.scope.material   = scopeMat;
        this.scope.parent     = this.mesh;
        this.scope.position   = new BABYLON.Vector3(0, 0.11, -0.1);
        this.scope.rotation.x = Math.PI / 2;
        this.scope.layerMask  = 0x10000000;

        // Canon long
        const barrelMat = new BABYLON.StandardMaterial("snpBarrelMat", this.scene);
        barrelMat.diffuseColor  = new BABYLON.Color3(0.02, 0.08, 0.18);
        barrelMat.emissiveColor = new BABYLON.Color3(0, 0.2, 0.5);

        this.barrelMesh = BABYLON.MeshBuilder.CreateCylinder("snpBarrel", { diameter: 0.04, height: 0.55, tessellation: 8 }, this.scene);
        this.barrelMesh.material   = barrelMat;
        this.barrelMesh.parent     = this.mesh;
        this.barrelMesh.position   = new BABYLON.Vector3(0, 0, 0.7);
        this.barrelMesh.rotation.x = Math.PI / 2;
        this.barrelMesh.layerMask  = 0x10000000;
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    toggleZoom() {
        this._zoomed = !this._zoomed;
        const targetFov = this._zoomed ? this._zoomFov : this._baseFov;

        let t = 0;
        const startFov = this.player.camera.fov;
        const dur      = 120;
        const start    = Date.now();

        const interval = setInterval(() => {
            const now    = Date.now();
            t            = Math.min((now - start) / dur, 1);
            const ease   = 1 - (1 - t) * (1 - t);
            this.player.camera.fov = startFov + (targetFov - startFov) * ease;
            if (t >= 1) clearInterval(interval);
        }, 16);

        if (this._zoomed) this._chargeStart = Date.now();
        else this._chargeStart = null;
    }

    cancelZoom() {
        if (!this._zoomed) return;
        this._zoomed = false;
        this.player.camera.fov = this._baseFov;
        this._chargeStart = null;
    }

    // ── Tir hitscan ──────────────────────────────────────────────────────────

    fire() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate) return false;
        if (this._reloading || this.currentAmmo <= 0) {
            this._startReload();
            return false;
        }

        // Délai de charge minimal si zoomé
        if (this._chargeStart && (now - this._chargeStart) < this.chargeTime) return false;

        this.lastFireTime = now;
        this.currentAmmo--;

        const cam = this.player.camera;
        const forward = cam.getForwardRay().direction.normalize();
        const origin  = cam.globalPosition.add(forward.scale(1.5));

        // Hitscan sur toute la range
        const ray = new BABYLON.Ray(origin, forward, this.maxRange);
        const hit  = this.scene.pickWithRay(ray, m => m.isPickable);

        // Rayon laser visible
        this._showLaser(origin, hit.hit ? hit.pickedPoint : origin.add(forward.scale(this.maxRange)));

        if (hit.hit) this._onHit(hit);

        // Recul caméra
        cam.rotation.x -= this._zoomed ? 0.04 : 0.012;
        this.player.applyWeaponRecoil?.(this._zoomed ? 0.25 : 0.08);

        // Kick FOV (sursaut)
        if (this._zoomed) {
            const savedFov = cam.fov;
            cam.fov = savedFov + 0.06;
            setTimeout(() => { cam.fov = savedFov; }, 80);
        }

        if (this.currentAmmo <= 0) this._startReload();

        this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "QUANTUM SNIPER", this._reloading);
        return true;
    }

    _onHit(hit) {
        const m = hit.pickedMesh;
        if (!m) return;
        const pos = hit.pickedPoint ?? this.player.camera.globalPosition;
        const n   = hit.getNormal(true) ?? BABYLON.Vector3.Up();

        if (m.name === "weakPoint") {
            if (m.parent) m.parent.dispose();
        } else if (["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) {
            // Sniper perfore → tue directement
            EnemyParticles.projectileImpact(this.scene, pos, n);
            // Cherche le weakPoint parent
            const enemy = m;
            if (enemy && !enemy.isDisposed()) enemy.dispose();
        } else {
            EnemyParticles.projectileImpact(this.scene, pos, n);
        }
    }

    // ── Rayon laser visuel ────────────────────────────────────────────────────

    _showLaser(from, to) {
        if (this._laserMesh) { try { this._laserMesh.dispose(); } catch(_){} }

        const dir  = to.subtract(from);
        const len  = dir.length();
        const mid  = from.add(dir.scale(0.5));

        const laser = BABYLON.MeshBuilder.CreateCylinder("snpLaser", { diameter: 0.025, height: len, tessellation: 6 }, this.scene);
        laser.position = mid;
        laser.isPickable = false;
        laser.alwaysSelectAsActiveMesh = true;

        // Orient le cylindre le long du rayon
        const axis = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), dir.normalize());
        const angle = Math.acos(BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), dir.normalize()));
        if (axis.length() > 0.001) laser.rotateAround(mid, axis.normalize(), angle);

        const mat = new BABYLON.StandardMaterial("snpLaserMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(0, 1, 1);
        mat.disableLighting = true;
        mat.alpha           = 0.85;
        laser.material = mat;

        this._laserMesh = laser;

        // Fade out
        let t = 0;
        const fadeObs = this.scene.onBeforeRenderObservable.add(() => {
            t += this.scene.getEngine().getDeltaTime();
            const a = Math.max(0, 0.85 - t / 180);
            mat.alpha = a;
            if (a <= 0 || laser.isDisposed()) {
                this.scene.onBeforeRenderObservable.remove(fadeObs);
                if (!laser.isDisposed()) laser.dispose();
                this._laserMesh = null;
            }
        });
    }

    // ── Rechargement ─────────────────────────────────────────────────────────

    _startReload() {
        if (this._reloading || this.currentAmmo >= this.ammoMax) return;
        this._reloading = true;
        this.cancelZoom();
        this.player.hud?.updateWeaponAmmo?.(0, this.ammoMax, "RECHARGEMENT...", true);

        this._reloadTimer = setTimeout(() => {
            this.currentAmmo = this.ammoMax;
            this._reloading  = false;
            this.player.hud?.updateWeaponAmmo?.(this.currentAmmo, this.ammoMax, "QUANTUM SNIPER", false);
        }, this.reloadTime);
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    destroy() {
        clearTimeout(this._reloadTimer);
        this.cancelZoom();
        if (this._laserMesh && !this._laserMesh.isDisposed()) this._laserMesh.dispose();
        if (this.scope      && !this.scope.isDisposed())      this.scope.dispose();
        if (this.barrelMesh && !this.barrelMesh.isDisposed()) this.barrelMesh.dispose();
        if (this.mesh       && !this.mesh.isDisposed())       this.mesh.dispose();
    }
}
