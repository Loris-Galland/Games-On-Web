import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "./EnemyParticles";

/**
 * BaseEnemy
 * ---------
 * checkCollisions = FALSE sur le body ennemi → le joueur traverse les ennemis
 * physiquement, ce qui évite le blocage en groupe.
 * La détection de proximité (dégâts + recul) est gérée manuellement via distFlat.
 *
 * Les ennemis se séparent entre eux via _applySeparation (pas de checkCollisions
 * inter-ennemis non plus — tout est géré en code).
 */
export class BaseEnemy {
    constructor(scene, position, player, speed, navManager = null) {
        this.scene       = scene;
        this.player      = player;
        this.speed       = speed;
        this._navManager = navManager;
        this._agentIdx   = null;

        this.gravity          = -18;
        this.verticalVelocity = 0;
        this.isGrounded       = false;
        this._slopeNormal     = BABYLON.Vector3.Up();
        this._onSlope         = false;

        this._stuckTimer    = 0;
        this._lastPos       = null;
        this._stuckDir      = null;
        this._stuckDirTimer = 0;

        this._targetUpdateTimer = 0;
        this._targetInterval    = 0.5;

        // ── Contact damage ────────────────────────────────────────────────────
        this._damageCooldown = 1.0;   // secondes entre deux dégâts
        this._damageTimer    = 0;

        // ── Recul ─────────────────────────────────────────────────────────────
        this._knockbackVel      = BABYLON.Vector3.Zero();
        this._knockbackDuration = 0;

        const cfg   = this._getConfig();
        this._cfg   = cfg;

        this.body = BABYLON.MeshBuilder.CreateBox(
            cfg.bodyName,
            { width: cfg.bodySize.width, height: cfg.bodySize.height, depth: cfg.bodySize.depth },
            scene,
        );
        this.body.position  = new BABYLON.Vector3(position.x, position.y + cfg.halfHeight, position.z);
        this.body.ellipsoid = cfg.ellipsoid.clone();
        this.body.refreshBoundingInfo();

        // ── CLEF : pas de collision physique avec le joueur ───────────────────
        // Le joueur traverse les ennemis → plus de blocage en groupe.
        // Les dégâts et le recul sont gérés par proximité (distFlat).
        this.body.checkCollisions = false;
        this.body.isPickable      = true;   // reste pickable pour les projectiles

        const bodyMat = new BABYLON.StandardMaterial(`bodyMat_${Math.random().toString(36).slice(2)}`, scene);
        bodyMat.diffuseColor = cfg.bodyColor;
        this.body.material   = bodyMat;

        this.weakPoint = BABYLON.MeshBuilder.CreateSphere(
            "weakPoint",
            { diameter: cfg.weakPointDiam },
            scene,
        );
        this.weakPoint.parent     = this.body;
        this.weakPoint.position.y = cfg.weakPointY;
        this.weakPoint.position.z = cfg.weakPointZ;

        const weakMat = new BABYLON.StandardMaterial(`weakMat_${Math.random().toString(36).slice(2)}`, scene);
        weakMat.emissiveColor   = cfg.weakPointColor;
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        this._tryRegisterAgent();

        this.observer = this.scene.onBeforeRenderObservable.add(() => this._update());

        this.body.onDisposeObservable.add(() => {
            this._removeAgent();
            this.scene.onBeforeRenderObservable.remove(this.observer);
            EnemyParticles.death(
                this.scene,
                this.body.position.clone(),
                EnemyParticles.colorForType(this._cfg.enemyType),
            );
        });
    }

    _getConfig() {
        throw new Error("BaseEnemy._getConfig() must be implemented by subclass.");
    }

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

        // Timers
        if (this._damageTimer > 0)       this._damageTimer       -= dt;
        if (this._knockbackDuration > 0) this._knockbackDuration -= dt;

        // ── Contact damage ────────────────────────────────────────────────────
        const contactRadius = this._cfg.bodySize.width * 0.65 + 0.6;
        if (distFlat < contactRadius && this._damageTimer <= 0 && !this.player.isDead) {
            this._damageTimer = this._damageCooldown;
            if (this.player.health) this.player.health.takeDamage(1);
            this._applyKnockback(pos, targetWorld);
        }

