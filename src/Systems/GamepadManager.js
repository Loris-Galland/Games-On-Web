import * as BABYLON from "@babylonjs/core";

/**
 * GamepadManager
 * --------------
 * Prise en charge robuste des manettes (Xbox, PS, Logitech, génériques).
 *
 * Problèmes Logitech résolus :
 *   - D-pad sur AXE 9 (valeurs discrètes) au lieu des boutons 12-15
 *   - Boutons décalés par rapport au standard Xbox
 *   - LT/RT sur axes 2/5 au lieu de boutons 6/7
 *
 * Navigation menu :
 *   - D-pad OU stick gauche pour naviguer
 *   - Focus stable (pas de re-scan à chaque frame)
 *   - Répétition avec délai quand maintenu
 */
export class GamepadManager {

    // ── Layout par défaut (détecté automatiquement) ───────────────────────────

    static DEFAULT_BINDINGS = {
        jump:    0,   // A / Cross / bas gauche Logitech
        back:    1,   // B / Circle
        fire:    7,   // RT / R2  — ou axe si analogique
        pause:   9,   // Start / Options
    };

    // Tous les boutons possibles avec leurs labels lisibles
    static BUTTON_LABELS = {
        0:  "BTN SUD (A/✕)",
        1:  "BTN EST (B/○)",
        2:  "BTN OUEST (X/□)",
        3:  "BTN NORD (Y/△)",
        4:  "LB / L1",
        5:  "RB / R1",
        6:  "LT / L2",
        7:  "RT / R2",
        8:  "SELECT / BACK",
        9:  "START / OPTIONS",
        10: "STICK G. (L3)",
        11: "STICK D. (R3)",
        12: "D-PAD ↑",
        13: "D-PAD ↓",
        14: "D-PAD ←",
        15: "D-PAD →",
        16: "HOME / GUIDE",
    };

    constructor(player = null, onPauseCallback = null) {
        this.player   = player;
        this._onPause = onPauseCallback;

        this._bindings  = { ...GamepadManager.DEFAULT_BINDINGS };
        this._running   = false;
        this._rafId     = null;
        this._lastTime  = 0;

        // Snapshots boutons/axes du frame précédent
        this._prevButtons = [];
        this._prevAxes    = [];

        // Menu
        this._menuMode     = false;
        this._menuEl       = null;
        this._menuItems    = [];
        this._menuFocusIdx = 0;
        this._menuDirty    = false; // flag pour re-scanner les items

        // Répétition D-pad / stick
        this._navDir        = 0;    // -1 haut, 0 neutre, +1 bas
        this._navHoldTime   = 0;
        this._navRepeatDelay = 400; // ms avant 1ère répétition
        this._navRepeatRate  = 120; // ms entre répétitions
        this._navFired       = false;

        // Sensibilité
        this.lookSensitivityH = 0.04;
        this.lookSensitivityV = 0.03;
        this.deadzone         = 0.15;

        // Détection layout manette
        this._layoutType = "unknown"; // "xbox" | "logitech" | "generic"

        this._vibrationEnabled = true;
    }

