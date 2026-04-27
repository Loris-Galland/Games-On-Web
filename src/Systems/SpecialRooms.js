import * as BABYLON from "@babylonjs/core";

/**
 * SpecialRooms
 * ------------
 * Gère les 3 types de salles spéciales AAA :
 *
 * 1. WeaponShopRoom  — boutique avec 3 armes au choix (libres, via balises)
 * 2. ChallengeRoom   — défi chronométré, récompense bonus de score
 * 3. ForgeRoom       — station d'amélioration d'arme active
 *
 * Chaque salle expose :
 *   room.activate(player, weaponManager, scoreManager, hud)
 *   room.deactivate()
 */

// ── WeaponShopRoom ────────────────────────────────────────────────────────────

export class WeaponShopRoom {
    /**
     * @param {BABYLON.Scene} scene
     * @param {BABYLON.Vector3} center  centre de la salle
     */
    constructor(scene, center) {
        this.scene  = scene;
        this.center = center;
        this._pedestals = [];
        this._active    = false;
        this._purchased = new Set();
    }

    /**
     * @param {object} player
     * @param {import('../Systems/WeaponManager').WeaponManager} weaponManager
     * @param {import('../Systems/ScoreManager').ScoreManager} scoreManager
     * @param {object} hud
     */
    activate(player, weaponManager, scoreManager, hud) {
        this._active = true;
        this._player = player;
        this._wm     = weaponManager;
        this._sm     = scoreManager;
        this._hud    = hud;

        const weapons = weaponManager.getShopInventory();
        if (weapons.length === 0) {
            hud?.showWaveMessage?.("ARSENAL COMPLET — AUCUNE ARME DISPONIBLE");
            return;
        }

        // Spawn 3 socles en éventail
        const count   = Math.min(weapons.length, 3);
        const spreadR = 4;

        for (let i = 0; i < count; i++) {
            const angle = ((i / (count - 1 || 1)) - 0.5) * Math.PI * 0.8 + Math.PI;
            const pos   = new BABYLON.Vector3(
                this.center.x + Math.cos(angle) * spreadR,
                0,
                this.center.z + Math.sin(angle) * spreadR,
            );
            this._createPedestal(pos, weapons[i]);
        }

        hud?.showWaveMessage?.("ARMURERIE — APPROCHEZ D'UN SOCLE POUR RAMASSER");
    }

