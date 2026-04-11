/**
 * KeybindingsMenu
 * ---------------
 * Panneau de remapping de touches style AAA.
 * S'intègre dans MainMenu et PauseMenu comme le GraphicsMenu.
 *
 * Usage :
 *   const kb = new KeybindingsMenu(player);
 *   const panel = kb.buildPanel(() => goBack());
 *   container.appendChild(panel);
 *
 * Le panneau gère :
 *   - Affichage de toutes les actions avec leur touche actuelle
 *   - Clic pour entrer en mode "écoute" (waiting for key)
 *   - Détection de conflits (même touche = deux actions)
 *   - RESET global vers les défauts
 *   - APPLIQUER / ANNULER avec snapshot
 *   - Application live au Player (camera.keysUp/Down/Left/Right + jump + shoot)
 */
export class KeybindingsMenu {

    // ── Définition des actions et leur état par défaut ────────────────────────
    static DEFAULT_BINDINGS = [
        { id: "moveForward",  label: "AVANCER",            category: "DÉPLACEMENT", keys: ["w", "z"],     icon: "▲" },
        { id: "moveBack",     label: "RECULER",            category: "DÉPLACEMENT", keys: ["s"],           icon: "▼" },
        { id: "moveLeft",     label: "STRAFE GAUCHE",      category: "DÉPLACEMENT", keys: ["a", "q"],     icon: "◄" },
        { id: "moveRight",    label: "STRAFE DROIT",       category: "DÉPLACEMENT", keys: ["d"],           icon: "►" },
        { id: "jump",         label: "SAUTER",             category: "DÉPLACEMENT", keys: ["space"],       icon: "↑" },
        { id: "shoot",        label: "TIRER",              category: "COMBAT",      keys: ["mouse0"],      icon: "◎" },
        { id: "pause",        label: "PAUSE / MENU",       category: "SYSTÈME",     keys: ["enter"],      icon: "⏸" },
    ];

    // Touches interdites (réservées système)
    static FORBIDDEN_KEYS = new Set(["f1","f2","f3","f4","f5","f6","f7","f8","f9","f10","f11","f12","printscreen","scrolllock","pause"]);

    constructor(player = null) {
        this.player    = player;
        this._bindings = null;   // état courant
        this._snapshot = null;   // snapshot pour annuler
        this._listening = null;  // { id, slotIdx, el } — action en attente de touche
        this._keyHandler  = null;
        this._mouseHandler = null;
    }

    // ── API Publique ──────────────────────────────────────────────────────────

    /** Retourne une copie profonde des bindings courants. */
    getBindings() {
        if (!this._bindings) {
            this._bindings = KeybindingsMenu.DEFAULT_BINDINGS.map(a => ({
                ...a,
                keys: [...a.keys],
            }));
        }
        return this._bindings;
    }

    buildPanel(onBack) {
        this._snapshot = this.getBindings().map(a => ({ ...a, keys: [...a.keys] }));

        const panel = document.createElement("div");
        panel.className = "kb-panel";
        panel.innerHTML = this._buildPanelHTML();

        this._renderRows(panel);
        this._attachFooter(panel, onBack);

        return panel;
    }

    // ── Construction HTML du squelette ────────────────────────────────────────

