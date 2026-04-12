/**
 * KeybindingsMenu
 * ---------------
 * Panneau de remapping de touches style AAA.
 *
 * La touche PAUSE est gérée en dehors du Player (dans main.js).
 * Pour être notifié quand elle change, passe un callback :
 *
 *   const kb = new KeybindingsMenu(player, (newKey) => {
 *       myPauseKey = newKey; // mettre à jour ton listener clavier ici
 *   });
 *
 * Dans ton main.js, remplace la comparaison de touche statique par :
 *   let pauseKey = "enter"; // touche par défaut
 *   document.addEventListener("keydown", e => {
 *       if (e.key.toLowerCase() === pauseKey || e.key === "Enter" && pauseKey === "enter") {
 *           togglePause();
 *       }
 *   });
 */
export class KeybindingsMenu {

    static DEFAULT_BINDINGS = [
        { id: "moveForward",  label: "AVANCER",         category: "DÉPLACEMENT", keys: ["w", "z"],   icon: "▲" },
        { id: "moveBack",     label: "RECULER",         category: "DÉPLACEMENT", keys: ["s"],         icon: "▼" },
        { id: "moveLeft",     label: "STRAFE GAUCHE",   category: "DÉPLACEMENT", keys: ["a", "q"],   icon: "◄" },
        { id: "moveRight",    label: "STRAFE DROIT",    category: "DÉPLACEMENT", keys: ["d"],         icon: "►" },
        { id: "jump",         label: "SAUTER",          category: "DÉPLACEMENT", keys: ["space"],     icon: "↑" },
        { id: "shoot",        label: "TIRER",           category: "COMBAT",      keys: ["mouse0"],    icon: "◎" },
        // Gérée globalement dans main.js — le callback onPauseKeyChange notifie le changement
        { id: "pause",        label: "PAUSE / MENU",    category: "SYSTÈME",     keys: ["enter"],     icon: "⏸" },
    ];

    static FORBIDDEN_KEYS = new Set([
        "f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12",
        "printscreen","scrolllock","pause","contextmenu",
    ]);

    constructor(player = null, onPauseKeyChange = null) {
        this.player            = player;
        this._onPauseKeyChange = onPauseKeyChange;
        this._bindings         = null;
        this._snapshot         = null;
        this._listening        = null;
        this._keyHandler       = null;
        this._mouseHandler     = null;
    }

    getBindings() {
        if (!this._bindings) {
            this._bindings = KeybindingsMenu.DEFAULT_BINDINGS.map(a => ({ ...a, keys: [...a.keys] }));
        }
        return this._bindings;
    }

    getPauseKey() {
        return this.getBindings().find(b => b.id === "pause")?.keys[0] ?? "enter";
    }

    buildPanel(onBack) {
        this._snapshot = this.getBindings().map(a => ({ ...a, keys: [...a.keys] }));

        const panel = document.createElement("div");
        panel.className = "kb-panel";
        panel.innerHTML = `
            <div class="kb-header">
                <div class="kb-title">TOUCHES</div>
                <div class="kb-subtitle">REMAPPING CLAVIER — CLIQUEZ UNE ENTRÉE POUR REBINDER</div>
            </div>
            <div class="kb-notice" id="kbNotice" style="display:none;">
                <span class="kb-notice-icon">⌨</span>
                <span id="kbNoticeText">APPUYEZ SUR UNE TOUCHE...</span>
                <button class="kb-cancel-listen" id="kbCancelListen">ANNULER</button>
            </div>
            <div class="kb-scroll" id="kbScroll"></div>
            <div class="kb-footer">
                <button class="kb-apply-btn" id="kbApply">✓ APPLIQUER</button>
                <button class="kb-back-btn"  id="kbBack">✕ ANNULER</button>
                <button class="kb-reset-btn" id="kbReset">⟳ DÉFAUTS</button>
            </div>
        `;

        this._renderRows(panel);
        this._attachFooter(panel, onBack);
        return panel;
    }

