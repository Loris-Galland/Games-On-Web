/**
 * MainMenu
 * --------
 * Reçoit les instances partagées de GraphicsMenu et KeybindingsMenu
 * pour garantir que l'état est synchronisé avec le PauseMenu.
 */
export class MainMenu {
    /**
     * @param {function}        onPlayCallback
     * @param {object|null}     playerRef
     * @param {GraphicsMenu}    sharedGfxMenu   instance partagée
     * @param {KeybindingsMenu} sharedKbMenu    instance partagée
     */
    constructor(onPlayCallback, playerRef = null, sharedGfxMenu = null, sharedKbMenu = null) {
        this.onPlay    = onPlayCallback;
        this.player    = playerRef;
        this._gfxMenu  = sharedGfxMenu;
        this._kbMenu   = sharedKbMenu;
        this.lm        = sharedGfxMenu?.lm ?? null;
        this._createMenu();
    }

    // ── Construction ──────────────────────────────────────────────────────────

    _createMenu() {
        this.overlay = document.createElement("div");
        this.overlay.id = "main-menu-overlay";

        const title = document.createElement("div");
        title.className = "menu-title";
        title.innerText = "PROJECT // ROGUE";
        this.overlay.appendChild(title);

        this.buttonsContainer = document.createElement("div");
        this.buttonsContainer.className = "menu-buttons-container";

        const playBtn = document.createElement("button");
        playBtn.className = "menu-btn";
        playBtn.innerText = "INITIALISER (PLAY)";
        playBtn.onclick   = () => {
            this.overlay.style.display = "none";
            if (this.onPlay) this.onPlay();
        };

        const settingsBtn = document.createElement("button");
        settingsBtn.className = "menu-btn";
        settingsBtn.innerText = "PARAMÈTRES";
        settingsBtn.onclick   = () => this._showSettings();

        const exitBtn = document.createElement("button");
        exitBtn.className = "menu-btn exit-btn";
        exitBtn.innerText = "QUITTER SYSTÈME";
        exitBtn.onclick   = () => {
            document.body.innerHTML = "<h1 style='color:red;text-align:center;font-family:Courier New;margin-top:20%'>SYSTÈME DÉCONNECTÉ.</h1>";
        };

        this.buttonsContainer.appendChild(playBtn);
        this.buttonsContainer.appendChild(settingsBtn);
        this.buttonsContainer.appendChild(exitBtn);
        this.overlay.appendChild(this.buttonsContainer);

        this._createSettingsPanel();

        this._panelSlot = document.createElement("div");
        this._panelSlot.style.display = "none";
        this.overlay.appendChild(this._panelSlot);

        document.body.appendChild(this.overlay);
    }

    _createSettingsPanel() {
        this.settingsPanel = document.createElement("div");
        this.settingsPanel.id = "settings-panel";
        this.settingsPanel.style.cssText = `
            display: none; flex-direction: column;
            background: rgba(0,10,15,0.95);
            border: 1px solid rgba(0,255,204,0.25);
            box-shadow: 0 0 60px rgba(0,180,255,0.08), inset 0 1px 0 rgba(0,255,204,0.12);
            padding: 32px 36px 28px; width: 420px; color: white;
            font-family: 'Courier New', monospace;
        `;

        const title = document.createElement("div");
        title.style.cssText = `
            font-size: 18px; font-weight: bold; letter-spacing: 5px;
            color: #00ffcc; text-shadow: 0 0 16px rgba(0,255,204,0.5);
            text-transform: uppercase; margin-bottom: 24px;
            padding-bottom: 14px; border-bottom: 1px solid rgba(0,255,204,0.15);
        `;
        title.innerText = "PARAMÈTRES";
        this.settingsPanel.appendChild(title);

        this._addSliderGroup(this.settingsPanel, "SENSIBILITÉ SOURIS", 1000, 10000, 5000,
            (v) => { if (this.player?.camera) this.player.camera.angularSensibility = v; });
        this._addSliderGroup(this.settingsPanel, "VOLUME MASTER", 0, 100, 100, () => {});

        const sep = document.createElement("div");
        sep.style.cssText = "border-top:1px solid rgba(0,255,204,0.1);margin:18px 0 14px;";
        this.settingsPanel.appendChild(sep);

        const subLabel = document.createElement("div");
        subLabel.style.cssText = "font-size:9px;letter-spacing:3px;color:rgba(0,200,160,0.4);text-transform:uppercase;margin-bottom:12px;";
        subLabel.innerText = "SOUS-MENUS";
        this.settingsPanel.appendChild(subLabel);

        const gfxBtn = document.createElement("button");
        gfxBtn.className = "menu-btn"; gfxBtn.style.marginBottom = "10px";
        gfxBtn.innerText = "◈  GRAPHISMES"; gfxBtn.onclick = () => this._showGraphics();
        this.settingsPanel.appendChild(gfxBtn);

        const kbBtn = document.createElement("button");
        kbBtn.className = "menu-btn"; kbBtn.style.marginBottom = "24px";
        kbBtn.innerText = "⌨  TOUCHES"; kbBtn.onclick = () => this._showKeybindings();
        this.settingsPanel.appendChild(kbBtn);

        const backBtn = document.createElement("button");
        backBtn.className = "menu-btn"; backBtn.innerText = "← RETOUR";
        backBtn.onclick = () => this._showMain();
        this.settingsPanel.appendChild(backBtn);

        this.overlay.appendChild(this.settingsPanel);
    }

    _addSliderGroup(container, label, min, max, value, onChange) {
        const group = document.createElement("div");
        group.style.cssText = "margin-bottom:18px;";
        const lbl = document.createElement("div");
        lbl.style.cssText = "font-size:10px;letter-spacing:2px;color:rgba(200,230,230,0.6);text-transform:uppercase;margin-bottom:8px;display:flex;justify-content:space-between;";
        const valSpan = document.createElement("span");
        valSpan.style.color = "#00ffcc"; valSpan.textContent = value;
        lbl.innerHTML = `<span>${label}</span>`; lbl.appendChild(valSpan);
        const input = document.createElement("input");
        input.type = "range"; input.min = min; input.max = max; input.value = value;
        input.className = "gfx-slider"; input.style.width = "100%";
        input.oninput = (e) => { valSpan.textContent = e.target.value; onChange(parseInt(e.target.value)); };
        group.appendChild(lbl); group.appendChild(input);
        container.appendChild(group);
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    _showMain() {
        this.buttonsContainer.style.display = "flex";
        this.settingsPanel.style.display    = "none";
        this._panelSlot.style.display       = "none";
    }

    _showSettings() {
        this.buttonsContainer.style.display = "none";
        this.settingsPanel.style.display    = "flex";
        this._panelSlot.style.display       = "none";
    }

    _showGraphics() {
        if (!this._gfxMenu) { console.warn("[MainMenu] GraphicsMenu non disponible."); return; }
        // Mettre à jour le LM au cas où il a été injecté après construction
        if (this.lm && !this._gfxMenu.lm) this._gfxMenu.lm = this.lm;
        this.settingsPanel.style.display = "none";
        this._panelSlot.innerHTML = "";
        this._panelSlot.appendChild(this._gfxMenu.buildPanel(() => this._showSettings()));
        this._panelSlot.style.display = "block";
    }

    _showKeybindings() {
        if (!this._kbMenu) { console.warn("[MainMenu] KeybindingsMenu non disponible."); return; }
        this.settingsPanel.style.display = "none";
        this._panelSlot.innerHTML = "";
        this._panelSlot.appendChild(this._kbMenu.buildPanel(() => this._showSettings()));
        this._panelSlot.style.display = "block";
    }
}