        // ── Phase de recul ────────────────────────────────────────────────────
        if (this._knockbackDuration > 0) {
            // Pendant le recul on utilise moveWithCollisions pour que l'ennemi
            // reste dans la salle (rebondit sur les murs)
            this.body.checkCollisions = true;
            this.body.moveWithCollisions(new BABYLON.Vector3(
                this._knockbackVel.x * dt,
                this.verticalVelocity * dt,
                this._knockbackVel.z * dt,
            ));
            this.body.checkCollisions = false;  // remet à false après

            if (this._agentIdx !== null && this._navManager?.isReady) {
                const agentPos = this._navManager.getAgentPosition(this._agentIdx);
                if (agentPos) this.body.position.y = agentPos.y + this._cfg.halfHeight;
            }
            return;
        }

        // ── Déplacement normal ────────────────────────────────────────────────
        if (this._agentIdx === null) this._tryRegisterAgent();

        if (this._agentIdx !== null && this._navManager?.isReady) {
            this._targetUpdateTimer -= dt;
            if (this._targetUpdateTimer <= 0) {
                this._navManager.setAgentTarget(this._agentIdx, targetWorld);
                this._targetUpdateTimer = this._targetInterval;
            }

            const agentPos = this._navManager.getAgentPosition(this._agentIdx);
            if (agentPos) this.body.position.y = agentPos.y + this._cfg.halfHeight;

            const vel = this._navManager.getAgentVelocity(this._agentIdx);
            if (vel && vel.length() > 0.1 && distFlat > 1) {
                const lookAt = new BABYLON.Vector3(pos.x + vel.x, pos.y, pos.z + vel.z);
                this.body.lookAt(lookAt);
            }

        } else {
            // Mode fallback beeline
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

            // Fallback : les ennemis utilisent checkCollisions uniquement pour
            // rester dans la salle (murs) — on l'active juste pour le moveWithCollisions
            this.body.checkCollisions = true;
            const hSpeed = distFlat > 1.8 ? this.speed * climbBoost : 0;
            this.body.moveWithCollisions(new BABYLON.Vector3(
                moveDir.x * hSpeed * dt,
                this.verticalVelocity * dt,
                moveDir.z * hSpeed * dt,
            ));
            this.body.checkCollisions = false;

            if (distFlat > 1) this.body.lookAt(new BABYLON.Vector3(targetWorld.x, pos.y, targetWorld.z));
        }
    }

    // ── Recul sécurisé ────────────────────────────────────────────────────────

    _applyKnockback(pos, playerPos) {
        const KNOCKBACK_SPEED    = this.speed * 3.5;
        const KNOCKBACK_DURATION = 0.35;
        const RAY_LEN            = 1.2;

        const awayDir = new BABYLON.Vector3(pos.x - playerPos.x, 0, pos.z - playerPos.z);
        const candidates = [];

        if (awayDir.length() > 0.01) {
            const base = awayDir.normalize();
            candidates.push(base);
            candidates.push(new BABYLON.Vector3(-base.z,  0,  base.x));
            candidates.push(new BABYLON.Vector3( base.z,  0, -base.x));
            candidates.push(this._rotateY(base,  Math.PI / 4));
            candidates.push(this._rotateY(base, -Math.PI / 4));
        }

        let chosen = BABYLON.Vector3.Zero();
        const origin = pos.clone();
        origin.y += 0.5;

        for (const dir of candidates) {
            const ray = new BABYLON.Ray(origin, dir, RAY_LEN);
            const hit = this.scene.pickWithRay(
                ray,
                // On teste seulement les murs (checkCollisions=true sur les murs de la map)
                m => m.checkCollisions && m !== this.body && m.name !== "weakPoint"
                    && !["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name),
            );
            if (!hit.hit) {
                chosen = dir.scale(KNOCKBACK_SPEED);
                break;
            }
            if (hit.distance > RAY_LEN * 0.4) {
                chosen = dir.scale(KNOCKBACK_SPEED * (hit.distance / RAY_LEN));
                break;
            }
        }

        this._knockbackVel      = chosen;
        this._knockbackDuration = KNOCKBACK_DURATION;
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