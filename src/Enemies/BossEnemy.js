import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy — "ARCHON-0"
 * ----------------------
 * Boss multi-phases inspiré des jeux AAA (Doom, Returnal, Hades).
 *
 * Phase 1 (100% → 60%) : charge directe, slam au sol
 * Phase 2 (60%  → 30%) : invoque des scouts, tire des orbes
 * Phase 3 (30%  → 0%)  : frenzy — tout en même temps, vitesse ×1.5
 *
 * Le boss expose :
 *   boss.onDeath   = () => {}
 *   boss.onPhase   = (phase) => {}
 */
export class BossEnemy {
    /**
     * @param {BABYLON.Scene} scene
     * @param {BABYLON.Vector3} position
     * @param {object} player
     * @param {object} [navManager]
     * @param {function} [onSummon]  callback pour invoquer des ennemis
     */
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene      = scene;
        this.player     = player;
        this._navManager = navManager;
        this._onSummon  = onSummon;

        // Callbacks externes
        this.onDeath = null;
        this.onPhase = null;
        this.onDamage = null;

        // Stats
        this.maxHealth     = 800;
        this.currentHealth = 800;
        this.speed         = 2.2;
        this.phase         = 1;
        this._dead         = false;
        this._invincible   = false;

        // Mouvement
        this._velocity     = BABYLON.Vector3.Zero();
        this._targetPos    = position.clone();
        this._moveTimer    = 0;
        this._attackCooldown = 0;
        this._summonCooldown = 0;

        // Phase transition
        this._phaseTransition = false;
        this._shieldActive    = false;
        this._shieldMesh      = null;

        // Orbes projetiles
        this._orbCooldown  = 0;
        this._slamCooldown = 0;

        this._buildMesh(position);
        this._spawnWarning(position);

        this._updateObs = this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── Construction ──────────────────────────────────────────────────────────

