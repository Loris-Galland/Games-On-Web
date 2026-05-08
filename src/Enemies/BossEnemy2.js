import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy2 — NEXUS
 * ------------------
 * Même design box que BossEnemy (couleur cyan).
 * Suit dynamiquement la hauteur du sol par raycast → s'adapte aux plateformes.
 *
 * 3 PHASES :
 *   Phase 1 — MINES    : pose 6 mines télééguidées autour du joueur
 *   Phase 2 — BARRAGE  : volée circulaire 12 proj + 3 ciblés, se déplace au sol
 *   Phase 3 — LASER TOURNANT : bras laser qui accélère progressivement
 *
 * TRANSITION (5s) : vulnérable, weakpoint visible, particules vertes
 */
export class BossEnemy2 {
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene     = scene;
        this.player    = player;
        this._onSummon = onSummon;

        this.onDeath  = null;
        this.onPhase  = null;
        this.onDamage = null;

        this.maxHealth     = 30;
        this.currentHealth = 30;
        this._dead         = false;
        this._dying        = false;

        this._stateLabel      = "transition";
        this._invincible      = true;
        this._phaseIndex      = 0;
        this._transitionTimer = 0;
        this._TRANSITION_DUR  = 5.0;
        this._nextPhase       = 1;

        this._t            = 0;
        this._contactTimer = 0;
        this._CONTACT_CD   = 1.0;
        this._wpPulseT     = 0;

        // Phase 1 — mines
        this._mineTimer  = 0;
        this._MINE_RATE  = 1.5;
        this._mineCount  = 0;
        this._MAX_MINES  = 6;

        // Phase 2 — barrage
        this._burstTimer   = 0;
        this._BURST_RATE   = 2.0;
        this._moveCooldown = 0;
        this._moveTarget   = null;

        // Phase 3 — laser tournant
        this._laserAngle  = 0;
        this._laserSpeed  = 0.7;
        this._laserMesh   = null;
        this._laserDamTmr = 0;
        this._LASER_LEN   = 16;

        this._groundY = position.y + 2.4;

        EnemyParticles.spawnWarning(scene, position, new BABYLON.Color3(0, 0.6, 1), 2000);
        this._buildMesh(position);
        this._buildWeakPoint();
        this._buildAuraSystem();
        this._introTimer = 3.0;
        this._inIntro    = true;
        this._obs = scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTION
    // ═══════════════════════════════════════════════════════════════════════════

    _buildMesh(position) {
        const uid = Math.random().toString(36).slice(2);
        const mat = new BABYLON.StandardMaterial(`nexusMat_${uid}`, this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.04, 0.12, 0.18);
        mat.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.5);
        mat.specularColor = new BABYLON.Color3(0.2, 0.5, 0.8);