    _renderRows(panel) {
        const scroll = panel.querySelector("#kbScroll");
        if (!scroll) return;
        scroll.innerHTML = "";

        const bindings   = this.getBindings();
        const categories = [...new Set(bindings.map(b => b.category))];
        const conflicts  = this._detectConflicts(bindings);

        categories.forEach(cat => {
            const section = document.createElement("div");
            section.className = "kb-section";

            const hdr = document.createElement("div");
            hdr.className = "kb-section-hdr";
            hdr.innerHTML = `<span class="kb-section-dot"></span><span>${cat}</span>`;
            section.appendChild(hdr);

            bindings.filter(b => b.category === cat).forEach(action => {
                section.appendChild(this._buildRow(action, conflicts, panel));
            });

            scroll.appendChild(section);
        });
    }

    _buildRow(action, conflicts, panel) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.dataset.id = action.id;

        const isPause = action.id === "pause";

        const labelSide = document.createElement("div");
        labelSide.className = "kb-row-label-side";
        labelSide.innerHTML = `
            <span class="kb-row-icon">${action.icon}</span>
            <span class="kb-row-label">${action.label}</span>
            ${isPause ? `<span class="kb-badge" title="Touche gérée globalement via callback">GLOBAL</span>` : ""}
        `;

        const keysSide = document.createElement("div");
        keysSide.className = "kb-row-keys-side";

        for (let slotIdx = 0; slotIdx < 2; slotIdx++) {
            const key  = action.keys[slotIdx] ?? null;
            const slot = document.createElement("div");
            slot.className = "kb-key-slot" + (key ? "" : " kb-key-empty");
            if (key && conflicts.has(`${action.id}:${key}`)) slot.classList.add("kb-conflict");

            slot.innerHTML = `
                <span class="kb-key-label">${key ? this._formatKey(key) : "+ AJOUTER"}</span>
                ${key ? `<button class="kb-key-clear" data-action="${action.id}" data-slot="${slotIdx}">×</button>` : ""}
            `;

            slot.addEventListener("click", (e) => {
                if (e.target.classList.contains("kb-key-clear")) return;
                this._startListening(action.id, slotIdx, slot, panel);
            });

            slot.querySelector(".kb-key-clear")?.addEventListener("click", (e) => {
                e.stopPropagation();
                this._clearKey(action.id, slotIdx, panel);
            });

            keysSide.appendChild(slot);
        }

