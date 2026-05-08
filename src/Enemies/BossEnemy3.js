import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

/**
 * BossEnemy3 — VOIDBRINGER
 * ------------------------
 * Boss final de cycle 3. Le plus intense. Patterns de zone très agressifs.
 *
 * 3 PHASES :
 *   Phase 1 — "TEMPÊTE" : pluie de projectiles qui tombent du ciel sur le joueur
 *   Phase 2 — "MUR" : 3 murs de balles qui traversent l'arène en alternance
 *   Phase 3 — "SINGULARITÉ" : zones de dégâts brûlantes pulsantes au sol (×5 zones)
 *             + tirs directs sur le joueur en continu
 *
 * TRANSITION (4s seulement, plus courte) : particules violettes, weakpoint visible
 */
export class BossEnemy3 {
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene     = scene;
        this.player    = player;
        this._onSummon = onSummon;

        this.onDeath  = null;
        this.onPhase  = null;
        this.onDamage = null;

        this.maxHealth     = 45;
        this.currentHealth = 45;
        this._dead         = false;
        this._dying        = false;

        this._stateLabel      = "transition";
        this._invincible      = true;
        this._phaseIndex      = 0;
        this._transitionTimer = 0;
        this._TRANSITION_DUR  = 4.0;
        this._nextPhase       = 1;

        this._t            = 0;
        this._contactTimer = 0;
        this._CONTACT_CD   = 1.0;
        this._wpPulseT     = 0;

        // Phase 1 — pluie céleste
        this._rainTimer    = 0;
        this._RAIN_RATE    = 0.35; // secondes entre chaque impact
        this._rainCount    = 0;
        this._MAX_RAIN     = 30;

        // Phase 2 — murs de balles
        this._wallTimer    = 0;
        this._WALL_RATE    = 3.5;
        this._wallCount    = 0;
        this._MAX_WALLS    = 5;

        // Phase 3 — singularités + tirs
        this._singZones    = [];   // { mesh, mat, x, z, timer }
        this._singSpawned  = false;
        this._directTimer  = 0;
        this._DIRECT_RATE  = 0.8;

        // Spawn
        this._groundY = position.y;
        this._arenaCenter = position.clone();

        this._buildBody(position);
        this._buildWeakPoint();
        this._buildAuras();
        this._buildIntro();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTION
    // ═══════════════════════════════════════════════════════════════════════════

