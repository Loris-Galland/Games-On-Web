import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * QuantumSniper (corrigé)
 * -----------------------
 * Fix résidus visuels : scope + barrel sont désormais listés dans _allMeshParts
 * et masqués/détruits de façon atomique via setVisible() / destroy().
 * Le laser est aussi nettoyé proprement à chaque switch.
 */
export class QuantumSniper {
    constructor(player) {
        this.player = player;
        this.scene  = player.scene;

        this.fireRate     = 1200;
        this.ammoMax      = 3;
        this.currentAmmo  = 3;
        this.reloadTime   = 3000;
        this.chargeTime   = 350;
        this.maxRange     = 120;

        this.lastFireTime = 0;
        this._reloading   = false;
        this._zoomed      = false;
        this._baseFov     = 0.8;
        this._zoomFov     = 0.22;
        this._chargeStart = null;
        this._reloadTimer = null;
        this._fovInterval = null;

        // Toutes les pièces visuelles — hide/show/dispose groupés
        this._allMeshParts = [];
        this._laserMesh    = null;
        this._laserObs     = null;

        this._buildMesh();
    }

    // ── Construction ──────────────────────────────────────────────────────────

    _buildMesh() {
        const uid = Math.random().toString(36).slice(2);

        // Corps
        const mat = new BABYLON.StandardMaterial(`snpMat_${uid}`, this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.15, 0.3);
        mat.emissiveColor = new BABYLON.Color3(0, 0.3, 0.6);

        this.mesh = BABYLON.MeshBuilder.CreateBox("weaponSniper", { width: 0.1, height: 0.12, depth: 0.85 }, this.scene);
        this.mesh.material  = mat;
        this.mesh.parent    = this.player.camera;
        this.mesh.position  = new BABYLON.Vector3(0.38, -0.42, 1.1);
        this.mesh.layerMask = 0x10000000;
        this._allMeshParts.push(this.mesh);

        // Scope — parented au corps, donc suit automatiquement
        const scopeMat = new BABYLON.StandardMaterial(`scopeMat_${uid}`, this.scene);
        scopeMat.diffuseColor  = new BABYLON.Color3(0, 0.5, 1);
        scopeMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);

        this.scope = BABYLON.MeshBuilder.CreateCylinder("snpScope", { diameter: 0.09, height: 0.28, tessellation: 10 }, this.scene);
        this.scope.material   = scopeMat;
        this.scope.parent     = this.mesh;
        this.scope.position   = new BABYLON.Vector3(0, 0.11, -0.1);
        this.scope.rotation.x = Math.PI / 2;
        this.scope.layerMask  = 0x10000000;
        this._allMeshParts.push(this.scope);

        // Canon
        const barrelMat = new BABYLON.StandardMaterial(`snpBarrelMat_${uid}`, this.scene);
        barrelMat.diffuseColor  = new BABYLON.Color3(0.02, 0.08, 0.18);
        barrelMat.emissiveColor = new BABYLON.Color3(0, 0.2, 0.5);