    _createPedestal(pos, weaponInfo) {
        // Socle
        const baseMat = new BABYLON.StandardMaterial("pedestalMat", this.scene);
        baseMat.diffuseColor  = new BABYLON.Color3(0.05, 0.1, 0.2);
        baseMat.emissiveColor = new BABYLON.Color3(0, 0.3, 0.5);

        const base = BABYLON.MeshBuilder.CreateCylinder("pedestal", { diameter: 1.2, height: 0.6, tessellation: 12 }, this.scene);
        base.position   = new BABYLON.Vector3(pos.x, 0.3, pos.z);
        base.material   = baseMat;
        base.isPickable = false;

        // Arme flottante (représentée par une boîte colorée)
        const weapMat = new BABYLON.StandardMaterial("pedestalWeapon", this.scene);
        weapMat.emissiveColor   = BABYLON.Color3.FromHexString(weaponInfo.iconColor ?? "#00ffff");
        weapMat.disableLighting = true;

        const icon = BABYLON.MeshBuilder.CreateBox("shopWeapon", { width: 0.5, height: 0.15, depth: 0.9 }, this.scene);
        icon.position   = new BABYLON.Vector3(pos.x, 1.2, pos.z);
        icon.material   = weapMat;
        icon.isPickable = true;
        icon._weaponId  = weaponInfo.id;
        icon.alwaysSelectAsActiveMesh = true;

        // Anneau de particules
        this._createPickupAura(pos, weapMat.emissiveColor);

        // Label 3D (via plane + DynamicTexture)
        this._createLabel(pos, weaponInfo);

        // Hover
        let t = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            if (icon.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); return; }
            t += this.scene.getEngine().getDeltaTime() / 1000;
            icon.position.y  = 1.2 + Math.sin(t * 2) * 0.12;
            icon.rotation.y += 0.012;
        });

        // Zone de ramassage (proximity)
        const pedestal = { base, icon, weaponInfo, obs, picked: false };
        this._pedestals.push(pedestal);

        // Boucle de proximité
        const trigObs = this.scene.onBeforeRenderObservable.add(() => {
            if (pedestal.picked || icon.isDisposed() || !this._player?.camera) { this.scene.onBeforeRenderObservable.remove(trigObs); return; }
            const d = BABYLON.Vector3.Distance(this._player.camera.globalPosition, icon.position);
            if (d < 1.8) {
                pedestal.picked = true;
                this._pickupWeapon(weaponInfo, pedestal);
                this.scene.onBeforeRenderObservable.remove(trigObs);
            }
        });
    }

    _createPickupAura(pos, color) {
        const aura = new BABYLON.ParticleSystem("shopAura", 30, this.scene);
        aura.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", this.scene);
        aura.emitter         = new BABYLON.Vector3(pos.x, 0.7, pos.z);
        aura.minEmitBox      = new BABYLON.Vector3(-0.4, 0, -0.4);
        aura.maxEmitBox      = new BABYLON.Vector3( 0.4, 0,  0.4);
        aura.color1          = new BABYLON.Color4(color.r, color.g, color.b, 0.8);
        aura.color2          = new BABYLON.Color4(1, 1, 1, 0.4);
        aura.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        aura.minSize         = 0.05;
        aura.maxSize         = 0.15;
        aura.minLifeTime     = 0.5;
        aura.maxLifeTime     = 1.0;
        aura.emitRate        = 25;
        aura.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        aura.direction1      = new BABYLON.Vector3(-0.5, 1, -0.5);
        aura.direction2      = new BABYLON.Vector3( 0.5, 3,  0.5);
        aura.minEmitPower    = 0.5;
        aura.maxEmitPower    = 1.5;
        aura.gravity         = new BABYLON.Vector3(0, -0.5, 0);
        aura.updateSpeed     = 0.025;
        aura.start();
        return aura;
    }

    _createLabel(pos, weaponInfo) {
        const plane = BABYLON.MeshBuilder.CreatePlane("shopLabel", { width: 2.2, height: 0.55 }, this.scene);
        plane.position   = new BABYLON.Vector3(pos.x, 0.7, pos.z);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
        plane.isPickable    = false;

        const tex = new BABYLON.DynamicTexture("shopLabelTex", { width: 512, height: 128 }, this.scene);
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, 512, 128);
        ctx.fillStyle = "rgba(0,10,20,0.85)";
        ctx.fillRect(0, 0, 512, 128);
        ctx.font      = "bold 28px Courier New";
        ctx.fillStyle = weaponInfo.iconColor ?? "#00ffff";
        ctx.textAlign = "center";
        ctx.fillText(weaponInfo.name, 256, 50);
        ctx.font      = "18px Courier New";
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText(weaponInfo.description.substring(0, 40), 256, 88);
        tex.update();

        const mat = new BABYLON.StandardMaterial("shopLabelMat", this.scene);
        mat.diffuseTexture   = tex;
        mat.emissiveTexture  = tex;
        mat.backFaceCulling  = false;
        mat.disableLighting  = true;
        plane.material = mat;
    }

    _pickupWeapon(weaponInfo, pedestal) {
        this._wm?.give?.(weaponInfo.id);
        this._hud?.showWaveMessage?.(`ARMEMENT : ${weaponInfo.name}`);

        // Dispose socle
        setTimeout(() => {
            try { if (!pedestal.base.isDisposed()) pedestal.base.dispose(); } catch(_) {}
            try { if (!pedestal.icon.isDisposed()) pedestal.icon.dispose(); } catch(_) {}
        }, 100);
    }

    deactivate() {
        this._active = false;
        this._pedestals.forEach(p => {
            try { if (!p.base.isDisposed()) p.base.dispose(); } catch(_) {}
            try { if (!p.icon.isDisposed()) p.icon.dispose(); } catch(_) {}
        });
        this._pedestals = [];
    }
}

// ── ChallengeRoom ─────────────────────────────────────────────────────────────

export class ChallengeRoom {
    /**
     * Défi : tuer N ennemis en T secondes.
     * @param {BABYLON.Scene} scene
     * @param {object} player
     * @param {object} scoreManager
     * @param {object} hud
     */
    constructor(scene, player, scoreManager, hud) {
        this.scene  = scene;
        this.player = player;
        this.sm     = scoreManager;
        this.hud    = hud;

        this._active   = false;
        this._success  = false;
        this._timeLeft = 0;
        this._target   = 0;
        this._killed   = 0;
        this._tickObs  = null;
        this._enemyObs = null;
    }

    /**
     * @param {{ timeLimit: number, killTarget: number, spawnFn: function }} opts
     * spawnFn(count) → spawne des ennemis, appelle this.registerKill() à chaque mort
     */
    start(opts = {}) {
        this._active   = true;
        this._success  = false;
        this._timeLeft = opts.timeLimit ?? 45;
        this._target   = opts.killTarget ?? 20;
        this._killed   = 0;

        this.hud?.showWaveMessage?.(`DÉFI : ${this._target} ENNEMIS EN ${this._timeLeft}s !`);

        // Spawn
        if (opts.spawnFn) opts.spawnFn(this._target);

        // Countdown
        this._tickObs = this.scene.onBeforeRenderObservable.add(() => {
            if (!this._active) { this.scene.onBeforeRenderObservable.remove(this._tickObs); return; }
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            this._timeLeft -= dt;
            this.hud?.updateChallengeTimer?.(Math.ceil(this._timeLeft), this._killed, this._target);

            if (this._timeLeft <= 0) {
                this._end(false);
            }
        });
    }