        row.appendChild(labelSide);
        row.appendChild(keysSide);
        return row;
    }

    _startListening(actionId, slotIdx, slotEl, panel) {
        this._stopListening(false);
        this._listening = { actionId, slotIdx, slotEl };
        slotEl.classList.add("kb-listening");

        const action    = this.getBindings().find(b => b.id === actionId);
        const noticeEl  = panel.querySelector("#kbNotice");
        const noticeText = panel.querySelector("#kbNoticeText");
        if (noticeEl) {
            noticeText.textContent = `APPUYEZ SUR UNE TOUCHE POUR « ${action.label} »...`;
            noticeEl.style.display = "flex";
        }
        panel.querySelector("#kbCancelListen").onclick = () => this._stopListening(true, panel);

        this._keyHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = this._normalizeKey(e.key, e.code);
            // Échap annule sauf si on bind justement la touche pause
            if (key === "escape" && actionId !== "pause") { this._stopListening(true, panel); return; }
            if (KeybindingsMenu.FORBIDDEN_KEYS.has(key)) return;
            this._assignKey(actionId, slotIdx, key, panel);
        };
        this._mouseHandler = (e) => {
            if (e.button >= 0) this._assignKey(actionId, slotIdx, `mouse${e.button}`, panel);
        };

        setTimeout(() => {
            window.addEventListener("keydown",   this._keyHandler,   { capture: true });
            window.addEventListener("mousedown", this._mouseHandler, { capture: true });
        }, 150);
    }

    _stopListening(restoreUI = true, panel = null) {
        if (this._keyHandler)   { window.removeEventListener("keydown",   this._keyHandler,   { capture: true }); this._keyHandler  = null; }
        if (this._mouseHandler) { window.removeEventListener("mousedown", this._mouseHandler, { capture: true }); this._mouseHandler = null; }
        if (this._listening?.slotEl) this._listening.slotEl.classList.remove("kb-listening");
        this._listening = null;
        if (restoreUI && panel) {
            const n = panel.querySelector("#kbNotice");
            if (n) n.style.display = "none";
        }
    }

    _assignKey(actionId, slotIdx, key, panel) {
        this._stopListening(true, panel);
        const bindings = this.getBindings();
        bindings.forEach(a => { a.keys = a.keys.map(k => k === key ? null : k).filter(Boolean); });
        const target = bindings.find(b => b.id === actionId);
        if (target) {
            if (slotIdx < target.keys.length) target.keys[slotIdx] = key;
            else target.keys.push(key);
        }
        this._renderRows(panel);
        const row = panel.querySelector(`.kb-row[data-id="${actionId}"]`);
        if (row) { row.classList.add("kb-row-flash"); setTimeout(() => row.classList.remove("kb-row-flash"), 500); }
    }

    _clearKey(actionId, slotIdx, panel) {
        const target = this.getBindings().find(b => b.id === actionId);
        if (target) target.keys.splice(slotIdx, 1);
        this._renderRows(panel);
    }

    _detectConflicts(bindings) {
        const seen = new Map(), conflicts = new Set();
        bindings.forEach(action => {
            action.keys.forEach(key => {
                if (!key) return;
                if (seen.has(key)) { conflicts.add(`${action.id}:${key}`); conflicts.add(`${seen.get(key)}:${key}`); }
                else seen.set(key, action.id);
            });
        });
        return conflicts;
    }

    _attachFooter(panel, onBack) {
        panel.querySelector("#kbApply").onclick = () => {
            this._applyToPlayer();
            if (this._onPauseKeyChange) this._onPauseKeyChange(this.getPauseKey());
            this._snapshot = null;
            this._stopListening(true, panel);
            onBack();
        };
        panel.querySelector("#kbBack").onclick = () => {
            if (this._snapshot) { this._bindings = this._snapshot.map(a => ({ ...a, keys: [...a.keys] })); this._snapshot = null; }
            this._stopListening(true, panel);
            onBack();
        };
        panel.querySelector("#kbReset").onclick = () => {
            this._bindings = KeybindingsMenu.DEFAULT_BINDINGS.map(a => ({ ...a, keys: [...a.keys] }));
            this._renderRows(panel);
        };
    }

    _applyToPlayer() {
        if (!this.player) return;
        const get = (id) => this.getBindings().find(b => b.id === id)?.keys ?? [];
        const toKeyCodes = (keys) => keys.filter(k => k && !k.startsWith("mouse")).map(k => this._keyToCode(k)).filter(Boolean);
        if (this.player.camera) {
            this.player.camera.keysUp    = toKeyCodes(get("moveForward"));
            this.player.camera.keysDown  = toKeyCodes(get("moveBack"));
            this.player.camera.keysLeft  = toKeyCodes(get("moveLeft"));
            this.player.camera.keysRight = toKeyCodes(get("moveRight"));
        }
        this.player._keybindings = {
            moveForward: get("moveForward"), moveBack: get("moveBack"),
            moveLeft: get("moveLeft"),       moveRight: get("moveRight"),
            jump:     get("jump"),           shoot:    get("shoot"),
        };
    }

    _normalizeKey(key, code) {
        if (key === " " || code === "Space") return "space";
        if (key === "Enter")  return "enter";
        if (key === "Escape") return "escape";
        return key.toLowerCase();
    }

    _keyToCode(key) {
        const MAP = {
            "a":65,"b":66,"c":67,"d":68,"e":69,"f":70,"g":71,"h":72,"i":73,"j":74,
            "k":75,"l":76,"m":77,"n":78,"o":79,"p":80,"q":81,"r":82,"s":83,"t":84,
            "u":85,"v":86,"w":87,"x":88,"y":89,"z":90,
            "0":48,"1":49,"2":50,"3":51,"4":52,"5":53,"6":54,"7":55,"8":56,"9":57,
            "space":32,"shift":16,"control":17,"alt":18,"escape":27,"enter":13,
            "tab":9,"backspace":8,"arrowup":38,"arrowdown":40,"arrowleft":37,"arrowright":39,
        };
        return MAP[key] ?? null;
    }

    _formatKey(key) {
        const L = {
            "space":"ESPACE","escape":"ÉCHAP","enter":"ENTRÉE",
            "mouse0":"CLIC G","mouse1":"CLIC M","mouse2":"CLIC D",
            "arrowup":"↑","arrowdown":"↓","arrowleft":"←","arrowright":"→",
            "shift":"SHIFT","control":"CTRL","alt":"ALT","backspace":"RETOUR","tab":"TAB",
        };
        return L[key] ?? key.toUpperCase();
    }
}