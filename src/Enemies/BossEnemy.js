import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy — ARCHON
 * ------------------
 * Basé sur la structure des mobs standards (HeavyEnemy), taille imposante.
 *
 * 3 PHASES DE COMBAT (invincible pendant chaque phase) :
 *   Phase 1 — "SAUT" : immobile puis saute 5× sur le joueur
 *   Phase 2 — "LASER" : tire des lasers hitscan, se déplace aléatoirement
 *   Phase 3 — "INVOCATION" : flotte en l'air, spawne des mobs en continu
 *
 * TRANSITION entre phases (5 sec) :
 *   - Plus invincible
 *   - Particules VERTES
 *   - Weakpoint visible et pickable
 *   - Contact damage actif
 *
 * Couleurs particules :
 *   Phase 1 → Rouge
 *   Phase 2 → Jaune
 *   Phase 3 → Violet
 *   Transition → Vert
 */
export class BossEnemy {
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene      = scene;
        this.player     = player;
        this._onSummon  = onSummon;

        this.onDeath  = null;
        this.onPhase  = null;
        this.onDamage = null;

        this.maxHealth     = 20;
        this.currentHealth = 20;
        this._dead         = false;
        this._dying        = false;

        this._stateLabel      = "transition";
        this._invincible      = true;
        this._phaseIndex      = 0;
        this._transitionTimer = 0;
        this._TRANSITION_DUR  = 5.0;


        this._t             = 0;
        this._contactTimer  = 0;
        this._CONTACT_CD    = 1.0;


        this._jumpCount    = 0;
        this._MAX_JUMPS    = 5;
        this._jumpState    = "idle";
        this._jumpTimer    = 0;
        this._jumpElapsed  = 0;
        this._jumpOrigin   = null;
        this._jumpTarget   = null;


        this._laserCooldown  = 0;
        this._LASER_RATE     = 1.8;
        this._moveCooldown   = 0;
        this._moveTarget     = null;

        this._minionWaveSpawned = false;
        this._minionWaveDone    = false;
        this._floatY            = 12;
        this._minionsSpawned = 0;

        EnemyParticles.spawnWarning(scene, position, new BABYLON.Color3(0.8, 0, 0), 2000);
        this._buildMesh(position);
        this._buildWeakPoint();
        this._buildAuraSystem();

        this._introTimer  = 3.0;
        this._inIntro     = true;

