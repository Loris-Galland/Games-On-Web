import * as BABYLON from "@babylonjs/core";
import { PlayerShoot }    from "./PlayerShoot";
import { Health }         from "../Systems/Health";
import { PlayerHUD }      from "../UI/PlayerHUD";
import { GameOverScreen } from "../UI/GameOverScreen";

export class Player {
    constructor(scene, canvas) {
        this.scene  = scene;
        this.canvas = canvas;

        this.speed     = 0.3;
        this.inputMap  = {};
        this.maxHealth = 10;
        this.isDead    = false;

        this.getStatsCallback = null;
        this.onEnemyKilled    = null; // hook pour lifesteal etc.

        // ── Caméra ────────────────────────────────────────────────────────────
        this.camera = new BABYLON.UniversalCamera(
            "playerCam",
            new BABYLON.Vector3(0, 1.5, 0),
            this.scene,
        );
        this.camera.attachControl(this.canvas, true);
        this.camera.checkCollisions = true;
        this.camera.applyGravity    = true;
        this.camera.ellipsoid       = new BABYLON.Vector3(0.25, 1.5, 0.25);
        this.camera.ellipsoidOffset = new BABYLON.Vector3(0, 1.5, 0);
        this.camera.slopLimit       = 90;
        this.camera.stepOffset      = 0.4;
        this.camera.minZ            = 0.1;
        this.camera.speed           = this.speed;
        this.camera.angularSensibility = 5000;
        this.camera.layerMask       = 0x0FFFFFFF;

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
        this.jumpForce   = 0;

        // ── États des capacités (activées par upgrades) ───────────────────────
        this._dashEnabled    = false;
        this._dashCooldown   = 0;
        this._DASH_CD        = 1500;
        this._DASH_FORCE     = 18;
        this._DASH_DUR       = 120;
        this._isDashing      = false;

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

        this._lastStandReady = false;

        // Référence au GamepadManager (injectée depuis main.js après construction)
        this.gamepad = null;

        this.scene.registerBeforeRender(() => {
            if (this.isDead) return;
            const dt = this.scene.getEngine().getDeltaTime();
            this._updateCameraTilt();
            this._updateWeaponBobbing();
            this._updateJump();
            this._updateWeaponRecoilRecovery();
            this._updateCooldowns(dt);
            this._updateStomp();
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

    // ── Inputs clavier ────────────────────────────────────────────────────────

    _initInputs() {
        this.scene.onKeyboardObservable.add((kbInfo) => {
            if (this.isDead) return;
            const key  = kbInfo.event.key.toLowerCase();
            const code = kbInfo.event.code;

            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                this.inputMap[key] = true;

                if (code === "Space")      this._jump();
                if (code === "ShiftLeft" || code === "ShiftRight") this._tryDash();
                if (key === "f")           this._tryShield();
                if (key === "q" && !this.inputMap["_q_handled"]) {
                    // 'q' est aussi la touche de déplacement gauche (AZERTY)
                    // On active berserk seulement si le berserk est débloqué
                    if (this._berserkEnabled) {
                        this.inputMap["_q_handled"] = true;
                        this._tryBerserk();
                    }
                }
                if (key === "g")           this._tryEMP();

            } else {
                this.inputMap[key] = false;
                if (key === "q") this.inputMap["_q_handled"] = false;
            }
        });

        // Clic droit → blink
        this.scene.onPointerObservable.add((pointerInfo) => {
            if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) return;
            if (pointerInfo.event.button !== 2) return;
            this._tryBlink();
        });
    }

    // ── Cooldowns ─────────────────────────────────────────────────────────────

    _updateCooldowns(dt) {
        if (this._dashCooldown   > 0) this._dashCooldown   = Math.max(0, this._dashCooldown   - dt);
        if (this._blinkCooldown  > 0) this._blinkCooldown  = Math.max(0, this._blinkCooldown  - dt);
        if (this._shieldCooldown > 0) this._shieldCooldown = Math.max(0, this._shieldCooldown - dt);
        if (this._empCooldown    > 0) this._empCooldown    = Math.max(0, this._empCooldown    - dt);
        if (this._berserkCooldown> 0) this._berserkCooldown= Math.max(0, this._berserkCooldown- dt);
    }

    // ── DASH ─────────────────────────────────────────────────────────────────

    _tryDash() {
        if (!this._dashEnabled)       return;
        if (this._dashCooldown > 0)   return;
        if (this._isDashing)          return;

        this._dashCooldown = this._DASH_CD;
        this._isDashing    = true;

        // Direction du dash = direction de mouvement clavier, sinon forward
        const forward = this.camera.getForwardRay().direction.normalize();
        const right   = BABYLON.Vector3.Cross(forward, BABYLON.Vector3.Up()).normalize();

        let dir = BABYLON.Vector3.Zero();
        if (this.inputMap["z"] || this.inputMap["w"]) dir = dir.add(forward);
        if (this.inputMap["s"])                        dir = dir.subtract(forward);
        if (this.inputMap["q"] || this.inputMap["a"]) dir = dir.subtract(right);
        if (this.inputMap["d"])                        dir = dir.add(right);

        if (dir.length() < 0.01) dir = forward; // fallback: dash en avant
        dir = dir.normalize();

        // Flash visuel blanc
        this._screenFlash("rgba(255,255,255,0.25)", 150);

        // Impulsion par steps sur _DASH_DUR ms
        const steps    = 8;
        const stepDur  = this._DASH_DUR / steps;
        const impulse  = dir.scale(this._DASH_FORCE / steps);

        let step = 0;
        const interval = setInterval(() => {
            if (step >= steps || this.isDead) {
                clearInterval(interval);
                this._isDashing = false;
                return;
            }
            this.camera.cameraDirection.addInPlace(impulse);
            step++;
        }, stepDur);

        this.hud?.showWaveMessage?.("DASH");
    }

    // ── BLINK (téléportation sur ennemi) ─────────────────────────────────────

    _tryBlink() {
        if (!this._blinkEnabled)      return;
        if (this._blinkCooldown > 0)  return;

        // Raycast depuis la caméra vers l'avant, portée 30m
        const forward = this.camera.getForwardRay().direction.normalize();
        const ray     = new BABYLON.Ray(this.camera.globalPosition, forward, 30);
        const hit     = this.scene.pickWithRay(ray, (m) => {
            return m.isPickable && (
                m.name === "enemyBody"      ||
                m.name === "enemyBodyHeavy" ||
                m.name === "enemyBodyScout" ||
                m.name === "weakPoint"      ||
                m._isBossBody
            );
        });

        if (!hit.hit || !hit.pickedMesh) {
            this.hud?.showWaveMessage?.("BLINK — AUCUNE CIBLE");
            return;
        }

        // TP à 1.8m devant l'ennemi (côté joueur)
        const enemyPos   = hit.pickedMesh.getAbsolutePosition();
        const toEnemy    = enemyPos.subtract(this.camera.globalPosition).normalize();
        const blinkPos   = enemyPos.subtract(toEnemy.scale(1.8));
        blinkPos.y       = this.camera.globalPosition.y;

        this.camera.position.copyFrom(blinkPos);
        this._blinkCooldown = this._BLINK_CD;

        // Flash violet
        this._screenFlash("rgba(180,0,255,0.35)", 200);
        this.hud?.showWaveMessage?.("BLINK");
    }

    // ── STOMP (shockwave à l'atterrissage) ───────────────────────────────────

    _updateStomp() {
        if (!this._stompEnabled) return;

        // Détecter si on est en l'air
        const ray = new BABYLON.Ray(this.camera.position, new BABYLON.Vector3(0, -1, 0), 1.15);
        const hit = this.scene.pickWithRay(ray, (m) => m.checkCollisions && m.name !== "weapon");
        const onGround = hit.hit;

        if (!onGround) {
            this._wasInAir = true;
        } else if (this._wasInAir && onGround) {
            // Vient d'atterrir
            this._wasInAir = false;
            if (this.jumpForce <= 0) this._triggerStomp();
        }
    }

    _triggerStomp() {
        const pos    = this.camera.globalPosition;
        const radius = 4;

        // Repousser les ennemis proches
        this.scene.meshes.forEach(m => {
            if (!m.isPickable) return;
            if (!["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) return;
            const dist = BABYLON.Vector3.Distance(m.getAbsolutePosition(), pos);
            if (dist < radius) {
                const dir = m.getAbsolutePosition().subtract(pos).normalize();
                // Impulsion directe sur la position (les ennemis utilisent moveWithCollisions via crowd)
                m.position.addInPlace(dir.scale(3));
                m._takeDamage?.(1);
            }
        });

        // Flash jaune + message
        this._screenFlash("rgba(255,200,0,0.3)", 200);
        this.hud?.showWaveMessage?.("ATTERRISSAGE LOURD");
    }

    // ── BOUCLIER ─────────────────────────────────────────────────────────────

    _tryShield() {
        if (!this._shieldEnabled)      return;
        if (this._shieldCooldown > 0)  return;
        if (this._shieldActive)        return;

        this._shieldActive   = true;
        this._shieldCooldown = this._SHIELD_CD;

        // Bloquer les dégâts pendant 2s
        const origTakeDmg = this.health.takeDamage?.bind(this.health);
        this.health.takeDamage = () => {}; // absorbe tout

        // Overlay bleu
        const overlay = this._screenOverlay("rgba(0,120,255,0.25)", 2000);
        this.hud?.showWaveMessage?.("BOUCLIER ACTIF — 2s");

        setTimeout(() => {
            if (origTakeDmg) this.health.takeDamage = origTakeDmg;
            this._shieldActive = false;
            overlay?.remove();
            this.hud?.showWaveMessage?.("BOUCLIER DÉSACTIVÉ");
        }, 2000);
    }

    // ── BERSERK ───────────────────────────────────────────────────────────────

    _tryBerserk() {
        if (!this._berserkEnabled)      return;
        if (this._berserkCooldown > 0)  return;
        if (this._berserkActive)        return;

        this._berserkActive   = true;
        this._berserkCooldown = this._BERSERK_CD;

        // Buff : dégâts ×2, vitesse +30%, invincibilité
        const prevSpeed  = this.speed;
        const prevDmgMult = this.shootController?.damageMultiplier ?? 1;

        this.speed *= 1.30;
        this.camera.speed = this.speed;
        if (this.shootController) this.shootController.damageMultiplier = prevDmgMult * 2;

        const origTakeDmg = this.health.takeDamage?.bind(this.health);
        this.health.takeDamage = () => {};

        // Overlay rouge pulsé
        const overlay = this._screenOverlay("rgba(255,0,0,0.15)", 10000);
        this.hud?.showWaveMessage?.("⚡ MODE BERSERK — 10s");

        setTimeout(() => {
            this.speed = prevSpeed;
            this.camera.speed = this.speed;
            if (this.shootController) this.shootController.damageMultiplier = prevDmgMult;
            if (origTakeDmg) this.health.takeDamage = origTakeDmg;
            this._berserkActive = false;
            overlay?.remove();
            this.hud?.showWaveMessage?.("BERSERK TERMINÉ");
        }, 10000);
    }

    // ── EMP ───────────────────────────────────────────────────────────────────

    _tryEMP() {
        if (!this._empEnabled)      return;
        if (this._empCooldown > 0)  return;

        this._empCooldown = this._EMP_CD;
        const pos    = this.camera.globalPosition;
        const radius = 4;

        let affected = 0;
        this.scene.meshes.forEach(m => {
            if (!["enemyBody","enemyBodyHeavy","enemyBodyScout"].includes(m.name)) return;
            const dist = BABYLON.Vector3.Distance(m.getAbsolutePosition(), pos);
            if (dist < radius) {
                affected++;
                // Ralentir l'ennemi via son agent crowd
                const agent = m._crowdAgent;
                if (agent != null && this._navManager) {
                    const origSpeed = m._origSpeed ?? 1;
                    m._origSpeed = origSpeed;
                    this._navManager.crowd?.agentUpdateParameters?.(agent, { maxSpeed: origSpeed * 0.15 });
                    setTimeout(() => {
                        this._navManager.crowd?.agentUpdateParameters?.(agent, { maxSpeed: origSpeed });
                    }, 3000);
                }
            }
        });

        this._screenFlash("rgba(0,200,255,0.4)", 300);
        this.hud?.showWaveMessage?.(`GRENADE EMP — ${affected} ennemi(s) ralenti(s)`);
    }

    // ── Helpers visuels ───────────────────────────────────────────────────────

    _screenFlash(color, duration) {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:9998;transition:opacity ${duration}ms`;
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = "0"; });
        setTimeout(() => el.remove(), duration + 50);
        return el;
    }

    _screenOverlay(color, duration) {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;inset:0;background:${color};pointer-events:none;z-index:9997;`;
        document.body.appendChild(el);
        return el;
    }

    // ── Saut ──────────────────────────────────────────────────────────────────

    _jump() {
        if (this.jumpForce > 0) return;
        const ray = new BABYLON.Ray(
            this.camera.position,
            new BABYLON.Vector3(0, -1, 0),
            1.15,
        );
        const hit = this.scene.pickWithRay(
            ray,
            (mesh) => mesh.checkCollisions && mesh.name !== "weapon",
        );
        if (hit.hit) this.jumpForce = 0.4;
    }

    _updateJump() {
        if (this.jumpForce > 0) {
            this.camera.cameraDirection.y += this.jumpForce;
            this.jumpForce -= 0.02;
            if (this.jumpForce <= 0) this.jumpForce = 0;
        }
    }

    // ── Arme ─────────────────────────────────────────────────────────────────

    _initWeapon() {
        const weaponMat = new BABYLON.StandardMaterial("weaponMat", this.scene);
        weaponMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);

        this.weapon = BABYLON.MeshBuilder.CreateBox(
            "weapon",
            { width: 0.15, height: 0.2, depth: 0.6 },
            this.scene,
        );
        this.weapon.material         = weaponMat;
        this.weapon.parent           = this.camera;
        this.weaponOriginalPos       = new BABYLON.Vector3(0.4, -0.4, 1);
        this.weapon.position         = this.weaponOriginalPos.clone();
        this.weaponMinZ              = 0.6;
        this.weapon.layerMask        = 0x10000000;

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
        const newZ = this.weapon.position.z - amount;
        this.weapon.position.z = Math.max(newZ, this.weaponMinZ);
    }

    _updateWeaponRecoilRecovery() {
        if (!this.weapon) return;
        if (this.weapon.position.z < this.weaponOriginalPos.z) {
            this.weapon.position.z = BABYLON.Scalar.Lerp(
                this.weapon.position.z,
                this.weaponOriginalPos.z,
                0.15,
            );
            if (Math.abs(this.weapon.position.z - this.weaponOriginalPos.z) < 0.001) {
                this.weapon.position.z = this.weaponOriginalPos.z;
            }
        }
    }

    // ── Tilt caméra ───────────────────────────────────────────────────────────

    _updateCameraTilt() {
        let targetTilt = 0;
        if (this.inputMap["q"] || this.inputMap["a"]) targetTilt =  0.05;
        else if (this.inputMap["d"])                  targetTilt = -0.05;
        this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, 0.1);
        this.camera.rotation.z = this.currentTilt;
    }

    // ── Bobbing arme ─────────────────────────────────────────────────────────

    _updateWeaponBobbing() {
        const isMovingKb =
            this.inputMap["z"] || this.inputMap["w"] || this.inputMap["s"] ||
            this.inputMap["q"] || this.inputMap["a"] || this.inputMap["d"];
        const isMoving = isMovingKb || this.inputMap["_gp_move"];

        if (isMoving) {
            this.bobTimer += 0.2;
            this.weapon.position.y = this.weaponOriginalPos.y + Math.sin(this.bobTimer) * 0.04;
            this.weapon.position.x = this.weaponOriginalPos.x + Math.cos(this.bobTimer * 0.5) * 0.04;
        } else {
            this.weapon.position.x = BABYLON.Scalar.Lerp(this.weapon.position.x, this.weaponOriginalPos.x, 0.1);
            this.weapon.position.y = BABYLON.Scalar.Lerp(this.weapon.position.y, this.weaponOriginalPos.y, 0.1);
            this.bobTimer = 0;
        }
    }
}