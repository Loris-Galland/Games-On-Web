import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

export class BossEnemy3 {
    constructor(scene, position, player, navManager = null, onSummon = null) {
        this.scene = scene; this.player = player; this._onSummon = onSummon;
        this.onDeath = null; this.onPhase = null; this.onDamage = null;
        this.maxHealth = 45; this.currentHealth = 45;
        this._dead = false; this._dying = false;
        this._stateLabel = "transition"; this._invincible = true;
        this._phaseIndex = 0; this._transitionTimer = 0; this._TRANSITION_DUR = 5.0; this._nextPhase = 1;
        this._t = 0; this._contactTimer = 0; this._CONTACT_CD = 0.7; this._wpPulseT = 0;
        this._chargeState = "idle"; this._chargeTimer = 0; this._chargeDir = null;
        this._chargeCount = 0; this._MAX_CHARGES = 4; this._chargeVelX = 0; this._chargeVelZ = 0;
        this._spinTimer = 0; this._SPIN_DUR = 2.5; this._spinCount = 0; this._MAX_SPINS = 3;
        this._spinCooldown = 0; this._damZoneTimer = 0;
        this._stompTimer = 0; this._STOMP_RATE = 1.2;
        this._dashTimer = 0; this._DASH_RATE = 3.0; this._dashDir = null; this._dashActive = false; this._dashElapsed = 0;
        this._groundY = position.y + 1.25;
        EnemyParticles.spawnWarning(scene, position, new BABYLON.Color3(1, 0.15, 0), 2000);
        this._buildMesh(position); this._buildWeakPoint(); this._buildAuraSystem();
        this._introTimer = 3.0; this._inIntro = true;
        this._obs = scene.onBeforeRenderObservable.add(() => this._update());
    }

    _buildMesh(position) {
        const uid = Math.random().toString(36).slice(2);
        const mat = new BABYLON.StandardMaterial(`bruteMat_${uid}`, this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.2, 0.04, 0.02);
        mat.emissiveColor = new BABYLON.Color3(0.55, 0.08, 0.0);
        mat.specularColor = new BABYLON.Color3(0.6, 0.2, 0.0);
        this.body = BABYLON.MeshBuilder.CreateBox("bossBody", { width: 2.0, height: 2.5, depth: 2.0 }, this.scene);
        this.body.position = new BABYLON.Vector3(position.x, position.y + 1.25, position.z);
        this.body.material = mat; this.body.checkCollisions = true;
        this.body.ellipsoid = new BABYLON.Vector3(1.0, 1.25, 1.0);
        this.body.isPickable = false;
        this.body._isBossBody = true; this.body._takeDamage = (dmg) => this.takeDamage(dmg);
        this._groundY = position.y + 1.25;
    }

