import * as BABYLON from "@babylonjs/core";

/**
 * DummyEnemy
 * ----------
 * Si un NavigationManager est fourni ET prêt, l'ennemi est piloté en tant
 * que crowd agent Recast (pathfinding + évitement automatique).
 * Sinon fallback sur un beeline direct + wall-avoidance raycasts.
 */
export class DummyEnemy {
    /**
     * @param {BABYLON.Scene}         scene
     * @param {BABYLON.Vector3}       position      position de spawn (Y = sol)
     * @param {object}                player
     * @param {number}                speed         vitesse u/s
     * @param {NavigationManager|null} navManager   gestionnaire Recast
     */
    constructor(scene, position, player, speed = 0.65, navManager = null) {
        this.scene      = scene;
        this.player     = player;
        this.speed      = speed;
        this._navManager = navManager;
        this._agentIdx   = null;  // index crowd Recast

        // Physique (utilisée en mode fallback ou pour la gravité)
        this.gravity          = -18;
        this.verticalVelocity = 0;
        this.isGrounded       = false;
        this._slopeNormal     = BABYLON.Vector3.Up();
        this._onSlope         = false;

        // Fallback anti-blocage
        this._stuckTimer    = 0;
        this._lastPos       = null;
        this._stuckDir      = null;
        this._stuckDirTimer = 0;

        // Mise à jour périodique de la cible (évite de spammer agentGoto)
        this._targetUpdateTimer = 0;
        this._targetInterval    = 0.5;

        // ── Mesh ────────────────────────────────────────────────────────────
        this.body = BABYLON.MeshBuilder.CreateBox(
            "enemyBody",
            { width: 1.2, height: 2.2, depth: 1.2 },
            scene,
        );
        this.body.position  = new BABYLON.Vector3(position.x, position.y + 1.1, position.z);
        this.body.ellipsoid = new BABYLON.Vector3(0.55, 1.1, 0.55);
        this.body.refreshBoundingInfo();
        this.body.showBoundingBox          = false;
        this.body.showSubMeshesBoundingBox = false;
        this.body.checkCollisions          = true;

        const bodyMat = new BABYLON.StandardMaterial("bodyMat", scene);
        bodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
        this.body.material   = bodyMat;

        // Point faible
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 0.5 }, scene);
        this.weakPoint.parent     = this.body;
        this.weakPoint.position.y = 0.8;
        this.weakPoint.position.z = 0.6;
        const weakMat = new BABYLON.StandardMaterial("weakMat", scene);
        weakMat.emissiveColor   = new BABYLON.Color3(1, 0, 0);
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        // Enregistrement comme agent Recast une fois le navmesh prêt
        this._tryRegisterAgent();

        this.observer = this.scene.onBeforeRenderObservable.add(() => this._update());
        this.body.onDisposeObservable.add(() => {
            this._removeAgent();
            this.scene.onBeforeRenderObservable.remove(this.observer);
        });
    }

    // ── Enregistrement agent ──────────────────────────────────────────────────

    _tryRegisterAgent() {
        if (!this._navManager?.isReady) return;
        this._agentIdx = this._navManager.addAgent(this.body.position, this.body, this.speed);
    }

    _removeAgent() {
        if (this._navManager && this._agentIdx !== null) {
            this._navManager.removeAgent(this._agentIdx);
            this._agentIdx = null;
        }
    }

    // ── Boucle principale ─────────────────────────────────────────────────────

    _update() {
        if (!this.player?.camera) return;
        if (this.body.isDisposed())  return;

        const dt          = this.scene.getEngine().getDeltaTime() / 1000;
        const pos         = this.body.position;
        const targetWorld = this.player.camera.globalPosition.clone();
        const distFlat    = Math.sqrt(
            (pos.x - targetWorld.x) ** 2 + (pos.z - targetWorld.z) ** 2,
        );

        // Tenter l'enregistrement si pas encore fait
        if (this._agentIdx === null) this._tryRegisterAgent();

        if (this._agentIdx !== null && this._navManager?.isReady) {
            // ── Mode Recast crowd ───────────────────────────────────────────
            this._targetUpdateTimer -= dt;
            if (this._targetUpdateTimer <= 0) {
                this._navManager.setAgentTarget(this._agentIdx, targetWorld);
                this._targetUpdateTimer = this._targetInterval;
            }

            // La position du body est mise à jour par le crowd agent directement
            // (Babylon lie le mesh au crowd via addAgent).
            // On gère juste l'orientation.
            const vel = this._navManager.getAgentVelocity(this._agentIdx);
            if (vel && vel.length() > 0.1 && distFlat > 1) {
                const lookAt = new BABYLON.Vector3(pos.x + vel.x, pos.y, pos.z + vel.z);
                this.body.lookAt(lookAt);
            }

        } else {
            // ── Mode fallback : beeline + wall avoidance ────────────────────
            const toPlayer = new BABYLON.Vector3(targetWorld.x - pos.x, 0, targetWorld.z - pos.z);
            let desiredDir = toPlayer.length() > 0.01 ? toPlayer.normalize() : BABYLON.Vector3.Zero();

            if (distFlat > 2) desiredDir = this._steerAroundWalls(pos, desiredDir);
            desiredDir = this._applySeparation(pos, desiredDir);
            this._updateGroundInfo(pos);

            let moveDir = desiredDir.clone(), climbBoost = 1.0;
            if (this._onSlope && this.isGrounded) {
                const proj = this._projectOnPlane(moveDir, this._slopeNormal);
                if (proj.length() > 0.01) { moveDir = proj.normalize(); climbBoost = 1.3; }
                if (this.verticalVelocity < 0) this.verticalVelocity = Math.max(this.verticalVelocity, -3);
            }

            // Anti-blocage
            if (this._lastPos) {
                const moved = BABYLON.Vector3.Distance(pos, this._lastPos);
                if (moved < 0.004 && distFlat > 3) { this._stuckTimer += dt; }
                else { this._stuckTimer = Math.max(0, this._stuckTimer - dt * 2); if (this._stuckTimer <= 0) this._stuckDir = null; }

                if (this._stuckTimer > 1.0 && distFlat > 2) {
                    if (!this._stuckDir || this._stuckDirTimer <= 0) {
                        const perp = new BABYLON.Vector3(-desiredDir.z, 0, desiredDir.x);
                        this._stuckDir      = (Math.random() > 0.5 ? perp : perp.negate()).normalize();
                        this._stuckDirTimer = 0.5 + Math.random() * 0.5;
                    }
                    this._stuckDirTimer -= dt;
                    moveDir = BABYLON.Vector3.Lerp(moveDir, this._stuckDir, 0.6).normalize();
                }
                if (this._stuckTimer > 2.5 && this.isGrounded) {
                    this.verticalVelocity = 7; this._stuckTimer = 0; this._stuckDir = null;
                }
            }
            this._lastPos = pos.clone();

            if (!this.isGrounded || !this._onSlope) this.verticalVelocity += this.gravity * dt;
            this.verticalVelocity = Math.max(this.verticalVelocity, -30);

            const hSpeed = distFlat > 1.8 ? this.speed * climbBoost : 0;
            this.body.moveWithCollisions(new BABYLON.Vector3(
                moveDir.x * hSpeed * dt,
                this.verticalVelocity * dt,
                moveDir.z * hSpeed * dt,
            ));

            if (distFlat > 1) this.body.lookAt(new BABYLON.Vector3(targetWorld.x, pos.y, targetWorld.z));
        }
    }

    // ── Fallback helpers ──────────────────────────────────────────────────────

    _steerAroundWalls(pos, desiredDir) {
        const origin = pos.add(new BABYLON.Vector3(0, 0.6, 0));
        const rayLen = 2.8;
        const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3];
        let steering = BABYLON.Vector3.Zero(), frontBlocked = false;
        for (const angle of angles) {
            const dir = this._rotateY(desiredDir, angle);
            const hit = this.scene.pickWithRay(
                new BABYLON.Ray(origin, dir, rayLen),
                m => m.checkCollisions && m !== this.body && m.name !== "weakPoint",
            );
            if (hit.hit && hit.distance < rayLen) {
                const w = 1 - hit.distance / rayLen;
                steering.addInPlace(dir.negate().scale(w * w));
                if (angle === 0) frontBlocked = true;
            }
        }
        if (steering.length() > 0.01) {
            const aw = frontBlocked ? 0.9 : 0.45;
            const b  = desiredDir.scale(1 - aw).add(steering.normalize().scale(aw));
            return b.length() > 0.01 ? b.normalize() : desiredDir;
        }
        return desiredDir;
    }

    _applySeparation(pos, desiredDir) {
        const radius = 2.2;
        let push = BABYLON.Vector3.Zero();
        for (const mesh of this.scene.meshes) {
            if (mesh === this.body || mesh.name !== "enemyBody") continue;
            const diff = pos.subtract(mesh.position);
            const d    = diff.length();
            if (d > 0.01 && d < radius) push.addInPlace(diff.normalize().scale((radius - d) / radius));
        }
        if (push.length() > 0.01) {
            const b = desiredDir.add(push.normalize().scale(0.55));
            return b.length() > 0.01 ? b.normalize() : desiredDir;
        }
        return desiredDir;
    }

    _updateGroundInfo(pos) {
        const tryRay = (len) => this.scene.pickWithRay(
            new BABYLON.Ray(pos, new BABYLON.Vector3(0, -1, 0), len),
            m => m.checkCollisions && m !== this.body && m.name !== "weakPoint",
        );
        let hit = tryRay(1.35);
        if (!hit.hit) hit = tryRay(1.7);
        if (hit.hit) {
            this._slopeNormal = hit.getNormal(true, true) ?? BABYLON.Vector3.Up();
            const dot         = BABYLON.Vector3.Dot(this._slopeNormal, BABYLON.Vector3.Up());
            this._onSlope     = dot < 0.97 && dot > 0.2;
            this.isGrounded   = this.verticalVelocity <= 0.5;
        } else {
            this.isGrounded = false; this._onSlope = false;
            this._slopeNormal = BABYLON.Vector3.Up();
        }
    }

    _rotateY(v, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new BABYLON.Vector3(v.x * c - v.z * s, 0, v.x * s + v.z * c).normalize();
    }
    _projectOnPlane(v, n) { return v.subtract(n.scale(BABYLON.Vector3.Dot(v, n))); }
}