        this._updateObs = scene.onBeforeRenderObservable.add(() => this._update());
    }

    /**
     *
     * @param {BABYLON.Vector3}position
     */
    _buildMesh(position) {
        const uid = Math.random().toString(36).slice(2);

        // Corps — taille HeavyEnemy ×1.5
        const mat = new BABYLON.StandardMaterial(`bossMat_${uid}`, this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.12, 0.04, 0.18);
        mat.emissiveColor = new BABYLON.Color3(0.3, 0.0, 0.5);
        mat.specularColor = new BABYLON.Color3(0.2, 0, 0.4);

        this.body = BABYLON.MeshBuilder.CreateBox("bossBody", {
            width:  3.3,
            height: 4.8,
            depth:  3.3,
        }, this.scene);
        this.body.position        = new BABYLON.Vector3(position.x, position.y + 2.4, position.z);
        this.body.material        = mat;
        this.body.checkCollisions = true;
        this.body.isPickable      = false; // le weakpoint prend les hits
        this.body.ellipsoid       = new BABYLON.Vector3(1.6, 2.4, 1.6);
        this.body._isBossBody     = true;
        this.body._takeDamage     = (dmg) => this.takeDamage(dmg);

        this._groundY = position.y + 2.4; // Y de référence au sol
    }

    _buildWeakPoint() {
        const uid = Math.random().toString(36).slice(2);
        const mat = new BABYLON.StandardMaterial(`bossWpMat_${uid}`, this.scene);

        mat.emissiveColor   = new BABYLON.Color3(1, 1, 1);
        mat.diffuseColor    = new BABYLON.Color3(0.5, 1, 0.5);
        mat.disableLighting = true;

        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 1.2 }, this.scene);
        this.weakPoint.material   = mat;
        this.weakPoint.isPickable = false;
        this.weakPoint.isVisible  = false;
        this.weakPoint.parent     = this.body;

        this.weakPoint.position   = new BABYLON.Vector3(0, 0.8, 1.9);

        this._wpPulseT = 0;
    }

    _buildAuraSystem() {
        const tex = "https://assets.babylonjs.com/textures/flare.png";

        this._phaseAura = new BABYLON.ParticleSystem("bossPhaseAura", 80, this.scene);
        this._phaseAura.particleTexture = new BABYLON.Texture(tex, this.scene);
        this._phaseAura.emitter         = this.body;
        this._phaseAura.minEmitBox      = new BABYLON.Vector3(-1.5, -2, -1.5);
        this._phaseAura.maxEmitBox      = new BABYLON.Vector3( 1.5,  2,  1.5);
        this._phaseAura.minSize         = 0.1;
        this._phaseAura.maxSize         = 0.3;
        this._phaseAura.minLifeTime     = 0.4;
        this._phaseAura.maxLifeTime     = 1.0;
        this._phaseAura.emitRate        = 60;
        this._phaseAura.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this._phaseAura.direction1      = new BABYLON.Vector3(-1, 0.5, -1);
        this._phaseAura.direction2      = new BABYLON.Vector3( 1, 3,    1);
        this._phaseAura.minEmitPower    = 0.5;
        this._phaseAura.maxEmitPower    = 2;
        this._phaseAura.gravity         = new BABYLON.Vector3(0, -0.5, 0);
        this._phaseAura.updateSpeed     = 0.025;
        this._setAuraColor(new BABYLON.Color4(0.8, 0, 0, 0.8)); // rouge par défaut
        this._phaseAura.start();

        this._transAura = new BABYLON.ParticleSystem("bossTransAura", 200, this.scene);
        this._transAura.particleTexture = new BABYLON.Texture(tex, this.scene);
        this._transAura.emitter         = this.body;
        this._transAura.minEmitBox      = new BABYLON.Vector3(-1.6, -2.4, -1.6);
        this._transAura.maxEmitBox      = new BABYLON.Vector3( 1.6,  2.4,  1.6);
        this._transAura.color1          = new BABYLON.Color4(0, 1, 0.2, 1);
        this._transAura.color2          = new BABYLON.Color4(0.1, 1, 0.4, 1);
        this._transAura.colorDead       = new BABYLON.Color4(0, 0.6, 0.1, 0);
        this._transAura.minSize         = 0.2;
        this._transAura.maxSize         = 0.55;
        this._transAura.minLifeTime     = 0.5;
        this._transAura.maxLifeTime     = 1.4;
        this._transAura.emitRate        = 160;
        this._transAura.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this._transAura.direction1      = new BABYLON.Vector3(-2.5, 0.5, -2.5);
        this._transAura.direction2      = new BABYLON.Vector3( 2.5, 5,    2.5);
        this._transAura.minEmitPower    = 1.5;
        this._transAura.maxEmitPower    = 4;
        this._transAura.gravity         = new BABYLON.Vector3(0, -1, 0);
        this._transAura.updateSpeed     = 0.025;
        this._transAura.stop(); // inactif au début
    }

    /**
     * @param {Color4} color4
     */
    _setAuraColor(color4) {
        const c2 = color4.clone();
        c2.a *= 0.5;
        this._phaseAura.color1   = color4;
        this._phaseAura.color2   = c2;
        this._phaseAura.colorDead = new BABYLON.Color4(color4.r * 0.1, color4.g * 0.1, color4.b * 0.1, 0);
    }


    _update() {
        if (this._dead || !this.player?.camera) return;
        if (!this.body || this.body.isDisposed()) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();

        this._t += dt;

        if (this._inIntro) {
            this._introTimer -= dt;
            if (this._introTimer <= 0) {
                this._inIntro = false;
                this._enterPhase(1);
            }
            return;
        }

        if (!this._invincible) {
            if (this._contactTimer > 0) this._contactTimer -= dt;
            const dx = pos.x - playerPos.x;
            const dz = pos.z - playerPos.z;
            const flatDist = Math.sqrt(dx * dx + dz * dz);
            if (flatDist < 2.5 && !this.player.isDead && this._contactTimer <= 0) {
                this.player.health?.takeDamage(1);
                this._contactTimer = this._CONTACT_CD;
            }
        }

        if (!this._invincible && this.weakPoint && !this.weakPoint.isDisposed()) {
            this._wpPulseT += dt;
            const sc = 1 + Math.sin(this._wpPulseT * 6) * 0.25;
            this.weakPoint.scaling = new BABYLON.Vector3(sc, sc, sc);
        }

        if (this._stateLabel === "transition") {
            this._updateTransition(dt, playerPos);
        } else if (this._stateLabel === "phase1") {
            this._updatePhase1(dt, pos, playerPos);
        } else if (this._stateLabel === "phase2") {
            this._updatePhase2(dt, pos, playerPos);
        } else if (this._stateLabel === "phase3") {
            this._updatePhase3(dt, pos, playerPos);
        }

        if (this._stateLabel !== "phase3") {
            this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
        }
    }


    /**
     * @param {number} nextPhase
     */
    _enterTransition(nextPhase) {
        this._stateLabel      = "transition";
        this._invincible      = false;
        this._transitionTimer = this._TRANSITION_DUR;
        this._nextPhase       = nextPhase;

        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible  = true;
            this.weakPoint.isPickable = true;
        } else {
            console.warn(`[Boss._enterTransition] weakPoint is null or already disposed!`);
        }

        this._phaseAura.stop();
        this._transAura.start();

        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(0.0, 0.25, 0.05);
            this.body.material.diffuseColor  = new BABYLON.Color3(0.0, 0.2, 0.05);
        }

        this.body.position.y = this._groundY;
    }

    /**
     * @param {number} dt
     * @param {BABYLON.Vector3} playerPos
     */
    _updateTransition(dt, playerPos) {
        this._transitionTimer -= dt;

        this.body.position.y = this._groundY + Math.sin(this._t * 3) * 0.15;

        if (this._transitionTimer <= 0) {
            this._enterPhase(this._nextPhase);
        }
    }

    /**
     * @param {number} phaseNum
     */
    _enterPhase(phaseNum) {
        this._stateLabel = `phase${phaseNum}`;
        this._phaseIndex = phaseNum;
        this._invincible = true;
        this._t          = 0;

        // Cacher weakpoint
        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible  = false;
            this.weakPoint.isPickable = false;
        }

        // Particules transition OFF, phase ON
        this._transAura.stop();
        this._phaseAura.start();

        // Couleur et particules selon la phase
        if (phaseNum === 1) {
            // Rouge
            this._setAuraColor(new BABYLON.Color4(1, 0.05, 0.05, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.5, 0, 0);
            this._jumpCount = 0;
            this._jumpState = "idle";
            this._jumpTimer = 1.5; // délai avant premier saut
        } else if (phaseNum === 2) {
            // Jaune
            this._setAuraColor(new BABYLON.Color4(1, 0.9, 0, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.5, 0.45, 0);
            this._laserCooldown = 0.5;
            this._moveCooldown  = 0;
            this._moveTarget    = null;
            this.body.position.y = this._groundY;
        } else if (phaseNum === 3) {
            // Violet
            this._setAuraColor(new BABYLON.Color4(0.6, 0, 1, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.3, 0, 0.6);
            this._minionWaveSpawned   = false; // la vague n'a pas encore été lancée
            this._minionWaveDone      = false; // la vague n'est pas encore terminée
        }

        if (this.onPhase) this.onPhase(phaseNum);

        // Message HUD via callback
        const labels = ["", "PHASE I — IMPACT", "PHASE II — RAFALE", "PHASE III — INVOCATION"];
    }


    /**
     * @param {number} dt
     * @param {*} pos
     * @param {*} playerPos
     */
    _updatePhase1(dt, pos, playerPos) {
        if (this._jumpState === "idle") {

            this.body.position.y = this._groundY + Math.sin(this._t * 2) * 0.1;
            this._jumpTimer -= dt;
            if (this._jumpTimer <= 0) {
                this._initiateJump(pos, playerPos);
            }
            return;
        }

        if (this._jumpState === "charging") {

            this._jumpTimer -= dt;
            const chargeProgress = Math.max(0, 1 - this._jumpTimer / 0.3);
            this.body.position.y = this._groundY - 0.5 * chargeProgress;
            if (this._jumpTimer <= 0) {
                this._jumpState    = "jumping";
                this._jumpElapsed  = 0;
            }
            return;
        }

        if (this._jumpState === "jumping") {
            const JUMP_DUR = 0.7;
            this._jumpElapsed += dt;
            const t = Math.min(this._jumpElapsed / JUMP_DUR, 1);

            const orig = this._jumpOrigin;
            const targ = this._jumpTarget;

            this.body.position.x = orig.x + (targ.x - orig.x) * t;
            this.body.position.z = orig.z + (targ.z - orig.z) * t;

            const arcH = 8.0;
            this.body.position.y = this._groundY + arcH * Math.sin(t * Math.PI);

            if (t === 1) {
                this._jumpState = "landing";
                this._jumpTimer = 0.4;
                this._onJumpLand(targ);
            }
            return;
        }

        if (this._jumpState === "landing") {
            this._jumpTimer -= dt;
            this.body.position.y = this._groundY + Math.max(0, this._jumpTimer * 1.2);
            if (this._jumpTimer <= 0) {
                this._jumpCount++;
                this.body.position.y = this._groundY;

                if (this._jumpCount >= this._MAX_JUMPS) {
                    this._enterTransition(2);
                } else {
                    this._jumpState = "idle";
                    this._jumpTimer = 1.2;
                }
            }
        }
    }

    /**
     * @param {BABYLON.Vector3} pos
     * @param {BABYLON.Vector3} playerPos
     */
    _initiateJump(pos, playerPos) {
        this._jumpOrigin = pos.clone();
        const offset = new BABYLON.Vector3(
            (Math.random() - 0.5) * 1.5,
            0,
            (Math.random() - 0.5) * 1.5,
        );
        this._jumpTarget = new BABYLON.Vector3(
            playerPos.x + offset.x,
            this._groundY,
            playerPos.z + offset.z,
        );
        this._jumpState = "charging";
        this._jumpTimer = 0.3; // durée de la compression
    }

    /**
     * @param {BABYLON.Vector3} pos
     */
    _onJumpLand(pos) {
        // Onde de choc à l'atterrissage
        this._spawnShockwave(new BABYLON.Vector3(pos.x, this._groundY - 2.0, pos.z));

        // Dégâts si joueur proche
        const playerPos = this.player.camera.globalPosition;
        const dist = Math.sqrt(
            (pos.x - playerPos.x) ** 2 + (pos.z - playerPos.z) ** 2
        );
        if (dist < 4.0 && !this.player.isDead) {
            this.player.health?.takeDamage(1);
        }

        EnemyParticles.death(this.scene, new BABYLON.Vector3(pos.x, this._groundY, pos.z), new BABYLON.Color3(1, 0.1, 0));
    }

    /**
     * @param {BABYLON.Vector3} center
     */
    _spawnShockwave(center) {
        const ring = BABYLON.MeshBuilder.CreateDisc("bossShockwave", { radius: 0.2, tessellation: 32 }, this.scene);
        ring.position    = center.clone();
        ring.rotation.x  = Math.PI / 2;
        ring.isPickable  = false;

        const mat = new BABYLON.StandardMaterial("bossShockMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(1, 0.2, 0);
        mat.backFaceCulling = false;
        mat.alpha           = 0.8;
        ring.material       = mat;

        const start = Date.now();
        const obs   = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / 600, 1);
            const r = t * 7;
            ring.scaling = new BABYLON.Vector3(r, r, r);
            mat.alpha    = 0.8 * (1 - t);
            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });
    }

    /**
     * @param {number} dt
     * @param {BABYLON.Vector3} pos
     * @param {BABYLON.Vector3} playerPos
     */
    _updatePhase2(dt, pos, playerPos) {

        this._moveCooldown -= dt;
        if (this._moveCooldown <= 0 || !this._moveTarget) {
            const angle  = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 9;
            const center = playerPos;
            this._moveTarget = new BABYLON.Vector3(
                center.x + Math.cos(angle) * radius,
                this._groundY,
                center.z + Math.sin(angle) * radius,
            );
            this._moveCooldown = 1.5 + Math.random() * 1.5;
        }

        const toTarget = this._moveTarget.subtract(pos);
        toTarget.y = 0;
        const dist = toTarget.length();
        if (dist > 1.0) {
            const speed = 6.0;
            const dir   = toTarget.normalize();
            this.body.moveWithCollisions(new BABYLON.Vector3(dir.x * speed * dt, 0, dir.z * speed * dt));
        }
        this.body.position.y = this._groundY + Math.sin(this._t * 4) * 0.12;

        this._laserCooldown -= dt;
        if (this._laserCooldown <= 0) {
            this._fireLaser(pos, playerPos);
            this._laserCooldown = this._LASER_RATE;
        }

        if (this._t >= 12.0) {
            this._enterTransition(3);
        }
    }

    /**
     * @param {BABYLON.Vector3} from
     * @param {BABYLON.Vector3} playerPos
     */
    _fireLaser(from, playerPos) {
        const origin = new BABYLON.Vector3(from.x, from.y + 0.5, from.z);
        const dir    = playerPos.subtract(origin).normalize();

        const bullet = BABYLON.MeshBuilder.CreateCylinder("bossBullet", {
            height: 0.7, diameter: 0.18, tessellation: 8,
        }, this.scene);
        bullet.position   = origin.clone();
        bullet.isPickable = false;
        bullet.alwaysSelectAsActiveMesh = true;

        bullet.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionRH(
            dir, BABYLON.Vector3.Up(),
        );
        bullet.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);

        const mat = new BABYLON.StandardMaterial("bossBulletMat_" + Math.random().toString(36).slice(2), this.scene);
        mat.emissiveColor   = new BABYLON.Color3(1, 0.85, 0);
        mat.disableLighting = true;
        bullet.material     = mat;

        const tex   = "https://assets.babylonjs.com/textures/flare.png";
        const trail = new BABYLON.ParticleSystem("bossBulletTrail", 20, this.scene);
        trail.particleTexture = new BABYLON.Texture(tex, this.scene);
        trail.emitter         = bullet;
        trail.minEmitBox      = BABYLON.Vector3.Zero();
        trail.maxEmitBox      = BABYLON.Vector3.Zero();
        trail.color1          = new BABYLON.Color4(1, 0.9, 0, 0.8);
        trail.color2          = new BABYLON.Color4(1, 0.5, 0, 0.5);
        trail.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        trail.minSize         = 0.06;
        trail.maxSize         = 0.15;
        trail.minLifeTime     = 0.08;
        trail.maxLifeTime     = 0.2;
        trail.emitRate        = 40;
        trail.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        trail.direction1      = new BABYLON.Vector3(-0.3, -0.3, -1);
        trail.direction2      = new BABYLON.Vector3( 0.3,  0.3, -3);
        trail.minEmitPower    = 1;
        trail.maxEmitPower    = 3;
        trail.updateSpeed     = 0.025;
        trail.start();

        const SPEED     = 14; // lent et esquivable
        const spawnTime = Date.now();
        const scene     = this.scene;

        const obs = scene.onBeforeRenderObservable.add(() => {
            if (bullet.isDisposed()) {
                scene.onBeforeRenderObservable.remove(obs);
                return;
            }

            const dt = scene.getEngine().getDeltaTime() / 1000;

            const toCam = this.player.camera.globalPosition.subtract(bullet.position);
            if (toCam.length() < 1.0 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                trail.stop();
                scene.onBeforeRenderObservable.remove(obs);
                setTimeout(() => { trail.dispose(); if (!bullet.isDisposed()) bullet.dispose(); }, 300);
                return;
            }

            const ray = new BABYLON.Ray(bullet.position, dir, SPEED * dt * 1.5);
            const hit  = scene.pickWithRay(ray, m => m.checkCollisions && !m.name.startsWith("boss"));
            if (hit?.hit) {
                EnemyParticles.projectileImpact(scene, hit.pickedPoint ?? bullet.position.clone(), hit.getNormal(true) ?? BABYLON.Vector3.Up());
                trail.stop();
                scene.onBeforeRenderObservable.remove(obs);
                setTimeout(() => { trail.dispose(); if (!bullet.isDisposed()) bullet.dispose(); }, 300);
                return;
            }

            bullet.position.addInPlace(dir.scale(SPEED * dt));

            if (Date.now() - spawnTime > 4000) {
                trail.stop();
                scene.onBeforeRenderObservable.remove(obs);
                setTimeout(() => { trail.dispose(); if (!bullet.isDisposed()) bullet.dispose(); }, 300);
            }
        });
    }

    /**
     * @param {number} dt
     * @param {BABYLON.Vector3} pos
     * @param {BABYLON.Vector3} playerPos
     */
    _updatePhase3(dt, pos, playerPos) {
        // Flotte en l'air
        const targetY = this._groundY + this._floatY;
        this.body.position.y += (targetY - this.body.position.y) * dt * 2.0;
        this.body.position.y += Math.sin(this._t * 1.5) * 0.08;

        // Tourne lentement
        this.body.rotation.y += dt * 0.4;

        // Lancer la vague une seule fois, après 2 sec (le temps de monter)
        if (!this._minionWaveSpawned && this._t >= 2.0) {
            this._spawnMinionWave(playerPos);
            this._minionWaveSpawned = true;
        }

        // Une fois la vague lancée, attendre que tous les minions soient morts
        if (this._minionWaveSpawned && !this._minionWaveDone) {

            if (this._minionsSpawned < this._minionsToSpawn) return;

            const alive = this.scene.meshes.filter(m =>
                !m.isDisposed() &&
                (
                    m.name.startsWith("enemyBody") ||
                    m.name.startsWith("enemyBodyHeavy") ||
                    m.name.startsWith("enemyBodyScout")
                )
            ).length;

            if (alive === 0) {
                this._minionWaveDone = true;
                this._enterFinalTransition();
            }
        }
    }

    /**
     * @param {BABYLON.Vector3} center
     */
    _spawnMinionWave(center) {
        if (!this._onSummon) return;

        const composition = ["standard", "standard", "standard", "scout", "heavy"];
        this._minionsToSpawn = composition.length;

        composition.forEach((type, i) => {
            const angle = (i / composition.length) * Math.PI * 2;
            const r     = 7;
            const sp    = new BABYLON.Vector3(
                center.x + Math.cos(angle) * r,
                1.5,
                center.z + Math.sin(angle) * r,
            );
            EnemyParticles.spawnWarning(this.scene, sp, new BABYLON.Color3(0.5, 0, 1), 1800);
            setTimeout(() => {
                // Guard: ne pas spawner si le boss est déjà mort ou la scène détruite
                if (this._dead || !this.scene || this.body?.isDisposed()) return;
                this._onSummon(type, sp);
                this._minionsSpawned++;
            }, 1900);
        });
    }

    _enterFinalTransition() {
        const descObs = this.scene.onBeforeRenderObservable.add(() => {
            if (this._dead || this.body.isDisposed()) { this.scene.onBeforeRenderObservable.remove(descObs); return; }
            const dt2 = this.scene.getEngine().getDeltaTime() / 1000;
            this.body.position.y += (this._groundY - this.body.position.y) * dt2 * 3;
            if (Math.abs(this.body.position.y - this._groundY) < 0.1) {
                this.body.position.y = this._groundY;
                this.scene.onBeforeRenderObservable.remove(descObs);
            }
        });
        this._enterTransition(1);
    }

    /**
     * @param {number} amount
     */
    takeDamage(amount) {

        if (this._dead || this._dying) {
            return;
        }
        if (this._invincible) {
            return;
        }
        if (!this.body || this.body.isDisposed()) {
            return;
        }

        this.currentHealth = Math.max(0, this.currentHealth - amount);

        if (this.body.material) {
            const orig = this.body.material.emissiveColor.clone();
            this.body.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
            setTimeout(() => {
                if (!this.body?.isDisposed() && this.body?.material)
                    this.body.material.emissiveColor = orig;
            }, 100);
        }

        if (this.onDamage) {
            this.onDamage(this.currentHealth, this.maxHealth);
        } else {
            console.warn(`[Boss.takeDamage] onDamage is NULL — boss bar won't update`);
        }

        if (this.currentHealth <= 0) {
            this._dying = true;
            this._die();
        }
    }

    _die() {
        if (this._dead) return;
        this._dead = true;

        try { this.scene.onBeforeRenderObservable.remove(this._updateObs); } catch (_) {}

        const pos = this.body.position.clone();

        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                if (!this.scene) return;
                const offset = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 5,
                    Math.random() * 4,
                    (Math.random() - 0.5) * 5,
                );
                EnemyParticles.death(this.scene, pos.add(offset), new BABYLON.Color3(0.6, 0, 1));
            }, i * 180);
        }

        setTimeout(() => {
            this._phaseAura?.stop();
            this._phaseAura?.dispose();
            this._transAura?.stop();
            this._transAura?.dispose();
            if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
            if (this.body && !this.body.isDisposed()) this.body.dispose();
        }, 1500);

        if (this.onDeath) this.onDeath();
    }

    dispose() {
        this._dead = true;
        try { this.scene.onBeforeRenderObservable.remove(this._updateObs); } catch (_) {}
        this._phaseAura?.stop();
        this._phaseAura?.dispose();
        this._transAura?.stop();
        this._transAura?.dispose();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}