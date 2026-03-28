import * as BABYLON from "@babylonjs/core";

/**
 * BaseEnemy
 * ---------
 * Classe abstraite commune à tous les types d'ennemis.
 * Les sous-classes définissent leur config via _getConfig().
 *
 * Config attendue :
 *   bodySize        { width, height, depth }
 *   bodyColor       BABYLON.Color3
 *   ellipsoid       BABYLON.Vector3
 *   halfHeight      number   (offset Y du centre du body depuis le sol)
 *   weakPointDiam   number
 *   weakPointY      number   (position locale Y sur le body)
 *   weakPointZ      number   (position locale Z sur le body)
 *   weakPointColor  BABYLON.Color3
 *   bodyName        string   (nom du mesh body — utilisé pour la séparation)
 */
export class BaseEnemy {
    constructor(scene, position, player, speed, navManager = null) {
        this.scene       = scene;
        this.player      = player;
        this.speed       = speed;
        this._navManager = navManager;
        this._agentIdx   = null;

        // Physique (mode fallback)
        this.gravity          = -18;
        this.verticalVelocity = 0;
        this.isGrounded       = false;
        this._slopeNormal     = BABYLON.Vector3.Up();
        this._onSlope         = false;

        // Anti-blocage
        this._stuckTimer    = 0;
        this._lastPos       = null;
        this._stuckDir      = null;
        this._stuckDirTimer = 0;

        // Mise à jour périodique de la cible Recast
        this._targetUpdateTimer = 0;
        this._targetInterval    = 0.5;

        // ── Construction du mesh ─────────────────────────────────────────────
        const cfg = this._getConfig();
        this._cfg = cfg;

        this.body = BABYLON.MeshBuilder.CreateBox(
            cfg.bodyName,
            { width: cfg.bodySize.width, height: cfg.bodySize.height, depth: cfg.bodySize.depth },
            scene,
        );
        this.body.position  = new BABYLON.Vector3(position.x, position.y + cfg.halfHeight, position.z);
        this.body.ellipsoid = cfg.ellipsoid.clone();
        this.body.refreshBoundingInfo();
        this.body.checkCollisions = true;

        const bodyMat = new BABYLON.StandardMaterial(`bodyMat_${cfg.bodyName}`, scene);
        bodyMat.diffuseColor = cfg.bodyColor;
        this.body.material   = bodyMat;

        // ── Point faible ─────────────────────────────────────────────────────
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere(
            "weakPoint",
            { diameter: cfg.weakPointDiam },
            scene,
        );
        this.weakPoint.parent     = this.body;
        this.weakPoint.position.y = cfg.weakPointY;
        this.weakPoint.position.z = cfg.weakPointZ;

        const weakMat = new BABYLON.StandardMaterial(`weakMat_${cfg.bodyName}`, scene);
        weakMat.emissiveColor   = cfg.weakPointColor;
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        // ── Démarrage ────────────────────────────────────────────────────────
        this._tryRegisterAgent();

        this.observer = this.scene.onBeforeRenderObservable.add(() => this._update());
        this.body.onDisposeObservable.add(() => {
            this._removeAgent();
            this.scene.onBeforeRenderObservable.remove(this.observer);
        });
    }

    /**
     * À surcharger dans chaque sous-classe.
     * @returns {object} config de l'ennemi
     */
    _getConfig() {
        throw new Error("BaseEnemy._getConfig() doit être implémenté par la sous-classe.");
    }

    // ── Enregistrement agent Recast ───────────────────────────────────────────

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

        if (this._agentIdx === null) this._tryRegisterAgent();

        if (this._agentIdx !== null && this._navManager?.isReady) {
            // ── Mode Recast crowd ───────────────────────────────────────────
            this._targetUpdateTimer -= dt;
            if (this._targetUpdateTimer <= 0) {
                this._navManager.setAgentTarget(this._agentIdx, targetWorld);
                this._targetUpdateTimer = this._targetInterval;
            }

            const agentPos = this._navManager.getAgentPosition(this._agentIdx);
            if (agentPos) {
                this.body.position.y = agentPos.y + this._cfg.halfHeight;
            }

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

            if (this._lastPos) {
                const moved = BABYLON.Vector3.Distance(pos, this._lastPos);
                if (moved < 0.004 && distFlat > 3) { this._stuckTimer += dt; }
                else {
                    this._stuckTimer = Math.max(0, this._stuckTimer - dt * 2);
                    if (this._stuckTimer <= 0) this._stuckDir = null;
                }

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
                    this.verticalVelocity = 7;
                    this._stuckTimer = 0;
                    this._stuckDir   = null;
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
            // Séparation avec tous les types d'ennemis
            if (mesh === this.body) continue;
            if (!["enemyBody", "enemyBodyHeavy", "enemyBodyScout"].includes(mesh.name)) continue;
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
        const halfH = this._cfg.halfHeight;
        const tryRay = (len) => this.scene.pickWithRay(
            new BABYLON.Ray(pos, new BABYLON.Vector3(0, -1, 0), len),
            m => m.checkCollisions && m !== this.body && m.name !== "weakPoint",
        );
        let hit = tryRay(halfH + 0.25);
        if (!hit.hit) hit = tryRay(halfH + 0.6);
        if (hit.hit) {
            this._slopeNormal = hit.getNormal(true, true) ?? BABYLON.Vector3.Up();
            const dot         = BABYLON.Vector3.Dot(this._slopeNormal, BABYLON.Vector3.Up());
            this._onSlope     = dot < 0.97 && dot > 0.2;
            this.isGrounded   = this.verticalVelocity <= 0.5;
        } else {
            this.isGrounded   = false;
            this._onSlope     = false;
            this._slopeNormal = BABYLON.Vector3.Up();
        }
    }

    _rotateY(v, a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new BABYLON.Vector3(v.x * c - v.z * s, 0, v.x * s + v.z * c).normalize();
    }

    _projectOnPlane(v, n) {
        return v.subtract(n.scale(BABYLON.Vector3.Dot(v, n)));
    }
}