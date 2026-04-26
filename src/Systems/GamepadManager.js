import * as BABYLON from "@babylonjs/core";

export class GamepadManager {

    static DEFAULT_BINDINGS = {
        jump:    0,   // A / Cross
        back:    1,   // B / Circle
        fire:    7,   // RT / R2
        pause:   9,   // Start / Options
    };

    static BUTTON_LABELS = {
        0:  "BTN SUD (A/✕)",   1:  "BTN EST (B/○)",
        2:  "BTN OUEST (X/□)", 3:  "BTN NORD (Y/△)",
        4:  "LB / L1",         5:  "RB / R1",
        6:  "LT / L2",         7:  "RT / R2",
        8:  "SELECT / BACK",   9:  "START / OPTIONS",
        10: "STICK G. (L3)",   11: "STICK D. (R3)",
        12: "D-PAD ↑",         13: "D-PAD ↓",
        14: "D-PAD ←",         15: "D-PAD →",
        16: "HOME / GUIDE",
    };

    constructor(player = null, onPauseCallback = null) {
        this.player   = player;
        this._onPause = onPauseCallback;

        this._bindings  = { ...GamepadManager.DEFAULT_BINDINGS };
        this._running   = false;
        this._rafId     = null;
        this._lastTime  = 0;

        this._prevButtons = [];
        this._prevAxes    = [];

        // Menu
        this._menuMode     = false;
        this._menuEl       = null;
        this._menuItems    = [];
        this._menuFocusIdx = 0;
        this._menuDirty    = false;

        // Répétition D-pad / stick vertical (navigation liste)
        this._navDir         = 0;
        this._navHoldTime    = 0;
        this._navRepeatDelay = 400;
        this._navRepeatRate  = 120;
        this._navFired       = false;

        // Répétition stick droit horizontal (sliders)
        this._sliderDir      = 0;
        this._sliderHoldTime = 0;
        this._sliderFired    = false;

        // Sensibilité
        this.lookSensitivityH = 0.04;
        this.lookSensitivityV = 0.03;
        this.deadzone         = 0.15;

        this._layoutType       = "unknown";
        this._vibrationEnabled = true;

        // Suivi des touches virtuelles actives (pour le keyup)
        this._gpKeysActive = { up: false, down: false, left: false, right: false };
    }

    // ── API publique ──────────────────────────────────────────────────────────

    start() {
        if (this._running) return;
        this._running  = true;
        this._lastTime = performance.now();
        this._rafId    = requestAnimationFrame(this._loop.bind(this));
        window.addEventListener("gamepadconnected",    e => this._onConnect(e));
        window.addEventListener("gamepaddisconnected", e => this._onDisconnect(e));
    }

    stop() {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
    }

    setMenuMode(active, menuEl = null) {
        const wasActive = this._menuMode;
        this._menuMode  = active;
        if (menuEl) this._menuEl = menuEl;
        if (active && (!wasActive || menuEl)) {
            this._menuDirty   = true;
            this._navDir      = 0;
            this._navHoldTime = 0;
        }

        if (!active) {
            this._clearFocus();
            this.flushMovement();
        }
    }

    refreshMenuRoot(menuEl) {
        if (!menuEl) return;
        this._menuEl    = menuEl;
        this._menuDirty = true;
    }

    /**
     * Vide tout mouvement résiduel : relâche les touches virtuelles et
     * remet cameraDirection à zéro. À appeler à chaque reprise du jeu.
     */
    flushMovement() {
        this._releaseVirtualKeys();
        if (this.player?.camera?.cameraDirection) {
            this.player.camera.cameraDirection.set(0, 0, 0);
        }
        if (this.player) {
            ["_gp_move", "a", "d"].forEach(k => { this.player.inputMap[k] = false; });
        }
    }

    isConnected()      { return this._getGamepad() !== null; }
    getBindings()      { return { ...this._bindings }; }
    setBinding(a, idx) { this._bindings[a] = idx; }
    resetBindings()    { this._bindings = { ...GamepadManager.DEFAULT_BINDINGS }; }

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
        const dt = Math.min(now - this._lastTime, 50);
        this._lastTime = now;