    _buildMesh(position) {
        // Corps principal — grand cube hexagonal (approximé par une boîte)
        const bodyMat = new BABYLON.StandardMaterial("bossMat", this.scene);
        bodyMat.diffuseColor  = new BABYLON.Color3(0.08, 0.0, 0.12);
        bodyMat.emissiveColor = new BABYLON.Color3(0.25, 0, 0.4);
        bodyMat.specularColor = new BABYLON.Color3(0.5, 0, 1);

        this.body = BABYLON.MeshBuilder.CreateBox("bossBody", { width: 3.5, height: 5.0, depth: 3.5 }, this.scene);
        this.body.position    = new BABYLON.Vector3(position.x, position.y + 2.5, position.z);
        this.body.material    = bodyMat;
        this.body.checkCollisions = false;
        this.body.isPickable      = true;
        this.body._isBossBody     = true;
        this.body._takeDamage     = (dmg) => this.takeDamage(dmg);

        // "Cristaux" orbitaux
        this._crystals = [];
        for (let i = 0; i < 4; i++) {
            const cMat = new BABYLON.StandardMaterial(`cMat_${i}`, this.scene);
            cMat.emissiveColor   = new BABYLON.Color3(0.6, 0, 1);
            cMat.disableLighting = true;

            const crystal = BABYLON.MeshBuilder.CreateBox(`bossCrystal_${i}`, { width: 0.6, height: 1.8, depth: 0.6 }, this.scene);
            crystal.material   = cMat;
            crystal.isPickable = false;
            crystal._baseAngle = (i / 4) * Math.PI * 2;
            this._crystals.push(crystal);
        }

        // Weak point (glowing core)
        const wpMat = new BABYLON.StandardMaterial("bossWpMat", this.scene);
        wpMat.emissiveColor   = new BABYLON.Color3(1, 0, 0.6);
        wpMat.disableLighting = true;

        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 0.85 }, this.scene);
        this.weakPoint.parent     = this.body;
        this.weakPoint.position.y = 0.8;
        this.weakPoint.material   = wpMat;
        this.weakPoint.isPickable = true;

        // Ellipsoïde de collision simplifié
        this.body.ellipsoid = new BABYLON.Vector3(1.75, 2.5, 1.75);

        // Aura
        this._auraT = 0;
        this._buildAura();
    }

    _buildAura() {
        const aura = new BABYLON.ParticleSystem("bossAura", 80, this.scene);
        aura.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", this.scene);
        aura.emitter         = this.body;
        aura.minEmitBox      = new BABYLON.Vector3(-1.5, -2, -1.5);
        aura.maxEmitBox      = new BABYLON.Vector3( 1.5,  2,  1.5);
        aura.color1          = new BABYLON.Color4(0.7, 0, 1, 0.6);
        aura.color2          = new BABYLON.Color4(0.4, 0, 0.6, 0.3);
        aura.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        aura.minSize         = 0.08;
        aura.maxSize         = 0.22;
        aura.minLifeTime     = 0.5;
        aura.maxLifeTime     = 1.2;
        aura.emitRate        = 55;
        aura.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        aura.direction1      = new BABYLON.Vector3(-1, 0.5, -1);
        aura.direction2      = new BABYLON.Vector3( 1, 2.5,  1);
        aura.minEmitPower    = 0.5;
        aura.maxEmitPower    = 2;
        aura.gravity         = new BABYLON.Vector3(0, -1, 0);
        aura.updateSpeed     = 0.025;
        aura.start();
        this._aura = aura;
    }

    _spawnWarning(pos) {
        // Pilier lumineux pré-spawn
        EnemyParticles.spawnWarning(this.scene, pos, new BABYLON.Color3(0.6, 0, 1), 2200);
    }

    // ── Boucle principale ─────────────────────────────────────────────────────

    _update() {
        if (this._dead || !this.player?.camera || this.body.isDisposed()) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();

        // Rotation crystaux orbitaux
        this._auraT += dt;
        this._updateCrystals(dt);
        this._animateBody(dt);

        // Cooldowns
        this._attackCooldown -= dt;
        this._summonCooldown -= dt;
        this._orbCooldown    -= dt;
        this._slamCooldown   -= dt;

        // Contact damage au joueur
        const dist = BABYLON.Vector3.Distance(pos, playerPos);
        if (dist < 3.5 && !this.player.isDead) {
            if (!this._contactCooldown || this._contactCooldown <= 0) {
                this.player.health?.takeDamage(1);
                this._contactCooldown = 1.2;
            }
        }
        if (this._contactCooldown > 0) this._contactCooldown -= dt;

        // Movement IA
        this._updateMovement(pos, playerPos, dt);

        // Attaques selon la phase
        this._updateAttacks(pos, playerPos, dt);
    }

    _updateCrystals(dt) {
        const pos = this.body.position;
        this._crystals.forEach((c, i) => {
            if (c.isDisposed()) return;
            const angle = c._baseAngle + this._auraT * (1.2 + i * 0.15);
            const r     = 2.8 + Math.sin(this._auraT * 2 + i) * 0.4;
            const yOff  = Math.sin(this._auraT * 1.5 + i * 0.8) * 0.6;
            c.position = new BABYLON.Vector3(
                pos.x + Math.cos(angle) * r,
                pos.y + yOff,
                pos.z + Math.sin(angle) * r,
            );
            c.rotation.y += dt * 2.5;
            c.rotation.z  = Math.sin(this._auraT * 3 + i) * 0.4;
        });
    }

    _animateBody(dt) {
        // Hover sinusoidal
        if (!this.body.isDisposed()) {
            this.body.position.y += Math.sin(this._auraT * 2.2) * dt * 0.3;
            // Pulse emissive
            const ph = (Math.sin(this._auraT * 3) + 1) / 2;
            const mul = this.phase === 3 ? 1.5 : 1;
            if (this.body.material) {
                this.body.material.emissiveColor = new BABYLON.Color3(
                    0.25 * mul + ph * 0.15,
                    0,
                    0.4 * mul + ph * 0.25,
                );
            }
        }
    }

    _updateMovement(pos, playerPos, dt) {
        // Déplacement vers le joueur avec strafing latéral
        const toPlayer = playerPos.subtract(pos);
        const flatDist  = Math.sqrt(toPlayer.x**2 + toPlayer.z**2);

        if (flatDist < 0.5) return;

        const desired   = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
        const lateral   = new BABYLON.Vector3(-desired.z, 0, desired.x);
        const strafeAmt = Math.sin(this._auraT * (this.phase === 3 ? 2.5 : 1.3)) * 0.5;

        const speed = this.speed * (this.phase === 3 ? 1.55 : 1);
        const move  = desired.add(lateral.scale(strafeAmt)).normalize().scale(speed * dt);

        // On garde une distance minimum de 4 unités
        if (flatDist > 4.5) {
            this.body.position.x += move.x;
            this.body.position.z += move.z;
        } else if (flatDist < 3.0) {
            this.body.position.x -= move.x * 0.5;
            this.body.position.z -= move.z * 0.5;
        }

        this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
    }

    _updateAttacks(pos, playerPos, dt) {
        const dist = BABYLON.Vector3.Distance(pos, playerPos);

        if (this.phase === 1) {
            // Slam de sol
            if (this._slamCooldown <= 0 && dist < 10) {
                this._slamAttack(pos);
                this._slamCooldown = 5;
            }

        } else if (this.phase === 2) {
            // Invocation de scouts
            if (this._summonCooldown <= 0) {
                this._summonMinions(pos);
                this._summonCooldown = 12;
            }
            // Orbes projetiles
            if (this._orbCooldown <= 0) {
                this._fireOrbs(pos, playerPos);
                this._orbCooldown = 2.5;
            }

        } else if (this.phase === 3) {
            // Tout en même temps + fréquence augmentée
            if (this._slamCooldown <= 0 && dist < 12) {
                this._slamAttack(pos);
                this._slamCooldown = 3;
            }
            if (this._summonCooldown <= 0) {
                this._summonMinions(pos);
                this._summonCooldown = 8;
            }
            if (this._orbCooldown <= 0) {
                this._fireOrbs(pos, playerPos, 8);
                this._orbCooldown = 1.4;
            }
        }
    }

    // ── Attaques ──────────────────────────────────────────────────────────────

    _slamAttack(pos) {
        // Onde de choc au sol autour du boss
        const SLAM_R = 6.5;
        const SLAM_DMG_R = 3.5;

        // Shockwave visuel
        const ring = BABYLON.MeshBuilder.CreateDisc("bossSlam", { radius: 0.1, tessellation: 40 }, this.scene);
        ring.position   = pos.clone();
        ring.position.y = 0.15;
        ring.rotation.x = Math.PI / 2;
        ring.isPickable = false;

        const mat = new BABYLON.StandardMaterial("slamMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(0.8, 0, 1);
        mat.backFaceCulling = false;
        mat.alpha           = 0.85;
        ring.material = mat;

        const start = Date.now();
        const dur   = 500;

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / dur, 1);
            ring.scaling = new BABYLON.Vector3(SLAM_R * t, SLAM_R * t, SLAM_R * t);
            mat.alpha    = 0.85 * (1 - t * 0.8);

            // Dégât au joueur si dans la zone
            if (t > 0.3 && t < 0.7) {
                const d = BABYLON.Vector3.Distance(this.player.camera.globalPosition, pos);
                if (d < SLAM_DMG_R && !this.player.isDead) {
                    this.player.health?.takeDamage(1);
                }
            }

            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(obs);
                ring.dispose();
            }
        });

        // Particules slam
        EnemyParticles.death(this.scene, pos, new BABYLON.Color3(0.6, 0, 1));
    }

    _fireOrbs(pos, playerPos, count = 4) {
        const dir    = playerPos.subtract(pos).normalize();
        const spread = Math.PI * 2 / count;

        for (let i = 0; i < count; i++) {
            const angle = i * spread + this._auraT * 0.5;
            let orbDir  = new BABYLON.Vector3(
                Math.cos(angle) * 0.6 + dir.x * 0.4,
                0,
                Math.sin(angle) * 0.6 + dir.z * 0.4,
            ).normalize();
            // Vise légèrement le joueur en phase 3
            if (this.phase === 3) {
                orbDir = BABYLON.Vector3.Lerp(orbDir, dir, 0.5).normalize();
            }
            this._spawnOrb(pos.clone().add(new BABYLON.Vector3(0, 1.5, 0)), orbDir);
        }
    }

    _spawnOrb(spawnPos, dir) {
        const orb = BABYLON.MeshBuilder.CreateSphere("bossOrb", { diameter: 0.35 }, this.scene);
        orb.position   = spawnPos;
        orb.isPickable = false;
        orb.alwaysSelectAsActiveMesh = true;

        const mat = new BABYLON.StandardMaterial("orbMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(1, 0, 0.8);
        mat.disableLighting = true;
        orb.material = mat;

        const speed = 8 + this.phase * 2;
        const spawn = Date.now();
        const scene = this.scene;
        let hit = false;

        const obs = scene.onBeforeRenderObservable.add(() => {
            if (hit || orb.isDisposed()) { scene.onBeforeRenderObservable.remove(obs); return; }
            const dt = scene.getEngine().getDeltaTime() / 1000;

            // Frappe le joueur ?
            const d = BABYLON.Vector3.Distance(orb.position, this.player.camera.globalPosition);
            if (d < 1.0 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                hit = true;
                scene.onBeforeRenderObservable.remove(obs);
                if (!orb.isDisposed()) orb.dispose();
                return;
            }

            orb.position.addInPlace(dir.scale(speed * dt));
            if (Date.now() - spawn > 4000) {
                scene.onBeforeRenderObservable.remove(obs);
                if (!orb.isDisposed()) orb.dispose();
            }
        });
    }

    _summonMinions(pos) {
        if (!this._onSummon) return;
        const count = this.phase === 3 ? 4 : 2;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const r     = 6;
            const sp    = new BABYLON.Vector3(
                pos.x + Math.cos(angle) * r,
                1.5,
                pos.z + Math.sin(angle) * r,
            );
            this._onSummon("scout", sp);
        }
        // VFX
        EnemyParticles.spawnWarning(this.scene, pos, new BABYLON.Color3(0, 0.95, 1), 800);
    }

    // ── Dégâts / Phase ───────────────────────────────────────────────────────

    takeDamage(amount) {
        if (this._dead || this._invincible || this.body.isDisposed()) return;

        this.currentHealth = Math.max(0, this.currentHealth - amount);

        // Flash rouge
        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
            setTimeout(() => {
                if (!this.body.isDisposed() && this.body.material)
                    this.body.material.emissiveColor = new BABYLON.Color3(0.25, 0, 0.4);
            }, 100);
        }

        if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);

        const pct = this.currentHealth / this.maxHealth;

        // Transition de phase
        if (this.phase === 1 && pct <= 0.60) {
            this._enterPhase(2);
        } else if (this.phase === 2 && pct <= 0.30) {
            this._enterPhase(3);
        }

        if (this.currentHealth <= 0) {
            this._die();
        }
    }

    _enterPhase(newPhase) {
        if (this._phaseTransition) return;
        this._phaseTransition = true;
        this.phase = newPhase;

        // Invincibilité temporaire + shield
        this._invincible = true;
        this._spawnPhaseShield();

        // VFX
        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(0.5, 0, 1));

        setTimeout(() => {
            this._removePhaseShield();
            this._invincible      = false;
            this._phaseTransition = false;
            if (this.onPhase) this.onPhase(newPhase);

            // Update couleur par phase
            if (!this.body.isDisposed() && this.body.material) {
                const colors = {
                    2: new BABYLON.Color3(0.6, 0.1, 0),
                    3: new BABYLON.Color3(1, 0, 0),
                };
                this.body.material.emissiveColor = colors[newPhase] ?? this.body.material.emissiveColor;
            }
            // Accélération crystaux en phase 3
            if (newPhase === 3) {
                this._crystals.forEach(c => { if (!c.isDisposed()) c.material.emissiveColor = new BABYLON.Color3(1, 0.3, 0); });
            }
        }, 2200);
    }

    _spawnPhaseShield() {
        const mat = new BABYLON.StandardMaterial("phaseShield", this.scene);
        mat.emissiveColor  = new BABYLON.Color3(0.5, 0, 1);
        mat.alpha          = 0.3;
        mat.backFaceCulling = false;
        mat.wireframe       = false;

        this._shieldMesh = BABYLON.MeshBuilder.CreateSphere("bossShield", { diameter: 8 }, this.scene);
        this._shieldMesh.parent    = this.body;
        this._shieldMesh.position  = BABYLON.Vector3.Zero();
        this._shieldMesh.material  = mat;
        this._shieldMesh.isPickable = false;
    }

    _removePhaseShield() {
        if (this._shieldMesh && !this._shieldMesh.isDisposed()) {
            this._shieldMesh.dispose();
            this._shieldMesh = null;
        }
    }

    _die() {
        if (this._dead) return;
        this._dead = true;

        this.scene.onBeforeRenderObservable.remove(this._updateObs);

        // Explosion de mort spectaculaire
        const pos = this.body.position.clone();
        for (let i = 0; i < 6; i++) {
            setTimeout(() => {
                const offset = new BABYLON.Vector3(
                    (Math.random() - 0.5) * 4,
                    Math.random() * 3,
                    (Math.random() - 0.5) * 4,
                );
                EnemyParticles.death(this.scene, pos.add(offset), new BABYLON.Color3(0.8, 0, 1));
            }, i * 200);
        }

        // Dispose meshes
        setTimeout(() => {
            this._crystals.forEach(c => { try { if (!c.isDisposed()) c.dispose(); } catch(_){} });
            this._aura?.stop();
            this._aura?.dispose();
            this._removePhaseShield();
            if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
            if (!this.body.isDisposed()) this.body.dispose();
        }, 1200);

        if (this.onDeath) this.onDeath();
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    dispose() {
        this._dead = true;
        try { this.scene.onBeforeRenderObservable.remove(this._updateObs); } catch(_) {}
        this._crystals.forEach(c => { try { if (!c.isDisposed()) c.dispose(); } catch(_){} });
        this._aura?.stop();
        this._aura?.dispose();
        this._removePhaseShield();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}
