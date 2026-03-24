export class MainMenu {
    // onPlayCallback est la fonction qui lancera le jeu quand on clique sur Play
    // playerRef permet d'avoir accès au joueur pour modifier sa sensibilité, etc.
    constructor(onPlayCallback, playerRef = null) {
        this.onPlay = onPlayCallback;
        this.player = playerRef;
        this._createMenu();
    }

    _createMenu() {
        this.overlay = document.createElement("div");
        this.overlay.id = "main-menu-overlay";

        // Titre du jeu
        const title = document.createElement("div");
        title.className = "menu-title";
        title.innerText = "PROJECT // ROGUE"; 
        this.overlay.appendChild(title);

        // Conteneur des boutons principaux
        this.buttonsContainer = document.createElement("div");
        this.buttonsContainer.className = "menu-buttons-container";

        // Bouton PLAY
        const playBtn = document.createElement("button");
        playBtn.className = "menu-btn";
        playBtn.innerText = "INITIALISER (PLAY)";
        playBtn.onclick = () => {
            this.overlay.style.display = "none";
            if (this.onPlay) this.onPlay();
        };

        // Bouton SETTINGS
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "menu-btn";
        settingsBtn.innerText = "PARAMÈTRES";
        settingsBtn.onclick = () => this._toggleSettings(true);

        // Bouton EXIT
        const exitBtn = document.createElement("button");
        exitBtn.className = "menu-btn exit-btn";
        exitBtn.innerText = "QUITTER SYSTÈME";
        exitBtn.onclick = () => {
            // Sur navigateur, on ne peut pas vraiment fermer l'onglet par code, 
            // alors on affiche un écran noir ou on recharge.
            document.body.innerHTML = "<h1 style='color:red; text-align:center; font-family:Courier New; margin-top:20%'>SYSTÈME DÉCONNECTÉ.</h1>";
        };

        this.buttonsContainer.appendChild(playBtn);
        this.buttonsContainer.appendChild(settingsBtn);
        this.buttonsContainer.appendChild(exitBtn);
        this.overlay.appendChild(this.buttonsContainer);

        // Création du panneau des paramètres
        this._createSettingsPanel();

        document.body.appendChild(this.overlay);
    }

    _createSettingsPanel() {
        this.settingsPanel = document.createElement("div");
        this.settingsPanel.id = "settings-panel";

        const title = document.createElement("h2");
        title.innerText = "PARAMÈTRES";
        title.style.color = "#00ffff";
        title.style.marginTop = "0";
        this.settingsPanel.appendChild(title);

        // Paramètre 1 : Sensibilité de la souris
        const sensGroup = document.createElement("div");
        sensGroup.className = "setting-group";
        
        const sensLabel = document.createElement("label");
        sensLabel.innerText = "SENSIBILITÉ SOURIS : 5000";
        
        const sensInput = document.createElement("input");
        sensInput.type = "range";
        sensInput.min = "1000"; // Très sensible
        sensInput.max = "10000"; // Très lent
        sensInput.value = "5000"; // Valeur par défaut de ton Player.js
        
        // Met à jour la variable du joueur en temps réel !
        sensInput.oninput = (e) => {
            sensLabel.innerText = `SENSIBILITÉ SOURIS : ${e.target.value}`;
            if (this.player) {
                this.player.camera.angularSensibility = parseInt(e.target.value);
            }
        };

        sensGroup.appendChild(sensLabel);
        sensGroup.appendChild(sensInput);
        this.settingsPanel.appendChild(sensGroup);

        // Paramètre 2 : Volume (pour plus tard)
        const volGroup = document.createElement("div");
        volGroup.className = "setting-group";
        const volLabel = document.createElement("label");
        volLabel.innerText = "VOLUME MASTER : 100%";
        const volInput = document.createElement("input");
        volInput.type = "range";
        volInput.min = "0";
        volInput.max = "100";
        volInput.value = "100";
        
        volInput.oninput = (e) => {
            volLabel.innerText = `VOLUME MASTER : ${e.target.value}%`;
        };

        volGroup.appendChild(volLabel);
        volGroup.appendChild(volInput);
        this.settingsPanel.appendChild(volGroup);

        // Bouton retour
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
}