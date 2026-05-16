/**
 * PlayerHUD
 * ---------
 * Disposition :
 *   - Score + Combo     : haut CENTRE
 *   - Messages vague    : haut GAUCHE
 *   - Boss bar          : bas CENTRE
 *   - Health            : bas GAUCHE
 *   - Ammo + slots      : bas DROITE
 *   - Challenge timer   : haut DROITE
 *   - Ability cooldowns : bas CENTRE (au-dessus de la boss bar)
 */
export class PlayerHUD {
  constructor(maxHealth) {
    this.maxHealth = maxHealth;
    this._createHUD();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRÉATION
  // ═══════════════════════════════════════════════════════════════════════════

  _createHUD() {
    // ── Health (bas gauche) ───────────────────────────────────────────────
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
      const seg = document.createElement("div");
      seg.className = "hud-segment";
      this.segments.push(seg);
      this.barContainer.appendChild(seg);
    }
    this.container.appendChild(this.barContainer);
    document.body.appendChild(this.container);

    // ── Ammo (bas droite) ─────────────────────────────────────────────────
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
      const seg = document.createElement("div");
      seg.className = "hud-segment ammo-segment";
      this.ammoSegments.push(seg);
      this.ammoBarContainer.appendChild(seg);
    }
    this.ammoContainer.appendChild(this.ammoBarContainer);

    this._reloadBar = document.createElement("div");
    this._reloadBar.className = "hud-reload-bar";
    this._reloadBar.style.display = "none";
    this.ammoContainer.appendChild(this._reloadBar);

    document.body.appendChild(this.ammoContainer);

    // ── Weapon slots ──────────────────────────────────────────────────────
    this._createWeaponSlots();

    // ── Score + Combo (haut centre) ───────────────────────────────────────
    this._createScoreHUD();

    // ── Message de vague (haut gauche) ───────────────────────────────────
    this._createWaveHUD();

    // ── Boss bar (bas centre) ─────────────────────────────────────────────
    this._createBossBar();

    // ── Ability cooldowns HUD (juste au-dessus de la boss bar) ───────────
    this._createAbilityHUD();

    // ── Challenge timer (haut droite) ─────────────────────────────────────
    this._createChallengeHUD();

    // ── FPS ───────────────────────────────────────────────────────────────
    this.fpsContainer = document.createElement("div");
    this.fpsContainer.id = "fpsContainer";
    this.fpsContainer.style.cssText = `
      position:absolute;background:#000;border:2px solid red;
      text-align:center;font-size:14px;color:white;
      top:15px;right:10px;width:60px;height:20px;`;
    this.fpsContainer.textContent = "0";
    document.body.appendChild(this.fpsContainer);

    // ── Popups flottants ──────────────────────────────────────────────────
    this._popupContainer = document.createElement("div");
    this._popupContainer.id = "hud-popups";
    this._popupContainer.style.cssText = `
      position:fixed;top:50%;left:50%;
      transform:translate(-50%,-50%);
      pointer-events:none;z-index:50;
      width:0;height:0;overflow:visible;`;
    document.body.appendChild(this._popupContainer);