    /** Appelé par le WaveManager à chaque kill dans la salle défi */
    registerKill() {
        if (!this._active) return;
        this._killed++;
        if (this._killed >= this._target) {
            this._end(true);
        }
    }

    _end(success) {
        this._active = false;
        this._success = success;
        if (this._tickObs) {
            this.scene.onBeforeRenderObservable.remove(this._tickObs);
            this._tickObs = null;
        }

        if (success) {
            const timeBonus = Math.round(this._timeLeft * 50);
            const totalBonus = 1200 + timeBonus;
            this.sm?.totalScore && (this.sm.totalScore += totalBonus);
            this.hud?.showWaveMessage?.(`DÉFI RÉUSSI ! +${totalBonus} POINTS`);
            this.hud?.showPointsPopup?.(totalBonus, { label: "CHALLENGE!" });
        } else {
            this.hud?.showWaveMessage?.("DÉFI ÉCHOUÉ — OBJECTIF NON ATTEINT");
        }
    }

    deactivate() {
        this._active = false;
        if (this._tickObs) {
            this.scene.onBeforeRenderObservable.remove(this._tickObs);
            this._tickObs = null;
        }
    }
}

// ── ForgeRoom ─────────────────────────────────────────────────────────────────

export class ForgeRoom {
    /**
     * Station de forge : améliore l'arme active parmi 3 options.
     * @param {BABYLON.Scene} scene
     * @param {BABYLON.Vector3} center
     */
    constructor(scene, center) {
        this.scene  = scene;
        this.center = center;
        this._terminals = [];
        this._used      = false;
    }

    static UPGRADES = {
        shotgun: [
            { id: "sg_ammo",    name: "+1 CHARGEUR",    desc: "Ammo max +1.",             apply: w => { w.ammoMax++;  w.currentAmmo++; } },
            { id: "sg_spread",  name: "CHOKE SERRÉ",    desc: "Dispersion ÷2.",            apply: w => { w.spreadAngle *= 0.5; } },
            { id: "sg_reload",  name: "MÉCANISME RAPIDE",desc: "Rechargement -30%.",       apply: w => { w.reloadTime  *= 0.7; } },
        ],
        sniper: [
            { id: "snp_ammo",   name: "+1 CARTOUCHE",   desc: "Ammo max +1.",             apply: w => { w.ammoMax++;  w.currentAmmo++; } },
            { id: "snp_range",  name: "LUNETTE LONGUE",  desc: "Portée ×1.5.",            apply: w => { w.maxRange   *= 1.5; } },
            { id: "snp_charge", name: "DÉTENTE COURTE",  desc: "Délai de charge ÷2.",     apply: w => { w.chargeTime *= 0.5; } },
        ],
        rocket: [
            { id: "rl_blast",   name: "CHARGE CREUSE",  desc: "Rayon explosion +30%.",    apply: w => { w.explosionRadius *= 1.3; } },
            { id: "rl_speed",   name: "PROPULSEUR+",    desc: "Vitesse roquette +40%.",   apply: w => { w.projectileSpeed *= 1.4; } },
            { id: "rl_safe",    name: "BOUCLIER SPLASH", desc: "Splash self-damage ÷2.",  apply: w => { w.selfDamageMin  *= 2; } },
        ],
        default: [
            { id: "gen_fire",   name: "CADENCE+",        desc: "Tir 20% plus rapide.",    apply: w => { w.fireRate  *= 0.8; } },
        ],
    };

    activate(player, weaponManager, scoreManager, hud) {
        if (this._used) { hud?.showWaveMessage?.("FORGE — DÉJÀ UTILISÉE"); return; }

        this._player = player;
        this._wm     = weaponManager;
        this._hud    = hud;

        const active = weaponManager?.activeWeapon;
        const weapId = active?.constructor?.name?.toLowerCase() ?? "default";
        const upKey  = weapId.includes("shotgun") ? "shotgun" : weapId.includes("sniper") ? "sniper" : weapId.includes("rocket") ? "rocket" : "default";
        const upgrades = ForgeRoom.UPGRADES[upKey] ?? ForgeRoom.UPGRADES.default;

        hud?.showWaveMessage?.("FORGE — CHOISISSEZ UNE AMÉLIORATION");

        this._spawnTerminals(upgrades, active);
    }

