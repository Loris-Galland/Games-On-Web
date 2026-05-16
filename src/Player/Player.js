import * as BABYLON from "@babylonjs/core";
import { PlayerShoot }    from "./PlayerShoot";
import { Health }         from "../Systems/Health";
import { PlayerHUD }      from "../UI/PlayerHUD";
import { GameOverScreen } from "../UI/GameOverScreen";

export class Player {
    constructor(scene, canvas) {
        this.scene  = scene;
        this.canvas = canvas;

        // Sons gameplay
        this._footstepSfx        = new Audio("sounds/sfx/footstep.wav");
        this._footstepSfx.loop   = true;
        this._footstepSfx.volume = 0.3;
        this._isPlayingFootstep  = false;
        this._footstepUnlocked   = false;

        const unlock = () => {
        this._footstepSfx.play().then(() => {
            this._footstepSfx.pause();
            this._footstepSfx.currentTime = 0;
            this._footstepUnlocked = true;
        }).catch(() => {});
    };
    window.addEventListener("click",   unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

        this.speed     = 0.3;
        this.inputMap  = {};
        this.keybindings = null;
        this.maxHealth = 10;
        this.isDead    = false;

        this.getStatsCallback = null;
        this.onEnemyKilled    = null;

        // ── Caméra ────────────────────────────────────────────────────────────
        this.camera = new BABYLON.UniversalCamera("playerCam", new BABYLON.Vector3(0, 1.5, 0), this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.checkCollisions    = true;
        this.camera.applyGravity       = true;
        this.camera.ellipsoid          = new BABYLON.Vector3(0.25, 1.5, 0.25);
        this.camera.ellipsoidOffset    = new BABYLON.Vector3(0, 1.5, 0);
        this.camera.slopLimit          = 90;
        this.camera.stepOffset         = 0.4;
        this.camera.minZ               = 0.1;
        this.camera.speed              = this.speed;
        this.camera.angularSensibility = 5000;
        this.camera.layerMask          = 0x0FFFFFFF;
        this.camera.keysUp    = [90, 87];
        this.camera.keysDown  = [83];
        this.camera.keysLeft  = [81, 65];
        this.camera.keysRight = [68];

        this._initInputs();
        this._initWeapon();

        this.hud             = new PlayerHUD(this.maxHealth);
        this._gameOverScreen = new GameOverScreen();

        this.health = new Health(
            this.maxHealth,
            (current) => this.hud.updateHealth(current),
            () => this._onDeath(),
        );
        this.shootController = new PlayerShoot(this);

        this.currentTilt = 0;
        this.bobTimer    = 0;
        this._baseFov   = 1.0;   
        this._currentFov = 1.0;
        this.camera.fov  = this._baseFov;

        // ── Saut : on gère nous-mêmes la vélocité verticale ──────────────────
        // applyGravity reste true pour que la caméra colle au sol normalement.
        // On injecte la vélocité via camera._localDirection.y chaque frame.
        this._jumpVelocity = 0;           // vitesse verticale courante (unités/frame)
        this._JUMP_INIT    = 0.22;        // impulsion initiale
        this._GRAVITY      = 0.012;       // gravité par frame

        // ── États capacités ───────────────────────────────────────────────────
        this._dashEnabled    = false;
        this._dashCooldown   = 0;
        this._DASH_CD        = 1500;
        this._isDashing      = false;
        this._dashDir       = null;
        this._dashRemaining = 0;
        this._DASH_DIST     = 4;          
        this._DASH_SPEED    = 0.6;

        this._blinkEnabled   = false;
        this._blinkCooldown  = 0;
        this._BLINK_CD       = 3000;

        this._stompEnabled   = false;
        this._wasInAir       = false;

        this._shieldEnabled  = false;
        this._shieldCooldown = 0;
        this._SHIELD_CD      = 8000;
        this._shieldActive   = false;

        this._berserkEnabled  = false;
        this._berserkCooldown = 0;
        this._BERSERK_CD      = 45000;
        this._berserkActive   = false;

        this._empEnabled   = false;
        this._empCooldown  = 0;
        this._EMP_CD       = 10000;

        // Vignette berserk (bords écran uniquement)
        this._berserkVignette = this._createVignette(
            "radial-gradient(ellipse at center, transparent 50%, rgba(180,0,0,0.6) 100%)"
        );

        this.gamepad = null;

        this.scene.registerBeforeRender(() => {
            if (this.isDead) return;
            const dt = this.scene.getEngine().getDeltaTime();
            this._updateCameraTilt();
            this._updateWeaponBobbing();
            this._updateJump();
            this._updateDash(); 
            this._updateWeaponRecoilRecovery();
            this._updateCooldowns(dt);
            this._updateStomp();
            this._updateAbilityHUD();
        });
    }

    // ── Mort ──────────────────────────────────────────────────────────────────

    _onDeath() {
        if (this.isDead) return;
        this.isDead = true;
        this.camera.detachControl();
        const stats = this.getStatsCallback ? this.getStatsCallback() : {};
        setTimeout(() => { this._gameOverScreen.show(stats); }, 600);
    }

    // ── Inputs ────────────────────────────────────────────────────────────────

    _initInputs() {
        this._installMouseSmoothing();
        // window.addEventListener pour pouvoir faire preventDefault sur Space/Shift/Tab
        window.addEventListener("keydown", (e) => {
            if (this.isDead) return;

            if (["Space", "ShiftLeft", "ShiftRight", "Tab"].includes(e.code)) {
                e.preventDefault();
            }

            const key = e.key.toLowerCase();
            this.inputMap[key] = true;

            if (e.code === "KeyD") this.inputMap["d"] = true;

            switch (e.code) {
                case "Space":      this._jump();    break;
                case "ShiftLeft":
                case "ShiftRight": this._tryDash(); break;
            }
            switch (key) {
                case "f": this._tryShield();  break;
                case "g": this._tryEMP();     break;
                case "m": if (this._berserkEnabled) this._tryBerserk(); break;
            }
        });

        window.addEventListener("keyup", (e) => {
        const key = e.key.toLowerCase();
        this.inputMap[key] = false;
        if (e.code === "KeyD") this.inputMap["d"] = false; 
    });

        // Observable Babylon pour la compatibilité WeaponManager
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (this.isDead) return;
            const key = kbInfo.event.key.toLowerCase();
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.inputMap[key] = true;
            } else {
                this.inputMap[key] = false;
            }
        });