        this.body = BABYLON.MeshBuilder.CreateBox("bossBody", {
            width: 3.3, height: 4.8, depth: 3.3,
        }, this.scene);
        this.body.position        = new BABYLON.Vector3(position.x, position.y + 2.4, position.z);
        this.body.material        = mat;
        this.body.checkCollisions = true;
        this.body.ellipsoid       = new BABYLON.Vector3(1.65, 2.4, 1.65);
        this.body.isPickable      = false;
        this.body._isBossBody     = true;
        this.body._takeDamage     = (dmg) => this.takeDamage(dmg);
        this._groundY = position.y + 2.4;
    }

    _buildWeakPoint() {
        const uid = Math.random().toString(36).slice(2);
        const mat = new BABYLON.StandardMaterial(`nexusWpMat_${uid}`, this.scene);
        mat.emissiveColor   = new BABYLON.Color3(1, 1, 1);
        mat.diffuseColor    = new BABYLON.Color3(0.5, 1, 1);
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
        const makePS = (name, count) => {
            const ps = new BABYLON.ParticleSystem(name, count, this.scene);
            ps.particleTexture = new BABYLON.Texture(tex, this.scene);
            ps.emitter = this.body;
            ps.minEmitBox = new BABYLON.Vector3(-1.5, -2, -1.5);
            ps.maxEmitBox = new BABYLON.Vector3(1.5, 2, 1.5);
            ps.minSize = 0.1; ps.maxSize = 0.3;
            ps.minLifeTime = 0.4; ps.maxLifeTime = 1.0;
            ps.emitRate = 60;
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            ps.direction1 = new BABYLON.Vector3(-1, 0.5, -1);
            ps.direction2 = new BABYLON.Vector3(1, 3, 1);
            ps.minEmitPower = 0.5; ps.maxEmitPower = 2;
            ps.gravity = new BABYLON.Vector3(0, -0.5, 0);
            ps.updateSpeed = 0.025;
            return ps;
        };
        this._phaseAura = makePS("nexusPhasePS", 80);
        this._setAuraColor(new BABYLON.Color4(0, 0.8, 1, 0.9));
        this._phaseAura.start();

        this._transAura = makePS("nexusTransPS", 200);
        this._transAura.emitRate = 160;
        this._transAura.color1   = new BABYLON.Color4(0, 1, 0.2, 1);
        this._transAura.color2   = new BABYLON.Color4(0.1, 1, 0.4, 1);
        this._transAura.colorDead = new BABYLON.Color4(0, 0.6, 0.1, 0);
        this._transAura.stop();
    }

    _setAuraColor(c4) {
        const c2 = c4.clone(); c2.a *= 0.5;
        this._phaseAura.color1    = c4;
        this._phaseAura.color2    = c2;
        this._phaseAura.colorDead = new BABYLON.Color4(c4.r * 0.1, c4.g * 0.1, c4.b * 0.1, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RAYCAST SOL DYNAMIQUE
    // ═══════════════════════════════════════════════════════════════════════════

    _updateGroundY() {
        if (!this.body || this.body.isDisposed()) return;
        const pos = this.body.position;
        const ray = new BABYLON.Ray(new BABYLON.Vector3(pos.x, pos.y, pos.z), new BABYLON.Vector3(0, -1, 0), 12);
        const hit = this.scene.pickWithRay(ray, m => m.checkCollisions && m !== this.body && m.name !== "weakPoint");
        if (hit.hit) this._groundY = hit.pickedPoint.y + 2.4;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOUCLE
    // ═══════════════════════════════════════════════════════════════════════════

    _update() {
        if (this._dead || !this.player?.camera) return;
        if (!this.body || this.body.isDisposed()) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();
        this._t += dt;
        this._updateGroundY();

        if (this._inIntro) {
            this._introTimer -= dt;
            this.body.position.y = this._groundY + Math.sin(this._t * 2) * 0.1;
            if (this._introTimer <= 0) { this._inIntro = false; this._enterPhase(1); }
            return;
        }

        if (!this._invincible) {
            if (this._contactTimer > 0) this._contactTimer -= dt;
            const dx = pos.x - playerPos.x, dz = pos.z - playerPos.z;
            if (Math.sqrt(dx*dx + dz*dz) < 2.5 && !this.player.isDead && this._contactTimer <= 0) {
                this.player.health?.takeDamage(1);
                this._contactTimer = this._CONTACT_CD;
            }
        }

        if (!this._invincible && this.weakPoint && !this.weakPoint.isDisposed()) {
            this._wpPulseT += dt;
            const sc = 1 + Math.sin(this._wpPulseT * 6) * 0.25;
            this.weakPoint.scaling = new BABYLON.Vector3(sc, sc, sc);
        }

        if      (this._stateLabel === "transition") this._updateTransition(dt, playerPos);
        else if (this._stateLabel === "phase1")     this._updatePhase1(dt, pos, playerPos);
        else if (this._stateLabel === "phase2")     this._updatePhase2(dt, pos, playerPos);
        else if (this._stateLabel === "phase3")     this._updatePhase3(dt, pos, playerPos);

        this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSITIONS / PHASES
    // ═══════════════════════════════════════════════════════════════════════════

    _enterTransition(nextPhase) {
        this._stateLabel      = "transition";
        this._invincible      = false;
        this._transitionTimer = this._TRANSITION_DUR;
        this._nextPhase       = nextPhase;
        this._destroyLaser();
        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible = true; this.weakPoint.isPickable = true;
        }
        this._phaseAura.stop(); this._transAura.start();
        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(0.0, 0.25, 0.05);
            this.body.material.diffuseColor  = new BABYLON.Color3(0.0, 0.2, 0.05);
        }
        this.body.position.y = this._groundY;
    }

    _updateTransition(dt) {
        this._transitionTimer -= dt;
        this.body.position.y = this._groundY + Math.sin(this._t * 3) * 0.15;
        if (this._transitionTimer <= 0) this._enterPhase(this._nextPhase);
    }

    _enterPhase(phaseNum) {
        this._stateLabel = `phase${phaseNum}`;
        this._phaseIndex = phaseNum;
        this._invincible = true;
        this._t          = 0;
        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible = false; this.weakPoint.isPickable = false;
        }
        this._transAura.stop(); this._phaseAura.start();

        if (phaseNum === 1) {
            this._setAuraColor(new BABYLON.Color4(0, 0.8, 1, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0, 0.4, 0.6);
            this._mineCount = 0; this._mineTimer = 0.8;
            this.body.position.y = this._groundY;
        } else if (phaseNum === 2) {
            this._setAuraColor(new BABYLON.Color4(1, 0.6, 0, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.5, 0.3, 0);
            this._burstTimer = 0.5; this._moveCooldown = 0; this._moveTarget = null;
            this.body.position.y = this._groundY;
        } else if (phaseNum === 3) {
            this._setAuraColor(new BABYLON.Color4(1, 0, 0.5, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.6, 0, 0.3);
            this._laserAngle = 0; this._laserSpeed = 0.7; this._laserDamTmr = 0;
            this.body.position.y = this._groundY;
            this._buildLaser();
        }
        if (this.onPhase) this.onPhase(phaseNum);
        const labels = ["", "NEXUS — PHASE I : MINES", "NEXUS — PHASE II : BARRAGE", "NEXUS — PHASE III : VORTEX"];
        this.player.hud?.showWaveMessage?.(labels[phaseNum] ?? "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1 — MINES
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase1(dt, pos, playerPos) {
        this.body.position.y = this._groundY + Math.sin(this._t * 2) * 0.1;
        this._mineTimer -= dt;
        if (this._mineTimer <= 0 && this._mineCount < this._MAX_MINES) {
            this._spawnMine(playerPos);
            this._mineCount++; this._mineTimer = this._MINE_RATE;
        }
        if (this._mineCount >= this._MAX_MINES && this._mineTimer < -1.0) this._enterTransition(2);
    }

    _spawnMine(playerPos) {
        const angle = Math.random() * Math.PI * 2;
        const r     = 2.5 + Math.random() * 5;
        const mx    = playerPos.x + Math.cos(angle) * r;
        const mz    = playerPos.z + Math.sin(angle) * r;
        const my    = this._groundY - 2.3;

        const indicator = BABYLON.MeshBuilder.CreateDisc("mineWarn", { radius: 2.0, tessellation: 32 }, this.scene);
        indicator.position = new BABYLON.Vector3(mx, my + 0.05, mz);
        indicator.rotation.x = Math.PI / 2; indicator.isPickable = false;
        const iMat = new BABYLON.StandardMaterial("mineWarnMat", this.scene);
        iMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1);
        iMat.backFaceCulling = false; iMat.alpha = 0.4;
        indicator.material = iMat;

        const mine = BABYLON.MeshBuilder.CreateSphere("mine", { diameter: 0.5 }, this.scene);
        mine.position = new BABYLON.Vector3(mx, my + 0.25, mz);
        mine.isPickable = false; mine.alwaysSelectAsActiveMesh = true;
        const mMat = new BABYLON.StandardMaterial("mineMat", this.scene);
        mMat.emissiveColor = new BABYLON.Color3(0, 0.6, 1); mine.material = mMat;

        let elapsed = 0;
        const FUSE = 2.0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (mine.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            elapsed += this.scene.getEngine().getDeltaTime() / 1000;
            const blink = Math.sin(elapsed * (5 + (elapsed / FUSE) * 15));
            mMat.emissiveColor = new BABYLON.Color3(0, 0.3 + 0.5 * Math.abs(blink), 1);
            iMat.alpha = 0.25 + 0.2 * Math.abs(blink);
            if (elapsed >= FUSE) {
                this.scene.onBeforeRenderObservable.remove(obs);
                if (!mine.isDisposed()) mine.dispose();
                if (!indicator.isDisposed()) indicator.dispose();
                this._explodeMine(new BABYLON.Vector3(mx, my, mz));
            }
        });
    }

    _explodeMine(center) {
        EnemyParticles.death(this.scene, new BABYLON.Vector3(center.x, center.y + 0.5, center.z), new BABYLON.Color3(0, 0.6, 1));
        const ring = BABYLON.MeshBuilder.CreateDisc("mineBlast", { radius: 0.1, tessellation: 32 }, this.scene);
        ring.position = new BABYLON.Vector3(center.x, center.y + 0.05, center.z);
        ring.rotation.x = Math.PI / 2; ring.isPickable = false;
        const rMat = new BABYLON.StandardMaterial("mineBlastMat", this.scene);
        rMat.emissiveColor = new BABYLON.Color3(0, 0.8, 1); rMat.backFaceCulling = false; rMat.alpha = 0.9;
        ring.material = rMat;
        const pPos = this.player.camera.globalPosition;
        if (Math.sqrt((center.x-pPos.x)**2 + (center.z-pPos.z)**2) < 2.5 && !this.player.isDead)
            this.player.health?.takeDamage(2);
        const start = Date.now();
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / 450, 1);
            ring.scaling = new BABYLON.Vector3(t * 5, t * 5, t * 5);
            rMat.alpha = 0.9 * (1 - t);
            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — BARRAGE CIRCULAIRE
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase2(dt, pos, playerPos) {
        this._moveCooldown -= dt;
        if (this._moveCooldown <= 0 || !this._moveTarget) {
            const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 8;
            this._moveTarget = new BABYLON.Vector3(playerPos.x + Math.cos(a)*r, this._groundY, playerPos.z + Math.sin(a)*r);
            this._moveCooldown = 1.5 + Math.random() * 1.5;
        }
        const toTarget = this._moveTarget.subtract(pos); toTarget.y = 0;
        if (toTarget.length() > 1.5) {
            const dir = toTarget.normalize();
            this.body.moveWithCollisions(new BABYLON.Vector3(dir.x * 5.0 * dt, 0, dir.z * 5.0 * dt));
        }
        this.body.position.y = this._groundY + Math.sin(this._t * 4) * 0.1;
        this._burstTimer -= dt;
        if (this._burstTimer <= 0) { this._fireBurst(pos, playerPos); this._burstTimer = this._BURST_RATE; }
        if (this._t >= 14.0) this._enterTransition(3);
    }

    _fireBurst(from, playerPos) {
        const N = 12;
        const origin = new BABYLON.Vector3(from.x, from.y + 0.5, from.z);
        for (let i = 0; i < N; i++) {
            const a = (i / N) * Math.PI * 2;
            this._fireBullet(origin, new BABYLON.Vector3(Math.cos(a), 0, Math.sin(a)), false);
        }
        const tp = playerPos.subtract(origin); tp.y = 0;
        if (tp.length() > 0.1) {
            tp.normalize();
            for (let i = -1; i <= 1; i++) {
                const s = i * 0.18;
                this._fireBullet(origin, new BABYLON.Vector3(tp.x*Math.cos(s)-tp.z*Math.sin(s), 0, tp.x*Math.sin(s)+tp.z*Math.cos(s)).normalize(), true);
            }
        }
    }

    _fireBullet(origin, dir, fast) {
        const bullet = BABYLON.MeshBuilder.CreateSphere("nexusBullet", { diameter: 0.22 }, this.scene);
        bullet.position = origin.clone(); bullet.isPickable = false; bullet.alwaysSelectAsActiveMesh = true;
        const mat = new BABYLON.StandardMaterial("nexusBulMat", this.scene);
        const col = fast ? new BABYLON.Color3(1, 0.8, 0) : new BABYLON.Color3(0, 0.8, 1);
        mat.diffuseColor = col; mat.emissiveColor = col; bullet.material = mat;
        const SPEED = fast ? 14 : 9, spawnTime = Date.now();
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (bullet.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2 = this.scene.getEngine().getDeltaTime() / 1000;
            const p = this.player.camera.globalPosition;
            const dx = bullet.position.x-p.x, dy = bullet.position.y-(p.y-1), dz = bullet.position.z-p.z;
            if (Math.sqrt(dx*dx+dy*dy+dz*dz) < 0.6 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                this.scene.onBeforeRenderObservable.remove(obs); bullet.dispose(); return;
            }
            bullet.position.addInPlace(dir.scale(SPEED * dt2));
            if (Date.now() - spawnTime > 4000) { this.scene.onBeforeRenderObservable.remove(obs); bullet.dispose(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3 — LASER TOURNANT
    // ═══════════════════════════════════════════════════════════════════════════

    _buildLaser() {
        this._laserMesh = BABYLON.MeshBuilder.CreateBox("nexusLaser", { width: this._LASER_LEN, height: 0.2, depth: 0.2 }, this.scene);
        this._laserMesh.isPickable = false; this._laserMesh.alwaysSelectAsActiveMesh = true;
        const mat = new BABYLON.StandardMaterial("nexusLaserMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(1, 0, 0.4);
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0.4); mat.alpha = 0.85;
        this._laserMesh.material = mat;
    }

    _destroyLaser() {
        if (this._laserMesh && !this._laserMesh.isDisposed()) this._laserMesh.dispose();
        this._laserMesh = null;
    }

    _updatePhase3(dt, pos) {
        this.body.position.y = this._groundY;
        this._laserAngle += this._laserSpeed * dt;
        this._laserSpeed = 0.7 + Math.min(this._t * 0.05, 1.5);
        if (this._laserMesh && !this._laserMesh.isDisposed()) {
            const half = this._LASER_LEN / 2;
            this._laserMesh.position = new BABYLON.Vector3(
                pos.x + Math.cos(this._laserAngle) * half, pos.y, pos.z + Math.sin(this._laserAngle) * half,
            );
            this._laserMesh.rotation.y = this._laserAngle;
            this._laserDamTmr -= dt;
            if (this._laserDamTmr <= 0) {
                const p = this.player.camera.globalPosition;
                const lx = Math.cos(this._laserAngle), lz = Math.sin(this._laserAngle);
                const dx = p.x - pos.x, dz = p.z - pos.z;
                const proj = dx*lx + dz*lz, perp = Math.abs(dx*(-lz) + dz*lx);
                if (proj >= -0.5 && proj <= this._LASER_LEN && perp < 0.85 && Math.abs(p.y - pos.y) < 2.5)
                    this.player.health?.takeDamage(1);
                this._laserDamTmr = 0.4;
            }
        }
        if (this._t >= 15.0) { this._destroyLaser(); this._enterTransition(1); }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DÉGÂTS / MORT
    // ═══════════════════════════════════════════════════════════════════════════

    takeDamage(amount) {
        if (this._dead || this._dying || this._invincible) return;
        if (!this.body || this.body.isDisposed()) return;
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        if (this.body.material) {
            const orig = this.body.material.emissiveColor.clone();
            this.body.material.emissiveColor = new BABYLON.Color3(1, 1, 1);
            setTimeout(() => { if (!this.body?.isDisposed() && this.body?.material) this.body.material.emissiveColor = orig; }, 100);
        }
        if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
        if (this.currentHealth <= 0) { this._dying = true; this._die(); }
    }

    _die() {
        if (this._dead) return;
        this._dead = true;
        this._destroyLaser();
        this.scene.onBeforeRenderObservable.remove(this._obs);
        this._phaseAura.stop(); this._transAura.stop();
        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(0, 0.8, 1));
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        setTimeout(() => { if (!this.body?.isDisposed()) this.body.dispose(); if (this.onDeath) this.onDeath(); }, 1200);
    }

    dispose() {
        this._dead = true;
        this._destroyLaser();
        try { this.scene.onBeforeRenderObservable.remove(this._obs); } catch(_){}
        this._phaseAura?.stop(); this._transAura?.stop();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}