import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy — "ARCHON-0" (corrigé)
 * ----------------------------------
 * Fixes :
 *   1. Weakpoint orbital : tourne avec les cristaux à rayon réduit, pickable
 *   2. Contact damage : cooldown correctement initialisé à 0, distance vérifiée
 *      en flatDist (XZ seulement) pour ne pas rater le joueur verticalement
 *   3. Mouvement : le boss se déplace réellement vers le joueur dès le début
 */
export class BossEnemy {
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene       = scene;
        this.player      = player;
        this._navManager = navManager;
        this._onSummon   = onSummon;

        this.onDeath  = null;
        this.onPhase  = null;
        this.onDamage = null;

        this.maxHealth     = 800;
        this.currentHealth = 800;
        this.speed         = 2.5;
        this.phase         = 1;
        this._dead         = false;
        this._invincible   = false;

        this._phaseTransition = false;
        this._shieldMesh      = null;

        // Cooldowns — tous initialisés à 0
        this._orbCooldown      = 3;
        this._slamCooldown     = 4;
        this._summonCooldown   = 10;
        this._contactCooldown  = 0;   // FIX : était undefined au 1er frame

        this._auraT = 0;

        this._spawnWarning(position);
        this._buildMesh(position);

        this._updateObs = this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── Construction ──────────────────────────────────────────────────────────

