export class PauseMenu {
    constructor(onResumeCallback, onQuitCallback, playerRef = null) {
        this.onResume = onResumeCallback;
        this.onQuit = onQuitCallback;
        this.player = playerRef;
        this._createMenu();
    }

    _createMenu() {
        this.overlay = document.createElement("div");
        this.overlay.id = "pause-menu-overlay";

        // Titre
        const title = document.createElement("div");
        title.className = "pause-title";
        title.innerText = "SYSTÈME EN PAUSE";
        this.overlay.appendChild(title);

        // Conteneur des boutons
        this.buttonsContainer = document.createElement("div");
        this.buttonsContainer.className = "menu-buttons-container";

        // Bouton REPRENDRE
        const resumeBtn = document.createElement("button");
        resumeBtn.className = "menu-btn";
        resumeBtn.innerText = "REPRENDRE";
        resumeBtn.onclick = () => {
            if (this.onResume) this.onResume();
        };

        // Bouton PARAMÈTRES
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "menu-btn";
        settingsBtn.innerText = "PARAMÈTRES";
        settingsBtn.onclick = () => this._toggleSettings(true);

        // Bouton RETOUR AU MENU
        const quitBtn = document.createElement("button");
        quitBtn.className = "menu-btn exit-btn";
        quitBtn.innerText = "RETOUR À L'ACCUEIL";
        quitBtn.onclick = () => {
            if (this.onQuit) this.onQuit();
        };

        this.buttonsContainer.appendChild(resumeBtn);
        this.buttonsContainer.appendChild(settingsBtn);
        this.buttonsContainer.appendChild(quitBtn);
        this.overlay.appendChild(this.buttonsContainer);

        // Création du même panneau de paramètres que le menu principal
        this._createSettingsPanel();

        document.body.appendChild(this.overlay);
    }

    _createSettingsPanel() {
        this.settingsPanel = document.createElement("div");
        this.settingsPanel.id = "settings-panel";
        
        // On force le style pour l'isoler des règles générales du CSS
        this.settingsPanel.style.display = "none";
        this.settingsPanel.style.flexDirection = "column";

        const title = document.createElement("h2");
        title.innerText = "PARAMÈTRES";
        title.style.color = "#00ffff";
        title.style.marginTop = "0";
        this.settingsPanel.appendChild(title);

        const sensGroup = document.createElement("div");
        sensGroup.className = "setting-group";
        
        const currentSens = this.player ? this.player.camera.angularSensibility : 5000;
        const sensLabel = document.createElement("label");
        sensLabel.innerText = `SENSIBILITÉ SOURIS : ${currentSens}`;
        
        const sensInput = document.createElement("input");
        sensInput.type = "range";
        sensInput.min = "1000"; 
        sensInput.max = "10000"; 
        sensInput.value = currentSens;
        
        sensInput.oninput = (e) => {
            sensLabel.innerText = `SENSIBILITÉ SOURIS : ${e.target.value}`;
            if (this.player) {
                this.player.camera.angularSensibility = parseInt(e.target.value);
            }
        };

        sensGroup.appendChild(sensLabel);
        sensGroup.appendChild(sensInput);
        this.settingsPanel.appendChild(sensGroup);

        const backBtn = document.createElement("button");
        backBtn.className = "menu-btn";
        backBtn.style.marginTop = "20px";
        backBtn.innerText = "RETOUR";
        backBtn.onclick = () => this._toggleSettings(false);
        this.settingsPanel.appendChild(backBtn);

        this.overlay.appendChild(this.settingsPanel);
    }

    _toggleSettings(show) {
        if (show) {
            this.buttonsContainer.style.display = "none";
            this.settingsPanel.style.display = "flex";
        } else {
            this.buttonsContainer.style.display = "flex";
            this.settingsPanel.style.display = "none";
        }
    }

    show() {
        this.overlay.style.display = "flex";
    }

    hide() {
        this.overlay.style.display = "none";
        this._toggleSettings(false); 
    }
}