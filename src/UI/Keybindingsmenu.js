/**
 * KeybindingsMenu
 * ---------------
 * Remapping clavier + manette.
 * L'onglet MANETTE affiche un panneau de détection visuel "appuyez sur un bouton"
 * qui détecte et affiche en temps réel la pression des boutons — comme dans les jeux AAA.
 */
export class KeybindingsMenu {

    static DEFAULT_KB_BINDINGS = [
        { id: "moveForward",  label: "AVANCER",         category: "DÉPLACEMENT", keys: ["w", "z"],  icon: "▲" },
        { id: "moveBack",     label: "RECULER",         category: "DÉPLACEMENT", keys: ["s"],        icon: "▼" },
        { id: "moveLeft",     label: "STRAFE GAUCHE",   category: "DÉPLACEMENT", keys: ["a", "q"],  icon: "◄" },
        { id: "moveRight",    label: "STRAFE DROIT",    category: "DÉPLACEMENT", keys: ["d"],        icon: "►" },
        { id: "jump",         label: "SAUTER",          category: "DÉPLACEMENT", keys: ["space"],    icon: "↑" },
        { id: "shoot",        label: "TIRER",           category: "COMBAT",      keys: ["mouse0"],   icon: "◎" },
        { id: "pause",        label: "PAUSE / MENU",    category: "SYSTÈME",     keys: ["enter"],    icon: "⏸" },
    ];

    static GP_ACTIONS = [
        { id: "jump",   label: "SAUTER",        category: "ACTIONS",   icon: "↑" },
        { id: "fire",   label: "TIRER",         category: "ACTIONS",   icon: "◎" },
        { id: "pause",  label: "PAUSE / MENU",  category: "ACTIONS",   icon: "⏸" },
        { id: "back",   label: "RETOUR MENU",   category: "ACTIONS",   icon: "←" },
    ];

    static FORBIDDEN_KEYS = new Set([
        "f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12",
        "printscreen","scrolllock","pause","contextmenu",
    ]);

    constructor(player = null, onPauseKeyChange = null, gamepadManager = null) {
        this.player            = player;
        this._onPauseKeyChange = onPauseKeyChange;
        this.gamepadManager    = gamepadManager;

        this._kbBindings  = null;
        this._gpBindings  = null;
        this._snapshot    = null;
        this._activeTab   = "keyboard";

        // Écoute clavier
        this._listening    = null;
        this._keyHandler   = null;
        this._mouseHandler = null;

        // Écoute manette
        this._gpListening  = null;
        this._gpPollId     = null;
        this._gpPrevStates = [];
    }

    // ── Bindings ──────────────────────────────────────────────────────────────

    getBindings() {
        if (!this._kbBindings)
            this._kbBindings = KeybindingsMenu.DEFAULT_KB_BINDINGS.map(a => ({ ...a, keys: [...a.keys] }));
        return this._kbBindings;
    }

    getPauseKey() {
        return this.getBindings().find(b => b.id === "pause")?.keys[0] ?? "enter";
    }

    _getGpBindings() {
        if (!this._gpBindings)
            this._gpBindings = this.gamepadManager
                ? { ...this.gamepadManager.getBindings() }
                : { jump: 0, fire: 7, pause: 9, back: 1 };
        return this._gpBindings;
    }

    // ── Build ─────────────────────────────────────────────────────────────────

