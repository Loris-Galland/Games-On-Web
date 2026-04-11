import { GraphicsMenu }    from "./GraphicsMenu.js";
import { KeybindingsMenu } from "./KeybindingsMenu.js";

export class PauseMenu {
    constructor(onResumeCallback, onQuitCallback, playerRef = null, lightingManagerRef = null) {
        this.onResume = onResumeCallback;
        this.onQuit   = onQuitCallback;
        this.player   = playerRef;
        this.lm       = lightingManagerRef;
        this._gfxMenu = null;
        this._kbMenu  = null;
        this._createMenu();
    }

    setLightingManager(lm) {
        this.lm = lm;
        this._gfxMenu = new GraphicsMenu(lm);
        this._kbMenu  = new KeybindingsMenu(this.player);
    }

    _createMenu() {
        this.overlay = document.createElement("div");
        this.overlay.id = "pause-menu-overlay";

        const title = document.createElement("div");
        title.className = "pause-title";
        title.innerText = "SYSTÈME EN PAUSE";
        this.overlay.appendChild(title);

        this.buttonsContainer = document.createElement("div");
        this.buttonsContainer.className = "menu-buttons-container";

        const resumeBtn = document.createElement("button");
        resumeBtn.className = "menu-btn"; resumeBtn.innerText = "REPRENDRE";
        resumeBtn.onclick = () => { this.hide(); if (this.onResume) this.onResume(); };

        const settingsBtn = document.createElement("button");
        settingsBtn.className = "menu-btn"; settingsBtn.innerText = "PARAMÈTRES";
        settingsBtn.onclick = () => this._showSettings();

        const gfxBtn = document.createElement("button");
        gfxBtn.className = "menu-btn"; gfxBtn.innerText = "GRAPHISMES";
        gfxBtn.onclick = () => this._showGraphics();

        // ── NOUVEAU : bouton TOUCHES ──────────────────────────────
        const kbBtn = document.createElement("button");
        kbBtn.className = "menu-btn"; kbBtn.innerText = "TOUCHES";
        kbBtn.onclick = () => this._showKeybindings();

        const quitBtn = document.createElement("button");
        quitBtn.className = "menu-btn exit-btn"; quitBtn.innerText = "RETOUR À L'ACCUEIL";
        quitBtn.onclick = () => { if (this.onQuit) this.onQuit(); };

        this.buttonsContainer.appendChild(resumeBtn);
        this.buttonsContainer.appendChild(settingsBtn);
        this.buttonsContainer.appendChild(gfxBtn);
        this.buttonsContainer.appendChild(kbBtn);    // ← NOUVEAU
        this.buttonsContainer.appendChild(quitBtn);
        this.overlay.appendChild(this.buttonsContainer);

        this._createSettingsPanel();

        // Slot générique unique pour tous les sous-panneaux
        this._panelSlot = document.createElement("div");
        this._panelSlot.style.display = "none";
        this.overlay.appendChild(this._panelSlot);

        // Alias rétrocompatibilité
        this._gfxPanelSlot = this._panelSlot;

        document.body.appendChild(this.overlay);
    }

    _createSettingsPanel() {
        this.settingsPanel = document.createElement("div");
        this.settingsPanel.id = "settings-panel-pause";
        this.settingsPanel.style.display = "none";
        this.settingsPanel.style.flexDirection = "column";
        this.settingsPanel.style.cssText += `
            background: rgba(0,10,15,0.9);
            border: 2px solid #00ffff;
            padding: 40px;
            width: 400px;
            color: white;
            font-family: 'Courier New', monospace;
            box-shadow: 0 0 30px rgba(0,255,255,0.2);
        `;

        const title = document.createElement("h2");
        title.innerText = "PARAMÈTRES"; title.style.color = "#00ffff"; title.style.marginTop = "0";
        this.settingsPanel.appendChild(title);

        const sensGroup = document.createElement("div"); sensGroup.className = "setting-group";
        const currentSens = this.player ? this.player.camera.angularSensibility : 5000;
        const sensLabel = document.createElement("label"); sensLabel.innerText = `SENSIBILITÉ SOURIS : ${currentSens}`;
        const sensInput = document.createElement("input");
        sensInput.type = "range"; sensInput.min = "1000"; sensInput.max = "10000"; sensInput.value = currentSens;
        sensInput.oninput = (e) => {
            sensLabel.innerText = `SENSIBILITÉ SOURIS : ${e.target.value}`;
            if (this.player) this.player.camera.angularSensibility = parseInt(e.target.value);
        };
        sensGroup.appendChild(sensLabel); sensGroup.appendChild(sensInput);
        this.settingsPanel.appendChild(sensGroup);

        const backBtn = document.createElement("button");
        backBtn.className = "menu-btn"; backBtn.style.marginTop = "20px"; backBtn.innerText = "RETOUR";
        backBtn.onclick = () => this._showMain();
        this.settingsPanel.appendChild(backBtn);

        this.overlay.appendChild(this.settingsPanel);
    }

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
        if (!this.lm) { console.warn("[PauseMenu] LightingManager non disponible."); return; }
        this.buttonsContainer.style.display = "none";
        this.settingsPanel.style.display    = "none";
        this._panelSlot.innerHTML = "";
        if (!this._gfxMenu) this._gfxMenu = new GraphicsMenu(this.lm);
        const panel = this._gfxMenu.buildPanel(() => this._showMain());
        this._panelSlot.appendChild(panel);
        this._panelSlot.style.display = "block";
    }

    // ── NOUVEAU ────────────────────────────────────────────────────────────────
    _showKeybindings() {
        this.buttonsContainer.style.display = "none";
        this.settingsPanel.style.display    = "none";
        this._panelSlot.innerHTML = "";
        if (!this._kbMenu) this._kbMenu = new KeybindingsMenu(this.player);
        const panel = this._kbMenu.buildPanel(() => this._showMain());
        this._panelSlot.appendChild(panel);
        this._panelSlot.style.display = "block";
    }

    show() { this.overlay.style.display = "flex"; }

    hide() {
        this.overlay.style.display = "none";
        this._showMain();
    }
}