        const gp = this._getGamepad();
        if (gp) {
            if (this._layoutType === "unknown") this._detectLayout(gp);

            if (this._menuMode) {
                this._releaseVirtualKeys(); // s'assurer qu'on ne bouge pas en menu
                this._updateMenuNav(gp, dt);
            } else {
                this._updateGameplay(gp, dt);
            }

            this._prevButtons = gp.buttons.map(b => ({ pressed: b.pressed, value: b.value }));
            this._prevAxes    = [...gp.axes];
        } else {
            this._releaseVirtualKeys();
        }

        this._rafId = requestAnimationFrame(this._loop.bind(this));
    }

    _getGamepad() {
        for (const gp of navigator.getGamepads()) {
            if (gp?.connected) return gp;
        }
        return null;
    }

    // ── Détection layout ──────────────────────────────────────────────────────

    _detectLayout(gp) {
        const id = gp.id.toLowerCase();
        this._layoutType =
            id.includes("logitech") || id.includes("046d") ? "logitech" :
            id.includes("xbox")     || id.includes("xinput") || id.includes("045e") ? "xbox" :
            id.includes("playstation") || id.includes("054c") ? "ps" : "generic";
        console.log(`[Gamepad] Layout : ${this._layoutType} — "${gp.id}"`);
        this._showToast(`🎮 ${gp.id.substring(0, 40)}`);
    }

    // ── D-pad ─────────────────────────────────────────────────────────────────

    _getDpad(gp) {
        if (gp.buttons.length >= 16) {
            const up    = gp.buttons[12]?.pressed ?? false;
            const down  = gp.buttons[13]?.pressed ?? false;
            const left  = gp.buttons[14]?.pressed ?? false;
            const right = gp.buttons[15]?.pressed ?? false;
            if (up || down || left || right) return { up, down, left, right };
        }
        if (gp.axes.length >= 10) {
            const v = gp.axes[9] ?? 1.1;
            if (v <= 1.0) return {
                up: v < -0.6, down: v >= 0.5 && v < 0.9,
                left: v >= -0.5 && v < -0.1,
                right: (v >= -0.1 && v < 0.2) || (v < -0.85 && v > -1),
            };
        }
        if (gp.axes.length >= 8) {
            const vx = gp.axes[6] ?? 0, vy = gp.axes[7] ?? 0;
            if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5)
                return { up: vy < -0.5, down: vy > 0.5, left: vx < -0.5, right: vx > 0.5 };
        }
        return { up: false, down: false, left: false, right: false };
    }

    // ── LT / RT ───────────────────────────────────────────────────────────────

    _getTriggerValue(gp, btnIdx) {
        const btn = gp.buttons[btnIdx];
        if (btn) return btn.value ?? (btn.pressed ? 1 : 0);
        if (btnIdx === 6 && gp.axes.length >= 3) return Math.max(0, -(gp.axes[2] ?? 0));
        if (btnIdx === 7 && gp.axes.length >= 6) return Math.max(0,  (gp.axes[5] ?? 0));
        return 0;
    }

    // ── Gameplay ──────────────────────────────────────────────────────────────
    //
    // FIX VITESSE : au lieu d'appeler cam.cameraDirection.addInPlace() qui
    // contourne la physique interne de Babylon (et donne une vitesse×frames),
    // on dispatche des KeyboardEvent synthétiques sur le canvas.
    // La caméra UniversalCamera les traite exactement comme des touches physiques :
    // même camera.speed, même collision, même gravité, même fréquence.

    _updateGameplay(gp, dt) {
        if (!this.player || this.player.isDead) return;

        const b  = this._bindings;
        const lx = this._dead(gp.axes[0] ?? 0);
        const ly = this._dead(gp.axes[1] ?? 0);

        // Stick gauche → touches virtuelles (même vitesse que clavier)
        this._setVirtualKey("up",    ly < -2);
        this._setVirtualKey("down",  ly >  2);
        this._setVirtualKey("left",  lx < -2);
        this._setVirtualKey("right", lx >  2);

        // inputMap pour tilt/bobbing uniquement (pas de mouvement)
        const moving = Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15;
        this.player.inputMap["_gp_move"] = moving;
        this.player.inputMap["a"]        = lx < -0.15;
        this.player.inputMap["d"]        = lx >  0.15;

        // Stick droit → rotation caméra
        const rx = this._dead(gp.axes[2] ?? 0);
        const ry = this._dead(gp.axes[3] ?? 0);
        if (Math.abs(rx) > 0 || Math.abs(ry) > 0) {
            const cam = this.player.camera;
            cam.rotation.y += rx * this.lookSensitivityH;
            cam.rotation.x  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2,
                cam.rotation.x + ry * this.lookSensitivityV));
        }

        // Saut
        if (this._justPressed(gp, b.jump)) {
            this.player._jump();
            this.vibrate(60, 0.1, 0.3);
        }

        // Tir RT/R2
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

        // Pause
        if (this._justPressed(gp, b.pause)) {
            if (this._onPause) this._onPause();
        }
    }

    // ── Touches virtuelles (KeyboardEvent sur canvas) ─────────────────────────

    _setVirtualKey(dir, active) {
        if (this._gpKeysActive[dir] === active) return;
        this._gpKeysActive[dir] = active;
        const keyCode = this._getDirKeyCode(dir);
        if (keyCode !== null) this._fireKey(active ? "keydown" : "keyup", keyCode);
    }

    _getDirKeyCode(dir) {
        if (!this.player?.camera) return null;
        const cam = this.player.camera;
        switch (dir) {
            case "up":    return cam.keysUp?.[0]    ?? 87;
            case "down":  return cam.keysDown?.[0]  ?? 83;
            case "left":  return cam.keysLeft?.[0]  ?? 65;
            case "right": return cam.keysRight?.[0] ?? 68;
            default:      return null;
        }
    }

    _fireKey(type, keyCode) {
        const canvas = this.player?.scene?.getEngine?.()?.getRenderingCanvas?.();
        if (!canvas) return;
        canvas.dispatchEvent(new KeyboardEvent(type, {
            keyCode, which: keyCode, bubbles: true, cancelable: true,
        }));
    }

    _releaseVirtualKeys() {
        for (const dir of ["up", "down", "left", "right"]) {
            if (this._gpKeysActive[dir]) {
                this._gpKeysActive[dir] = false;
                const kc = this._getDirKeyCode(dir);
                if (kc !== null) this._fireKey("keyup", kc);
            }
        }
        if (this.player) {
            this.player.inputMap["_gp_move"] = false;
            this.player.inputMap["a"]        = false;
            this.player.inputMap["d"]        = false;
        }
    }

    // ── Navigation menu ───────────────────────────────────────────────────────

    _updateMenuNav(gp, dt) {
        const b = this._bindings;

        if (this._menuDirty) {
            this._scanMenuItems();
            this._menuDirty = false;
        }

        // A → activer l'élément focalisé
        if (this._justPressed(gp, b.jump)) {
            const item = this._menuItems[this._menuFocusIdx];
            if (item) {
                this._activateItem(item);
                this.vibrate(40, 0.1, 0.2);
                setTimeout(() => { this._menuDirty = true; }, 80);
            }
        }

        // B → remonter d'un niveau (jamais quitter le jeu)
        if (this._justPressed(gp, b.back)) {
            this._clickBack();
            this.vibrate(30, 0.05, 0.1);
            setTimeout(() => { this._menuDirty = true; }, 80);
        }

        // Start → pause
        if (this._justPressed(gp, b.pause)) {
            if (this._onPause) this._onPause();
        }

        // D-pad / stick gauche vertical → navigation liste
        const dpad = this._getDpad(gp);
        const ly   = this._dead(gp.axes[1] ?? 0);
        const wantUp   = dpad.up   || ly < -0.5;
        const wantDown = dpad.down || ly >  0.5;
        const wantDir  = wantUp ? -1 : wantDown ? 1 : 0;

        if (wantDir !== 0) {
            if (this._navDir !== wantDir) {
                this._navDir = wantDir; this._navHoldTime = 0; this._navFired = false;
                this._moveFocus(wantDir);
            } else {
                this._navHoldTime += dt;
                if (this._navHoldTime >= (this._navFired ? this._navRepeatRate : this._navRepeatDelay)) {
                    this._navHoldTime = 0; this._navFired = true;
                    this._moveFocus(wantDir);
                }
            }
        } else {
            this._navDir = 0; this._navFired = false;
        }

        // Stick droit horizontal → modifier slider focalisé
        const rx = this._dead(gp.axes[2] ?? 0);
        if (Math.abs(rx) > 0.1) {
            const sDir = rx > 0 ? 1 : -1;
            if (this._sliderDir !== sDir) {
                this._sliderDir = sDir; this._sliderHoldTime = 0; this._sliderFired = false;
                this._nudgeSlider(this._menuItems[this._menuFocusIdx], sDir);
            } else {
                this._sliderHoldTime += dt;
                if (this._sliderHoldTime >= (this._sliderFired ? 80 : 300)) {
                    this._sliderHoldTime = 0; this._sliderFired = true;
                    this._nudgeSlider(this._menuItems[this._menuFocusIdx], sDir);
                }
            }
        } else {
            this._sliderDir = 0; this._sliderFired = false;
        }
    }

    /** Active un élément selon son type. */
    _activateItem(el) {
        const tag  = el.tagName?.toLowerCase();
        const type = el.type?.toLowerCase();
        if (tag === "input" && type === "checkbox") {
            el.checked = !el.checked;
            el.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (tag === "input" && type === "range") {
            // contrôlé par le stick droit — A ne fait rien ici
        } else if (tag === "select") {
            el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
            el.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
            el.click();
        }
    }

    /** Déplace un slider d'un step dans la direction donnée. */
    _nudgeSlider(el, dir) {
        if (!el) return;
        let slider = el;
        if (el.tagName?.toLowerCase() !== "input") slider = el.querySelector('input[type="range"]');
        if (!slider || slider.type !== "range") return;
        const step  = parseFloat(slider.step) || 1;
        const min   = parseFloat(slider.min)  || 0;
        const max   = parseFloat(slider.max)  || 100;
        slider.value = Math.min(max, Math.max(min, parseFloat(slider.value) + dir * step));
        slider.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ── Scan des items navigables ─────────────────────────────────────────────

    _scanMenuItems() {
        if (!this._menuEl) return;
        const root = this._findDeepestVisibleContainer(this._menuEl);

        const SELECTOR = [
            'button:not([disabled])',
            'input[type="range"]',
            'input[type="checkbox"]',
            'select',
            '.kb-key-slot',
            '.upgrade-card',
            '.gfx-preset-btn',
            '.kb-tab',
        ].join(', ');

        const all = [...root.querySelectorAll(SELECTOR)].filter(el => {
            if (!el.offsetParent) return false;
            const s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
        });

        const focused = this._menuItems[this._menuFocusIdx];
        this._menuItems    = all;
        this._menuFocusIdx = focused ? Math.max(0, all.indexOf(focused)) : 0;
        this._applyFocus();
    }

    /**
     * Remonte jusqu'au conteneur visible le plus profond.
     * Priorité : .gfx-panel / .kb-panel → #settings-panel → .menu-buttons-container → root
     */
    _findDeepestVisibleContainer(root) {
        const ok = el => el && el.offsetParent !== null && window.getComputedStyle(el).display !== 'none';
        for (const sel of ['.gfx-panel', '.kb-panel']) {
            const el = root.querySelector(sel); if (ok(el)) return el;
        }
        for (const id of ['#settings-panel-pause', '#settings-panel']) {
            const el = root.querySelector(id); if (ok(el)) return el;
        }
        const btns = root.querySelector('.menu-buttons-container');
        if (ok(btns)) return btns;
        return root;
    }

    _moveFocus(delta) {
        if (!this._menuItems.length) return;
        this._menuFocusIdx = (this._menuFocusIdx + delta + this._menuItems.length) % this._menuItems.length;
        this._applyFocus();
        this.vibrate(15, 0, 0.08);
    }

    _applyFocus() {
        this._menuItems.forEach((el, i) => el.classList.toggle("gp-focus", i === this._menuFocusIdx));
        this._menuItems[this._menuFocusIdx]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }

    _clearFocus() {
        this._menuItems.forEach(el => el.classList.remove("gp-focus"));
        this._menuItems = []; this._menuFocusIdx = 0;
    }

    /**
     * B / Circle = remonter d'un niveau.
     * ANNULER (graphismes/touches) > RETOUR (paramètres) > REPRENDRE (pause principal)
     * Le bouton "RETOUR À L'ACCUEIL" n'est jamais déclenché par B.
     */
    _clickBack() {
        if (!this._menuEl) return;
        const root       = this._findDeepestVisibleContainer(this._menuEl);
        const candidates = [...root.querySelectorAll("button")].filter(el => el.offsetParent);

        const tests = [
            el => /ANNULER/i.test(el.innerText),
            el => /RETOUR/.test(el.innerText) && !/ACCUEIL/i.test(el.innerText),
            el => el.classList.contains("kb-back-btn") || el.classList.contains("gfx-back-btn"),
            el => /REPRENDRE/i.test(el.innerText),
        ];

        for (const test of tests) {
            const btn = candidates.find(test);
            if (btn) { btn.click(); setTimeout(() => { this._menuDirty = true; }, 80); return; }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _justPressed(gp, btnIdx) {
        if (btnIdx == null || btnIdx < 0 || btnIdx >= gp.buttons.length) return false;
        return (gp.buttons[btnIdx]?.pressed ?? false) && !(this._prevButtons[btnIdx]?.pressed ?? false);
    }

    _dead(v) {
        if (Math.abs(v) < this.deadzone) return 0;
        return (v > 0 ? 1 : -1) * (Math.abs(v) - this.deadzone) / (1 - this.deadzone);
    }

    _onConnect(e) {
        console.log(`[Gamepad] Connecté : "${e.gamepad.id}"`);
        this._layoutType = "unknown";
        this._showToast("🎮 MANETTE CONNECTÉE");
        if (this._menuMode) this._menuDirty = true;
    }

    _onDisconnect() { this._showToast("⚠ MANETTE DÉCONNECTÉE"); }

    _showToast(msg) {
        document.getElementById("gp-toast")?.remove();
        const t = document.createElement("div");
        t.id = "gp-toast"; t.textContent = msg;
        t.style.cssText = `
            position:fixed;bottom:110px;left:50%;transform:translateX(-50%);
            background:rgba(0,10,15,0.95);border:1px solid rgba(0,255,204,0.5);
            color:#00ffcc;font-family:'Courier New',monospace;font-size:11px;
            letter-spacing:2px;text-transform:uppercase;padding:10px 22px;
            z-index:9999;pointer-events:none;animation:gp-toast-in 0.25s ease-out;
        `;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }

    diagnose() {
        const gp = this._getGamepad();
        if (!gp) { console.warn("[Gamepad] Aucune manette."); return; }
        console.group(`[Gamepad] Diagnostic — "${gp.id}"`);
        gp.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.01) console.log(`  Btn ${i}: ${b.value.toFixed(3)}`); });
        gp.axes.forEach((v, i)    => { if (Math.abs(v) > 0.01)         console.log(`  Axe ${i}: ${v.toFixed(4)}`); });
        console.groupEnd();
    }
}