    buildPanel(onBack) {
        this._snapshot = {
            kb: this.getBindings().map(a => ({ ...a, keys: [...a.keys] })),
            gp: this.gamepadManager ? { ...this.gamepadManager.getBindings() } : {},
        };

        const panel = document.createElement("div");
        panel.className = "kb-panel";
        panel.innerHTML = `
            <div class="kb-header">
                <div class="kb-title">TOUCHES</div>
                <div class="kb-subtitle">CLIQUEZ UNE ENTRÉE POUR REBINDER</div>
            </div>
            <div class="kb-tabs">
                <button class="kb-tab active" data-tab="keyboard">⌨ CLAVIER / SOURIS</button>
                <button class="kb-tab" data-tab="gamepad">🎮 MANETTE</button>
            </div>
            <div class="kb-notice" id="kbNotice" style="display:none;">
                <span class="kb-notice-icon" id="kbNoticeIcon">⌨</span>
                <span id="kbNoticeText">APPUYEZ SUR UNE TOUCHE...</span>
                <button class="kb-cancel-listen" id="kbCancelListen">✕ ANNULER</button>
            </div>
            <div class="kb-scroll" id="kbScroll"></div>
            <div class="kb-footer">
                <button class="kb-apply-btn" id="kbApply">✓ APPLIQUER</button>
                <button class="kb-back-btn"  id="kbBack">✕ ANNULER</button>
                <button class="kb-reset-btn" id="kbReset">⟳ DÉFAUTS</button>
            </div>
        `;

        // Onglets
        panel.querySelectorAll(".kb-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                this._stopAll(panel);
                panel.querySelectorAll(".kb-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                this._activeTab = tab.dataset.tab;
                this._renderContent(panel);
                // Notifier le GamepadManager de re-scanner les items
                if (this.gamepadManager?._menuMode) this.gamepadManager._menuDirty = true;
            });
        });

        this._renderContent(panel);
        this._attachFooter(panel, onBack);
        return panel;
    }

    _renderContent(panel) {
        this._activeTab === "keyboard"
            ? this._renderKbRows(panel)
            : this._renderGpPanel(panel);
    }

    // ── ONGLET CLAVIER ────────────────────────────────────────────────────────

    _renderKbRows(panel) {
        const scroll = panel.querySelector("#kbScroll");
        if (!scroll) return;
        scroll.innerHTML = "";

        const bindings   = this.getBindings();
        const categories = [...new Set(bindings.map(b => b.category))];
        const conflicts  = this._detectConflicts(bindings);

        categories.forEach(cat => {
            const sec = document.createElement("div");
            sec.className = "kb-section";
            sec.innerHTML = `<div class="kb-section-hdr"><span class="kb-section-dot"></span><span>${cat}</span></div>`;
            bindings.filter(b => b.category === cat).forEach(a => sec.appendChild(this._buildKbRow(a, conflicts, panel)));
            scroll.appendChild(sec);
        });
    }

    _buildKbRow(action, conflicts, panel) {
        const row = document.createElement("div");
        row.className = "kb-row"; row.dataset.id = action.id;

        const labelSide = document.createElement("div");
        labelSide.className = "kb-row-label-side";
        labelSide.innerHTML = `
            <span class="kb-row-icon">${action.icon}</span>
            <span class="kb-row-label">${action.label}</span>
            ${action.id === "pause" ? `<span class="kb-badge">GLOBAL</span>` : ""}
        `;

        const keysSide = document.createElement("div");
        keysSide.className = "kb-row-keys-side";

        for (let si = 0; si < 2; si++) {
            const key  = action.keys[si] ?? null;
            const slot = document.createElement("div");
            slot.className = "kb-key-slot" + (key ? "" : " kb-key-empty");
            if (key && conflicts.has(`${action.id}:${key}`)) slot.classList.add("kb-conflict");

            slot.innerHTML = `
                <span class="kb-key-label">${key ? this._fmtKey(key) : "+ AJOUTER"}</span>
                ${key ? `<button class="kb-key-clear">×</button>` : ""}
            `;
            slot.addEventListener("click", e => {
                if (e.target.classList.contains("kb-key-clear")) return;
                this._startKbListening(action.id, si, slot, panel);
            });
            slot.querySelector(".kb-key-clear")?.addEventListener("click", e => {
                e.stopPropagation();
                action.keys.splice(si, 1);
                this._renderKbRows(panel);
            });
            keysSide.appendChild(slot);
        }

        row.appendChild(labelSide); row.appendChild(keysSide);
        return row;
    }

    // ── ONGLET MANETTE ────────────────────────────────────────────────────────

    _renderGpPanel(panel) {
        const scroll = panel.querySelector("#kbScroll");
        if (!scroll) return;
        scroll.innerHTML = "";

        const gp          = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g?.connected) : null;
        const isConnected = !!gp;

        // ── Bannière statut ───────────────────────────────────────────────────
        const banner = document.createElement("div");
        banner.className = `kb-gp-banner ${isConnected ? "kb-gp-ok" : "kb-gp-nok"}`;
        banner.innerHTML = isConnected
            ? `<span class="kb-gp-dot">●</span> ${gp.id.substring(0, 48)} — ${gp.buttons.length} BOUTONS · ${gp.axes.length} AXES`
            : `<span class="kb-gp-dot">○</span> AUCUNE MANETTE DÉTECTÉE — BRANCHEZ UNE MANETTE`;
        scroll.appendChild(banner);

        if (!isConnected) return;

        // ── Sensibilité ───────────────────────────────────────────────────────
        const sensSection = document.createElement("div");
        sensSection.className = "kb-section";
        sensSection.innerHTML = `<div class="kb-section-hdr"><span class="kb-section-dot"></span><span>SENSIBILITÉ STICK DROIT</span></div>`;
        sensSection.appendChild(this._buildSlider("HORIZONTAL", 0.01, 0.12, this.gamepadManager?.lookSensitivityH ?? 0.04,
            v => { if (this.gamepadManager) this.gamepadManager.lookSensitivityH = v; }));
        sensSection.appendChild(this._buildSlider("VERTICAL",   0.01, 0.10, this.gamepadManager?.lookSensitivityV ?? 0.03,
            v => { if (this.gamepadManager) this.gamepadManager.lookSensitivityV = v; }));
        sensSection.appendChild(this._buildSlider("ZONE MORTE", 0.05, 0.40, this.gamepadManager?.deadzone ?? 0.15,
            v => { if (this.gamepadManager) this.gamepadManager.deadzone = v; }));
        scroll.appendChild(sensSection);

        // ── Remapping boutons ─────────────────────────────────────────────────
        const bindings   = this._getGpBindings();
        const remapSec   = document.createElement("div");
        remapSec.className = "kb-section";
        remapSec.innerHTML = `<div class="kb-section-hdr"><span class="kb-section-dot"></span><span>BOUTONS</span></div>`;

        KeybindingsMenu.GP_ACTIONS.forEach(action => {
            remapSec.appendChild(this._buildGpRow(action, bindings, panel));
        });
        scroll.appendChild(remapSec);

        // ── Visualiseur de boutons en temps réel ──────────────────────────────
        scroll.appendChild(this._buildButtonVisualizer(panel));
    }

    _buildSlider(label, min, max, value, onChange) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.style.cssText = "flex-direction:column;align-items:flex-start;gap:6px;padding:10px 28px;";

        const top = document.createElement("div");
        top.style.cssText = "display:flex;justify-content:space-between;width:100%;";
        const lbl = document.createElement("span");
        lbl.className = "kb-row-label"; lbl.textContent = label;
        const val = document.createElement("span");
        val.style.cssText = "font-size:10px;color:#00ffcc;font-family:'Courier New',monospace;letter-spacing:1px;";
        val.textContent   = value.toFixed(3);
        top.appendChild(lbl); top.appendChild(val);

        const input = document.createElement("input");
        input.type = "range"; input.min = min; input.max = max;
        input.step = 0.001; input.value = value;
        input.className = "gfx-slider"; input.style.width = "100%";
        input.oninput = e => { const v = parseFloat(e.target.value); val.textContent = v.toFixed(3); onChange(v); };

        row.appendChild(top); row.appendChild(input);
        return row;
    }

    _buildGpRow(action, bindings, panel) {
        const row = document.createElement("div");
        row.className = "kb-row"; row.dataset.id = `gp_${action.id}`;

        const labelSide = document.createElement("div");
        labelSide.className = "kb-row-label-side";
        labelSide.innerHTML = `<span class="kb-row-icon">${action.icon}</span><span class="kb-row-label">${action.label}</span>`;

        const keysSide = document.createElement("div");
        keysSide.className = "kb-row-keys-side";

        const btnIdx = bindings[action.id];
        const slot   = document.createElement("div");
        slot.className = "kb-key-slot";

        const label = this._gpBtnLabel(btnIdx);
        slot.innerHTML = `<span class="kb-key-label">${label}</span>`;
        slot.addEventListener("click", () => this._startGpListening(action.id, slot, panel));

        keysSide.appendChild(slot);
        row.appendChild(labelSide); row.appendChild(keysSide);
        return row;
    }

    // ── Visualiseur temps réel ────────────────────────────────────────────────

    _buildButtonVisualizer(panel) {
        const container = document.createElement("div");
        container.className = "kb-section";
        container.innerHTML = `
            <div class="kb-section-hdr">
                <span class="kb-section-dot"></span>
                <span>VISUALISEUR DE BOUTONS — EN TEMPS RÉEL</span>
            </div>
        `;

        const vizBox = document.createElement("div");
        vizBox.className = "kb-viz-box";
        vizBox.id = "kb-viz-box";

        const gp = [...navigator.getGamepads()].find(g => g?.connected);
        if (!gp) { vizBox.textContent = "Aucune manette."; container.appendChild(vizBox); return container; }

        // Grille de boutons
        const grid = document.createElement("div");
        grid.className = "kb-viz-grid";
        grid.id        = "kb-viz-grid";

        gp.buttons.forEach((_, i) => {
            const btn = document.createElement("div");
            btn.className   = "kb-viz-btn";
            btn.id          = `viz-btn-${i}`;
            btn.textContent = i;
            btn.title       = this._gpBtnLabel(i);
            grid.appendChild(btn);
        });

        // Axes
        const axesRow = document.createElement("div");
        axesRow.className = "kb-viz-axes";
        axesRow.id        = "kb-viz-axes";

        gp.axes.forEach((_, i) => {
            const ax = document.createElement("div");
            ax.className = "kb-viz-axis-wrap";
            ax.innerHTML  = `
                <span class="kb-viz-axis-lbl">AXE ${i}</span>
                <div class="kb-viz-axis-track"><div class="kb-viz-axis-fill" id="viz-ax-${i}"></div></div>
                <span class="kb-viz-axis-val" id="viz-axv-${i}">0.000</span>
            `;
            axesRow.appendChild(ax);
        });

        vizBox.appendChild(grid);
        vizBox.appendChild(axesRow);
        container.appendChild(vizBox);

        // Polling du visualiseur
        if (this._vizPollId) clearInterval(this._vizPollId);
        this._vizPollId = setInterval(() => {
            const g = [...navigator.getGamepads()].find(g => g?.connected);
            if (!g) return;
            g.buttons.forEach((b, i) => {
                const el = document.getElementById(`viz-btn-${i}`);
                if (!el) return;
                el.classList.toggle("kb-viz-btn-pressed",  b.pressed);
                el.classList.toggle("kb-viz-btn-analog",   !b.pressed && b.value > 0.05);
                if (b.value > 0.05) el.style.setProperty("--fill", (b.value * 100).toFixed(0) + "%");
            });
            g.axes.forEach((v, i) => {
                const fill = document.getElementById(`viz-ax-${i}`);
                const valEl = document.getElementById(`viz-axv-${i}`);
                if (!fill || !valEl) return;
                const pct   = ((v + 1) / 2 * 100).toFixed(1);
                fill.style.width = pct + "%";
                fill.style.left  = "0";
                fill.style.background = v > 0 ? "#00ffcc" : "#ff4466";
                valEl.textContent = v.toFixed(3);
            });
        }, 50);

        // Nettoyage quand le panel est retiré du DOM
        panel.addEventListener("remove-viz", () => {
            if (this._vizPollId) clearInterval(this._vizPollId);
        });

        return container;
    }

    // ── Écoute clavier ────────────────────────────────────────────────────────

    _startKbListening(actionId, slotIdx, slotEl, panel) {
        this._stopAll(panel);
        this._listening = { actionId, slotIdx, slotEl };
        slotEl.classList.add("kb-listening");

        const action = this.getBindings().find(b => b.id === actionId);
        this._showNotice(panel, "⌨", `TOUCHE POUR « ${action.label} »...`);

        panel.querySelector("#kbCancelListen").onclick = () => this._stopAll(panel);

        this._keyHandler = e => {
            e.preventDefault(); e.stopPropagation();
            const key = this._normKey(e.key, e.code);
            if (key === "escape" && actionId !== "pause") { this._stopAll(panel); return; }
            if (KeybindingsMenu.FORBIDDEN_KEYS.has(key)) return;
            this._assignKbKey(actionId, slotIdx, key, panel);
        };
        this._mouseHandler = e => {
            e.preventDefault(); e.stopPropagation();
            this._assignKbKey(actionId, slotIdx, `mouse${e.button}`, panel);
        };

        setTimeout(() => {
            window.addEventListener("keydown",   this._keyHandler,   { capture: true });
            window.addEventListener("mousedown", this._mouseHandler, { capture: true });
        }, 150);
    }

    _assignKbKey(actionId, slotIdx, key, panel) {
        this._stopAll(panel);
        const bindings = this.getBindings();
        bindings.forEach(a => { a.keys = a.keys.filter(k => k !== key); });
        const target = bindings.find(b => b.id === actionId);
        if (target) {
            if (slotIdx < target.keys.length) target.keys[slotIdx] = key;
            else target.keys.push(key);
        }
        this._renderKbRows(panel);
        this._flash(panel, actionId);
        if (this.gamepadManager?._menuMode) this.gamepadManager._menuDirty = true;
    }

    // ── Écoute manette ────────────────────────────────────────────────────────

    _startGpListening(actionId, slotEl, panel) {
        this._stopAll(panel);
        this._gpListening = { actionId, slotEl };
        slotEl.classList.add("kb-listening");

        const action = KeybindingsMenu.GP_ACTIONS.find(a => a.id === actionId);
        this._showNotice(panel, "🎮", `BOUTON MANETTE POUR « ${action?.label ?? actionId} »...`);
        panel.querySelector("#kbCancelListen").onclick = () => this._stopAll(panel);

        this._gpPrevStates = [];

        this._gpPollId = setInterval(() => {
            const gp = [...navigator.getGamepads()].find(g => g?.connected);
            if (!gp) return;

            // Premier tour : snapshot sans assigner
            if (this._gpPrevStates.length === 0) {
                this._gpPrevStates = gp.buttons.map(b => b.pressed);
                return;
            }

            for (let i = 0; i < gp.buttons.length; i++) {
                if (gp.buttons[i].pressed && !this._gpPrevStates[i]) {
                    this._assignGpBtn(actionId, i, panel);
                    return;
                }
            }
            this._gpPrevStates = gp.buttons.map(b => b.pressed);
        }, 32);
    }

    _assignGpBtn(actionId, btnIdx, panel) {
        this._stopAll(panel);
        const bindings = this._getGpBindings();
        // Retirer ce bouton de toute autre action
        Object.keys(bindings).forEach(k => { if (bindings[k] === btnIdx) bindings[k] = null; });
        bindings[actionId] = btnIdx;
        this._gpBindings   = bindings;
        this._renderGpPanel(panel);
        this._flash(panel, `gp_${actionId}`);
        if (this.gamepadManager?._menuMode) this.gamepadManager._menuDirty = true;
    }

    // ── Stop tout ─────────────────────────────────────────────────────────────

    _stopAll(panel) {
        // Clavier
        if (this._keyHandler)   { window.removeEventListener("keydown",   this._keyHandler,   { capture: true }); this._keyHandler  = null; }
        if (this._mouseHandler) { window.removeEventListener("mousedown", this._mouseHandler, { capture: true }); this._mouseHandler = null; }
        if (this._listening?.slotEl) this._listening.slotEl.classList.remove("kb-listening");
        this._listening = null;

        // Manette
        if (this._gpPollId) { clearInterval(this._gpPollId); this._gpPollId = null; }
        if (this._gpListening?.slotEl) this._gpListening.slotEl.classList.remove("kb-listening");
        this._gpListening  = null;
        this._gpPrevStates = [];

        // UI notice
        if (panel) { const n = panel.querySelector("#kbNotice"); if (n) n.style.display = "none"; }
    }

    _showNotice(panel, icon, text) {
        const n = panel.querySelector("#kbNotice");
        if (!n) return;
        panel.querySelector("#kbNoticeIcon").textContent = icon;
        panel.querySelector("#kbNoticeText").textContent = text;
        n.style.display = "flex";
    }

    // ── Footer ────────────────────────────────────────────────────────────────

    _attachFooter(panel, onBack) {
        panel.querySelector("#kbApply").onclick = () => {
            this._applyKb(); this._applyGp();
            if (this._onPauseKeyChange) this._onPauseKeyChange(this.getPauseKey());
            this._snapshot = null;
            this._stopViz();
            this._stopAll(panel);
            onBack();
        };
        panel.querySelector("#kbBack").onclick = () => {
            if (this._snapshot) {
                this._kbBindings = this._snapshot.kb?.map(a => ({ ...a, keys: [...a.keys] }));
                if (this._snapshot.gp && this.gamepadManager)
                    Object.entries(this._snapshot.gp).forEach(([k, v]) => this.gamepadManager.setBinding(k, v));
                this._gpBindings = this._snapshot.gp ? { ...this._snapshot.gp } : null;
                this._snapshot = null;
            }
            this._stopViz();
            this._stopAll(panel);
            onBack();
        };
        panel.querySelector("#kbReset").onclick = () => {
            if (this._activeTab === "keyboard") {
                this._kbBindings = KeybindingsMenu.DEFAULT_KB_BINDINGS.map(a => ({ ...a, keys: [...a.keys] }));
                this._renderKbRows(panel);
            } else {
                this._gpBindings = null;
                this.gamepadManager?.resetBindings();
                this._renderGpPanel(panel);
            }
        };
    }

    _stopViz() {
        if (this._vizPollId) { clearInterval(this._vizPollId); this._vizPollId = null; }
    }

    // ── Application ───────────────────────────────────────────────────────────

    _applyKb() {
        if (!this.player) return;
        const get = id => this.getBindings().find(b => b.id === id)?.keys ?? [];
        const codes = keys => keys.filter(k => k && !k.startsWith("mouse")).map(k => this._keyCode(k)).filter(Boolean);
        if (this.player.camera) {
            this.player.camera.keysUp    = codes(get("moveForward"));
            this.player.camera.keysDown  = codes(get("moveBack"));
            this.player.camera.keysLeft  = codes(get("moveLeft"));
            this.player.camera.keysRight = codes(get("moveRight"));
        }
        this.player._keybindings = {
            moveForward: get("moveForward"), moveBack: get("moveBack"),
            moveLeft:    get("moveLeft"),    moveRight: get("moveRight"),
            jump:        get("jump"),        shoot:    get("shoot"),
        };
    }

    _applyGp() {
        if (!this.gamepadManager || !this._gpBindings) return;
        Object.entries(this._gpBindings).forEach(([a, v]) => { if (v != null) this.gamepadManager.setBinding(a, v); });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _detectConflicts(bindings) {
        const seen = new Map(), out = new Set();
        bindings.forEach(action => action.keys.forEach(key => {
            if (!key) return;
            if (seen.has(key)) { out.add(`${action.id}:${key}`); out.add(`${seen.get(key)}:${key}`); }
            else seen.set(key, action.id);
        }));
        return out;
    }

    _flash(panel, id) {
        const row = panel.querySelector(`.kb-row[data-id="${id}"]`);
        if (!row) return;
        row.classList.add("kb-row-flash");
        setTimeout(() => row.classList.remove("kb-row-flash"), 500);
    }

    _normKey(key, code) {
        if (key === " " || code === "Space") return "space";
        if (key === "Enter")  return "enter";
        if (key === "Escape") return "escape";
        return key.toLowerCase();
    }

    _keyCode(key) {
        const M = {
            "a":65,"b":66,"c":67,"d":68,"e":69,"f":70,"g":71,"h":72,"i":73,"j":74,
            "k":75,"l":76,"m":77,"n":78,"o":79,"p":80,"q":81,"r":82,"s":83,"t":84,
            "u":85,"v":86,"w":87,"x":88,"y":89,"z":90,
            "0":48,"1":49,"2":50,"3":51,"4":52,"5":53,"6":54,"7":55,"8":56,"9":57,
            "space":32,"shift":16,"control":17,"alt":18,"escape":27,"enter":13,
            "tab":9,"backspace":8,"arrowup":38,"arrowdown":40,"arrowleft":37,"arrowright":39,
        };
        return M[key] ?? null;
    }

    _fmtKey(key) {
        const L = {
            "space":"ESPACE","escape":"ÉCHAP","enter":"ENTRÉE",
            "mouse0":"CLIC G","mouse1":"CLIC M","mouse2":"CLIC D",
            "arrowup":"↑","arrowdown":"↓","arrowleft":"←","arrowright":"→",
            "shift":"SHIFT","control":"CTRL","alt":"ALT","backspace":"RETOUR","tab":"TAB",
        };
        return L[key] ?? key.toUpperCase();
    }

    _gpBtnLabel(idx) {
        const L = {
            0:"A/✕",1:"B/○",2:"X/□",3:"Y/△",
            4:"LB/L1",5:"RB/R1",6:"LT/L2",7:"RT/R2",
            8:"SELECT",9:"START",10:"L3",11:"R3",
            12:"D↑",13:"D↓",14:"D←",15:"D→",16:"HOME",
        };
        return idx != null ? (L[idx] ?? `BTN ${idx}`) : "—";
    }
}