    _spawnTerminals(upgrades, activeWeapon) {
        upgrades.forEach((upg, i) => {
            const angle = ((i / (upgrades.length - 1 || 1)) - 0.5) * Math.PI * 0.7;
            const r     = 3.5;
            const pos   = new BABYLON.Vector3(
                this.center.x + Math.cos(angle + Math.PI * 0.5) * r,
                0,
                this.center.z + Math.sin(angle + Math.PI * 0.5) * r,
            );

            // Socle forge
            const mat = new BABYLON.StandardMaterial("forgeMat", this.scene);
            mat.diffuseColor  = new BABYLON.Color3(0.3, 0.15, 0);
            mat.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0);

            const base = BABYLON.MeshBuilder.CreateCylinder(`forgeBase_${i}`, { diameter: 1.0, height: 0.5, tessellation: 6 }, this.scene);
            base.position = new BABYLON.Vector3(pos.x, 0.25, pos.z);
            base.material = mat;
            base.isPickable = false;

            // Hologramme de l'upgrade
            const holo = BABYLON.MeshBuilder.CreateBox(`forgeHolo_${i}`, { width: 0.4, height: 0.4, depth: 0.4 }, this.scene);
            holo.position   = new BABYLON.Vector3(pos.x, 1.0, pos.z);
            holo.isPickable = true;

            const holoMat = new BABYLON.StandardMaterial(`forgeHoloMat_${i}`, this.scene);
            holoMat.emissiveColor   = new BABYLON.Color3(1, 0.5, 0);
            holoMat.disableLighting = true;
            holoMat.wireframe       = true;
            holo.material = holoMat;

            // Label
            this._createForgeLabel(pos, upg);

            let t = 0;
            const anim = this.scene.onBeforeRenderObservable.add(() => {
                if (holo.isDisposed()) { this.scene.onBeforeRenderObservable.remove(anim); return; }
                t += this.scene.getEngine().getDeltaTime() / 1000;
                holo.rotation.y += 0.03;
                holo.position.y  = 1.0 + Math.sin(t * 2.5) * 0.1;
            });

            // Proximity pick
            const trigObs = this.scene.onBeforeRenderObservable.add(() => {
                if (this._used || holo.isDisposed() || !this._player?.camera) {
                    this.scene.onBeforeRenderObservable.remove(trigObs); return;
                }
                const d = BABYLON.Vector3.Distance(this._player.camera.globalPosition, holo.position);
                if (d < 1.8) {
                    this._used = true;
                    if (activeWeapon) upg.apply(activeWeapon);
                    this._hud?.showWaveMessage?.(`FORGE : ${upg.name}`);
                    this._hud?.showPointsPopup?.(0, { label: upg.name });
                    this.scene.onBeforeRenderObservable.remove(trigObs);

                    // Dispose tous les terminaux
                    this._terminals.forEach(t => {
                        try { if (!t.base.isDisposed()) t.base.dispose(); } catch(_) {}
                        try { if (!t.holo.isDisposed()) t.holo.dispose(); } catch(_) {}
                    });
                }
            });

            this._terminals.push({ base, holo, trigObs, anim });
        });
    }

    _createForgeLabel(pos, upg) {
        const plane = BABYLON.MeshBuilder.CreatePlane("forgeLabel", { width: 2.0, height: 0.5 }, this.scene);
        plane.position      = new BABYLON.Vector3(pos.x, 0.6, pos.z);
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
        plane.isPickable    = false;

        const tex = new BABYLON.DynamicTexture("forgeLabelTex", { width: 512, height: 128 }, this.scene);
        const ctx = tex.getContext();
        ctx.clearRect(0, 0, 512, 128);
        ctx.fillStyle = "rgba(20, 8, 0, 0.9)";
        ctx.fillRect(0, 0, 512, 128);
        ctx.font      = "bold 26px Courier New";
        ctx.fillStyle = "#ff8800";
        ctx.textAlign = "center";
        ctx.fillText(upg.name, 256, 48);
        ctx.font      = "16px Courier New";
        ctx.fillStyle = "#aaaaaa";
        ctx.fillText(upg.desc, 256, 85);
        tex.update();

        const mat = new BABYLON.StandardMaterial("forgeLabelMat", this.scene);
        mat.diffuseTexture  = tex;
        mat.emissiveTexture = tex;
        mat.backFaceCulling = false;
        mat.disableLighting = true;
        plane.material = mat;
    }

    deactivate() {
        this._terminals.forEach(t => {
            try { if (!t.base.isDisposed()) t.base.dispose(); } catch(_) {}
            try { if (!t.holo.isDisposed()) t.holo.dispose(); } catch(_) {}
        });
        this._terminals = [];
    }
}