    // ── Indicateur de sortie ──────────────────────────────────────────────
    this._exitIndicator = document.createElement("div");
    this._exitIndicator.id = "exit-indicator";
    this._exitIndicator.style.cssText = `
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      pointer-events:none;z-index:48;
      font-family:'Courier New',monospace;text-align:center;
      opacity:0;transition:opacity 0.5s ease;`;
    this._exitIndicator.innerHTML = `
      <div style="font-size:26px;letter-spacing:2px;color:#00ffcc;
          text-shadow:0 0 20px #00ffcc;animation:exit-pulse 1.2s ease-in-out infinite;">
          ▶ SORTIE DISPONIBLE ◀
      </div>
      <div style="font-size:11px;letter-spacing:3px;color:rgba(0,255,204,0.5);
          margin-top:6px;text-transform:uppercase;">
          Avancez vers le couloir
      </div>
      <style>
          @keyframes exit-pulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
      </style>`;
    document.body.appendChild(this._exitIndicator);
  }

  _createControlsHint() {
    const hint = document.createElement("div");
    hint.id = "controls-hint";
    hint.style.cssText = `
      position:fixed;bottom:145px;left:50%;transform:translateX(-50%);
      pointer-events:none;z-index:35;
      font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.5px;
      color:rgba(0,255,204,0.65);text-transform:uppercase;text-align:center;
      background:rgba(0,10,20,0.8);padding:10px 22px;
      border:1px solid rgba(0,255,204,0.18);border-radius:2px;
      transition:opacity 1.5s ease;white-space:nowrap;`;
    hint.innerHTML = `
      <div style="margin-bottom:5px;color:rgba(0,255,204,0.35);font-size:9px;letter-spacing:3px;">CONTRÔLES</div>
      <div style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
        <span><b style="color:#00ffcc">Z/W A/Q S D</b> Déplacement</span>
        <span><b style="color:#00ffcc">CLIC G</b> Tirer</span>
        <span><b style="color:#00ffcc">1-4</b> Changer d'arme</span>
        <span><b style="color:#00ffcc">ENTRÉE</b> Pause</span>
      </div>`;
    document.body.appendChild(hint);
    setTimeout(() => { hint.style.opacity = "0"; }, 8000);
    setTimeout(() => { try { hint.remove(); } catch (_) {} }, 9600);
  }

  // ── Score HUD ─────────────────────────────────────────────────────────────

  _createScoreHUD() {
    this._scoreEl = document.createElement("div");
    this._scoreEl.id = "score-hud";
    this._scoreEl.style.cssText = `
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      pointer-events:none;z-index:40;text-align:center;
      font-family:'Courier New',monospace;`;
    this._scoreEl.innerHTML = `
      <div id="combo-label" style="
        font-size:11px;letter-spacing:4px;color:#ff4400;
        text-shadow:0 0 10px #ff4400;text-transform:uppercase;
        min-height:16px;transition:opacity 0.3s;opacity:0;"></div>
      <div id="combo-mult" style="
        font-size:30px;font-weight:bold;letter-spacing:3px;
        color:#ffaa00;text-shadow:0 0 20px #ffaa00;
        min-height:36px;transition:all 0.2s;opacity:0;"></div>
      <div id="score-value" style="
        font-size:20px;letter-spacing:5px;color:#00ffcc;
        text-shadow:0 0 12px #00ffcc;margin-top:2px;">
        000000
      </div>`;
    document.body.appendChild(this._scoreEl);
  }

  // ── Wave HUD ──────────────────────────────────────────────────────────────

  _createWaveHUD() {
    this.waveText = document.createElement("div");
    this.waveText.id = "wave-hud";
    this.waveText.style.cssText = `
      position:fixed;top:110px;left:110px;
      font-family:'Courier New',monospace;font-size:13px;letter-spacing:3px;
      color:#00ffcc;text-shadow:0 0 10px #00ffcc;text-transform:uppercase;
      pointer-events:none;z-index:40;transition:opacity 0.4s;opacity:0;
      max-width:min(340px,calc(100vw - 40px));white-space:normal;line-height:1.5;
      background:rgba(0,10,20,0.7);padding:8px 14px;
      border-left:2px solid rgba(0,255,204,0.5);border-radius:0 2px 2px 0;`;
    document.body.appendChild(this.waveText);
  }

  // ── Weapon slots ──────────────────────────────────────────────────────────

  _createWeaponSlots() {
    this._weaponSlotsEl = document.createElement("div");
    this._weaponSlotsEl.id = "weapon-slots";
    this._weaponSlotsEl.style.cssText = `
      position:fixed;bottom:140px;right:30px;
      display:flex;flex-direction:column;gap:5px;
      pointer-events:none;z-index:40;`;

    this._slotEls = [];
    for (let i = 0; i < 4; i++) {
      const slot = document.createElement("div");
      slot.className = "weapon-slot";
      slot.dataset.idx = i;
      slot.innerHTML = `
        <span class="ws-num">[${i + 1}]</span>
        <span class="ws-name">${i === 0 ? "PLASMA DAGGER" : "—"}</span>`;
      this._weaponSlotsEl.appendChild(slot);
      this._slotEls.push(slot);
    }
    document.body.appendChild(this._weaponSlotsEl);
    this._slotEls[0]?.classList.add("ws-active");
  }

  // ── Boss bar ──────────────────────────────────────────────────────────────

  _createBossBar() {
    this._bossBarEl = document.createElement("div");
    this._bossBarEl.id = "boss-bar";
    this._bossBarEl.style.cssText = `
      position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
      width:600px;max-width:90vw;
      pointer-events:none;z-index:45;display:none;text-align:center;
      font-family:'Courier New',monospace;`;
    this._bossBarEl.innerHTML = `
      <div id="boss-name-label" style="font-size:11px;letter-spacing:4px;
        color:#cc00ff;text-shadow:0 0 8px #cc00ff;text-transform:uppercase;
        margin-bottom:5px;">★ ARCHON-0 ★</div>
      <div style="position:relative;width:100%;height:14px;
        background:rgba(0,0,0,0.7);border:1px solid rgba(180,0,255,0.5);
        border-radius:2px;overflow:hidden;">
        <div id="boss-bar-fill" style="height:100%;width:100%;
          background:linear-gradient(90deg,#8800ff,#cc00ff,#ff00aa);
          transition:width 0.3s ease;box-shadow:0 0 10px rgba(180,0,255,0.6);"></div>
      </div>
      <div id="boss-phase-label" style="font-size:9px;letter-spacing:3px;
        color:rgba(180,0,255,0.7);margin-top:4px;">PHASE 1</div>`;
    document.body.appendChild(this._bossBarEl);
  }

  // ── ABILITY HUD — style BPM ───────────────────────────────────────────────

  _createAbilityHUD() {
    this._abilityHUD = document.createElement("div");
    this._abilityHUD.id = "ability-hud";
    this._abilityHUD.style.cssText = `
      position:fixed;bottom:120px;left:50%;transform:translateX(-50%);
      display:flex;gap:12px;align-items:flex-end;
      pointer-events:none;z-index:44;`;
    document.body.appendChild(this._abilityHUD);

    // On crée les 5 slots, cachés par défaut
    this._abilitySlots = {};
    const abilities = [
      { id: "dash",    label: "DASH",    key: "SHIFT"  },
      { id: "blink",   label: "BLINK",   key: "CLIC D" },
      { id: "shield",  label: "BOUCLIER",key: "F"      },
      { id: "emp",     label: "EMP",     key: "G"      },
      { id: "berserk", label: "BERSERK", key: "M"      },
    ];

    abilities.forEach(({ id, label, key }) => {
      const slot = document.createElement("div");
      slot.className  = "ability-slot";
      slot.dataset.id = id;
      slot.style.cssText = `
        display:none;flex-direction:column;align-items:center;gap:3px;
        font-family:'Courier New',monospace;`;

      slot.innerHTML = `
        <div class="ab-icon" style="
          width:44px;height:44px;
          background:rgba(0,10,20,0.85);
          border:2px solid rgba(0,255,204,0.5);
          border-radius:4px;
          position:relative;overflow:hidden;
          display:flex;align-items:center;justify-content:center;">
          <span class="ab-label" style="
            font-size:8px;letter-spacing:1px;
            color:#00ffcc;text-transform:uppercase;
            text-align:center;line-height:1.2;z-index:2;position:relative;">
            ${label}
          </span>
          <div class="ab-cd-overlay" style="
            position:absolute;bottom:0;left:0;right:0;
            height:100%;background:rgba(0,0,0,0.7);
            transition:height 0.1s linear;z-index:1;"></div>
        </div>
        <span class="ab-key" style="
          font-size:9px;letter-spacing:1px;
          color:rgba(0,255,204,0.5);text-transform:uppercase;">
          ${key}
        </span>`;

      this._abilityHUD.appendChild(slot);
      this._abilitySlots[id] = slot;
    });
  }

  /**
   * Appelé chaque frame par Player._updateAbilityHUD()
   * @param {Object} abilities — { dash: {enabled, cd, max, key, active}, ... }
   */
  updateAbilityCooldowns(abilities) {
    Object.entries(abilities).forEach(([id, info]) => {
      const slot = this._abilitySlots[id];
      if (!slot) return;

      if (!info.enabled) {
        slot.style.display = "none";
        return;
      }

      slot.style.display = "flex";

      const overlay = slot.querySelector(".ab-cd-overlay");
      const icon    = slot.querySelector(".ab-icon");

      const ratio = info.max > 0 ? info.cd / info.max : 0;
      // L'overlay descend de haut en bas selon le CD restant
      overlay.style.height = (ratio * 100).toFixed(1) + "%";

      // Couleur de la bordure selon état
      if (info.active) {
        // Capacité active → or pulsé
        icon.style.borderColor = "#ffaa00";
        icon.style.boxShadow   = "0 0 10px rgba(255,170,0,0.6)";
      } else if (info.cd > 0) {
        // En rechargement → gris
        icon.style.borderColor = "rgba(100,100,100,0.5)";
        icon.style.boxShadow   = "none";
      } else {
        // Prêt → cyan
        icon.style.borderColor = "rgba(0,255,204,0.8)";
        icon.style.boxShadow   = "0 0 8px rgba(0,255,204,0.3)";
      }
    });
  }

  // ── Challenge timer ───────────────────────────────────────────────────────

  _createChallengeHUD() {
    this._challengeEl = document.createElement("div");
    this._challengeEl.id = "challenge-hud";
    this._challengeEl.style.cssText = `
      position:fixed;top:16px;right:80px;
      pointer-events:none;z-index:45;
      font-family:'Courier New',monospace;text-align:right;display:none;`;
    this._challengeEl.innerHTML = `
      <div style="font-size:9px;letter-spacing:3px;color:#ffaa00;
        text-transform:uppercase;margin-bottom:2px;">DÉFI</div>
      <div id="challenge-timer" style="font-size:32px;font-weight:bold;
        letter-spacing:4px;color:#ffaa00;text-shadow:0 0 16px #ffaa00;">00</div>
      <div id="challenge-kills" style="font-size:11px;letter-spacing:2px;
        color:rgba(255,170,0,0.6);margin-top:2px;">0 / 0</div>`;
    document.body.appendChild(this._challengeEl);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MISES À JOUR
  // ═══════════════════════════════════════════════════════════════════════════

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

  addHealthSegments(amount, newMaxHealth) {
    this.maxHealth = newMaxHealth;
    for (let i = 0; i < amount; i++) {
      const seg = document.createElement("div");
      seg.className = "hud-segment";
      this.segments.push(seg);
      this.barContainer.appendChild(seg);
    }
  }

  updateAmmo(currentAmmo, maxAmmo) {
    while (this.ammoSegments.length < maxAmmo) {
      const seg = document.createElement("div");
      seg.className = "hud-segment ammo-segment";
      this.ammoSegments.push(seg);
      this.ammoBarContainer.appendChild(seg);
    }
    for (let i = 0; i < this.ammoSegments.length; i++) {
      this.ammoSegments[i].style.opacity   = i < currentAmmo ? "1" : "0.2";
      this.ammoSegments[i].style.transform = i < currentAmmo ? "scale(1)" : "scale(0.8)";
    }
    if (currentAmmo === 0) {
      this.ammoContainer.classList.add("empty");
      this.ammoTitle.innerText = "WEAPON // RELOADING...";
    } else {
      this.ammoContainer.classList.remove("empty");
    }
  }

  updateWeaponAmmo(current, max, name = "WEAPON", reloading = false) {
    this.ammoTitle.innerText = reloading ? `${name} // RELOADING...` : `WEAPON // ${name}`;
    this._reloadBar.style.display = reloading ? "block" : "none";
    this.updateAmmo(current, max);
    if (current === 0 && reloading) this.ammoContainer.classList.add("empty");
    else this.ammoContainer.classList.remove("empty");
  }

  addAmmoSegments(amount) {
    for (let i = 0; i < amount; i++) {
      const seg = document.createElement("div");
      seg.className = "hud-segment ammo-segment";
      this.ammoSegments.push(seg);
      this.ammoBarContainer.appendChild(seg);
    }
  }

  addWeaponSlot(slotIdx, weaponInfo) {
    if (slotIdx < 0 || slotIdx >= this._slotEls.length) return;
    const el = this._slotEls[slotIdx];
    el.querySelector(".ws-name").textContent = weaponInfo.name;
    if (weaponInfo.iconColor) el.style.setProperty("--ws-accent", weaponInfo.iconColor);
  }

  highlightWeaponSlot(slotIdx) {
    this._slotEls.forEach((el, i) => el.classList.toggle("ws-active", i === slotIdx));
  }

  updateScore(total) {
    const el = document.getElementById("score-value");
    if (!el) return;
    el.textContent = String(total).padStart(6, "0");
    el.style.transform = "scale(1.1)";
    setTimeout(() => { el.style.transform = "scale(1)"; }, 150);
  }

  updateCombo(mult, label, decaying = false) {
    const multEl  = document.getElementById("combo-mult");
    const labelEl = document.getElementById("combo-label");
    if (!multEl || !labelEl) return;
    if (mult <= 1) { multEl.style.opacity = "0"; labelEl.style.opacity = "0"; return; }
    multEl.style.opacity   = "1";
    labelEl.style.opacity  = "1";
    multEl.textContent     = `×${mult.toFixed(1)}`;
    labelEl.textContent    = label;
    multEl.style.color     = decaying ? "#ff6600" : "#ffaa00";
    multEl.style.textShadow= decaying ? "0 0 12px #ff6600" : "0 0 20px #ffaa00";
  }

  showPointsPopup(points, opts = {}) {
    if (points <= 0 && !opts.label) return;
    const el  = document.createElement("div");
    let txt   = opts.label ? opts.label : `+${points}`;
    if (!opts.label && opts.weakpoint)   txt += " ✦ WEAKPOINT";
    if (!opts.label && opts.streak > 2)  txt += ` ×${opts.streak} STREAK`;
    el.style.cssText = `
      position:absolute;
      left:${-80 + Math.random() * 160}px;
      top:${Math.random() * 50 - 25}px;
      font-family:'Courier New',monospace;
      font-size:${opts.label ? 17 : 14}px;
      font-weight:bold;letter-spacing:2px;
      color:${opts.weakpoint ? "#ff88ff" : opts.label ? "#ffaa00" : "#00ffcc"};
      text-shadow:0 0 10px currentColor;
      white-space:nowrap;pointer-events:none;
      animation:popupFloat 1.2s ease-out forwards;`;
    el.textContent = txt;
    this._popupContainer.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 1300);
  }

  updateWave(waveNumber) {
    this.waveText.innerText = `▶ VAGUE ${waveNumber} / 3`;
    this.waveText.style.opacity = "1";
    clearTimeout(this._waveHideTimer);
    this._waveHideTimer = setTimeout(() => { this.waveText.style.opacity = "0"; }, 2500);
  }

  showWaveMessage(message) {
    this.waveText.innerText = message;
    this.waveText.style.opacity = "1";
    clearTimeout(this._waveHideTimer);
    this._waveHideTimer = setTimeout(() => { this.waveText.style.opacity = "0"; }, 3000);
  }

  showWaveBonus(bonus, labels = []) {
    labels.forEach((lbl, i) => setTimeout(() => this.showPointsPopup(0, { label: lbl }), i * 300));
  }

  showBossBar(maxHp) {
    this._bossMaxHp = maxHp;
    this._bossBarEl.style.display    = "block";
    this._bossBarEl.style.opacity    = "1";
    this._bossBarEl.style.transition = "opacity 0.5s";
    this.updateBossBar(maxHp, maxHp);
  }

  updateBossBar(current, max) {
    const fill = document.getElementById("boss-bar-fill");
    if (!fill) return;
    const pct = Math.max(0, (current / max) * 100).toFixed(1);
    fill.style.width = pct + "%";
    if (pct < 30)      fill.style.background = "linear-gradient(90deg,#ff0000,#ff4400)";
    else if (pct < 60) fill.style.background = "linear-gradient(90deg,#ff4400,#ff8800)";
    else               fill.style.background = "linear-gradient(90deg,#8800ff,#cc00ff,#ff00aa)";
  }

  hideBossBar() {
    this._bossBarEl.style.opacity    = "0";
    this._bossBarEl.style.transition = "opacity 1s";
    setTimeout(() => { this._bossBarEl.style.display = "none"; this._bossBarEl.style.opacity = "1"; }, 1000);
  }

  showBossPhaseBonus(phase, bonus) {
    this.showPointsPopup(bonus, { label: `PHASE ${phase} +${bonus}` });
    const lbl = document.getElementById("boss-phase-label");
    if (lbl) {
      lbl.textContent = `PHASE ${phase}`;
      lbl.style.color = phase >= 3 ? "#ff0000" : phase === 2 ? "#ff8800" : "rgba(180,0,255,0.7)";
    }
  }

  showBossKillBanner(totalScore) {
    const banner = document.createElement("div");
    banner.style.cssText = `
      position:fixed;top:0;left:0;right:0;bottom:0;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.65);font-family:'Courier New',monospace;
      pointer-events:none;z-index:300;`;
    banner.innerHTML = `
      <div style="font-size:56px;font-weight:bold;letter-spacing:10px;
        color:#cc00ff;text-shadow:0 0 40px #cc00ff;animation:glitch 0.5s infinite;">
        ARCHON NEUTRALISÉ
      </div>
      <div style="font-size:16px;letter-spacing:5px;color:#00ffcc;margin-top:20px;">
        SCORE : ${String(totalScore).padStart(8, "0")}
      </div>`;
    document.body.appendChild(banner);
    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transition = "opacity 1.5s";
      setTimeout(() => banner.remove(), 1500);
    }, 3000);
  }

  updateChallengeTimer(seconds, killed, target) {
    this._challengeEl.style.display = "block";
    const timerEl = document.getElementById("challenge-timer");
    const killsEl = document.getElementById("challenge-kills");
    if (timerEl) {
      timerEl.textContent = String(Math.max(0, seconds)).padStart(2, "0");
      timerEl.style.color = seconds <= 10 ? "#ff0000" : "#ffaa00";
    }
    if (killsEl) killsEl.textContent = `${killed} / ${target}`;
    if (seconds <= 0) setTimeout(() => { this._challengeEl.style.display = "none"; }, 1500);
  }

  showExitIndicator() {
    if (!this._exitIndicator) return;
    this._exitIndicator.style.opacity = "1";
    clearTimeout(this._exitHideTimer);
    this._exitHideTimer = setTimeout(() => this.hideExitIndicator(), 5000);
  }

  hideExitIndicator() {
    if (!this._exitIndicator) return;
    this._exitIndicator.style.opacity = "0";
  }

  updateFps(engine) {
    this.fpsContainer.innerHTML = engine.getFps().toFixed() + " fps";
  }

  // ── Upgrade screen ────────────────────────────────────────────────────────

  showUpgradeScreen(upgrades, onSelectCallback, rerollCost = 800, getScore = null, onReroll = null) {
    document.getElementById("upgrade-overlay")?.remove();

    this.upgradeOverlay = document.createElement("div");
    this.upgradeOverlay.id = "upgrade-overlay";

    const title = document.createElement("div");
    title.className = "upgrade-title";
    title.innerText = ">> SYSTÈME DE MISE À JOUR DISPONIBLE <<";
    this.upgradeOverlay.appendChild(title);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "cards-container";

    upgrades.forEach((upgrade) => {
      const rarity = upgrade.rarity ?? { color: "#aaaaaa", label: "COMMUN", glow: "rgba(170,170,170,0.3)" };
      const card   = document.createElement("div");
      card.className = "upgrade-card";
      card.style.setProperty("--rarity-color", rarity.color);
      card.style.setProperty("--rarity-glow",  rarity.glow);
      card.innerHTML = `
        <div class="upgrade-rarity-badge" style="color:${rarity.color}">${rarity.label}</div>
        <div class="card-icon-wrapper" style="border-color:${rarity.color}55">
          <img src="${upgrade.iconPath || "/vite.svg"}" alt="icon" class="card-icon">
        </div>
        <div class="card-title">${upgrade.name}</div>
        <div class="card-category" style="color:${rarity.color}">${upgrade.category}</div>
        <div class="card-desc">${upgrade.description}</div>`;
      card.addEventListener("click", () => { this.upgradeOverlay.remove(); onSelectCallback(upgrade); });
      cardsContainer.appendChild(card);
    });

    this.upgradeOverlay.appendChild(cardsContainer);

    if (onReroll) {
      const rerollRow = document.createElement("div");
      rerollRow.className = "upgrade-reroll-row";
      const rerollBtn = document.createElement("button");
      rerollBtn.className = "upgrade-reroll-btn";

      const refresh = () => {
        const score     = getScore?.() ?? 0;
        const canAfford = score >= rerollCost;
        rerollBtn.textContent = `⟳  REROLL  —  ${rerollCost} pts`;
        rerollBtn.disabled    = !canAfford;
        rerollBtn.style.opacity = canAfford ? "1" : "0.4";
      };
      refresh();
      rerollBtn.addEventListener("click", () => { onReroll(); });
      rerollRow.appendChild(rerollBtn);
      this.upgradeOverlay.appendChild(rerollRow);
    }

    document.body.appendChild(this.upgradeOverlay);
    requestAnimationFrame(() => { this.upgradeOverlay.style.opacity = "1"; });
  }

  // ── Panneau Tab ───────────────────────────────────────────────────────────

  _buildStatsPanel() {
    const panel = document.createElement("div");
    panel.id = "stats-panel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="stats-title">[ SYSTÈME // ÉTAT OPÉRATEUR ]</div>
      <div class="stats-body">
        <div class="stats-col">
          <div class="stats-section-label">STATISTIQUES</div>
          <div id="stats-lines"></div>
        </div>
        <div class="stats-col">
          <div class="stats-section-label">AMÉLIORATIONS ACTIVES</div>
          <div id="stats-upgrades"></div>
        </div>
      </div>
      <div class="stats-hint">[ TAB ] Fermer</div>`;
    document.body.appendChild(panel);
    this._statsPanel = panel;
  }

  toggleStatsPanel(stats, acquired) {
    if (!this._statsPanel) this._buildStatsPanel();

    const isVisible = this._statsPanel.style.display !== "none";
    if (isVisible) {
      this._statsPanel.style.opacity = "0";
      setTimeout(() => { this._statsPanel.style.display = "none"; }, 200);
      return;
    }

    const linesEl = this._statsPanel.querySelector("#stats-lines");
    linesEl.innerHTML = "";
    const statRows = [
      ["VIE",         stats.health],
      ["VITESSE",     stats.speed],
      ["DÉGÂTS",      stats.damage],
      ["CADENCE",     stats.firerate],
      ["CHARGEUR",    stats.ammo],
      ["DASH",        stats.dash],
      ["BLINK",       stats.blink],
      ["BOUCLIER",    stats.shield],
      ["BERSERK",     stats.berserk],
      ["GRENADE EMP", stats.emp],
    ];
    statRows.forEach(([label, val]) => {
      const isActive = val === "OUI";
      const row = document.createElement("div");
      row.className = "stats-row";
      row.innerHTML = `
        <span class="stats-label">${label}</span>
        <span class="stats-val${isActive ? " stats-val-yes" : ""}">${val}</span>`;
      linesEl.appendChild(row);
    });

    const upgrEl = this._statsPanel.querySelector("#stats-upgrades");
    upgrEl.innerHTML = "";
    if (!acquired.length) {
      upgrEl.innerHTML = `<div class="stats-empty">Aucune amélioration</div>`;
    } else {
      acquired.forEach(u => {
        const rarity = u.rarity ?? { color: "#aaaaaa" };
        const el = document.createElement("div");
        el.className = "stats-upgrade-tag";
        el.style.borderColor = rarity.color + "88";
        el.style.color       = rarity.color;
        el.title             = u.description;
        el.textContent       = u.name;
        upgrEl.appendChild(el);
      });
    }

    this._statsPanel.style.display = "flex";
    requestAnimationFrame(() => { this._statsPanel.style.opacity = "1"; });
  }
}