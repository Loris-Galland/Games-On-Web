import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy2 — NEXUS
 * ------------------
 * Boss de cycle 2. Patterns orientés zone / AOE.
 *
 * 3 PHASES :
 *   Phase 1 — "MINES" : pose des mines au sol qui explosent après 2s
 *   Phase 2 — "BARRAGE" : volée de projectiles en cercle + déplacement
 *   Phase 3 — "LASER TOURNANT" : laser qui tourne lentement autour du boss
 *
 * TRANSITION (5s) : vulnérable, weakpoint visible, particules cyan
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
        this._mineTimer    = 0;
        this._MINE_RATE    = 1.8;
        this._mineCount    = 0;
        this._MAX_MINES    = 8;

        // Phase 2 — barrage circulaire
        this._burstTimer   = 0;
        this._BURST_RATE   = 2.2;
        this._burstBullets = 16; // nb de projectiles par volée
        this._moveCooldown = 0;
        this._moveTarget   = null;

        // Phase 3 — laser tournant
        this._laserAngle   = 0;
        this._laserSpeed   = 0.8; // rad/s
        this._laserMesh    = null;
        this._laserDamTmr  = 0;
        this._LASER_DAM_CD = 0.4;
        this._laserLen     = 18;

        // Spawn
        this._groundY = position.y;

        this._buildBody(position);
        this._buildWeakPoint();
        this._buildAuras();
        this._buildIntro();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTION
    // ═══════════════════════════════════════════════════════════════════════════

    _buildBody(position) {
        // Corps octaédrique cyan — positionné au sol comme BossEnemy original
        this.body = BABYLON.MeshBuilder.CreatePolyhedron("nexusBody", {
            type: 3, // octaèdre
            size: 1.4,
        }, this.scene);
        this.body.position   = new BABYLON.Vector3(position.x, position.y + 1.4, position.z);
        this.body.isPickable = false;
        this.body.checkCollisions = false;
        this.body.alwaysSelectAsActiveMesh = true;

        // CRITIQUE : requis par Projectile.js et PlayerShoot.js
        this.body._isBossBody = true;
        this.body._takeDamage = (dmg) => this.takeDamage(dmg);

        const mat = new BABYLON.StandardMaterial("nexusBodyMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.0, 0.4, 0.6);
        mat.emissiveColor = new BABYLON.Color3(0.0, 0.3, 0.5);
        mat.specularColor = new BABYLON.Color3(0.5, 0.8, 1.0);
        this.body.material = mat;

        this._groundY = position.y + 1.4; // Y de référence

        this._obs = this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    _buildWeakPoint() {
        // CRITIQUE : le nom DOIT être "weakPoint" — les raycasts filtrent par ce nom exact
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 1.0 }, this.scene);
        this.weakPoint.parent     = this.body;
        this.weakPoint.position   = new BABYLON.Vector3(0, 0, 0);
        this.weakPoint.isVisible  = false;
        this.weakPoint.isPickable = false;

        const mat = new BABYLON.StandardMaterial("nexusWPMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
        mat.emissiveColor = new BABYLON.Color3(0.5, 1, 1);
        mat.disableLighting = true;
        this.weakPoint.material = mat;
    }

    _buildAuras() {
        const makePS = (name) => {
            const ps = new BABYLON.ParticleSystem(name, 200, this.scene);
            ps.particleTexture  = new BABYLON.Texture("https://assets.babylonjs.com/particles/flare.png", this.scene);
            ps.emitter          = this.body;
            ps.minEmitBox       = new BABYLON.Vector3(-1, -1, -1);
            ps.maxEmitBox       = new BABYLON.Vector3(1, 1, 1);
            ps.minSize          = 0.12;
            ps.maxSize          = 0.35;
            ps.minLifeTime      = 0.3;
            ps.maxLifeTime      = 0.8;
            ps.emitRate         = 80;
            ps.minEmitPower     = 1;
            ps.maxEmitPower     = 3;
            ps.updateSpeed      = 0.02;
            return ps;
        };

        this._phaseAura = makePS("nexusPhasePS");
        this._phaseAura.color1    = new BABYLON.Color4(0, 0.8, 1, 0.9);
        this._phaseAura.color2    = new BABYLON.Color4(0, 0.4, 0.8, 0.5);
        this._phaseAura.colorDead = new BABYLON.Color4(0, 0, 0.1, 0);

        this._transAura = makePS("nexusTransPS");
        this._transAura.color1    = new BABYLON.Color4(0, 1, 0.5, 0.9);
        this._transAura.color2    = new BABYLON.Color4(0, 0.5, 0.3, 0.5);
        this._transAura.colorDead = new BABYLON.Color4(0, 0.05, 0, 0);
    }

    _buildIntro() {
        this._inIntro    = true;
        this._introTimer = 3.0;
        this._phaseAura.start();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BOUCLE PRINCIPALE
    // ═══════════════════════════════════════════════════════════════════════════

    _update() {
        if (this._dead || !this.player?.camera) return;
        if (!this.body || this.body.isDisposed()) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const pos       = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();

        this._t += dt;

        // Rotation permanente du corps
        this.body.rotation.y += dt * 0.6;
        this.body.rotation.x += dt * 0.3;

        // Intro
        if (this._inIntro) {
            this._introTimer -= dt;
            this.body.position.y = this._groundY + Math.sin(this._t * 2) * 0.15;
            if (this._introTimer <= 0) {
                this._inIntro = false;
                this._enterPhase(1);
            }
            return;
        }

        // Contact damage (transition uniquement)
        if (!this._invincible) {
            if (this._contactTimer > 0) this._contactTimer -= dt;
            const dx = pos.x - playerPos.x;
            const dz = pos.z - playerPos.z;
            if (Math.sqrt(dx * dx + dz * dz) < 2.5 && !this.player.isDead && this._contactTimer <= 0) {
                this.player.health?.takeDamage(1);
                this._contactTimer = this._CONTACT_CD;
            }
        }

        // Weakpoint pulse
        if (!this._invincible && this.weakPoint && !this.weakPoint.isDisposed()) {
            this._wpPulseT += dt;
            const sc = 1 + Math.sin(this._wpPulseT * 6) * 0.3;
            this.weakPoint.scaling = new BABYLON.Vector3(sc, sc, sc);
        }

        // Dispatch
        if      (this._stateLabel === "transition") this._updateTransition(dt, playerPos);
        else if (this._stateLabel === "phase1")     this._updatePhase1(dt, pos, playerPos);
        else if (this._stateLabel === "phase2")     this._updatePhase2(dt, pos, playerPos);
        else if (this._stateLabel === "phase3")     this._updatePhase3(dt, pos, playerPos);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TRANSITIONS / PHASES
    // ═══════════════════════════════════════════════════════════════════════════

    _enterTransition(nextPhase) {
        this._stateLabel      = "transition";
        this._invincible      = false;
        this._transitionTimer = this._TRANSITION_DUR;
        this._nextPhase       = nextPhase;

        // Détruire le laser s'il existe
        this._destroyRotatingLaser();

        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible  = true;
            this.weakPoint.isPickable = true;
        }
        this._phaseAura.stop();
        this._transAura.start();

        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(0.0, 0.4, 0.2);
            this.body.material.diffuseColor  = new BABYLON.Color3(0.0, 0.3, 0.15);
        }
        this.body.position.y = this._groundY; // au sol pendant la transition
    }

    _updateTransition(dt, playerPos) {
        this._transitionTimer -= dt;
        this.body.position.y = this._groundY + Math.sin(this._t * 3) * 0.2;
        if (this._transitionTimer <= 0) this._enterPhase(this._nextPhase);
    }

    _enterPhase(phaseNum) {
        this._stateLabel = `phase${phaseNum}`;
        this._phaseIndex = phaseNum;
        this._invincible = true;
        this._t          = 0;

        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible  = false;
            this.weakPoint.isPickable = false;
        }
        this._transAura.stop();
        this._phaseAura.start();

        if (phaseNum === 1) {
            this._setAuraColor(new BABYLON.Color4(0, 0.8, 1, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0, 0.5, 0.8);
            this.body.position.y = this._groundY;
            this._mineCount = 0;
            this._mineTimer = 0.5;
        } else if (phaseNum === 2) {
            this._setAuraColor(new BABYLON.Color4(1, 0.5, 0, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.6, 0.3, 0);
            this.body.position.y = this._groundY;
            this._burstTimer   = 0.5;
            this._moveCooldown = 0;
            this._moveTarget   = null;
        } else if (phaseNum === 3) {
            this._setAuraColor(new BABYLON.Color4(1, 0, 0.5, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.7, 0, 0.3);
            this.body.position.y = this._groundY + 1.5; // juste un peu en l'air pour le laser
            this._laserAngle = 0;
            this._buildRotatingLaser();
        }

        if (this.onPhase) this.onPhase(phaseNum);
        const labels = ["", "NEXUS — PHASE I : MINES", "NEXUS — PHASE II : BARRAGE", "NEXUS — PHASE III : VORTEX"];
    }

    _setAuraColor(color4) {
        const c2 = color4.clone(); c2.a *= 0.4;
        this._phaseAura.color1    = color4;
        this._phaseAura.color2    = c2;
        this._phaseAura.colorDead = new BABYLON.Color4(color4.r * 0.05, color4.g * 0.05, color4.b * 0.05, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1 — MINES
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase1(dt, pos, playerPos) {
        // Flotte autour de la position de départ
        this.body.position.y = this._groundY + 1.5 + Math.sin(this._t * 1.5) * 0.3;

        // Suit le joueur lentement
        const dx = playerPos.x - pos.x;
        const dz = playerPos.z - pos.z;
        const d  = Math.sqrt(dx * dx + dz * dz);
        if (d > 5) {
            this.body.position.x += (dx / d) * 2.5 * dt;
            this.body.position.z += (dz / d) * 2.5 * dt;
        }

        // Pose des mines
        this._mineTimer -= dt;
        if (this._mineTimer <= 0 && this._mineCount < this._MAX_MINES) {
            this._spawnMine(pos, playerPos);
            this._mineCount++;
            this._mineTimer = this._MINE_RATE;
        }

        // Fin de phase après MAX_MINES mines posées (et timer écoulé)
        if (this._mineCount >= this._MAX_MINES && this._mineTimer <= -1.0) {
            this._enterTransition(2);
        }
    }

    _spawnMine(bossPos, playerPos) {
        // Place une mine autour du joueur (rayon aléatoire)
        const angle  = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random() * 5;
        const mineX  = playerPos.x + Math.cos(angle) * radius;
        const mineZ  = playerPos.z + Math.sin(angle) * radius;

        // Indicateur visuel AVANT l'explosion (disque rouge au sol)
        const indicator = BABYLON.MeshBuilder.CreateDisc("mineIndicator", { radius: 2.2, tessellation: 32 }, this.scene);
        indicator.position   = new BABYLON.Vector3(mineX, this._groundY + 0.05, mineZ);
        indicator.rotation.x = Math.PI / 2;
        indicator.isPickable = false;

        const iMat = new BABYLON.StandardMaterial("mineIndMat", this.scene);
        iMat.emissiveColor   = new BABYLON.Color3(1, 0.1, 0.1);
        iMat.backFaceCulling = false;
        iMat.alpha           = 0.35;
        indicator.material   = iMat;

        // Mine physique (petite sphère)
        const mine = BABYLON.MeshBuilder.CreateSphere("mine", { diameter: 0.45 }, this.scene);
        mine.position   = new BABYLON.Vector3(mineX, this._groundY + 0.25, mineZ);
        mine.isPickable = false;

        const mMat = new BABYLON.StandardMaterial("mineMat", this.scene);
        mMat.diffuseColor  = new BABYLON.Color3(1, 0.1, 0.0);
        mMat.emissiveColor = new BABYLON.Color3(0.8, 0.05, 0);
        mine.material = mMat;

        // Clignotement et explosion après 2s
        let elapsed = 0;
        const FUSE  = 2.0;
        const obs   = this.scene.onBeforeRenderObservable.add(() => {
            if (mine.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2  = this.scene.getEngine().getDeltaTime() / 1000;
            elapsed   += dt2;
            const t    = elapsed / FUSE;
            // Clignotement accéléré
            mMat.emissiveColor = new BABYLON.Color3(
                0.8 + Math.sin(elapsed * (4 + t * 12)) * 0.2,
                0.05, 0,
            );
            iMat.alpha = 0.35 + Math.sin(elapsed * (4 + t * 12)) * 0.15;

            if (elapsed >= FUSE) {
                this.scene.onBeforeRenderObservable.remove(obs);
                mine.dispose();
                indicator.dispose();
                this._explodeMine(new BABYLON.Vector3(mineX, this._groundY, mineZ));
            }
        });
    }

    _explodeMine(center) {
        const BLAST_R = 2.5;

        // Cercle d'explosion visuel
        const ring = BABYLON.MeshBuilder.CreateDisc("mineBlast", { radius: 0.1, tessellation: 32 }, this.scene);
        ring.position   = new BABYLON.Vector3(center.x, center.y + 0.08, center.z);
        ring.rotation.x = Math.PI / 2;
        ring.isPickable = false;

        const rMat = new BABYLON.StandardMaterial("mineBlastMat", this.scene);
        rMat.emissiveColor   = new BABYLON.Color3(1, 0.3, 0);
        rMat.backFaceCulling = false;
        rMat.alpha           = 0.9;
        ring.material        = rMat;

        EnemyParticles.death(this.scene, new BABYLON.Vector3(center.x, center.y + 0.5, center.z), new BABYLON.Color3(1, 0.3, 0));

        // Dégâts joueur
        const playerPos = this.player.camera.globalPosition;
        const d = Math.sqrt(
            (center.x - playerPos.x) ** 2 + (center.z - playerPos.z) ** 2,
        );
        if (d < BLAST_R && !this.player.isDead) {
            this.player.health?.takeDamage(2);
        }

        // Animation expansion rapide
        const start = Date.now();
        const obs   = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / 400, 1);
            const r = t * BLAST_R * 2;
            ring.scaling = new BABYLON.Vector3(r, r, r);
            rMat.alpha   = 0.9 * (1 - t);
            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — BARRAGE CIRCULAIRE
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase2(dt, pos, playerPos) {
        // Déplacement latéral aléatoire
        this._moveCooldown -= dt;
        if (this._moveCooldown <= 0 || !this._moveTarget) {
            const angle  = Math.random() * Math.PI * 2;
            const radius = 6 + Math.random() * 8;
            this._moveTarget   = new BABYLON.Vector3(
                playerPos.x + Math.cos(angle) * radius,
                this._groundY + 1.5,
                playerPos.z + Math.sin(angle) * radius,
            );
            this._moveCooldown = 2.0 + Math.random() * 1.5;
        }

        const toTarget = this._moveTarget.subtract(pos);
        const dist     = toTarget.length();
        if (dist > 1.0) {
            const dir = toTarget.normalize();
            this.body.position.addInPlace(dir.scale(4.5 * dt));
        }
        this.body.position.y = this._groundY + 1.5 + Math.sin(this._t * 3) * 0.2;

        // Barrage circulaire
        this._burstTimer -= dt;
        if (this._burstTimer <= 0) {
            this._fireBurst(pos, playerPos);
            this._burstTimer = this._BURST_RATE;
        }

        if (this._t >= 14.0) this._enterTransition(3);
    }

    _fireBurst(from, playerPos) {
        // Volée de projectiles en cercle complet + quelques visant le joueur
        const n      = this._burstBullets;
        const origin = new BABYLON.Vector3(from.x, from.y, from.z);

        for (let i = 0; i < n; i++) {
            const angle = (i / n) * Math.PI * 2;
            const dir   = new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle));
            this._fireProjectile(origin, dir, new BABYLON.Color3(1, 0.5, 0));
        }

        // 3 tirs supplémentaires visant le joueur (spirale courte)
        const toPlayer = playerPos.subtract(origin).normalize();
        toPlayer.y = 0;
        for (let i = -1; i <= 1; i++) {
            const spread = i * 0.2;
            const d = new BABYLON.Vector3(
                toPlayer.x * Math.cos(spread) - toPlayer.z * Math.sin(spread),
                0,
                toPlayer.x * Math.sin(spread) + toPlayer.z * Math.cos(spread),
            ).normalize();
            this._fireProjectile(origin, d, new BABYLON.Color3(1, 0.8, 0));
        }
    }

    _fireProjectile(from, dir, color) {
        const bullet = BABYLON.MeshBuilder.CreateSphere("nexusBullet", { diameter: 0.22 }, this.scene);
        bullet.position   = from.clone();
        bullet.isPickable = false;
        bullet.alwaysSelectAsActiveMesh = true;

        const mat = new BABYLON.StandardMaterial("nexusBulMat", this.scene);
        mat.diffuseColor  = color;
        mat.emissiveColor = color;
        bullet.material   = mat;

        const SPEED    = 9.0;
        const spawnTime = Date.now();

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (bullet.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2 = this.scene.getEngine().getDeltaTime() / 1000;

            // Collision joueur
            const playerPos = this.player.camera.globalPosition;
            const dx = bullet.position.x - playerPos.x;
            const dy = bullet.position.y - (playerPos.y - 1.0);
            const dz = bullet.position.z - playerPos.z;
            if (Math.sqrt(dx*dx + dy*dy + dz*dz) < 0.6 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
                return;
            }

            bullet.position.addInPlace(dir.scale(SPEED * dt2));

            if (Date.now() - spawnTime > 4000) {
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3 — LASER TOURNANT
    // ═══════════════════════════════════════════════════════════════════════════

    _buildRotatingLaser() {
        // Représentation visuelle du laser : un cylindre aplati
        this._laserMesh = BABYLON.MeshBuilder.CreateBox("nexusLaser", {
            width: this._laserLen,
            height: 0.18,
            depth:  0.18,
        }, this.scene);
        this._laserMesh.isPickable = false;
        this._laserMesh.alwaysSelectAsActiveMesh = true;

        const mat = new BABYLON.StandardMaterial("nexusLaserMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(1, 0, 0.4);
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0.4);
        mat.alpha         = 0.85;
        this._laserMesh.material = mat;
    }

    _destroyRotatingLaser() {
        if (this._laserMesh && !this._laserMesh.isDisposed()) {
            this._laserMesh.dispose();
            this._laserMesh = null;
        }
    }

    _updatePhase3(dt, pos, playerPos) {
        // Flotte plus haut
        const targetY = this._groundY + 3.0;
        this.body.position.y += (targetY - this.body.position.y) * dt * 2;

        // Tourne le laser
        this._laserAngle += this._laserSpeed * dt;

        if (this._laserMesh && !this._laserMesh.isDisposed()) {
            // Positionner le laser centré sur le boss, décalé d'un demi laserLen
            const halfLen = this._laserLen / 2;
            const cx = pos.x + Math.cos(this._laserAngle) * halfLen;
            const cz = pos.z + Math.sin(this._laserAngle) * halfLen;
            this._laserMesh.position = new BABYLON.Vector3(cx, pos.y, cz);
            this._laserMesh.rotation.y = this._laserAngle;

            // Dégât si le joueur est dans le laser
            this._laserDamTmr -= dt;
            if (this._laserDamTmr <= 0) {
                if (this._isPlayerInRotatingLaser(pos, playerPos)) {
                    this.player.health?.takeDamage(1);
                }
                this._laserDamTmr = this._LASER_DAM_CD;
            }
        }

        // Accélère progressivement
        this._laserSpeed = 0.8 + Math.min(this._t * 0.04, 1.2);

        if (this._t >= 15.0) {
            this._destroyRotatingLaser();
            this._enterTransition(1);
        }
    }

    _isPlayerInRotatingLaser(bossPos, playerPos) {
        // Projection du joueur sur l'axe du laser
        const lx = Math.cos(this._laserAngle);
        const lz = Math.sin(this._laserAngle);
        const dx = playerPos.x - bossPos.x;
        const dz = playerPos.z - bossPos.z;
        const proj = dx * lx + dz * lz; // projection sur l'axe
        const perp = Math.abs(dx * (-lz) + dz * lx); // distance perpendiculaire
        const dy   = Math.abs(playerPos.y - bossPos.y);
        return proj >= -0.5 && proj <= this._laserLen && perp < 0.8 && dy < 2.0;
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
            setTimeout(() => {
                if (!this.body?.isDisposed() && this.body?.material)
                    this.body.material.emissiveColor = orig;
            }, 100);
        }

        if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);

        if (this.currentHealth <= 0) {
            this._dying = true;
            this._die();
        }
    }

    _die() {
        if (this._dead) return;
        this._dead = true;
        this._destroyRotatingLaser();

        this.scene.onBeforeRenderObservable.remove(this._obs);
        this._phaseAura.stop();
        this._transAura.stop();

        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(0, 0.8, 1));

        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();

        const startY = this.body.position.y;
        const start  = Date.now();
        const deathObs = this.scene.onBeforeRenderObservable.add(() => {
            if (this.body.isDisposed()) { this.scene.onBeforeRenderObservable.remove(deathObs); return; }
            const t = Math.min((Date.now() - start) / 1200, 1);
            this.body.scaling = new BABYLON.Vector3(1 - t, 1 - t, 1 - t);
            this.body.position.y = startY + t * 3;
            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(deathObs);
                this.body.dispose();
                if (this.onDeath) this.onDeath();
            }
        });
    }

    dispose() {
        this._dead = true;
        this._destroyRotatingLaser();
        try { this.scene.onBeforeRenderObservable.remove(this._obs); } catch(_){}
        this._phaseAura?.stop();
        this._transAura?.stop();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}