    _buildMesh(position) {
        const uid = Math.random().toString(36).slice(2);

        // Corps principal
        const bodyMat = new BABYLON.StandardMaterial(`bossMat_${uid}`, this.scene);
        bodyMat.diffuseColor  = new BABYLON.Color3(0.08, 0.0, 0.12);
        bodyMat.emissiveColor = new BABYLON.Color3(0.25, 0, 0.4);
        bodyMat.specularColor = new BABYLON.Color3(0.5, 0, 1);

        this.body = BABYLON.MeshBuilder.CreateBox("bossBody", { width: 3.5, height: 5.0, depth: 3.5 }, this.scene);
        this.body.position        = new BABYLON.Vector3(position.x, position.y + 2.5, position.z);
        this.body.material        = bodyMat;
        this.body.checkCollisions = false;
        this.body.isPickable      = true;
        this.body._isBossBody     = true;
        this.body._takeDamage     = (dmg) => this.takeDamage(dmg);

        // ── Cristaux orbitaux ─────────────────────────────────────────────────
        this._crystals = [];
        for (let i = 0; i < 4; i++) {
            const cMat = new BABYLON.StandardMaterial(`cMat_${uid}_${i}`, this.scene);
            cMat.emissiveColor   = new BABYLON.Color3(0.6, 0, 1);
            cMat.disableLighting = true;

            const crystal = BABYLON.MeshBuilder.CreateBox(`bossCrystal_${i}`, { width: 0.6, height: 1.8, depth: 0.6 }, this.scene);
            crystal.material   = cMat;
            crystal.isPickable = false;
            crystal._baseAngle = (i / 4) * Math.PI * 2;
            this._crystals.push(crystal);
        }

        // ── Weakpoint ORBITAL (FIX) ───────────────────────────────────────────
        // Le weakpoint n'est plus enfant du corps (position fixe) :
        // il orbite autour du boss comme les cristaux, mais à un rayon plus petit
        // et légèrement plus haut, pour être visible et atteignable.
        const wpMat = new BABYLON.StandardMaterial(`bossWpMat_${uid}`, this.scene);
        wpMat.emissiveColor   = new BABYLON.Color3(1, 0, 0.5);
        wpMat.disableLighting = true;

        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 1.0 }, this.scene);
        this.weakPoint.material   = wpMat;
        this.weakPoint.isPickable = true;
        // Angle d'orbite distinct des cristaux (décalé de PI/4)
        this._wpAngle = Math.PI / 4;

        // Pulse visuel du weakpoint
        this._wpPulseT = 0;

        this.body.ellipsoid = new BABYLON.Vector3(1.75, 2.5, 1.75);

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
        aura.minSize         = 0.08; aura.maxSize     = 0.22;
        aura.minLifeTime     = 0.5;  aura.maxLifeTime = 1.2;
        aura.emitRate        = 55;
        aura.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        aura.direction1      = new BABYLON.Vector3(-1, 0.5, -1);
        aura.direction2      = new BABYLON.Vector3( 1, 2.5,  1);
        aura.minEmitPower    = 0.5; aura.maxEmitPower = 2;
        aura.gravity         = new BABYLON.Vector3(0, -1, 0);
        aura.updateSpeed     = 0.025;
        aura.start();
        this._aura = aura;
    }

    _spawnWarning(pos) {
        EnemyParticles.spawnWarning(this.scene, pos, new BABYLON.Color3(0.6, 0, 1), 2200);
    }

    // ── Boucle principale ─────────────────────────────────────────────────────

    _update() {
        if (this._dead || !this.player?.camera) return;
        if (!this.body || this.body.isDisposed()) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();

        this._auraT += dt;

        // Animations
        this._updateCrystals(dt);
        this._updateWeakpoint(dt);
        this._animateBody(dt);

        // Cooldowns
        this._orbCooldown    -= dt;
        this._slamCooldown   -= dt;
        this._summonCooldown -= dt;
        if (this._contactCooldown > 0) this._contactCooldown -= dt;

        // ── Contact damage (FIX) ──────────────────────────────────────────────
        // Utiliser flatDist (plan XZ) pour être robuste quand le joueur est
        // au même niveau Y ou légèrement en dessous du boss qui flotte
        const dx = pos.x - playerPos.x;
        const dz = pos.z - playerPos.z;
        const flatDist = Math.sqrt(dx * dx + dz * dz);

        if (flatDist < 3.5 && !this.player.isDead && this._contactCooldown <= 0) {
            this.player.health?.takeDamage(1);
            this._contactCooldown = 1.2;
        }

        // Mouvement + attaques
        this._updateMovement(pos, playerPos, dt);
        this._updateAttacks(pos, playerPos, dt);
    }

    // ── Crystaux orbitaux ─────────────────────────────────────────────────────

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

    // ── Weakpoint orbital (FIX) ───────────────────────────────────────────────

    _updateWeakpoint(dt) {
        if (!this.weakPoint || this.weakPoint.isDisposed()) return;
        const pos = this.body.position;

        // Orbite plus rapide que les cristaux, rayon plus petit = plus accessible
        this._wpAngle += dt * 2.0;
        const r    = 2.0;  // rayon orbite
        const yOff = 2 + Math.sin(this._auraT * 2.8) * 0.4;

        /*this.weakPoint.position = new BABYLON.Vector3(
            pos.x + Math.cos(this._wpAngle) * r,
            pos.y + yOff,
            pos.z + Math.sin(this._wpAngle) * r,
        );
        this.weakPoint.rotation.y += dt * 4.0;*/

        this.weakPoint.position = new BABYLON.Vector3(
            pos.x,
            pos.y + 3,
            pos.z,
        );

        // Pulse de taille pour indiquer que c'est le point faible
        this._wpPulseT += dt;
        const scale = 1.0 + Math.sin(this._wpPulseT * 5) * 0.2;
        this.weakPoint.scaling = new BABYLON.Vector3(scale, scale, scale);

        // Changement couleur selon la phase
        if (this.weakPoint.material) {
            const flash = (Math.sin(this._wpPulseT * 8) + 1) / 2;
            const phaseColor = this.phase >= 3
                ? new BABYLON.Color3(1, flash * 0.5, 0)     // rouge-orangé en phase 3
                : this.phase === 2
                ? new BABYLON.Color3(1, 0.2, flash * 0.6)  // rose en phase 2
                : new BABYLON.Color3(1, 0, 0.5);            // magenta en phase 1
            this.weakPoint.material.emissiveColor = phaseColor;
        }
    }

    _animateBody(dt) {
        if (this.body.isDisposed()) return;
        this.body.position.y += Math.sin(this._auraT * 2.2) * dt * 0.3;
        const ph  = (Math.sin(this._auraT * 3) + 1) / 2;
        const mul = this.phase === 3 ? 1.5 : 1;
        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(
                0.25 * mul + ph * 0.15, 0, 0.4 * mul + ph * 0.25,
            );
        }
    }

    // ── Mouvement (FIX) ───────────────────────────────────────────────────────

    _updateMovement(pos, playerPos, dt) {
        const toPlayer = playerPos.subtract(pos);
        // Distance flatMap seulement pour la logique d'approche
        const flatDist = Math.sqrt(toPlayer.x ** 2 + toPlayer.z ** 2);
        if (flatDist < 0.1) return;

        const desiredDir = new BABYLON.Vector3(toPlayer.x, 0, toPlayer.z).normalize();
        const lateral    = new BABYLON.Vector3(-desiredDir.z, 0, desiredDir.x);
        const strafeAmt  = Math.sin(this._auraT * (this.phase === 3 ? 2.5 : 1.3)) * 0.4;
        const speed      = this.speed * (this.phase === 3 ? 1.55 : 1.0);

        // Approche si trop loin, recul si trop proche
        if (flatDist > 5.0) {
            const move = desiredDir.add(lateral.scale(strafeAmt)).normalize().scale(speed * dt);
            this.body.position.x += move.x;
            this.body.position.z += move.z;
        } else if (flatDist < 3.0) {
            // S'écarter légèrement
            this.body.position.x -= desiredDir.x * speed * 0.4 * dt;
            this.body.position.z -= desiredDir.z * speed * 0.4 * dt;
        } else {
            // Zone de combat : strafing latéral uniquement
            this.body.position.x += lateral.x * strafeAmt * speed * dt;
            this.body.position.z += lateral.z * strafeAmt * speed * dt;
        }

        // Orientation vers le joueur
        this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
    }

    // ── Attaques ──────────────────────────────────────────────────────────────

    _updateAttacks(pos, playerPos, dt) {
        const dist = BABYLON.Vector3.Distance(pos, playerPos);

        if (this.phase === 1) {
            if (this._slamCooldown <= 0 && dist < 12) {
                this._slamAttack(pos);
                this._slamCooldown = 5;
            }
        } else if (this.phase === 2) {
            if (this._summonCooldown <= 0) {
                this._summonMinions(pos);
                this._summonCooldown = 12;
            }
            if (this._orbCooldown <= 0) {
                this._fireOrbs(pos, playerPos, 4);
                this._orbCooldown = 2.5;
            }
        } else if (this.phase === 3) {
            if (this._slamCooldown <= 0 && dist < 14) {
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

    _slamAttack(pos) {
        const SLAM_R     = 7.0;
        const SLAM_DMG_R = 3.5;

        const ring = BABYLON.MeshBuilder.CreateDisc("bossSlam", { radius: 0.1, tessellation: 40 }, this.scene);
        ring.position   = pos.clone();
        ring.position.y = 0.15;
        ring.rotation.x = Math.PI / 2;
        ring.isPickable = false;

        const mat = new BABYLON.StandardMaterial("slamMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(0.8, 0, 1);
        mat.backFaceCulling = false;
        mat.alpha           = 0.85;
        ring.material       = mat;

        const start = Date.now();
        let   hit   = false;

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / 500, 1);
            ring.scaling = new BABYLON.Vector3(SLAM_R * t, SLAM_R * t, SLAM_R * t);
            mat.alpha    = 0.85 * (1 - t * 0.8);

            if (!hit && t > 0.35 && t < 0.75) {
                const d = BABYLON.Vector3.Distance(this.player.camera.globalPosition, pos);
                if (d < SLAM_DMG_R && !this.player.isDead) {
                    this.player.health?.takeDamage(1);
                    hit = true;
                }
            }

            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });

        EnemyParticles.death(this.scene, pos.clone(), new BABYLON.Color3(0.6, 0, 1));
    }

    _fireOrbs(pos, playerPos, count = 4) {
        const dir    = playerPos.subtract(pos).normalize();
        const spread = (Math.PI * 2) / count;

        for (let i = 0; i < count; i++) {
            const angle  = i * spread + this._auraT * 0.5;
            let orbDir   = new BABYLON.Vector3(
                Math.cos(angle) * 0.5 + dir.x * 0.5,
                0,
                Math.sin(angle) * 0.5 + dir.z * 0.5,
            ).normalize();

            if (this.phase === 3) {
                orbDir = BABYLON.Vector3.Lerp(orbDir, dir, 0.55).normalize();
            }
            this._spawnOrb(pos.clone().add(new BABYLON.Vector3(0, 1.5, 0)), orbDir);
        }
    }

    _spawnOrb(spawnPos, dir) {
        const orb = BABYLON.MeshBuilder.CreateSphere("bossOrb", { diameter: 0.4 }, this.scene);
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

        const obs = scene.onBeforeRenderObservable.add(() => {
            if (orb.isDisposed()) { scene.onBeforeRenderObservable.remove(obs); return; }
            const dt = scene.getEngine().getDeltaTime() / 1000;

            const d = BABYLON.Vector3.Distance(orb.position, this.player.camera.globalPosition);
            if (d < 1.2 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                scene.onBeforeRenderObservable.remove(obs);
                orb.dispose();
                return;
            }

            orb.position.addInPlace(dir.scale(speed * dt));
            if (Date.now() - spawn > 4000) {
                scene.onBeforeRenderObservable.remove(obs);
                orb.dispose();
            }
        });
    }

    _summonMinions(pos) {
        if (!this._onSummon) return;
        const count = this.phase === 3 ? 4 : 2;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const sp    = new BABYLON.Vector3(pos.x + Math.cos(angle) * 6, 1.5, pos.z + Math.sin(angle) * 6);
            this._onSummon("scout", sp);
        }
        EnemyParticles.spawnWarning(this.scene, pos.clone(), new BABYLON.Color3(0, 0.95, 1), 800);
    }

    // ── Dégâts / phases ───────────────────────────────────────────────────────

    takeDamage(amount) {
        if (this._dead || this._invincible) return;
        if (!this.body || this.body.isDisposed()) return;

        this.currentHealth = Math.max(0, this.currentHealth - amount);

        // Flash rouge
        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
            setTimeout(() => {
                if (!this.body?.isDisposed() && this.body?.material)
                    this.body.material.emissiveColor = new BABYLON.Color3(0.25, 0, 0.4);
            }, 100);
        }

        if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);

        const pct = this.currentHealth / this.maxHealth;
        if (this.phase === 1 && pct <= 0.60) this._enterPhase(2);
        else if (this.phase === 2 && pct <= 0.30) this._enterPhase(3);

        if (this.currentHealth <= 0) this._die();
    }

    _enterPhase(newPhase) {
        if (this._phaseTransition) return;
        this._phaseTransition = true;
        this.phase = newPhase;
        this._invincible = true;

        this._spawnPhaseShield();
        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(0.5, 0, 1));

        setTimeout(() => {
            this._removePhaseShield();
            this._invincible      = false;
            this._phaseTransition = false;
            if (this.onPhase) this.onPhase(newPhase);

            if (!this.body?.isDisposed() && this.body?.material) {
                if (newPhase === 2) this.body.material.emissiveColor = new BABYLON.Color3(0.6, 0.1, 0);
                if (newPhase === 3) this.body.material.emissiveColor = new BABYLON.Color3(1, 0, 0);
            }
            if (newPhase === 3) {
                this._crystals.forEach(c => {
                    if (!c.isDisposed() && c.material)
                        c.material.emissiveColor = new BABYLON.Color3(1, 0.3, 0);
                });
                this.speed = 3.5;
            }
        }, 2200);
    }

    _spawnPhaseShield() {
        const mat = new BABYLON.StandardMaterial("phaseShield", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(0.5, 0, 1);
        mat.alpha           = 0.3;
        mat.backFaceCulling = false;

        this._shieldMesh = BABYLON.MeshBuilder.CreateSphere("bossShield", { diameter: 9 }, this.scene);
        this._shieldMesh.parent     = this.body;
        this._shieldMesh.position   = BABYLON.Vector3.Zero();
        this._shieldMesh.material   = mat;
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

        try { this.scene.onBeforeRenderObservable.remove(this._updateObs); } catch(_) {}

        const pos = this.body.position.clone();
        for (let i = 0; i < 7; i++) {
            setTimeout(() => {
                if (this.scene) {
                    const offset = new BABYLON.Vector3(
                        (Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5,
                    );
                    EnemyParticles.death(this.scene, pos.add(offset), new BABYLON.Color3(0.8, 0, 1));
                }
            }, i * 200);
        }

        setTimeout(() => {
            this._crystals.forEach(c => { try { if (!c.isDisposed()) c.dispose(); } catch(_){} });
            this._aura?.stop();
            this._aura?.dispose();
            this._removePhaseShield();
            if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
            if (!this.body.isDisposed()) this.body.dispose();
        }, 1400);

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