        // Clic droit → blink
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
            if (pointerInfo.event.button !== 2) return;
            if (this._blinkEnabled) this._tryBlink();
        });
    }

    _installMouseSmoothing() {
    const MAX_Y = 25;   
    const MAX_X = 50;   
    this.canvas.addEventListener("pointermove", (e) => {
        if (document.pointerLockElement !== this.canvas) return;
        const my = e.movementY, mx = e.movementX;
        if (Math.abs(my) > MAX_Y || Math.abs(mx) > MAX_X) {
            e.stopImmediatePropagation();
            this.canvas.dispatchEvent(new MouseEvent("pointermove", {
                bubbles: true, cancelable: true,
                movementX: Math.sign(mx) * Math.min(Math.abs(mx), MAX_X),
                movementY: Math.sign(my) * Math.min(Math.abs(my), MAX_Y),
                clientX: e.clientX, clientY: e.clientY,
            }));
        }
    }, true);
}

    // ── Cooldowns ─────────────────────────────────────────────────────────────

    _updateCooldowns(dt) {
        if (this._dashCooldown    > 0) this._dashCooldown    = Math.max(0, this._dashCooldown    - dt);
        if (this._blinkCooldown   > 0) this._blinkCooldown   = Math.max(0, this._blinkCooldown   - dt);
        if (this._shieldCooldown  > 0) this._shieldCooldown  = Math.max(0, this._shieldCooldown  - dt);
        if (this._empCooldown     > 0) this._empCooldown     = Math.max(0, this._empCooldown     - dt);
        if (this._berserkCooldown > 0) this._berserkCooldown = Math.max(0, this._berserkCooldown - dt);
    }

    _updateAbilityHUD() {
        if (!this.hud?.updateAbilityCooldowns) return;
        this.hud.updateAbilityCooldowns({
            dash:    { enabled: this._dashEnabled,    cd: this._dashCooldown,    max: this._DASH_CD,    key: "SHIFT" },
            blink:   { enabled: this._blinkEnabled,   cd: this._blinkCooldown,   max: this._BLINK_CD,   key: "CLIC D" },
            shield:  { enabled: this._shieldEnabled,  cd: this._shieldCooldown,  max: this._SHIELD_CD,  key: "F",    active: this._shieldActive },
            berserk: { enabled: this._berserkEnabled, cd: this._berserkCooldown, max: this._BERSERK_CD, key: "Q",    active: this._berserkActive },
            emp:     { enabled: this._empEnabled,     cd: this._empCooldown,     max: this._EMP_CD,     key: "G" },
        });
    }

    // ── SAUT ─────────────────────────────────────────────────────────────────
    // On détecte le sol avec un raycast, puis on gère la vélocité verticale
    // manuellement via moveWithCollisions — ce qui respecte les collisions.

    _isOnGround() {
        const ray = new BABYLON.Ray(this.camera.position, new BABYLON.Vector3(0, -1, 0), 1.2);
        const hit = this.scene.pickWithRay(ray, (m) => m.checkCollisions && m.name !== "weapon");
        return hit.hit;
    }

    _jump() {
        if (this._jumpVelocity > 0) return;  // déjà en l'air
        if (!this._isOnGround()) return;       // pas au sol
        this._jumpVelocity = this._JUMP_INIT;
    }

    _updateJump() {
        if (this._jumpVelocity === 0) return;

        this.camera.cameraDirection.y += this._jumpVelocity;
        this._jumpVelocity -= this._GRAVITY;

        if (this._jumpVelocity < 0 && this._isOnGround()) {
            this._jumpVelocity = 0;
        }
    }

    // ── DASH ─────────────────────────────────────────────────────────────────

    _isAction(actionId) {
        if (!this.keybindings) {
            const defaults = {
                moveForward: ["z", "w"],
                moveBack:    ["s"],
                moveLeft:    ["q", "a"],
                moveRight:   ["d"],
            };
            return (defaults[actionId] ?? []).some(k => this.inputMap[k]);
        }
        const binding = this.keybindings.find(b => b.id === actionId);
        return (binding?.keys ?? []).some(k => this.inputMap[k]);
    }

    _tryDash() {
        if (!this._dashEnabled)     return;
        if (this._dashCooldown > 0) return;
        if (this._isDashing)        return;

        const forward     = this.camera.getForwardRay().direction.normalize();
        const flatForward = new BABYLON.Vector3(forward.x, 0, forward.z).normalize();
        const right       = new BABYLON.Vector3(flatForward.z, 0, -flatForward.x);

        let dir = BABYLON.Vector3.Zero();
        if (this._isAction("moveForward")) dir = dir.add(flatForward);
        if (this._isAction("moveBack"))    dir = dir.subtract(flatForward);
        if (this._isAction("moveLeft"))    dir = dir.subtract(right);
        if (this._isAction("moveRight"))   dir = dir.add(right);
        if (dir.length() < 0.01)          dir = flatForward;

        this._dashDir       = dir.normalize();
        this._dashRemaining = this._DASH_DIST;
        this._isDashing     = true;
        this._dashCooldown  = this._DASH_CD;

        this._dashWeaponFX(this._dashDir);
        this._spawnDashTrail();
        const dashSfx = new Audio("sounds/sfx/dash.wav");
        dashSfx.volume = 0.5;
        dashSfx.play().catch(() => {});
    }

    _updateDash() {
        if (!this._isDashing) return;

        const step = Math.min(this._DASH_SPEED, this._dashRemaining);
        
        this.camera.cameraDirection.addInPlace(this._dashDir.scale(step));
        this._dashRemaining -= step;

        if (this._dashRemaining <= 0) {
            this._isDashing     = false;
            this._dashDir       = null;
            this._dashRemaining = 0;
        }
    }

    _dashWeaponFX(dir) {
        if (!this.weapon) return;
        this.weapon.position.x = this.weaponOriginalPos.x - dir.x * 0.25;
        this.weapon.position.z = this.weaponOriginalPos.z - 0.2;
    }

    _spawnDashTrail() {
        const tex = "https://assets.babylonjs.com/textures/flare.png";
        const emitter = BABYLON.MeshBuilder.CreateBox("_dashEmitter", { size: 0.01 }, this.scene);
        emitter.parent     = this.camera;
        emitter.position   = new BABYLON.Vector3(0, 0, -0.5);
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const ps = new BABYLON.ParticleSystem("dashTrail", 40, this.scene);
        ps.particleTexture = new BABYLON.Texture(tex, this.scene);
        ps.emitter         = emitter;
        ps.minEmitBox      = new BABYLON.Vector3(-0.15, -0.15, -0.15);
        ps.maxEmitBox      = new BABYLON.Vector3( 0.15,  0.15,  0.15);
        ps.color1          = new BABYLON.Color4(0, 1, 1, 0.8);
        ps.color2          = new BABYLON.Color4(0, 0.5, 1, 0.4);
        ps.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        ps.minSize = 0.05; ps.maxSize     = 0.18;
        ps.minLifeTime = 0.1; ps.maxLifeTime = 0.3;
        ps.emitRate        = 100;
        ps.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.direction1      = new BABYLON.Vector3(-1, -1, -2);
        ps.direction2      = new BABYLON.Vector3( 1,  1, -4);
        ps.minEmitPower = 1; ps.maxEmitPower = 3;
        ps.start();

        setTimeout(() => {
            ps.stop();
            emitter.parent = null;
            setTimeout(() => { ps.dispose(); emitter.dispose(); }, 400);
        }, 120);
    }

    // ── BLINK ────────────────────────────────────────────────────────────────

    _tryBlink() {
        if (!this._blinkEnabled)     return;
        if (this._blinkCooldown > 0) return;

        const forward = this.camera.getForwardRay().direction.normalize();
        const ray     = new BABYLON.Ray(this.camera.globalPosition, forward, 30);
        const hit     = this.scene.pickWithRay(ray, (m) =>
            m.isPickable && (
                m.name === "enemyBody" || m.name === "enemyBodyHeavy" ||
                m.name === "enemyBodyScout" || m.name === "weakPoint" || m._isBossBody
            )
        );

        if (!hit.hit || !hit.pickedMesh) {
            this.hud?.showWaveMessage?.("BLINK — AUCUNE CIBLE");
            return;
        }

        this._spawnBlinkFX(this.camera.globalPosition.clone());

        const enemyPos = hit.pickedMesh.getAbsolutePosition();
        const toEnemy  = enemyPos.subtract(this.camera.globalPosition).normalize();
        const dest     = enemyPos.subtract(toEnemy.scale(1.8));
        dest.y         = this.camera.globalPosition.y;
        this.camera.position.copyFrom(dest);

        this._spawnBlinkFX(dest);
        if (this.weapon) this.weapon.position.z = this.weaponOriginalPos.z - 0.25;

        this._blinkCooldown = this._BLINK_CD;
        this.hud?.showWaveMessage?.("BLINK");
    }

    _spawnBlinkFX(pos) {
        const tex     = "https://assets.babylonjs.com/textures/flare.png";
        const emitter = BABYLON.MeshBuilder.CreateBox("_blinkEmitter", { size: 0.01 }, this.scene);
        emitter.position   = pos.clone();
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const ps = new BABYLON.ParticleSystem("blinkFX", 60, this.scene);
        ps.particleTexture = new BABYLON.Texture(tex, this.scene);
        ps.emitter         = emitter;
        ps.color1          = new BABYLON.Color4(0.8, 0, 1, 1);
        ps.color2          = new BABYLON.Color4(0.3, 0, 0.8, 0.5);
        ps.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        ps.minSize = 0.1; ps.maxSize     = 0.5;
        ps.minLifeTime = 0.2; ps.maxLifeTime = 0.6;
        ps.emitRate        = 0;
        ps.manualEmitCount = 50;
        ps.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.direction1      = new BABYLON.Vector3(-3, -3, -3);
        ps.direction2      = new BABYLON.Vector3( 3,  3,  3);
        ps.minEmitPower = 2; ps.maxEmitPower = 6;
        ps.start();
        setTimeout(() => { ps.stop(); setTimeout(() => { ps.dispose(); emitter.dispose(); }, 700); }, 100);
    }

    // ── STOMP ────────────────────────────────────────────────────────────────

    _updateStomp() {
        if (!this._stompEnabled) return;
        const onGround = this._isOnGround();
        if (!onGround) {
            this._wasInAir = true;
        } else if (this._wasInAir) {
            this._wasInAir = false;
            this._triggerStomp();
        }
    }

    _triggerStomp() {
        const pos    = this.camera.globalPosition.clone();
        pos.y        = 0;
        const radius = 4;

        this.scene.meshes.forEach(m => {
            if (!["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name) || m.isDisposed()) return;
            const ePos = m.getAbsolutePosition();
            if (BABYLON.Vector3.Distance(ePos, pos) < radius) {
                m.position.addInPlace(ePos.subtract(pos).normalize().scale(3));
                m._takeDamage?.(1);
            }
        });

        const mat  = new BABYLON.StandardMaterial("_stompMat", this.scene);
        mat.emissiveColor = new BABYLON.Color3(0, 1, 1);
        mat.alpha         = 0.6;
        mat.wireframe     = true;
        const ring = BABYLON.MeshBuilder.CreateTorus("_stompRing", { diameter: 0.2, thickness: 0.1, tessellation: 32 }, this.scene);
        ring.position   = new BABYLON.Vector3(pos.x, 0.05, pos.z);
        ring.material   = mat;
        ring.isPickable = false;

        let t = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            t += this.scene.getEngine().getDeltaTime() / 1000;
            ring.scaling.set(1 + t * 10, 1, 1 + t * 10);
            mat.alpha = Math.max(0, 0.6 - t * 1.2);
            if (t > 0.5) {
                this.scene.onBeforeRenderObservable.remove(obs);
                ring.dispose(); mat.dispose();
            }
        });

        this.hud?.showWaveMessage?.("ATTERRISSAGE LOURD");
    }

    // ── BOUCLIER ─────────────────────────────────────────────────────────────

    _tryShield() {
        if (!this._shieldEnabled || this._shieldCooldown > 0 || this._shieldActive) return;

        this._shieldActive   = true;
        this._shieldCooldown = this._SHIELD_CD;

        const mat = new BABYLON.StandardMaterial("_shieldMat", this.scene);
        mat.diffuseColor    = new BABYLON.Color3(0, 0.5, 1);
        mat.emissiveColor   = new BABYLON.Color3(0, 0.2, 0.6);
        mat.alpha           = 0.22;
        mat.backFaceCulling = false;

        const sphere = BABYLON.MeshBuilder.CreateSphere("_shieldSphere", { diameter: 2.6, segments: 10 }, this.scene);
        sphere.parent     = this.camera;
        sphere.position   = BABYLON.Vector3.Zero();
        sphere.material   = mat;
        sphere.isPickable = false;
        sphere.layerMask  = 0x0FFFFFFF;

        let t = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            t += this.scene.getEngine().getDeltaTime() / 1000;
            mat.alpha = 0.15 + Math.sin(t * 5) * 0.07;
        });

        const origTakeDmg = this.health.takeDamage?.bind(this.health);
        this.health.takeDamage = () => {};
        this.hud?.showWaveMessage?.("BOUCLIER ACTIF — 2s");

        setTimeout(() => {
            if (origTakeDmg) this.health.takeDamage = origTakeDmg;
            this._shieldActive = false;
            this.scene.onBeforeRenderObservable.remove(obs);
            let fade = 0;
            const fo = this.scene.onBeforeRenderObservable.add(() => {
                fade += 0.05;
                mat.alpha = Math.max(0, 0.22 - fade);
                if (fade >= 0.22) {
                    this.scene.onBeforeRenderObservable.remove(fo);
                    sphere.dispose(); mat.dispose();
                }
            });
            this.hud?.showWaveMessage?.("BOUCLIER DÉSACTIVÉ");
        }, 2000);
    }

    // ── BERSERK ───────────────────────────────────────────────────────────────

    _tryBerserk() {
        if (!this._berserkEnabled || this._berserkCooldown > 0 || this._berserkActive) return;

        this._berserkActive   = true;
        this._berserkCooldown = this._BERSERK_CD;

        const prevSpeed   = this.speed;
        const prevDmgMult = this.shootController?.damageMultiplier ?? 1;
        this.speed       *= 1.30;
        this.camera.speed = this.speed;
        if (this.shootController) this.shootController.damageMultiplier = prevDmgMult * 2;

        const origTakeDmg = this.health.takeDamage?.bind(this.health);
        this.health.takeDamage = () => {};

        this._berserkVignette.style.opacity = "1";
        if (this.weapon?.material) this.weapon.material.emissiveColor = new BABYLON.Color3(0.8, 0, 0);

        this.hud?.showWaveMessage?.("⚡ MODE BERSERK — 10s");

        setTimeout(() => {
            this.speed = prevSpeed;
            this.camera.speed = this.speed;
            if (this.shootController) this.shootController.damageMultiplier = prevDmgMult;
            if (origTakeDmg) this.health.takeDamage = origTakeDmg;
            this._berserkActive = false;
            this._berserkVignette.style.opacity = "0";
            if (this.weapon?.material) this.weapon.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            this.hud?.showWaveMessage?.("BERSERK TERMINÉ");
        }, 10000);
    }

    // ── EMP ───────────────────────────────────────────────────────────────────

    _tryEMP() {
        if (!this._empEnabled || this._empCooldown > 0) return;
        this._empCooldown = this._EMP_CD;

        const forward = this.camera.getForwardRay().direction.normalize();
        const from    = this.camera.globalPosition.add(forward.scale(0.5));
        const target  = this.camera.globalPosition.add(forward.scale(6));
        target.y      = 0.05;

        this._throwEMPGrenade(from, target);
        this.hud?.showWaveMessage?.("GRENADE EMP LANCÉE");
    }

    _throwEMPGrenade(from, target) {
        const mat = new BABYLON.StandardMaterial("_empBallMat", this.scene);
        mat.emissiveColor   = new BABYLON.Color3(0, 1, 1);
        mat.disableLighting = true;

        const ball = BABYLON.MeshBuilder.CreateSphere("_empBall", { diameter: 0.22 }, this.scene);
        ball.material   = mat;
        ball.position   = from.clone();
        ball.isPickable = false;

        const travelTime = 0.35;
        let elapsed = 0;

        const obs = this.scene.onBeforeRenderObservable.add(() => {
            elapsed += this.scene.getEngine().getDeltaTime() / 1000;
            const t = Math.min(elapsed / travelTime, 1);
            ball.position.x = from.x + (target.x - from.x) * t;
            ball.position.z = from.z + (target.z - from.z) * t;
            ball.position.y = from.y + (target.y - from.y) * t + Math.sin(t * Math.PI) * 2.5;
            ball.rotation.y += 0.25;
            if (t >= 1) {
                this.scene.onBeforeRenderObservable.remove(obs);
                ball.dispose(); mat.dispose();
                this._explodeEMP(target.clone());
            }
        });
    }

    _explodeEMP(pos) {
        const radius   = 4;
        const duration = 3;

        const zoneMat = new BABYLON.StandardMaterial("_empZone", this.scene);
        zoneMat.emissiveColor   = new BABYLON.Color3(0, 0.6, 0.9);
        zoneMat.diffuseColor    = new BABYLON.Color3(0, 0.4, 0.7);
        zoneMat.alpha           = 0.3;
        zoneMat.backFaceCulling = false;

        const zone = BABYLON.MeshBuilder.CreateDisc("_empDisc", { radius, tessellation: 48 }, this.scene);
        zone.position   = new BABYLON.Vector3(pos.x, 0.05, pos.z);
        zone.rotation.x = Math.PI / 2;
        zone.material   = zoneMat;
        zone.isPickable = false;

        const ringMat = new BABYLON.StandardMaterial("_empRing", this.scene);
        ringMat.emissiveColor = new BABYLON.Color3(0, 1, 1);
        ringMat.alpha = 0.85;

        const ring = BABYLON.MeshBuilder.CreateTorus("_empTorus", { diameter: radius * 2, thickness: 0.08, tessellation: 48 }, this.scene);
        ring.position   = new BABYLON.Vector3(pos.x, 0.08, pos.z);
        ring.rotation.x = Math.PI / 2;
        ring.material   = ringMat;
        ring.isPickable = false;

        const tex     = "https://assets.babylonjs.com/textures/flare.png";
        const emitter = BABYLON.MeshBuilder.CreateBox("_empEmitter", { size: 0.01 }, this.scene);
        emitter.position   = new BABYLON.Vector3(pos.x, 0.2, pos.z);
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const ps = new BABYLON.ParticleSystem("empPS", 50, this.scene);
        ps.particleTexture = new BABYLON.Texture(tex, this.scene);
        ps.emitter         = emitter;
        ps.minEmitBox      = new BABYLON.Vector3(-radius * 0.75, 0, -radius * 0.75);
        ps.maxEmitBox      = new BABYLON.Vector3( radius * 0.75, 0,  radius * 0.75);
        ps.color1          = new BABYLON.Color4(0, 1, 1, 0.7);
        ps.color2          = new BABYLON.Color4(0, 0.5, 1, 0.3);
        ps.colorDead       = new BABYLON.Color4(0, 0, 0, 0);
        ps.minSize = 0.04; ps.maxSize     = 0.18;
        ps.minLifeTime = 0.5; ps.maxLifeTime = 1.5;
        ps.emitRate        = 25;
        ps.direction1      = new BABYLON.Vector3(-0.1, 1, -0.1);
        ps.direction2      = new BABYLON.Vector3( 0.1, 3,  0.1);
        ps.minEmitPower = 0.3; ps.maxEmitPower = 1.2;
        ps.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.start();

        const affectedAgents = [];
        this.scene.meshes.forEach(m => {
            if (!["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name) || m.isDisposed()) return;
            if (BABYLON.Vector3.Distance(m.getAbsolutePosition(), pos) < radius) {
                const agent = m._crowdAgent;
                if (agent != null && this._navManager) {
                    const origSpeed = m._origSpeed ?? 3;
                    m._origSpeed = origSpeed;
                    try {
                        this._navManager.crowd?.agentUpdateParameters?.(agent, { maxSpeed: origSpeed * 0.15 });
                        affectedAgents.push({ agent, origSpeed, mesh: m });
                    } catch (_) {}
                }
            }
        });

        let elapsed = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            elapsed += this.scene.getEngine().getDeltaTime() / 1000;
            zoneMat.alpha = 0.2 + Math.sin(elapsed * 4) * 0.1;
            ringMat.alpha = 0.6 + Math.sin(elapsed * 6) * 0.25;

            if (elapsed >= duration) {
                this.scene.onBeforeRenderObservable.remove(obs);
                affectedAgents.forEach(({ agent, origSpeed, mesh }) => {
                    if (!mesh.isDisposed() && this._navManager) {
                        try { this._navManager.crowd?.agentUpdateParameters?.(agent, { maxSpeed: origSpeed }); } catch (_) {}
                    }
                });
                let fade = 0;
                const fo = this.scene.onBeforeRenderObservable.add(() => {
                    fade += 0.04;
                    zoneMat.alpha = Math.max(0, 0.3  - fade);
                    ringMat.alpha = Math.max(0, 0.85 - fade * 3);
                    if (fade >= 1) {
                        this.scene.onBeforeRenderObservable.remove(fo);
                        ps.stop();
                        setTimeout(() => { ps.dispose(); emitter.dispose(); zone.dispose(); ring.dispose(); zoneMat.dispose(); ringMat.dispose(); }, 500);
                    }
                });
                this.hud?.showWaveMessage?.("EMP TERMINÉ");
            }
        });
    }

    // ── Vignette ──────────────────────────────────────────────────────────────

    _createVignette(gradient) {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9996;background:${gradient};opacity:0;transition:opacity 0.4s ease;`;
        document.body.appendChild(el);
        return el;
    }

    // ── Arme ─────────────────────────────────────────────────────────────────

    _initWeapon() {
        const weaponMat = new BABYLON.StandardMaterial("weaponMat", this.scene);
        weaponMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);

        this.weapon = BABYLON.MeshBuilder.CreateBox("weapon", { width: 0.15, height: 0.2, depth: 0.6 }, this.scene);
        this.weapon.material      = weaponMat;
        this.weapon.parent        = this.camera;
        this.weaponOriginalPos    = new BABYLON.Vector3(0.4, -0.4, 1);
        this.weapon.position      = this.weaponOriginalPos.clone();
        this.weaponMinZ           = 0.6;
        this.weapon.layerMask     = 0x10000000;

        this._weaponCamera = new BABYLON.FreeCamera("weaponCam", BABYLON.Vector3.Zero(), this.scene);
        this._weaponCamera.parent    = this.camera;
        this._weaponCamera.minZ      = 0.05;
        this._weaponCamera.maxZ      = 5;
        this._weaponCamera.layerMask = 0x10000000;

        this.scene.activeCameras = [this.camera, this._weaponCamera];

        this.scene.onBeforeCameraRenderObservable.add((cam) => {
            if (cam === this._weaponCamera) {
                this.scene.getEngine().clear(null, false, true, false);
            }
        });
    }

    applyWeaponRecoil(amount) {
        if (!this.weapon) return;
        this.weapon.position.z = Math.max(this.weapon.position.z - amount, this.weaponMinZ);
    }

    _updateWeaponRecoilRecovery() {
        if (!this.weapon) return;
        if (this.weapon.position.z < this.weaponOriginalPos.z) {
            this.weapon.position.z = BABYLON.Scalar.Lerp(this.weapon.position.z, this.weaponOriginalPos.z, 0.15);
            if (Math.abs(this.weapon.position.z - this.weaponOriginalPos.z) < 0.001) {
                this.weapon.position.z = this.weaponOriginalPos.z;
            }
        }
    }

    _updateCameraTilt() {
        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, 0, 0.18);
        this.camera.rotation.z = this.currentTilt;
    }

    _updateWeaponBobbing() {
        const goLeft       = this.inputMap["q"] || this.inputMap["a"];
        const goRight      = this.inputMap["d"];
        const strafeNeutral = goLeft && goRight;

        const goingForward = this.inputMap["z"] || this.inputMap["w"];
        const isMovingKb   =
            goingForward || this.inputMap["s"] ||
            (!strafeNeutral && (goLeft || goRight));
        const isMoving = (isMovingKb || this.inputMap["_gp_move"]) && !strafeNeutral;

        if (isMoving) {
            if (!this._isPlayingFootstep && this._footstepUnlocked) {
                this._footstepSfx.play().catch(() => {});
                this._isPlayingFootstep = true;
            }

            this.bobTimer += 0.18;
            this.weapon.position.y = this.weaponOriginalPos.y + Math.sin(this.bobTimer) * 0.025;
            // X uniquement si on avance/recule, pas en strafe pur
            const xBob = goingForward || this.inputMap["s"] ? Math.cos(this.bobTimer * 0.5) * 0.018 : 0;
            this.weapon.position.x = BABYLON.Scalar.Lerp(this.weapon.position.x, this.weaponOriginalPos.x + xBob, 0.15);
        } else {
            if (this._isPlayingFootstep) {
                this._footstepSfx.pause();
                this._footstepSfx.currentTime = 0;
                this._isPlayingFootstep = false;
            }
            
            this.weapon.position.x = BABYLON.Scalar.Lerp(this.weapon.position.x, this.weaponOriginalPos.x, 0.12);
            this.weapon.position.y = BABYLON.Scalar.Lerp(this.weapon.position.y, this.weaponOriginalPos.y, 0.12);
            this.bobTimer = BABYLON.Scalar.Lerp(this.bobTimer, 0, 0.15);
        }

        const targetFov = (isMoving && goingForward) ? this._baseFov + 0.07 : this._baseFov;
        this._currentFov = BABYLON.Scalar.Lerp(this._currentFov, targetFov, 0.06);
        this.camera.fov  = this._currentFov;
    }
}