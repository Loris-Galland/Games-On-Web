import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "./EnemyParticles";

// ── Compteur global pour distribuer les slots ─────────────────────────────────
let _enemySpawnCounter = 0;

/** Réinitialise le compteur de slots au début de chaque vague. */
export function resetSlotCounter() { _enemySpawnCounter = 0; }

/**
 * Les 4 slots d'attaque relatifs à l'orientation du joueur.
 *
 * FRONT  → chemin direct, attaque de face
 * LEFT   → parabole par la gauche du joueur
 * RIGHT  → parabole par la droite du joueur
 * BACK   → grand détour, attaque par derrière
 *
 * Chaque slot définit :
 *   attackAngle   : angle en radians dans le repère du joueur (0 = devant)
 *   waypointAngle : angle du waypoint intermédiaire dans le repère du joueur
 *   waypointDist  : distance du waypoint au joueur
 *   waypointDelay : le waypoint est visé tant que l'ennemi ne l'a pas atteint
 */
const SLOTS = [
    // FRONT — droit devant, pas de détour
    { id: "front", attackAngle: 0,           waypointAngle: null,  waypointDist: 0    },
    // LEFT — attaque par le côté gauche, passe d'abord sur la gauche du joueur
    { id: "left",  attackAngle: Math.PI/2,   waypointAngle: Math.PI,     waypointDist: 10   },
    // RIGHT — attaque par le côté droit, passe d'abord sur la droite du joueur
    { id: "right", attackAngle: -Math.PI/2,  waypointAngle: -Math.PI,    waypointDist: 10   },
    // BACK — grand détour, attaque par derrière
    { id: "back",  attackAngle: Math.PI,     waypointAngle: Math.PI*0.6, waypointDist: 16   },
];

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
        this._targetInterval    = 0.3;

        // Contact damage
        this._damageCooldown = 1.0;
        this._damageTimer    = 0;

        // Recul
        this._knockbackVel      = BABYLON.Vector3.Zero();
        this._knockbackDuration = 0;

        // ── Slot directionnel ─────────────────────────────────────────────────
        const idx        = _enemySpawnCounter++;
        this._slot       = SLOTS[idx % SLOTS.length];
        // Phase : "waypoint" → on vise d'abord le waypoint intermédiaire
        //         "attack"   → on vise le point d'attaque final
        this._phase      = this._slot.waypointDist > 0 ? "waypoint" : "attack";
        this._orbitAngle = 0; // dérive lente une fois en position

        // Config de la sous-classe (appelée APRÈS les inits ci-dessus)
        const cfg  = this._getConfig();
        this._cfg  = cfg;

        // Body
        this.body = BABYLON.MeshBuilder.CreateBox(
            cfg.bodyName,
            { width: cfg.bodySize.width, height: cfg.bodySize.height, depth: cfg.bodySize.depth },
            scene,
        );
        this.body.position  = new BABYLON.Vector3(position.x, position.y + cfg.halfHeight, position.z);
        this.body.ellipsoid = cfg.ellipsoid.clone();
        this.body.refreshBoundingInfo();
        this.body.checkCollisions = false;
        this.body.isPickable      = true;

        const bodyMat = new BABYLON.StandardMaterial(`bodyMat_${Math.random().toString(36).slice(2)}`, scene);
        bodyMat.diffuseColor = cfg.bodyColor;
        this.body.material   = bodyMat;

        // Point faible
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

    // ── Calcul des cibles ─────────────────────────────────────────────────────

    /**
     * Retourne la direction "avant" du joueur dans le plan XZ.
     * On utilise la rotation Y de la caméra.
     */
    _getPlayerForward() {
        const yaw = this.player.camera.rotation.y;
        return new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    }

    /**
     * Convertit un angle relatif au joueur (0 = devant) en position monde.
     * @param {BABYLON.Vector3} playerPos  position au sol du joueur
     * @param {number} relAngle            angle relatif à l'avant du joueur
     * @param {number} dist                distance au joueur
     */
    _relativePoint(playerPos, relAngle, dist) {
        const fwd   = this._getPlayerForward();
        const angle = Math.atan2(fwd.x, fwd.z) + relAngle;
        return new BABYLON.Vector3(
            playerPos.x + Math.sin(angle) * dist,
            playerPos.y,
            playerPos.z + Math.cos(angle) * dist,
        ).clone();
    }

    /**
     * Retourne la cible effective selon la phase courante.
     * - Phase "waypoint" : waypoint intermédiaire forcé par le slot
     * - Phase "attack"   : point d'attaque autour du joueur + légère dérive
     */
    _getTarget(playerPos, distFlat, dt) {
        const slot = this._slot;
        const R    = this._cfg.encircleRadius;

        if (this._phase === "waypoint") {

            // Waypoint intermédiaire dans le repère du joueur
            const wp = this._relativePoint(playerPos, slot.waypointAngle, slot.waypointDist);

            // Distance de l'ennemi au waypoint
            const pos    = this.body.position;
            const toWp   = Math.sqrt((pos.x - wp.x)**2 + (pos.z - wp.z)**2);

            // Une fois assez proche du waypoint, on passe en phase attaque
            if (toWp < 3.5) {
                this._phase = "attack";
            }
            return wp;
        }

        // Phase attaque : point autour du joueur à encircleRadius
        // Légère dérive angulaire pour que ça ne soit pas figé
        this._orbitAngle += this._cfg.angularDrift * dt;
        const fwd        = this._getPlayerForward();
        const baseAngle  = Math.atan2(fwd.x, fwd.z) + slot.attackAngle + this._orbitAngle;

        return new BABYLON.Vector3(
            playerPos.x + Math.sin(baseAngle) * R,
            playerPos.y,
            playerPos.z + Math.cos(baseAngle) * R,
        );
    }

    // ── Boucle principale ─────────────────────────────────────────────────────

    _update() {
        if (!this.player?.camera) return;
        if (this.body.isDisposed())  return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();

        const distFlat = Math.sqrt(
            (pos.x - playerPos.x) ** 2 + (pos.z - playerPos.z) ** 2,
        );

        // Timers
        if (this._damageTimer > 0)       this._damageTimer       -= dt;
        if (this._knockbackDuration > 0) this._knockbackDuration -= dt;

        // Contact damage
        const contactRadius = this._cfg.bodySize.width * 0.65 + 0.6;
        if (distFlat < contactRadius && this._damageTimer <= 0 && !this.player.isDead) {
            this._damageTimer = this._damageCooldown;
            if (this.player.health) this.player.health.takeDamage(1);
            this._applyKnockback(pos, playerPos);
        }

        // Phase de recul
        if (this._knockbackDuration > 0) {
            this.body.checkCollisions = true;
            this.body.moveWithCollisions(new BABYLON.Vector3(
                this._knockbackVel.x * dt,
                this.verticalVelocity * dt,
                this._knockbackVel.z * dt,
            ));
            this.body.checkCollisions = false;

            if (this._agentIdx !== null && this._navManager?.isReady) {
                const agentPos = this._navManager.getAgentPosition(this._agentIdx);
                if (agentPos) this.body.position.y = agentPos.y + this._cfg.halfHeight;
            }
            return;
        }

        // Calcul de la cible
        const target = this._getTarget(playerPos, distFlat, dt);

        // ── Mode Recast crowd ─────────────────────────────────────────────────
        if (this._agentIdx === null) this._tryRegisterAgent();

        if (this._agentIdx !== null && this._navManager?.isReady) {
            this._targetUpdateTimer -= dt;
            if (this._targetUpdateTimer <= 0) {
                this._navManager.setAgentTarget(this._agentIdx, target);
                this._targetUpdateTimer = this._targetInterval;
            }

            const agentPos = this._navManager.getAgentPosition(this._agentIdx);
            if (agentPos) this.body.position.y = agentPos.y + this._cfg.halfHeight;

            const vel = this._navManager.getAgentVelocity(this._agentIdx);
            if (vel && vel.length() > 0.1) {
                this.body.lookAt(new BABYLON.Vector3(pos.x + vel.x, pos.y, pos.z + vel.z));
            } else {
                this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
            }

        } else {
            // ── Mode fallback ─────────────────────────────────────────────────
            const toTarget  = new BABYLON.Vector3(target.x - pos.x, 0, target.z - pos.z);
            const targetDist = toTarget.length();
            let desiredDir   = targetDist > 0.01 ? toTarget.normalize() : BABYLON.Vector3.Zero();

            if (targetDist > 2) desiredDir = this._steerAroundWalls(pos, desiredDir);
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
                if (moved < 0.004 && targetDist > 3) { this._stuckTimer += dt; }
                else {
                    this._stuckTimer = Math.max(0, this._stuckTimer - dt * 2);
                    if (this._stuckTimer <= 0) this._stuckDir = null;
                }
                if (this._stuckTimer > 1.0 && targetDist > 2) {
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

            const speedScale = targetDist > 1.5 ? 1.0 : targetDist / 1.5;
            const hSpeed     = this.speed * climbBoost * speedScale;

            this.body.checkCollisions = true;
            this.body.moveWithCollisions(new BABYLON.Vector3(
                moveDir.x * hSpeed * dt,
                this.verticalVelocity * dt,
                moveDir.z * hSpeed * dt,
            ));
            this.body.checkCollisions = false;

            this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
        }
    }

    // ── Recul sécurisé ────────────────────────────────────────────────────────

    _applyKnockback(pos, playerPos) {
        const KNOCKBACK_SPEED    = this.speed * 3.5;
        const KNOCKBACK_DURATION = 0.35;
        const RAY_LEN            = 1.2;

        const away = new BABYLON.Vector3(pos.x - playerPos.x, 0, pos.z - playerPos.z);
        const candidates = [];
        if (away.length() > 0.01) {
            const base = away.normalize();
            candidates.push(base);
            candidates.push(new BABYLON.Vector3(-base.z,  0,  base.x));
            candidates.push(new BABYLON.Vector3( base.z,  0, -base.x));
            candidates.push(this._rotateY(base,  Math.PI / 4));
            candidates.push(this._rotateY(base, -Math.PI / 4));
        }

        let chosen   = BABYLON.Vector3.Zero();
        const origin = pos.clone();
        origin.y    += 0.5;

        for (const dir of candidates) {
            const hit = this.scene.pickWithRay(
                new BABYLON.Ray(origin, dir, RAY_LEN),
                m => m.checkCollisions && m !== this.body && m.name !== "weakPoint"
                    && !["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name),
            );
            if (!hit.hit) { chosen = dir.scale(KNOCKBACK_SPEED); break; }
            if (hit.distance > RAY_LEN * 0.4) {
                chosen = dir.scale(KNOCKBACK_SPEED * (hit.distance / RAY_LEN));
                break;
            }
        }

        this._knockbackVel      = chosen;
        this._knockbackDuration = KNOCKBACK_DURATION;
    }

    // ── Helpers de déplacement ────────────────────────────────────────────────

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
            if (!["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(mesh.name)) continue;
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
        const halfH  = this._cfg.halfHeight;
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