export class PlayerHUD {
  constructor(maxHealth) {
    this.maxHealth = maxHealth;
    this._createHUD();
  }

  // HUD Utilisateur
  _createHUD() {
    this.container = document.createElement("div");
    this.container.id = "hud";

    this.title = document.createElement("div");
    this.title.className = "hud-title";
    this.title.innerText = "SYSTEM INTEGRITY";
    this.container.appendChild(this.title);

    this.barContainer = document.createElement("div");
    this.barContainer.className = "hud-bar-container";

    this.segments = [];
    for (let i = 0; i < this.maxHealth; i++) {
      const segment = document.createElement("div");
      segment.className = "hud-segment";
      this.segments.push(segment);
      this.barContainer.appendChild(segment);
    }
    this.container.appendChild(this.barContainer);
    document.body.appendChild(this.container);

    this.ammoContainer = document.createElement("div");
    this.ammoContainer.id = "ammo-hud";

    this.ammoTitle = document.createElement("div");
    this.ammoTitle.className = "hud-title";
    this.ammoTitle.innerText = "WEAPON // PLASMA DAGGER";
    this.ammoContainer.appendChild(this.ammoTitle);

    this.ammoBarContainer = document.createElement("div");
    this.ammoBarContainer.className = "hud-bar-container";

    this.ammoSegments = [];
    for (let i = 0; i < 5; i++) {
      const segment = document.createElement("div");
      segment.className = "hud-segment ammo-segment";
      this.ammoSegments.push(segment);
      this.ammoBarContainer.appendChild(segment);
    }
    this.ammoContainer.appendChild(this.ammoBarContainer);
    document.body.appendChild(this.ammoContainer);

    this.waveText = document.createElement("div");
    this.waveText.id = "wave-hud";
    document.body.appendChild(this.waveText);

    this.fpsContainer = document.createElement("div");
    this.fpsContainer.id = "fpsContainer";
    this.fpsContainer.style.cssText = `
      position: absolute;
      background-color: black;
      border: 2px solid red;
      text-align: center;
      font-size: 16px;
      color: white;
      top: 15px;
      right: 10px;
      width: 60px;
      height: 20px;
      `;
    this.fpsContainer.textContent = '0';
    document.body.appendChild(this.fpsContainer);
  }

  // Mise à jour de la vie
  updateHealth(currentHealth) {
    for (let i = 0; i < this.segments.length; i++) {
      this.segments[i].style.opacity = i < currentHealth ? "1" : "0.1";
    }

    const ratio = currentHealth / this.maxHealth;
    this.container.className = "";
    if (ratio <= 0.3) {
      this.container.classList.add("critical");
      this.title.innerText = "CRITICAL FAILURE IMMINENT";
    } else if (ratio <= 0.6) {
      this.container.classList.add("warning");
      this.title.innerText = "SYSTEM DAMAGED";
    } else {
      this.title.innerText = "SYSTEM INTEGRITY";
    }
  }

  // Mise à jour des munitions
  updateAmmo(currentAmmo, maxAmmo) {
    for (let i = 0; i < this.ammoSegments.length; i++) {
      if (i < currentAmmo) {
        this.ammoSegments[i].style.opacity = "1";
        this.ammoSegments[i].style.transform = "scale(1)";
      } else {
        this.ammoSegments[i].style.opacity = "0.2";
        this.ammoSegments[i].style.transform = "scale(0.8)";
      }
    }

    if (currentAmmo === 0) {
      this.ammoContainer.classList.add("empty");
      this.ammoTitle.innerText = "WEAPON // RELOADING...";
    } else {
      this.ammoContainer.classList.remove("empty");
      this.ammoTitle.innerText = "WEAPON // PLASMA DAGGER";
    }
  }

  updateWave(waveNumber) {
    this.waveText.innerText = `VAGUE ${waveNumber}`;
    this.waveText.style.opacity = "1";

    setTimeout(() => {
      this.waveText.style.opacity = "0";
    }, 2000);
  }

  showWaveMessage(message) {
    this.waveText.innerText = message;
    this.waveText.style.opacity = "1";

    setTimeout(() => {
      this.waveText.style.opacity = "0";
    }, 2000);
  }

  updateFps(engine){
      this.fpsContainer.innerHTML = engine.getFps().toFixed() + " fps";
  }

  // Affiche l'écran de sélection d'amélioration à la fin d'une salle
  showUpgradeScreen(upgrades, onSelectCallback) {
    this.upgradeOverlay = document.createElement("div");
    this.upgradeOverlay.id = "upgrade-overlay";

    // Titre
    const title = document.createElement("div");
    title.className = "upgrade-title";
    title.innerText = ">> SYSTÈME DE MISE À JOUR DISPONIBLE <<";
    this.upgradeOverlay.appendChild(title);

    // Conteneur des cartes
    const cardsContainer = document.createElement("div");
    cardsContainer.className = "cards-container";

    upgrades.forEach((upgrade) => {
      const card = document.createElement("div");
      card.className = "upgrade-card";

      card.innerHTML = `
        <div class="card-icon-wrapper">
            <img src="${upgrade.iconPath || '/vite.svg'}" alt="icon" class="card-icon">
        </div>
        <div class="card-title">${upgrade.name}</div>
        <div class="card-desc">${upgrade.description}</div>
      `;

      // Ce qui se passe quand le joueur clique sur une carte
      card.addEventListener("click", () => {
        this.upgradeOverlay.remove();
        onSelectCallback(upgrade);
      });

      cardsContainer.appendChild(card);
    });

    this.upgradeOverlay.appendChild(cardsContainer);
    document.body.appendChild(this.upgradeOverlay);

    // Petite animation d'apparition fluide
    requestAnimationFrame(() => {
      this.upgradeOverlay.style.opacity = "1";
    });
  }

  // Ajoute de nouveaux segments de vie au HUD
  addHealthSegments(amount, newMaxHealth) {
    this.maxHealth = newMaxHealth;
    for (let i = 0; i < amount; i++) {
      const segment = document.createElement("div");
      segment.className = "hud-segment"; // Prend automatiquement le Cyan
      this.segments.push(segment);
      this.barContainer.appendChild(segment);
    }
  }

  // Ajoute des segments de munitions
  addAmmoSegments(amount) {
    for (let i = 0; i < amount; i++) {
      const segment = document.createElement("div");
      segment.className = "hud-segment ammo-segment"; 
      this.ammoSegments.push(segment);
      this.ammoBarContainer.appendChild(segment);
    }
  }
}