    // ── API publique ──────────────────────────────────────────────────────────

    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._rafId = requestAnimationFrame(this._loop.bind(this));
        window.addEventListener("gamepadconnected",    (e) => this._onConnect(e));
        window.addEventListener("gamepaddisconnected", (e) => this._onDisconnect(e));
    }

    stop() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    /** Active la navigation menu. menuEl = conteneur racine du menu visible. */
    setMenuMode(active, menuEl = null) {
        const wasActive = this._menuMode;
        this._menuMode  = active;
        if (menuEl) this._menuEl = menuEl;
        if (active && (!wasActive || menuEl)) {
            this._menuDirty    = true;
            this._navDir       = 0;
            this._navHoldTime  = 0;
        }
        if (!active) {
            this._clearFocus();
        }
    }

    isConnected() {
        return this._getGamepad() !== null;
    }

    getBindings()  { return { ...this._bindings }; }
    setBinding(action, buttonIdx) { this._bindings[action] = buttonIdx; }
    resetBindings() { this._bindings = { ...GamepadManager.DEFAULT_BINDINGS }; }

    vibrate(duration = 80, strong = 0.3, weak = 0.6) {
        if (!this._vibrationEnabled) return;
        const gp = this._getGamepad();
        gp?.vibrationActuator?.playEffect?.("dual-rumble", {
            startDelay: 0, duration, weakMagnitude: weak, strongMagnitude: strong,
        }).catch?.(() => {});
    }

    // ── Boucle RAF ────────────────────────────────────────────────────────────

    _loop(now) {
        if (!this._running) return;
        const dt = Math.min((now - this._lastTime), 50); // cap à 50ms
        this._lastTime = now;

        const gp = this._getGamepad();
        if (gp) {
            // Détection layout au premier frame
            if (this._layoutType === "unknown") this._detectLayout(gp);

            if (this._menuMode) {
                this._updateMenuNav(gp, dt);
            } else {
                this._updateGameplay(gp, dt);
            }

            // Snapshot pour détection "just pressed"
            this._prevButtons = gp.buttons.map(b => ({ pressed: b.pressed, value: b.value }));
            this._prevAxes    = [...gp.axes];
        }

        this._rafId = requestAnimationFrame(this._loop.bind(this));
    }

    _getGamepad() {
        // Prend la première manette connectée (index peut varier)
        const pads = navigator.getGamepads();
        for (const gp of pads) {
            if (gp && gp.connected) return gp;
        }
        return null;
    }

    // ── Détection du layout ───────────────────────────────────────────────────

    _detectLayout(gp) {
        const id = gp.id.toLowerCase();
        if (id.includes("logitech") || id.includes("logicool") || id.includes("046d")) {
            this._layoutType = "logitech";
        } else if (id.includes("xbox") || id.includes("xinput") || id.includes("045e")) {
            this._layoutType = "xbox";
        } else if (id.includes("playstation") || id.includes("dualshock") || id.includes("054c")) {
            this._layoutType = "ps";
        } else {
            this._layoutType = "generic";
        }
        console.log(`[Gamepad] Layout détecté : ${this._layoutType} — ID: "${gp.id}"`);
        this._showToast(`🎮 ${gp.id.substring(0, 40)}`);
    }

    // ── Lecture D-pad (boutons 12-15 OU axe 9 pour Logitech) ─────────────────

    _getDpad(gp) {
        // Méthode 1 : boutons standards 12-15
        if (gp.buttons.length >= 16) {
            const up    = gp.buttons[12]?.pressed ?? false;
            const down  = gp.buttons[13]?.pressed ?? false;
            const left  = gp.buttons[14]?.pressed ?? false;
            const right = gp.buttons[15]?.pressed ?? false;
            if (up || down || left || right) return { up, down, left, right };
        }

        // Méthode 2 : axe 9 (Logitech F310/F710 en mode DirectInput)
        // Valeurs : -1=↑, -0.71=↗, 0=→, 0.43=↘, 0.71=↓, 1=↙, -0.43=↖, reste=neutre
        if (gp.axes.length >= 10) {
            const v = gp.axes[9] ?? 1.1;
            if (v <= 1.0) { // 1.1 = neutre sur certains pilotes
                return {
                    up:    v < -0.9 || v < -0.6,
                    down:  v >= 0.5 && v < 0.9,
                    left:  v >= -0.5 && v < -0.1,
                    right: (v >= -0.1 && v < 0.2) || (v < -0.85 && v > -1),
                };
            }
        }

        // Méthode 3 : axe 7 (autre variante)
        if (gp.axes.length >= 8) {
            const vx = gp.axes[6] ?? 0;
            const vy = gp.axes[7] ?? 0;
            if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
                return {
                    up:    vy < -0.5,
                    down:  vy >  0.5,
                    left:  vx < -0.5,
                    right: vx >  0.5,
                };
            }
        }

        return { up: false, down: false, left: false, right: false };
    }

    // ── LT / RT robuste (bouton OU axe) ──────────────────────────────────────

    _getTriggerValue(gp, btnIdx) {
        // Essaie d'abord comme bouton (Xbox, PS)
        const btn = gp.buttons[btnIdx];
        if (btn) return btn.value ?? (btn.pressed ? 1 : 0);

        // LT = axe 2, RT = axe 5 sur Logitech DirectInput
        if (btnIdx === 6 && gp.axes.length >= 3) return Math.max(0, -(gp.axes[2] ?? 0));
        if (btnIdx === 7 && gp.axes.length >= 6) return Math.max(0,  (gp.axes[5] ?? 0));

        return 0;
    }

    // ── Gameplay ──────────────────────────────────────────────────────────────

    _updateGameplay(gp, dt) {
        if (!this.player || this.player.isDead) return;

        const b = this._bindings;

        // ── Stick gauche → déplacement ────────────────────────────────────────
        const lx = this._dead(gp.axes[0] ?? 0);
        const ly = this._dead(gp.axes[1] ?? 0);

        if (Math.abs(lx) > 0 || Math.abs(ly) > 0) {
            const cam   = this.player.camera;
            const yaw   = cam.rotation.y;
            const fwd   = new BABYLON.Vector3(Math.sin(yaw), 0,  Math.cos(yaw));
            const right = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
            const move  = fwd.scale(-ly).add(right.scale(lx));
            cam.cameraDirection.addInPlace(move.scale(this.player.speed * 0.6));
            this.player.inputMap["_gp_move"] = true;
            this.player.inputMap["a"] = lx < -0.3;
            this.player.inputMap["d"] = lx >  0.3;
        } else {
            this.player.inputMap["_gp_move"] = false;
            this.player.inputMap["a"] = false;
            this.player.inputMap["d"] = false;
        }

        // ── Stick droit → caméra ──────────────────────────────────────────────
        const rx = this._dead(gp.axes[2] ?? 0);
        const ry = this._dead(gp.axes[3] ?? 0);
        if (Math.abs(rx) > 0 || Math.abs(ry) > 0) {
            const cam = this.player.camera;
            cam.rotation.y += rx * this.lookSensitivityH;
            cam.rotation.x  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2,
                cam.rotation.x + ry * this.lookSensitivityV));
        }

        // ── Saut ─────────────────────────────────────────────────────────────
        if (this._justPressed(gp, b.jump)) {
            this.player._jump();
            this.vibrate(60, 0.1, 0.3);
        }

        // ── Tir (RT/R2 — valeur analogique ou bouton) ─────────────────────────
        const rt = this._getTriggerValue(gp, b.fire);
        if (rt > 0.5) {
            const sc  = this.player.shootController;
            const now = Date.now();
            if (sc && now - sc.lastFireTime >= sc.fireRate) {
                sc.lastFireTime = now;
                sc.fireBasicDagger();
                this.vibrate(40, 0.15, 0.4);
            }
        }

        // ── Pause ─────────────────────────────────────────────────────────────
        if (this._justPressed(gp, b.pause)) {
            if (this._onPause) this._onPause();
        }
    }

    // ── Navigation menu ───────────────────────────────────────────────────────

    _updateMenuNav(gp, dt) {
        const b = this._bindings;

        // Re-scan des items si le DOM a changé
        if (this._menuDirty) {
            this._scanMenuItems();
            this._menuDirty = false;
        }

        // ── Confirmer (bouton jump = A/Cross) ─────────────────────────────────
        if (this._justPressed(gp, b.jump)) {
            const item = this._menuItems[this._menuFocusIdx];
            if (item) {
                item.click();
                this.vibrate(40, 0.1, 0.2);
                // Le click peut changer le DOM — re-scanner au prochain frame
                setTimeout(() => { this._menuDirty = true; }, 60);
            }
        }

        // ── Retour (bouton back = B/Circle) ──────────────────────────────────
        if (this._justPressed(gp, b.back)) {
            this._clickBack();
            this.vibrate(30, 0.05, 0.1);
            setTimeout(() => { this._menuDirty = true; }, 60);
        }

        // ── Pause / Start ─────────────────────────────────────────────────────
        if (this._justPressed(gp, b.pause)) {
            if (this._onPause) this._onPause();
        }

        // ── D-pad ou stick gauche → navigation ────────────────────────────────
        const dpad = this._getDpad(gp);
        const ly   = this._dead(gp.axes[1] ?? 0);

        const wantUp   = dpad.up   || ly < -0.5;
        const wantDown = dpad.down || ly >  0.5;
        const wantDir  = wantUp ? -1 : wantDown ? 1 : 0;

        if (wantDir !== 0) {
            if (this._navDir !== wantDir) {
                // Nouveau départ
                this._navDir      = wantDir;
                this._navHoldTime = 0;
                this._navFired    = false;
                this._moveFocus(wantDir);
            } else {
                // Maintien — répétition avec délai
                this._navHoldTime += dt;
                const threshold = this._navFired ? this._navRepeatRate : this._navRepeatDelay;
                if (this._navHoldTime >= threshold) {
                    this._navHoldTime = 0;
                    this._navFired    = true;
                    this._moveFocus(wantDir);
                }
            }
        } else {
            this._navDir    = 0;
            this._navFired  = false;
        }
    }

    _scanMenuItems() {
        if (!this._menuEl) return;
        const all = [...this._menuEl.querySelectorAll(
            'button:not([disabled]), .kb-key-slot, .upgrade-card, .gfx-preset-btn, .kb-tab'
        )].filter(el => {
            if (!el.offsetParent) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });

        // Conserver le focus sur le même élément si possible
        const focused = this._menuItems[this._menuFocusIdx];
        this._menuItems = all;

        if (focused) {
            const newIdx = all.indexOf(focused);
            this._menuFocusIdx = newIdx >= 0 ? newIdx : 0;
        } else {
            this._menuFocusIdx = 0;
        }
        this._applyFocus();
    }

    _moveFocus(delta) {
        if (this._menuItems.length === 0) return;
        this._menuFocusIdx = (this._menuFocusIdx + delta + this._menuItems.length) % this._menuItems.length;
        this._applyFocus();
        this.vibrate(15, 0, 0.08);
    }

    _applyFocus() {
        this._menuItems.forEach((el, i) => {
            el.classList.toggle("gp-focus", i === this._menuFocusIdx);
        });
        const focused = this._menuItems[this._menuFocusIdx];
        focused?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }

    _clearFocus() {
        this._menuItems.forEach(el => el.classList.remove("gp-focus"));
    }

    _clickBack() {
        if (!this._menuEl) return;
        // Cherche dans l'ordre : bouton RETOUR, ANNULER, REPRENDRE
        const candidates = [...this._menuEl.querySelectorAll("button")].filter(el => el.offsetParent);
        const back = candidates.find(el => {
            const t = el.innerText;
            return t.includes("RETOUR") || t.includes("ANNULER") || t.includes("REPRENDRE") || el.classList.contains("kb-back-btn");
        });
        if (back) {
            back.click();
            setTimeout(() => { this._menuDirty = true; }, 60);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _justPressed(gp, btnIdx) {
        if (btnIdx == null || btnIdx < 0 || btnIdx >= gp.buttons.length) return false;
        const curr = gp.buttons[btnIdx]?.pressed ?? false;
        const prev = this._prevButtons[btnIdx]?.pressed ?? false;
        return curr && !prev;
    }

    _dead(v) {
        if (Math.abs(v) < this.deadzone) return 0;
        const s = v > 0 ? 1 : -1;
        return s * (Math.abs(v) - this.deadzone) / (1 - this.deadzone);
    }

    _onConnect(e) {
        console.log(`[Gamepad] Connecté : "${e.gamepad.id}" — ${e.gamepad.buttons.length} boutons, ${e.gamepad.axes.length} axes`);
        this._layoutType = "unknown";
        this._showToast("🎮 MANETTE CONNECTÉE");
        if (this._menuMode) this._menuDirty = true;
    }

    _onDisconnect() {
        this._showToast("⚠ MANETTE DÉCONNECTÉE");
    }

    _showToast(msg) {
        document.getElementById("gp-toast")?.remove();
        const t = document.createElement("div");
        t.id = "gp-toast";
        t.textContent = msg;
        t.style.cssText = `
            position:fixed;bottom:110px;left:50%;transform:translateX(-50%);
            background:rgba(0,10,15,0.95);border:1px solid rgba(0,255,204,0.5);
            color:#00ffcc;font-family:'Courier New',monospace;font-size:11px;
            letter-spacing:2px;text-transform:uppercase;padding:10px 22px;
            z-index:9999;pointer-events:none;
            animation:gp-toast-in 0.25s ease-out;
        `;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    // ── Outil de diagnostic (appelle depuis la console) ───────────────────────

    diagnose() {
        const gp = this._getGamepad();
        if (!gp) { console.warn("[Gamepad] Aucune manette."); return; }
        console.group(`[Gamepad] Diagnostic — "${gp.id}"`);
        console.log("Layout détecté :", this._layoutType);
        gp.buttons.forEach((b, i) => {
            if (b.pressed || b.value > 0.01)
                console.log(`  Bouton ${i}: pressed=${b.pressed} value=${b.value.toFixed(3)}`);
        });
        gp.axes.forEach((v, i) => {
            if (Math.abs(v) > 0.01)
                console.log(`  Axe ${i}: ${v.toFixed(4)}`);
        });
        console.groupEnd();
    }
}