    _buildBody(position) {
        this.body = BABYLON.MeshBuilder.CreatePolyhedron("voidBody", {
            type: 2, // icosaèdre
            size: 1.7,
        }, this.scene);
        this.body.position   = new BABYLON.Vector3(position.x, position.y + 1.7, position.z);
        this.body.isPickable = false;
        this.body.checkCollisions = false;
        this.body.alwaysSelectAsActiveMesh = true;

        // CRITIQUE : requis par Projectile.js et PlayerShoot.js
        this.body._isBossBody = true;
        this.body._takeDamage = (dmg) => this.takeDamage(dmg);

        const mat = new BABYLON.StandardMaterial("voidBodyMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.25, 0.0, 0.4);
        mat.emissiveColor = new BABYLON.Color3(0.4, 0.0, 0.6);
        mat.specularColor = new BABYLON.Color3(0.8, 0.4, 1.0);
        this.body.material = mat;

        this._groundY = position.y + 1.7; // Y de référence

        this._obs = this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    _buildWeakPoint() {
        // CRITIQUE : le nom DOIT être "weakPoint" — les raycasts filtrent par ce nom exact
        this.weakPoint = BABYLON.MeshBuilder.CreateIcoSphere("weakPoint", { radius: 0.6, subdivisions: 2 }, this.scene);
        this.weakPoint.parent     = this.body;
        this.weakPoint.position   = new BABYLON.Vector3(0, 0, 0);
        this.weakPoint.isVisible  = false;
        this.weakPoint.isPickable = false;

        const mat = new BABYLON.StandardMaterial("voidWPMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
        mat.emissiveColor = new BABYLON.Color3(1, 0.8, 1);
        mat.disableLighting = true;
        this.weakPoint.material = mat;
    }

    _buildAuras() {
        const makePS = (name, count) => {
            const ps = new BABYLON.ParticleSystem(name, count, this.scene);
            ps.particleTexture  = new BABYLON.Texture("https://assets.babylonjs.com/particles/flare.png", this.scene);
            ps.emitter          = this.body;
            ps.minEmitBox       = new BABYLON.Vector3(-1.5, -1.5, -1.5);
            ps.maxEmitBox       = new BABYLON.Vector3(1.5, 1.5, 1.5);
            ps.minSize          = 0.15;
            ps.maxSize          = 0.5;
            ps.minLifeTime      = 0.4;
            ps.maxLifeTime      = 1.0;
            ps.emitRate         = 100;
            ps.minEmitPower     = 1.5;
            ps.maxEmitPower     = 4;
            ps.updateSpeed      = 0.02;
            return ps;
        };

        this._phaseAura = makePS("voidPhasePS", 300);
        this._phaseAura.color1    = new BABYLON.Color4(0.6, 0, 1, 0.9);
        this._phaseAura.color2    = new BABYLON.Color4(0.3, 0, 0.6, 0.5);
        this._phaseAura.colorDead = new BABYLON.Color4(0.05, 0, 0.1, 0);

        this._transAura = makePS("voidTransPS", 150);
        this._transAura.color1    = new BABYLON.Color4(0.8, 0, 1, 0.9);
        this._transAura.color2    = new BABYLON.Color4(0.4, 0, 0.5, 0.5);
        this._transAura.colorDead = new BABYLON.Color4(0.05, 0, 0.05, 0);
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

        // Rotation lente permanente
        this.body.rotation.y += dt * 0.5;
        this.body.rotation.z += dt * 0.2;

        if (this._inIntro) {
            this._introTimer -= dt;
            this.body.position.y = this._groundY + Math.sin(this._t) * 0.3;
            if (this._introTimer <= 0) {
                this._inIntro = false;
                this._enterPhase(1);
            }
            return;
        }

        // Contact
        if (!this._invincible) {
            if (this._contactTimer > 0) this._contactTimer -= dt;
            const dx = pos.x - playerPos.x;
            const dz = pos.z - playerPos.z;
            if (Math.sqrt(dx*dx + dz*dz) < 2.5 && !this.player.isDead && this._contactTimer <= 0) {
                this.player.health?.takeDamage(1);
                this._contactTimer = this._CONTACT_CD;
            }
        }

        // Weakpoint pulse
        if (!this._invincible && this.weakPoint && !this.weakPoint.isDisposed()) {
            this._wpPulseT += dt;
            const sc = 1 + Math.sin(this._wpPulseT * 6) * 0.35;
            this.weakPoint.scaling = new BABYLON.Vector3(sc, sc, sc);
        }

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

        this._clearSingZones();

        if (this.weakPoint && !this.weakPoint.isDisposed()) {
            this.weakPoint.isVisible  = true;
            this.weakPoint.isPickable = true;
        }
        this._phaseAura.stop();
        this._transAura.start();

        if (this.body.material) {
            this.body.material.emissiveColor = new BABYLON.Color3(0.4, 0.0, 0.5);
            this.body.material.diffuseColor  = new BABYLON.Color3(0.2, 0.0, 0.3);
        }
    }

    _updateTransition(dt, playerPos) {
        this._transitionTimer -= dt;
        this.body.position.y += (this._groundY - this.body.position.y) * dt * 3;
        // Reste au-dessus du joueur
        this.body.position.x += (playerPos.x - this.body.position.x) * dt * 1.5;
        this.body.position.z += (playerPos.z - this.body.position.z) * dt * 1.5;
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
            this._setAuraColor(new BABYLON.Color4(0.6, 0, 1, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.4, 0, 0.7);
            this._rainCount = 0;
            this._rainTimer = 0.5;
        } else if (phaseNum === 2) {
            this._setAuraColor(new BABYLON.Color4(1, 0.3, 0, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.7, 0.2, 0);
            this._wallCount = 0;
            this._wallTimer = 1.0;
        } else if (phaseNum === 3) {
            this._setAuraColor(new BABYLON.Color4(1, 0, 0.8, 0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.8, 0, 0.5);
            this._singSpawned = false;
            this._directTimer = 0.5;
        }

        if (this.onPhase) this.onPhase(phaseNum);
    }

    _setAuraColor(color4) {
        const c2 = color4.clone(); c2.a *= 0.4;
        this._phaseAura.color1    = color4;
        this._phaseAura.color2    = c2;
        this._phaseAura.colorDead = new BABYLON.Color4(color4.r * 0.05, color4.g * 0.05, color4.b * 0.05, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1 — PLUIE CÉLESTE
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase1(dt, pos, playerPos) {
        // Flotte légèrement en orbite
        const targetY = this._groundY + 0.3;
        this.body.position.y += (targetY - this.body.position.y) * dt * 2;

        // Se déplace lentement en cercle
        const orbitR = 6;
        this.body.position.x = playerPos.x + Math.cos(this._t * 0.5) * orbitR;
        this.body.position.z = playerPos.z + Math.sin(this._t * 0.5) * orbitR;

        // Pluie de météores
        this._rainTimer -= dt;
        if (this._rainTimer <= 0 && this._rainCount < this._MAX_RAIN) {
            this._spawnRainStrike(playerPos);
            this._rainCount++;
            this._rainTimer = this._RAIN_RATE;
        }

        if (this._rainCount >= this._MAX_RAIN && this._rainTimer < -1.0) {
            this._enterTransition(2);
        }
    }

    _spawnRainStrike(playerPos) {
        // Choisit une position aléatoire proche du joueur
        const angle  = Math.random() * Math.PI * 2;
        const radius = Math.random() * 6;
        const tx     = playerPos.x + Math.cos(angle) * radius;
        const tz     = playerPos.z + Math.sin(angle) * radius;

        // Indicateur au sol (cercle rouge qui rétrécie = indicateur d'impact)
        const warn = BABYLON.MeshBuilder.CreateDisc("rainWarn", { radius: 1.5, tessellation: 24 }, this.scene);
        warn.position   = new BABYLON.Vector3(tx, this._groundY + 0.06, tz);
        warn.rotation.x = Math.PI / 2;
        warn.isPickable = false;

        const wMat = new BABYLON.StandardMaterial("rainWarnMat", this.scene);
        wMat.emissiveColor   = new BABYLON.Color3(0.8, 0, 1);
        wMat.backFaceCulling = false;
        wMat.alpha           = 0.55;
        warn.material = wMat;

        // Météore (sphère tombant du ciel)
        const meteor = BABYLON.MeshBuilder.CreateSphere("meteor", { diameter: 0.4 }, this.scene);
        meteor.position   = new BABYLON.Vector3(tx, this._groundY + 14, tz);
        meteor.isPickable = false;
        meteor.alwaysSelectAsActiveMesh = true;

        const mMat = new BABYLON.StandardMaterial("meteorMat", this.scene);
        mMat.diffuseColor  = new BABYLON.Color3(0.8, 0.2, 1);
        mMat.emissiveColor = new BABYLON.Color3(0.8, 0.2, 1);
        meteor.material    = mMat;

        const FALL_TIME = 0.7; // secondes avant impact
        let elapsed     = 0;

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (meteor.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2 = this.scene.getEngine().getDeltaTime() / 1000;
            elapsed  += dt2;
            const t   = Math.min(elapsed / FALL_TIME, 1);

            // Descente accélérée
            meteor.position.y = this._groundY + 14 * (1 - t * t);

            // Réduction de l'indicateur
            const sc = 1 - t * 0.5;
            warn.scaling = new BABYLON.Vector3(sc, sc, sc);
            wMat.alpha   = 0.55 * (1 - t * 0.3);

            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(obs);
                meteor.dispose();
                warn.dispose();
                this._meteorImpact(new BABYLON.Vector3(tx, this._groundY, tz));
            }
        });
    }

    _meteorImpact(center) {
        const BLAST_R = 2.0;

        EnemyParticles.death(this.scene, new BABYLON.Vector3(center.x, center.y + 0.5, center.z), new BABYLON.Color3(0.8, 0.2, 1));

        // Onde d'impact
        const ring = BABYLON.MeshBuilder.CreateDisc("meteorBlast", { radius: 0.1, tessellation: 32 }, this.scene);
        ring.position   = new BABYLON.Vector3(center.x, center.y + 0.08, center.z);
        ring.rotation.x = Math.PI / 2;
        ring.isPickable = false;

        const rMat = new BABYLON.StandardMaterial("meteorBlastMat", this.scene);
        rMat.emissiveColor   = new BABYLON.Color3(0.8, 0.2, 1);
        rMat.backFaceCulling = false;
        rMat.alpha           = 0.9;
        ring.material        = rMat;

        // Dégâts joueur
        const pPos = this.player.camera.globalPosition;
        const d = Math.sqrt((center.x - pPos.x)**2 + (center.z - pPos.z)**2);
        if (d < BLAST_R && !this.player.isDead) this.player.health?.takeDamage(2);

        const start = Date.now();
        const obs   = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now() - start) / 350, 1);
            const r = t * BLAST_R * 2;
            ring.scaling = new BABYLON.Vector3(r, r, r);
            rMat.alpha   = 0.9 * (1 - t);
            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2 — MUR DE BALLES
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase2(dt, pos, playerPos) {
        // Reste au sol
        const targetY = this._groundY;
        this.body.position.y += (targetY - this.body.position.y) * dt * 2;

        // Reste au-dessus du centre
        this.body.position.x += (this._arenaCenter.x - this.body.position.x) * dt * 1.5;
        this.body.position.z += (this._arenaCenter.z - this.body.position.z) * dt * 1.5;

        // Lance un mur toutes les X secondes
        this._wallTimer -= dt;
        if (this._wallTimer <= 0 && this._wallCount < this._MAX_WALLS) {
            this._spawnBulletWall(pos, playerPos);
            this._wallCount++;
            this._wallTimer = this._WALL_RATE;
        }

        if (this._wallCount >= this._MAX_WALLS && this._wallTimer < -1.5) {
            this._enterTransition(3);
        }
    }

    _spawnBulletWall(bossPos, playerPos) {
        // Direction du mur : perpendiculaire à la direction vers le joueur
        const toPlayer = playerPos.subtract(bossPos);
        toPlayer.y = 0;
        toPlayer.normalize();

        // Perpendiculaire
        const perp = new BABYLON.Vector3(-toPlayer.z, 0, toPlayer.x);

        // Centre du mur : position du joueur
        const wallCenter = new BABYLON.Vector3(playerPos.x, this._groundY + 1.0, playerPos.z);

        const N    = 9;   // nb de projectiles dans le mur
        const SPAN = 12;  // largeur du mur en unités

        for (let i = 0; i < N; i++) {
            const t      = (i / (N - 1)) - 0.5; // -0.5 à 0.5
            const offset = perp.scale(t * SPAN);
            const origin = wallCenter.add(offset);
            // Direction : vers le joueur + légère variation
            const dir = toPlayer.clone();

            // Délai léger par position (vague)
            const delay = Math.abs(t) * 150;
            setTimeout(() => {
                if (!this.scene || this._dead) return;
                this._fireWallProjectile(origin, dir);
            }, delay);
        }

        // Indicateur ligne au sol (avertissement)
        this._spawnWallIndicator(playerPos, perp);
    }

    _spawnWallIndicator(playerPos, perp) {
        const N = 9, SPAN = 12;
        const indicators = [];

        for (let i = 0; i < N; i++) {
            const t      = (i / (N - 1)) - 0.5;
            const offset = perp.scale(t * SPAN);
            const ind    = BABYLON.MeshBuilder.CreateDisc("wallInd", { radius: 0.6, tessellation: 16 }, this.scene);
            ind.position   = new BABYLON.Vector3(playerPos.x + offset.x, this._groundY + 0.06, playerPos.z + offset.z);
            ind.rotation.x = Math.PI / 2;
            ind.isPickable = false;

            const mat = new BABYLON.StandardMaterial("wallIndMat", this.scene);
            mat.emissiveColor   = new BABYLON.Color3(1, 0.4, 0);
            mat.backFaceCulling = false;
            mat.alpha           = 0.5;
            ind.material = mat;
            indicators.push(ind);
        }

        // Disparaît après 0.5s (avant l'impact)
        setTimeout(() => {
            indicators.forEach(ind => { if (!ind.isDisposed()) ind.dispose(); });
        }, 450);
    }

    _fireWallProjectile(origin, dir) {
        const bullet = BABYLON.MeshBuilder.CreateCylinder("voidWallBullet", {
            height: 0.6, diameter: 0.28, tessellation: 8,
        }, this.scene);
        bullet.position   = origin.clone();
        bullet.isPickable = false;
        bullet.alwaysSelectAsActiveMesh = true;

        try {
            bullet.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionRH(
                dir, BABYLON.Vector3.Up(),
            );
            bullet.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);
        } catch(_){}

        const mat = new BABYLON.StandardMaterial("voidWallBulMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(1, 0.4, 0);
        mat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
        bullet.material   = mat;

        const SPEED    = 11.0;
        const spawnTime = Date.now();

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (bullet.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2 = this.scene.getEngine().getDeltaTime() / 1000;

            const pPos = this.player.camera.globalPosition;
            const dx = bullet.position.x - pPos.x;
            const dy = bullet.position.y - (pPos.y - 1.0);
            const dz = bullet.position.z - pPos.z;
            if (Math.sqrt(dx*dx + dy*dy + dz*dz) < 0.65 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
                return;
            }

            bullet.position.addInPlace(dir.scale(SPEED * dt2));

            if (Date.now() - spawnTime > 3500) {
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3 — SINGULARITÉS + TIRS DIRECTS
    // ═══════════════════════════════════════════════════════════════════════════

    _updatePhase3(dt, pos, playerPos) {
        const targetY = this._groundY + 1.0;
        this.body.position.y += (targetY - this.body.position.y) * dt * 2;
        // Reste centré
        this.body.position.x += (this._arenaCenter.x - this.body.position.x) * dt;
        this.body.position.z += (this._arenaCenter.z - this.body.position.z) * dt;

        // Spawn zones une fois
        if (!this._singSpawned) {
            this._spawnSingularities(playerPos);
            this._singSpawned = true;
        }

        // Mise à jour des zones (pulsation + dégâts)
        this._updateSingZones(dt, playerPos);

        // Tirs directs sur le joueur
        this._directTimer -= dt;
        if (this._directTimer <= 0) {
            this._fireDirectShot(pos, playerPos);
            this._directTimer = this._DIRECT_RATE;
        }

        // Phase infinie jusqu'à la mort
    }

    _spawnSingularities(playerPos) {
        const N = 5;
        for (let i = 0; i < N; i++) {
            const angle  = (i / N) * Math.PI * 2;
            const radius = 6 + Math.random() * 4;
            const sx     = playerPos.x + Math.cos(angle) * radius;
            const sz     = playerPos.z + Math.sin(angle) * radius;

            const zone = BABYLON.MeshBuilder.CreateDisc("singZone", { radius: 2.5, tessellation: 32 }, this.scene);
            zone.position   = new BABYLON.Vector3(sx, this._groundY + 0.07, sz);
            zone.rotation.x = Math.PI / 2;
            zone.isPickable = false;

            const mat = new BABYLON.StandardMaterial("singZoneMat", this.scene);
            mat.emissiveColor   = new BABYLON.Color3(1, 0, 0.6);
            mat.backFaceCulling = false;
            mat.alpha           = 0.45;
            zone.material = mat;

            this._singZones.push({ mesh: zone, mat, damTimer: 0, pulseT: Math.random() * Math.PI * 2 });
        }
    }

    _updateSingZones(dt, playerPos) {
        for (const z of this._singZones) {
            if (!z.mesh || z.mesh.isDisposed()) continue;

            z.pulseT += dt * 3;
            const pulse = 0.3 + Math.sin(z.pulseT) * 0.25;
            z.mat.alpha           = 0.2 + Math.abs(Math.sin(z.pulseT)) * 0.5;
            z.mat.emissiveColor   = new BABYLON.Color3(1, pulse * 0.2, 0.6);

            // Agrandissement progressif
            const sc = 1 + Math.min(this._t * 0.015, 0.8);
            z.mesh.scaling = new BABYLON.Vector3(sc, sc, sc);

            // Dégâts si joueur dessus
            z.damTimer -= dt;
            if (z.damTimer <= 0) {
                const dx = z.mesh.position.x - playerPos.x;
                const dz = z.mesh.position.z - playerPos.z;
                if (Math.sqrt(dx*dx + dz*dz) < 2.5 * sc && !this.player.isDead) {
                    this.player.health?.takeDamage(1);
                }
                z.damTimer = 0.6;
            }
        }
    }

    _clearSingZones() {
        for (const z of this._singZones) {
            if (z.mesh && !z.mesh.isDisposed()) z.mesh.dispose();
        }
        this._singZones = [];
    }

    _fireDirectShot(from, playerPos) {
        const origin = new BABYLON.Vector3(from.x, from.y, from.z);
        const dir    = playerPos.subtract(origin).normalize();

        const bullet = BABYLON.MeshBuilder.CreateSphere("voidDirectBul", { diameter: 0.3 }, this.scene);
        bullet.position   = origin.clone();
        bullet.isPickable = false;
        bullet.alwaysSelectAsActiveMesh = true;

        const mat = new BABYLON.StandardMaterial("voidDirMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(1, 0, 0.8);
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0.8);
        bullet.material   = mat;

        const SPEED     = 13.0;
        const spawnTime = Date.now();

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (bullet.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const dt2  = this.scene.getEngine().getDeltaTime() / 1000;

            const pPos = this.player.camera.globalPosition;
            const dx = bullet.position.x - pPos.x;
            const dy = bullet.position.y - (pPos.y - 1.0);
            const dz = bullet.position.z - pPos.z;
            if (Math.sqrt(dx*dx + dy*dy + dz*dz) < 0.6 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
                return;
            }

            bullet.position.addInPlace(dir.scale(SPEED * dt2));

            if (Date.now() - spawnTime > 3000) {
                this.scene.onBeforeRenderObservable.remove(obs);
                bullet.dispose();
            }
        });
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
        this._clearSingZones();

        this.scene.onBeforeRenderObservable.remove(this._obs);
        this._phaseAura.stop();
        this._transAura.stop();

        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(0.6, 0, 1));

        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();

        // Mort spectaculaire : plusieurs explosions en cascade
        let burst = 0;
        const burstInterval = setInterval(() => {
            if (this.body.isDisposed() || burst >= 5) { clearInterval(burstInterval); return; }
            const offset = new BABYLON.Vector3(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
            );
            EnemyParticles.death(this.scene, this.body.position.add(offset), new BABYLON.Color3(0.8, 0, 1));
            burst++;
        }, 200);

        const startY = this.body.position.y;
        const start  = Date.now();
        const deathObs = this.scene.onBeforeRenderObservable.add(() => {
            if (this.body.isDisposed()) { this.scene.onBeforeRenderObservable.remove(deathObs); return; }
            const t = Math.min((Date.now() - start) / 1500, 1);
            this.body.scaling = new BABYLON.Vector3(1 - t * 0.8, 1 + t * 0.4, 1 - t * 0.8);
            this.body.position.y = startY + t * 5;
            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(deathObs);
                this.body.dispose();
                if (this.onDeath) this.onDeath();
            }
        });
    }

    dispose() {
        this._dead = true;
        this._clearSingZones();
        try { this.scene.onBeforeRenderObservable.remove(this._obs); } catch(_){}
        this._phaseAura?.stop();
        this._transAura?.stop();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}