    _buildWeakPoint() {
        const uid = Math.random().toString(36).slice(2);
        const mat = new BABYLON.StandardMaterial(`bruteWpMat_${uid}`, this.scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1); mat.diffuseColor = new BABYLON.Color3(1, 0.5, 0.3); mat.disableLighting = true;
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 0.9 }, this.scene);
        this.weakPoint.material = mat; this.weakPoint.isPickable = false; this.weakPoint.isVisible = false;
        this.weakPoint.parent = this.body; this.weakPoint.position = new BABYLON.Vector3(0, 0.2, 1.05);
        this._wpPulseT = 0;
    }

    _buildAuraSystem() {
        const tex = "https://assets.babylonjs.com/textures/flare.png";
        const make = (name, count) => {
            const ps = new BABYLON.ParticleSystem(name, count, this.scene);
            ps.particleTexture = new BABYLON.Texture(tex, this.scene);
            ps.emitter = this.body; ps.minEmitBox = new BABYLON.Vector3(-2,-2.5,-2); ps.maxEmitBox = new BABYLON.Vector3(2,2.5,2);
            ps.minSize = 0.15; ps.maxSize = 0.5; ps.minLifeTime = 0.3; ps.maxLifeTime = 0.8; ps.emitRate = 90;
            ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
            ps.direction1 = new BABYLON.Vector3(-2,1,-2); ps.direction2 = new BABYLON.Vector3(2,4,2);
            ps.minEmitPower = 1; ps.maxEmitPower = 3; ps.gravity = new BABYLON.Vector3(0,-1,0); ps.updateSpeed = 0.025;
            return ps;
        };
        this._phaseAura = make("brutePhasePS", 100);
        this._setAuraColor(new BABYLON.Color4(1, 0.15, 0, 0.9)); this._phaseAura.start();
        this._transAura = make("bruteTransPS", 200);
        this._transAura.emitRate = 160;
        this._transAura.color1 = new BABYLON.Color4(0,1,0.2,1); this._transAura.color2 = new BABYLON.Color4(0.1,1,0.4,1);
        this._transAura.colorDead = new BABYLON.Color4(0,0.6,0.1,0); this._transAura.stop();
    }

    _setAuraColor(c4) {
        const c2 = c4.clone(); c2.a *= 0.5;
        this._phaseAura.color1 = c4; this._phaseAura.color2 = c2;
        this._phaseAura.colorDead = new BABYLON.Color4(c4.r*0.1, c4.g*0.1, c4.b*0.1, 0);
    }

    _update() {
        if (this._dead || !this.player?.camera) return;
        if (!this.body || this.body.isDisposed()) return;
        const dt = this.scene.getEngine().getDeltaTime() / 1000;
        const pos = this.body.position;
        const playerPos = this.player.camera.globalPosition.clone();
        this._t += dt;

        if (this._inIntro) {
            this._introTimer -= dt;
            this.body.position.y = this._groundY;
            if (Math.random() < 0.3) { this.body.position.x += (Math.random()-0.5)*0.08; this.body.position.z += (Math.random()-0.5)*0.08; }
            if (this._introTimer <= 0) { this._inIntro = false; this._enterPhase(1); }
            return;
        }

        // Contact damage toujours actif
        if (this._contactTimer > 0) this._contactTimer -= dt;
        const dx0 = pos.x - playerPos.x, dz0 = pos.z - playerPos.z;
        if (Math.sqrt(dx0*dx0 + dz0*dz0) < 3.2 && !this.player.isDead && this._contactTimer <= 0) {
            this.player.health?.takeDamage(1); this._contactTimer = this._CONTACT_CD;
        }

        if (!this._invincible && this.weakPoint && !this.weakPoint.isDisposed()) {
            this._wpPulseT += dt;
            const sc = 1 + Math.sin(this._wpPulseT * 6) * 0.3;
            this.weakPoint.scaling = new BABYLON.Vector3(sc, sc, sc);
        }

        if (this._stateLabel === "transition") this._updateTransition(dt, playerPos);
        else if (this._stateLabel === "phase1") this._updatePhase1(dt, pos, playerPos);
        else if (this._stateLabel === "phase2") this._updatePhase2(dt, pos, playerPos);
        else if (this._stateLabel === "phase3") this._updatePhase3(dt, pos, playerPos);

        if (this._stateLabel !== "phase2" || this._spinTimer <= 0)
            this.body.lookAt(new BABYLON.Vector3(playerPos.x, pos.y, playerPos.z));
        this.body.position.y = Math.max(this.body.position.y, this._groundY - 0.1);
    }

    _enterTransition(nextPhase) {
        this._stateLabel = "transition"; this._invincible = false;
        this._transitionTimer = this._TRANSITION_DUR; this._nextPhase = nextPhase;
        if (this.weakPoint && !this.weakPoint.isDisposed()) { this.weakPoint.isVisible = true; this.weakPoint.isPickable = true; }
        this._phaseAura.stop(); this._transAura.start();
        if (this.body.material) { this.body.material.emissiveColor = new BABYLON.Color3(0,0.25,0.05); this.body.material.diffuseColor = new BABYLON.Color3(0,0.2,0.05); }
        this.body.position.y = this._groundY;
    }

    _updateTransition(dt, playerPos) {
        this._transitionTimer -= dt;
        this.body.position.y = this._groundY + Math.abs(Math.sin(this._t * 10)) * 0.06;
        const dx = playerPos.x - this.body.position.x, dz = playerPos.z - this.body.position.z;
        const d = Math.sqrt(dx*dx + dz*dz);
        if (d > 3) { this.body.moveWithCollisions(new BABYLON.Vector3((dx/d)*2.0*dt, 0, (dz/d)*2.0*dt)); }
        if (this._transitionTimer <= 0) this._enterPhase(this._nextPhase);
    }

    _enterPhase(phaseNum) {
        this._stateLabel = `phase${phaseNum}`; this._phaseIndex = phaseNum; this._invincible = true; this._t = 0;
        if (this.weakPoint && !this.weakPoint.isDisposed()) { this.weakPoint.isVisible = false; this.weakPoint.isPickable = false; }
        this._transAura.stop(); this._phaseAura.start();
        if (phaseNum === 1) {
            this._setAuraColor(new BABYLON.Color4(1,0.05,0,0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.65,0.05,0);
            this._chargeState = "idle"; this._chargeTimer = 1.5; this._chargeCount = 0;
        } else if (phaseNum === 2) {
            this._setAuraColor(new BABYLON.Color4(1,0.35,0,0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.7,0.18,0);
            this._spinTimer = 0; this._spinCount = 0; this._spinCooldown = 1.0; this._damZoneTimer = 0;
        } else if (phaseNum === 3) {
            this._setAuraColor(new BABYLON.Color4(1,0,0.2,0.9));
            if (this.body.material) this.body.material.emissiveColor = new BABYLON.Color3(0.8,0,0.1);
            this._stompTimer = 0.5; this._dashTimer = this._DASH_RATE; this._dashActive = false;
        }
        if (this.onPhase) this.onPhase(phaseNum);
        const labels = ["","BRUTE — PHASE I : CHARGE","BRUTE — PHASE II : BERSERKER","BRUTE — PHASE III : FURIE"];
        this.player.hud?.showWaveMessage?.(labels[phaseNum] ?? "");
    }

    _updatePhase1(dt, pos, playerPos) {
        if (this._chargeState === "idle") {
            const dx = playerPos.x-pos.x, dz = playerPos.z-pos.z, d = Math.sqrt(dx*dx+dz*dz);
            if (d > 4) { this.body.moveWithCollisions(new BABYLON.Vector3((dx/d)*3.5*dt, 0, (dz/d)*3.5*dt)); }
            this.body.position.y = this._groundY;
            this._chargeTimer -= dt;
            if (this._chargeTimer <= 0) {
                this._chargeDir = new BABYLON.Vector3(playerPos.x-pos.x,0,playerPos.z-pos.z).normalize();
                this._chargeState = "telegraphing"; this._chargeTimer = 0.8;
            }
        } else if (this._chargeState === "telegraphing") {
            this.body.position.x -= this._chargeDir.x*3.0*dt; this.body.position.z -= this._chargeDir.z*3.0*dt;
            this.body.position.y = this._groundY + Math.sin(this._t*25)*0.12;
            this._chargeTimer -= dt;
            if (this._chargeTimer <= 0) {
                this._chargeState = "charging"; this._chargeTimer = 0.55;
                this._chargeVelX = this._chargeDir.x*22; this._chargeVelZ = this._chargeDir.z*22;
            }
        } else if (this._chargeState === "charging") {
            this.body.moveWithCollisions(new BABYLON.Vector3(this._chargeVelX*dt, 0, this._chargeVelZ*dt));
            this.body.position.y = this._groundY;
            const dx2 = pos.x-playerPos.x, dz2 = pos.z-playerPos.z;
            if (Math.sqrt(dx2*dx2+dz2*dz2) < 3.5 && !this.player.isDead && this._contactTimer <= 0) {
                this.player.health?.takeDamage(2);
                this.player.camera.position.addInPlace(new BABYLON.Vector3(dx2,0,dz2).normalize().scale(4));
                this._contactTimer = this._CONTACT_CD;
            }
            this._chargeTimer -= dt;
            if (this._chargeTimer <= 0) {
                this._chargeState = "recovery"; this._chargeTimer = 0.7;
                this._spawnShockwave(pos, 5.5);
                EnemyParticles.death(this.scene, new BABYLON.Vector3(pos.x,this._groundY-2,pos.z), new BABYLON.Color3(1,0.2,0));
            }
        } else if (this._chargeState === "recovery") {
            this._chargeVelX *= 0.85; this._chargeVelZ *= 0.85;
            this.body.moveWithCollisions(new BABYLON.Vector3(this._chargeVelX*dt, 0, this._chargeVelZ*dt));
            this.body.position.y = this._groundY + Math.abs(Math.sin(this._t*8))*0.07;
            this._chargeTimer -= dt;
            if (this._chargeTimer <= 0) {
                this._chargeCount++;
                if (this._chargeCount >= this._MAX_CHARGES) this._enterTransition(2);
                else { this._chargeState = "idle"; this._chargeTimer = 1.2; }
            }
        }
    }

    _updatePhase2(dt, pos, playerPos) {
        this._spinCooldown -= dt;
        if (this._spinTimer > 0) {
            this.body.rotation.y += 7*dt;
            const dx = playerPos.x-pos.x, dz = playerPos.z-pos.z, d = Math.sqrt(dx*dx+dz*dz);
            if (d > 1.5) { this.body.moveWithCollisions(new BABYLON.Vector3((dx/d)*4.5*dt, 0, (dz/d)*4.5*dt)); }
            this.body.position.y = this._groundY;
            this._damZoneTimer -= dt;
            if (this._damZoneTimer <= 0) {
                const fd = Math.sqrt((pos.x-playerPos.x)**2 + (pos.z-playerPos.z)**2);
                if (fd < 5.0 && !this.player.isDead) {
                    this.player.health?.takeDamage(1);
                    EnemyParticles.death(this.scene, new BABYLON.Vector3(pos.x+(Math.random()-0.5)*5,this._groundY-2,pos.z+(Math.random()-0.5)*5), new BABYLON.Color3(1,0.3,0));
                }
                this._damZoneTimer = 0.25;
            }
            this._spinTimer -= dt;
            if (this._spinTimer <= 0) {
                this._spinCount++; this._spawnShockwave(pos, 7);
                if (this._spinCount >= this._MAX_SPINS) this._enterTransition(3);
                else this._spinCooldown = 1.5;
            }
        } else if (this._spinCooldown <= 0) {
            this._spinTimer = this._SPIN_DUR; this._damZoneTimer = 0;
        } else {
            const dx = playerPos.x-pos.x, dz = playerPos.z-pos.z, d = Math.sqrt(dx*dx+dz*dz);
            if (d > 2) { this.body.moveWithCollisions(new BABYLON.Vector3((dx/d)*6.0*dt, 0, (dz/d)*6.0*dt)); }
            this.body.position.y = this._groundY;
        }
    }

    _updatePhase3(dt, pos, playerPos) {
        if (this._dashActive) {
            this.body.moveWithCollisions(new BABYLON.Vector3(this._dashDir.x*18*dt, 0, this._dashDir.z*18*dt));
            this.body.position.y = this._groundY; this._dashElapsed += dt;
            if (this._dashElapsed >= 0.35) { this._dashActive = false; this._spawnShockwave(pos, 4.5); }
            return;
        }
        const dx = playerPos.x-pos.x, dz = playerPos.z-pos.z, d = Math.sqrt(dx*dx+dz*dz);
        if (d > 1.5) { this.body.moveWithCollisions(new BABYLON.Vector3((dx/d)*7.5*dt, 0, (dz/d)*7.5*dt)); }
        this.body.position.y = this._groundY + Math.abs(Math.sin(this._t*9))*0.12;
        this._stompTimer -= dt;
        if (this._stompTimer <= 0) { this._doStomp(pos); this._stompTimer = this._STOMP_RATE; }
        this._dashTimer -= dt;
        if (this._dashTimer <= 0) {
            this._dashDir = new BABYLON.Vector3(dx,0,dz).normalize();
            this._dashActive = true; this._dashElapsed = 0; this._dashTimer = this._DASH_RATE;
            this.player._screenFlash?.("rgba(255,50,0,0.25)", 150);
        }
    }

    _doStomp(pos) {
        this.body.position.y = this._groundY - 0.35;
        setTimeout(() => { if (!this.body?.isDisposed()) this.body.position.y = this._groundY; }, 100);
        EnemyParticles.death(this.scene, new BABYLON.Vector3(pos.x,this._groundY-2,pos.z), new BABYLON.Color3(1,0.15,0));
        [new BABYLON.Vector3(1,0,0), new BABYLON.Vector3(-1,0,0), new BABYLON.Vector3(0,0,1), new BABYLON.Vector3(0,0,-1)]
            .forEach(d => this._spawnWave(pos, d));
    }

    _spawnWave(origin, dir) {
        const wave = BABYLON.MeshBuilder.CreateBox("bruteWave", { width:0.6, height:0.4, depth:0.6 }, this.scene);
        wave.position = new BABYLON.Vector3(origin.x, this._groundY-2.3, origin.z); wave.isPickable = false;
        const mat = new BABYLON.StandardMaterial("bruteWaveMat", this.scene);
        mat.emissiveColor = new BABYLON.Color3(1,0.2,0); mat.backFaceCulling = false; mat.alpha = 0.85;
        wave.material = mat;
        const SPEED = 12, MAX_DIST = 12; let traveled = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (wave.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const step = SPEED * (this.scene.getEngine().getDeltaTime()/1000);
            wave.position.x += dir.x*step; wave.position.z += dir.z*step; traveled += step;
            mat.alpha = 0.85 * (1 - traveled/MAX_DIST);
            const p = this.player.camera.globalPosition;
            const dx = wave.position.x-p.x, dz = wave.position.z-p.z;
            if (Math.sqrt(dx*dx+dz*dz) < 1.2 && !this.player.isDead) {
                this.player.health?.takeDamage(1);
                this.player.camera.position.addInPlace(dir.scale(2.5));
            }
            if (traveled >= MAX_DIST) { this.scene.onBeforeRenderObservable.remove(obs); wave.dispose(); }
        });
    }

    _spawnShockwave(pos, radius) {
        const ring = BABYLON.MeshBuilder.CreateDisc("bruteShock", { radius:0.2, tessellation:32 }, this.scene);
        ring.position = new BABYLON.Vector3(pos.x, this._groundY-2.3, pos.z);
        ring.rotation.x = Math.PI/2; ring.isPickable = false;
        const mat = new BABYLON.StandardMaterial("bruteShockMat", this.scene);
        mat.emissiveColor = new BABYLON.Color3(1,0.2,0); mat.backFaceCulling = false; mat.alpha = 0.85;
        ring.material = mat;
        const p = this.player.camera.globalPosition;
        if (Math.sqrt((pos.x-p.x)**2+(pos.z-p.z)**2) < radius && !this.player.isDead) this.player.health?.takeDamage(1);
        const start = Date.now();
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (ring.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            const t = Math.min((Date.now()-start)/500,1);
            ring.scaling = new BABYLON.Vector3(t*radius*2, t*radius*2, t*radius*2);
            mat.alpha = 0.85*(1-t);
            if (t >= 1) { this.scene.onBeforeRenderObservable.remove(obs); ring.dispose(); }
        });
    }

    takeDamage(amount) {
        if (this._dead || this._dying || this._invincible) return;
        if (!this.body || this.body.isDisposed()) return;
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        if (this.body.material) {
            const orig = this.body.material.emissiveColor.clone();
            this.body.material.emissiveColor = new BABYLON.Color3(1,1,1);
            setTimeout(() => { if (!this.body?.isDisposed() && this.body?.material) this.body.material.emissiveColor = orig; }, 100);
        }
        if (this.onDamage) this.onDamage(this.currentHealth, this.maxHealth);
        if (this.currentHealth <= 0) { this._dying = true; this._die(); }
    }

    _die() {
        if (this._dead) return; this._dead = true;
        this.scene.onBeforeRenderObservable.remove(this._obs);
        this._phaseAura.stop(); this._transAura.stop();
        EnemyParticles.death(this.scene, this.body.position.clone(), new BABYLON.Color3(1,0.15,0));
        let n = 0;
        const burst = setInterval(() => {
            if (this.body?.isDisposed() || n >= 5) { clearInterval(burst); return; }
            const off = new BABYLON.Vector3((Math.random()-0.5)*4,(Math.random()-0.5)*3,(Math.random()-0.5)*4);
            EnemyParticles.death(this.scene, this.body.position.add(off), new BABYLON.Color3(1,0.2,0)); n++;
        }, 200);
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        setTimeout(() => { if (!this.body?.isDisposed()) this.body.dispose(); if (this.onDeath) this.onDeath(); }, 1500);
    }

    dispose() {
        this._dead = true;
        try { this.scene.onBeforeRenderObservable.remove(this._obs); } catch(_){}
        this._phaseAura?.stop(); this._transAura?.stop();
        if (this.weakPoint && !this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (this.body && !this.body.isDisposed()) this.body.dispose();
    }
}