        this.barrelMesh = BABYLON.MeshBuilder.CreateCylinder("snpBarrel", { diameter: 0.04, height: 0.55, tessellation: 8 }, this.scene);
        this.barrelMesh.material   = barrelMat;
        this.barrelMesh.parent     = this.mesh;
        this.barrelMesh.position   = new BABYLON.Vector3(0, 0, 0.7);
        this.barrelMesh.rotation.x = Math.PI / 2;
        this.barrelMesh.layerMask  = 0x10000000;
        this._allMeshParts.push(this.barrelMesh);
    }

    // ── Visibilité groupée (appelée par WeaponManager) ────────────────────────

    setVisible(visible) {
        this._allMeshParts.forEach(m => {
            if (m && !m.isDisposed()) m.isVisible = visible;
        });
        if (!visible) {
            this._killLaser();
            this.cancelZoom();
        }
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    toggleZoom() {
        this._zoomed = !this._zoomed;
        this._animateFov(this._zoomed ? this._zoomFov : this._baseFov);
        this._chargeStart = this._zoomed ? Date.now() : null;
    }

    cancelZoom() {
        if (!this._zoomed) return;
        this._zoomed      = false;
        this._chargeStart = null;
        this._animateFov(this._baseFov);
    }

    _animateFov(targetFov) {
        if (this._fovInterval) { clearInterval(this._fovInterval); this._fovInterval = null; }
        const startFov = this.player.camera.fov;
        const start    = Date.now();
        this._fovInterval = setInterval(() => {
            const t = Math.min((Date.now() - start) / 120, 1);
            this.player.camera.fov = startFov + (targetFov - startFov) * (1 - (1 - t) ** 2);
            if (t >= 1) { clearInterval(this._fovInterval); this._fovInterval = null; }
        }, 16);
    }

    // ── Tir ──────────────────────────────────────────────────────────────────

    fire() {
        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate) return false;
        if (this._reloading || this.currentAmmo <= 0) { this._startReload(); return false; }
        if (this._chargeStart && (now - this._chargeStart) < this.chargeTime) return false;

        this.lastFireTime = now;
        this.currentAmmo--;

        const cam     = this.player.camera;
        const forward = cam.getForwardRay().direction.normalize();
        const origin  = cam.globalPosition.add(forward.scale(1.5));

        const ray = new BABYLON.Ray(origin, forward, this.maxRange);
        const hit  = this.scene.pickWithRay(ray, m => m.isPickable);

        this._showLaser(origin, hit.hit ? hit.pickedPoint : origin.add(forward.scale(this.maxRange)));
        if (hit.hit) this._onHit(hit);

        cam.rotation.x -= this._zoomed ? 0.04 : 0.012;
        this.player.applyWeaponRecoil?.(this._zoomed ? 0.25 : 0.08);

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
            if (m.parent && !m.parent.isDisposed()) m.parent.dispose();
            else if (!m.isDisposed()) m.dispose();
        } else if (["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) {
            EnemyParticles.projectileImpact(this.scene, pos, n);
            if (!m.isDisposed()) m.dispose();
        } else if (m._isBossBody) {
            EnemyParticles.projectileImpact(this.scene, pos, n);
            m._takeDamage?.(80);
        } else {
            EnemyParticles.projectileImpact(this.scene, pos, n);
        }
    }

    // ── Laser ─────────────────────────────────────────────────────────────────

    _killLaser() {
        if (this._laserObs) {
            this.scene.onBeforeRenderObservable.remove(this._laserObs);
            this._laserObs = null;
        }
        if (this._laserMesh && !this._laserMesh.isDisposed()) this._laserMesh.dispose();
        this._laserMesh = null;
    }

    _showLaser(from, to) {
        this._killLaser();
        const dir = to.subtract(from);
        const len = dir.length();
        if (len < 0.01) return;

        const mid   = from.add(dir.scale(0.5));
        const laser = BABYLON.MeshBuilder.CreateCylinder("snpLaser", { diameter: 0.025, height: len, tessellation: 6 }, this.scene);
        laser.position   = mid;
        laser.isPickable = false;
        laser.alwaysSelectAsActiveMesh = true;

        const axis  = BABYLON.Vector3.Cross(BABYLON.Vector3.Up(), dir.normalize());
        const angle = Math.acos(Math.max(-1, Math.min(1, BABYLON.Vector3.Dot(BABYLON.Vector3.Up(), dir.normalize()))));
        if (axis.length() > 0.001) laser.rotateAround(mid, axis.normalize(), angle);

        const mat = new BABYLON.StandardMaterial("snpLaserMat_" + Math.random().toString(36).slice(2), this.scene);
        mat.emissiveColor = new BABYLON.Color3(0, 1, 1);
        mat.disableLighting = true;
        mat.alpha = 0.85;
        laser.material = mat;
        this._laserMesh = laser;

        let elapsed = 0;
        this._laserObs = this.scene.onBeforeRenderObservable.add(() => {
            if (!this._laserMesh || laser.isDisposed()) {
                if (this._laserObs) this.scene.onBeforeRenderObservable.remove(this._laserObs);
                this._laserObs = null;
                return;
            }
            elapsed += this.scene.getEngine().getDeltaTime();
            const a = Math.max(0, 0.85 - elapsed / 180);
            mat.alpha = a;
            if (a <= 0) this._killLaser();
        });
    }

    // ── Reload ────────────────────────────────────────────────────────────────

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

    // ── Destroy ───────────────────────────────────────────────────────────────

    destroy() {
        clearTimeout(this._reloadTimer);
        if (this._fovInterval) clearInterval(this._fovInterval);
        this.cancelZoom();
        this._killLaser();

        // Détacher les enfants avant dispose du parent pour éviter double-dispose
        if (this.barrelMesh && !this.barrelMesh.isDisposed()) {
            this.barrelMesh.parent = null;
            this.barrelMesh.dispose();
        }
        if (this.scope && !this.scope.isDisposed()) {
            this.scope.parent = null;
            this.scope.dispose();
        }
        if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose();

        this._allMeshParts = [];
    }
}