    _buildPanelHTML() {
        return `
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
    }

    // ── Rendu des lignes par catégorie ────────────────────────────────────────

    _renderRows(panel) {
        const scroll = panel.querySelector("#kbScroll");
        if (!scroll) return;
        scroll.innerHTML = "";

        const bindings = this.getBindings();
        const categories = [...new Set(bindings.map(b => b.category))];

        // Détecter les conflits
        const conflicts = this._detectConflicts(bindings);

        categories.forEach(cat => {
            const section = document.createElement("div");
            section.className = "kb-section";

            const hdr = document.createElement("div");
            hdr.className = "kb-section-hdr";
            hdr.innerHTML = `<span class="kb-section-dot"></span><span>${cat}</span>`;
            section.appendChild(hdr);

            bindings.filter(b => b.category === cat).forEach(action => {
                const row = this._buildRow(action, conflicts, panel);
                section.appendChild(row);
            });

            scroll.appendChild(section);
        });
    }

    _buildRow(action, conflicts, panel) {
        const row = document.createElement("div");
        row.className = "kb-row";
        row.dataset.id = action.id;

        const labelSide = document.createElement("div");
        labelSide.className = "kb-row-label-side";
        labelSide.innerHTML = `
            <span class="kb-row-icon">${action.icon}</span>
            <span class="kb-row-label">${action.label}</span>
        `;

        const keysSide = document.createElement("div");
        keysSide.className = "kb-row-keys-side";

        // Jusqu'à 2 slots de touche par action
        const maxSlots = 2;
        for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
            const key = action.keys[slotIdx] ?? null;
            const slot = document.createElement("div");
            slot.className = "kb-key-slot" + (key ? "" : " kb-key-empty");
            slot.dataset.action = action.id;
            slot.dataset.slot   = slotIdx;

            const isConflict = key && conflicts.has(`${action.id}:${key}`);
            if (isConflict) slot.classList.add("kb-conflict");

            slot.innerHTML = `
                <span class="kb-key-label">${key ? this._formatKey(key) : "+ AJOUTER"}</span>
                ${key ? `<button class="kb-key-clear" data-action="${action.id}" data-slot="${slotIdx}" title="Supprimer">×</button>` : ""}
            `;

            // Clic sur le slot → mode écoute
            slot.addEventListener("click", (e) => {
                if (e.target.classList.contains("kb-key-clear")) return;
                this._startListening(action.id, slotIdx, slot, panel);
            });

            // Bouton clear
            const clearBtn = slot.querySelector(".kb-key-clear");
            if (clearBtn) {
                clearBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this._clearKey(action.id, slotIdx, panel);
                });
            }

            keysSide.appendChild(slot);
        }

        row.appendChild(labelSide);
        row.appendChild(keysSide);
        return row;
    }

    // ── Écoute de touche ──────────────────────────────────────────────────────

    _startListening(actionId, slotIdx, slotEl, panel) {
        // Annuler toute écoute précédente
        this._stopListening(false);

        this._listening = { actionId, slotIdx, slotEl };
        slotEl.classList.add("kb-listening");

        const noticeEl  = panel.querySelector("#kbNotice");
        const noticeText = panel.querySelector("#kbNoticeText");
        const action    = this.getBindings().find(b => b.id === actionId);
        if (noticeEl && noticeText) {
            noticeText.textContent = `APPUYEZ SUR UNE TOUCHE POUR « ${action.label} »...`;
            noticeEl.style.display = "flex";
        }

        // Annuler avec le bouton
        const cancelBtn = panel.querySelector("#kbCancelListen");
        if (cancelBtn) {
            cancelBtn.onclick = () => this._stopListening(true, panel);
        }

        // Keyboard handler
        this._keyHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = this._normalizeKey(e.key, e.code);
            if (key === "escape") { this._stopListening(true, panel); return; }
            if (KeybindingsMenu.FORBIDDEN_KEYS.has(key)) return;
            this._assignKey(actionId, slotIdx, key, panel);
        };

        // Mouse handler
        this._mouseHandler = (e) => {
            if (e.button >= 0) {
                const key = `mouse${e.button}`;
                this._assignKey(actionId, slotIdx, key, panel);
            }
        };

        // Délai court pour éviter de capturer le clic d'ouverture
        setTimeout(() => {
            window.addEventListener("keydown",  this._keyHandler,   { capture: true });
            window.addEventListener("mousedown", this._mouseHandler, { capture: true });
        }, 150);
    }

    _stopListening(restoreUI = true, panel = null) {
        if (this._keyHandler)  { window.removeEventListener("keydown",  this._keyHandler,   { capture: true }); this._keyHandler  = null; }
        if (this._mouseHandler){ window.removeEventListener("mousedown", this._mouseHandler, { capture: true }); this._mouseHandler = null; }

        if (this._listening?.slotEl) this._listening.slotEl.classList.remove("kb-listening");
        this._listening = null;

        if (restoreUI && panel) {
            const noticeEl = panel.querySelector("#kbNotice");
            if (noticeEl) noticeEl.style.display = "none";
        }
    }

    _assignKey(actionId, slotIdx, key, panel) {
        this._stopListening(true, panel);

        const bindings = this.getBindings();

        // Retirer cette touche de toute autre action/slot
        bindings.forEach(action => {
            action.keys = action.keys.map(k => (k === key ? null : k)).filter(Boolean);
        });

        // Affecter la touche
        const target = bindings.find(b => b.id === actionId);
        if (target) {
            if (slotIdx < target.keys.length) target.keys[slotIdx] = key;
            else target.keys.push(key);
        }

        this._renderRows(panel);
        this._showAssignFeedback(panel, actionId);
    }

    _clearKey(actionId, slotIdx, panel) {
        const bindings = this.getBindings();
        const target   = bindings.find(b => b.id === actionId);
        if (target) target.keys.splice(slotIdx, 1);
        this._renderRows(panel);
    }

    // ── Conflits ──────────────────────────────────────────────────────────────

    _detectConflicts(bindings) {
        const seen    = new Map(); // key → actionId
        const conflicts = new Set();
        bindings.forEach(action => {
            action.keys.forEach(key => {
                if (!key) return;
                if (seen.has(key)) {
                    conflicts.add(`${action.id}:${key}`);
                    conflicts.add(`${seen.get(key)}:${key}`);
                } else {
                    seen.set(key, action.id);
                }
            });
        });
        return conflicts;
    }

    // ── Feedback visuel ───────────────────────────────────────────────────────

    _showAssignFeedback(panel, actionId) {
        const row = panel.querySelector(`.kb-row[data-id="${actionId}"]`);
        if (!row) return;
        row.classList.add("kb-row-flash");
        setTimeout(() => row.classList.remove("kb-row-flash"), 500);
    }

    // ── Footer (appliquer / annuler / reset) ──────────────────────────────────

    _attachFooter(panel, onBack) {
        panel.querySelector("#kbApply").onclick = () => {
            this._applyToPlayer();
            this._snapshot = null;
            this._stopListening(true, panel);
            onBack();
        };

        panel.querySelector("#kbBack").onclick = () => {
            if (this._snapshot) {
                this._bindings = this._snapshot.map(a => ({ ...a, keys: [...a.keys] }));
                this._snapshot = null;
            }
            this._stopListening(true, panel);
            onBack();
        };

        panel.querySelector("#kbReset").onclick = () => {
            this._bindings = KeybindingsMenu.DEFAULT_BINDINGS.map(a => ({
                ...a,
                keys: [...a.keys],
            }));
            this._renderRows(panel);
        };
    }

    // ── Application au Player ─────────────────────────────────────────────────

    _applyToPlayer() {
        if (!this.player) return;
        const bindings = this.getBindings();
        const get = (id) => bindings.find(b => b.id === id)?.keys ?? [];

        const toKeyCodes = (keys) => keys
            .filter(k => k && !k.startsWith("mouse"))
            .map(k => this._keyToCode(k))
            .filter(Boolean);

        const fwd   = get("moveForward");
        const back  = get("moveBack");
        const left  = get("moveLeft");
        const right = get("moveRight");

        if (this.player.camera) {
            this.player.camera.keysUp    = toKeyCodes(fwd);
            this.player.camera.keysDown  = toKeyCodes(back);
            this.player.camera.keysLeft  = toKeyCodes(left);
            this.player.camera.keysRight = toKeyCodes(right);
        }

        // Sauvegarde dans le inputMap du player pour les contrôles custom
        this.player._keybindings = {
            moveForward:  get("moveForward"),
            moveBack:     get("moveBack"),
            moveLeft:     get("moveLeft"),
            moveRight:    get("moveRight"),
            jump:         get("jump"),
            shoot:        get("shoot"),
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _normalizeKey(key, code) {
        if (key === " " || code === "Space") return "space";
        return key.toLowerCase();
    }

    _keyToCode(key) {
        const MAP = {
            "a": 65, "b": 66, "c": 67, "d": 68, "e": 69, "f": 70,
            "g": 71, "h": 72, "i": 73, "j": 74, "k": 75, "l": 76,
            "m": 77, "n": 78, "o": 79, "p": 80, "q": 81, "r": 82,
            "s": 83, "t": 84, "u": 85, "v": 86, "w": 87, "x": 88,
            "y": 89, "z": 90,
            "0": 48, "1": 49, "2": 50, "3": 51, "4": 52,
            "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
            "space": 32, "shift": 16, "control": 17, "alt": 18,
            "arrowup": 38, "arrowdown": 40, "arrowleft": 37, "arrowright": 39,
            "enter": 13, "tab": 9, "backspace": 8,
            "f1": 112, "f2": 113, "f3": 114, "f4": 115,
        };
        return MAP[key] ?? null;
    }

    _formatKey(key) {
        const LABELS = {
            "space":      "ESPACE",
            "escape":     "ÉCHAP",
            "mouse0":     "CLIC G",
            "mouse1":     "CLIC M",
            "mouse2":     "CLIC D",
            "arrowup":    "↑",
            "arrowdown":  "↓",
            "arrowleft":  "←",
            "arrowright": "→",
            "shift":      "SHIFT",
            "control":    "CTRL",
            "alt":        "ALT",
            "enter":      "ENTRÉE",
            "backspace":  "RETOUR",
            "tab":        "TAB",
        };
        return LABELS[key] ?? key.toUpperCase();
    }
}