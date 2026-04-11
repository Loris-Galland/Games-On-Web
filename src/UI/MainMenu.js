import { GraphicsMenu }    from "./GraphicsMenu.js";
import { KeybindingsMenu } from "./KeybindingsMenu.js";

export class MainMenu {
    constructor(onPlayCallback, playerRef = null, lightingManagerRef = null) {
        this.onPlay   = onPlayCallback;
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
        playBtn.onclick = () => {
            this.overlay.style.display = "none";
            if (this.onPlay) this.onPlay();
        };

        const settingsBtn = document.createElement("button");
        settingsBtn.className = "menu-btn";
        settingsBtn.innerText = "PARAMÈTRES";
        settingsBtn.onclick = () => this._showSettings();

        const gfxBtn = document.createElement("button");
        gfxBtn.className = "menu-btn";
        gfxBtn.innerText = "GRAPHISMES";
        gfxBtn.onclick = () => this._showGraphics();

        // ── NOUVEAU : bouton TOUCHES ──────────────────────────────
        const kbBtn = document.createElement("button");
        kbBtn.className = "menu-btn";
        kbBtn.innerText = "TOUCHES";
        kbBtn.onclick = () => this._showKeybindings();

        const exitBtn = document.createElement("button");
        exitBtn.className = "menu-btn exit-btn";
        exitBtn.innerText = "QUITTER SYSTÈME";
        exitBtn.onclick = () => {
            document.body.innerHTML = "<h1 style='color:red;text-align:center;font-family:Courier New;margin-top:20%'>SYSTÈME DÉCONNECTÉ.</h1>";
        };

        this.buttonsContainer.appendChild(playBtn);
        this.buttonsContainer.appendChild(settingsBtn);
        this.buttonsContainer.appendChild(gfxBtn);
        this.buttonsContainer.appendChild(kbBtn);    // ← NOUVEAU
        this.buttonsContainer.appendChild(exitBtn);
        this.overlay.appendChild(this.buttonsContainer);

        this._createSettingsPanel();

        // Slot générique pour tous les sous-panneaux
        this._panelSlot = document.createElement("div");
        this._panelSlot.style.display = "none";
        this.overlay.appendChild(this._panelSlot);

        // Alias pour rétrocompatibilité interne
        this._gfxPanelSlot = this._panelSlot;

        document.body.appendChild(this.overlay);
    }

    _createSettingsPanel() {
        this.settingsPanel = document.createElement("div");
        this.settingsPanel.id = "settings-panel";

        const title = document.createElement("h2");
        title.innerText = "PARAMÈTRES";
        title.style.cssText = "color:#00ffff;margin-top:0";
        this.settingsPanel.appendChild(title);

        const sensGroup = document.createElement("div");
        sensGroup.className = "setting-group";
        const sensLabel = document.createElement("label");
        sensLabel.innerText = "SENSIBILITÉ SOURIS : 5000";
        const sensInput = document.createElement("input");
        sensInput.type = "range"; sensInput.min = "1000"; sensInput.max = "10000"; sensInput.value = "5000";
        sensInput.oninput = (e) => {
            sensLabel.innerText = `SENSIBILITÉ SOURIS : ${e.target.value}`;
            if (this.player) this.player.camera.angularSensibility = parseInt(e.target.value);
        };
        sensGroup.appendChild(sensLabel); sensGroup.appendChild(sensInput);
        this.settingsPanel.appendChild(sensGroup);

        const volGroup = document.createElement("div");
        volGroup.className = "setting-group";
        const volLabel = document.createElement("label"); volLabel.innerText = "VOLUME MASTER : 100%";
        const volInput = document.createElement("input");
        volInput.type = "range"; volInput.min = "0"; volInput.max = "100"; volInput.value = "100";
        volInput.oninput = (e) => { volLabel.innerText = `VOLUME MASTER : ${e.target.value}%`; };
        volGroup.appendChild(volLabel); volGroup.appendChild(volInput);
        this.settingsPanel.appendChild(volGroup);

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
        if (!this.lm) { console.warn("[MainMenu] LightingManager non encore disponible."); return; }
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
}