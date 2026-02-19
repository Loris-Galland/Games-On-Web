export class PlayerHUD {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this._createHUD();
    }

    _createHUD() {
        // --- 1. TON CODE EXISTANT POUR LA VIE (Ne touche à rien) ---
        this.container = document.createElement('div');
        this.container.id = 'hud';
        this.title = document.createElement('div');
        this.title.className = 'hud-title';
        this.title.innerText = 'SYSTEM INTEGRITY';
        this.container.appendChild(this.title);

        this.barContainer = document.createElement('div');
        this.barContainer.className = 'hud-bar-container';
        this.segments = [];
        for(let i = 0; i < this.maxHealth; i++) {
            const segment = document.createElement('div');
            segment.className = 'hud-segment';
            this.segments.push(segment);
            this.barContainer.appendChild(segment);
        }
        this.container.appendChild(this.barContainer);
        document.body.appendChild(this.container);

        // --- 2. NOUVEAU CODE : HUD DES MUNITIONS ---
        this.ammoContainer = document.createElement('div');
        this.ammoContainer.id = 'ammo-hud';
        
        this.ammoTitle = document.createElement('div');
        this.ammoTitle.className = 'hud-title';
        this.ammoTitle.innerText = 'WEAPON // PLASMA DAGGER';
        this.ammoContainer.appendChild(this.ammoTitle);

        this.ammoBarContainer = document.createElement('div');
        this.ammoBarContainer.className = 'hud-bar-container';
        
        this.ammoSegments = [];
        // On pré-crée 5 blocs de munitions par défaut
        for(let i = 0; i < 5; i++) {
            const segment = document.createElement('div');
            segment.className = 'hud-segment ammo-segment';
            this.ammoSegments.push(segment);
            this.ammoBarContainer.appendChild(segment);
        }
        this.ammoContainer.appendChild(this.ammoBarContainer);
        document.body.appendChild(this.ammoContainer);
    }

    updateHealth(currentHealth) {
        // Met à jour le nombre de segments affichés
        for (let i = 0; i < this.segments.length; i++) {
            this.segments[i].style.opacity = (i < currentHealth) ? '1' : '0.1';
        }

        // Change l'état visuel (glitch, couleurs) selon la vie
        const ratio = currentHealth / this.maxHealth;
        
        this.container.className = ''; // Reset
        if (ratio <= 0.3) {
            this.container.classList.add('critical');
            this.title.innerText = 'CRITICAL FAILURE IMMINENT';
        } else if (ratio <= 0.6) {
            this.container.classList.add('warning');
            this.title.innerText = 'SYSTEM DAMAGED';
        } else {
            this.title.innerText = 'SYSTEM INTEGRITY';
        }
    }

    updateAmmo(currentAmmo, maxAmmo) {
        for (let i = 0; i < this.ammoSegments.length; i++) {
            if (i < currentAmmo) {
                this.ammoSegments[i].style.opacity = '1';
                this.ammoSegments[i].style.transform = 'scale(1)';
            } else {
                this.ammoSegments[i].style.opacity = '0.2';
                this.ammoSegments[i].style.transform = 'scale(0.8)'; 
            }
        }

        if (currentAmmo === 0) {
            this.ammoContainer.classList.add('empty');
            this.ammoTitle.innerText = 'WEAPON // RELOADING...';
        } else {
            this.ammoContainer.classList.remove('empty');
            this.ammoTitle.innerText = 'WEAPON // PLASMA DAGGER';
        }
    }
}