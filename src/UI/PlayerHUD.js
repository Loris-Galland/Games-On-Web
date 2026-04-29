/**
 * PlayerHUD (corrigé)
 * -------------------
 * Fix superposition : le texte des vagues est maintenant positionné
 * à GAUCHE (côté health) au lieu du centre, ce qui l'éloigne du score.
 * Disposition finale :
 *   - Score + Combo : haut CENTRE
 *   - Messages vague : haut GAUCHE (sous le health)
 *   - Boss bar       : bas CENTRE
 *   - Health         : bas GAUCHE
 *   - Ammo + slots   : bas DROITE
 *   - Challenge timer: haut DROITE
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

        // ── Weapon slots (bas droite, au-dessus ammo) ─────────────────────────
        this._createWeaponSlots();

        // ── Score + Combo (haut CENTRE) ───────────────────────────────────────
        this._createScoreHUD();

        // ── Message de vague (haut GAUCHE — FIX superposition) ───────────────
        this._createWaveHUD();

        // ── Boss bar (bas centre) ─────────────────────────────────────────────
        this._createBossBar();

        // ── Challenge timer (haut DROITE) ─────────────────────────────────────
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
    }

    // ── Score HUD (haut CENTRE) ───────────────────────────────────────────────

    _createScoreHUD() {
        this._scoreEl = document.createElement("div");
        this._scoreEl.id = "score-hud";
        // Position : haut centre, assez haut pour ne pas gêner
        this._scoreEl.style.cssText = `
            position:fixed;
            top:16px;
            left:50%;
            transform:translateX(-50%);
            pointer-events:none;z-index:40;
            text-align:center;
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

    // ── Message de vague (haut GAUCHE — FIX) ─────────────────────────────────

    _createWaveHUD() {
        // FIX : on retire l'ancien #wave-hud centré et on crée un élément
        // positionné en haut GAUCHE, sous le HUD health, séparé du score.
        this.waveText = document.createElement("div");
        this.waveText.id = "wave-hud";
        // Positionnement : gauche, sous le bloc health (qui est en bas à gauche)
        // On le met en haut à gauche pour les messages courts de statut.
        this.waveText.style.cssText = `
            position:fixed;
            top:80px;
            left:30px;
            font-family:'Courier New',monospace;
            font-size:13px;
            letter-spacing:3px;
            color:#00ffcc;
            text-shadow:0 0 10px #00ffcc;
            text-transform:uppercase;
            pointer-events:none;
            z-index:40;
            transition:opacity 0.4s;
            opacity:0;
            max-width:320px;
            white-space:normal;
            line-height:1.5;
            background:rgba(0,10,20,0.55);
            padding:6px 12px;
            border-left:2px solid rgba(0,255,204,0.4);`;
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
        for (let i = 0; i < 3; i++) {
            const slot = document.createElement("div");
            slot.className = "weapon-slot";
            slot.dataset.idx = i;
            slot.innerHTML = `
                <span class="ws-num">${i + 1}</span>
                <span class="ws-name">${i === 0 ? "PLASMA DAGGER" : "—"}</span>`;
            this._weaponSlotsEl.appendChild(slot);
            this._slotEls.push(slot);
        }
        document.body.appendChild(this._weaponSlotsEl);
        // Activer slot 0 par défaut
        this._slotEls[0]?.classList.add("ws-active");
    }

    // ── Boss bar (bas CENTRE) ─────────────────────────────────────────────────

    _createBossBar() {
        this._bossBarEl = document.createElement("div");
        this._bossBarEl.id = "boss-bar";
        this._bossBarEl.style.cssText = `
            position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
            width:600px;max-width:90vw;
            pointer-events:none;z-index:45;
            display:none;text-align:center;
            font-family:'Courier New',monospace;`;

        this._bossBarEl.innerHTML = `
            <div id="boss-name-label" style="font-size:11px;letter-spacing:4px;
                color:#cc00ff;text-shadow:0 0 8px #cc00ff;text-transform:uppercase;
                margin-bottom:5px;">★ ARCHON-0 ★</div>
            <div style="position:relative;width:100%;height:14px;
                background:rgba(0,0,0,0.7);border:1px solid rgba(180,0,255,0.5);
                border-radius:2px;overflow:hidden;">
                <div id="boss-bar-fill" style="
                    height:100%;width:100%;
                    background:linear-gradient(90deg,#8800ff,#cc00ff,#ff00aa);
                    transition:width 0.3s ease;
                    box-shadow:0 0 10px rgba(180,0,255,0.6);"></div>
                <div style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
                    <div style="position:absolute;top:0;bottom:0;left:60%;width:2px;background:rgba(255,255,255,0.35);"></div>
                    <div style="position:absolute;top:0;bottom:0;left:30%;width:2px;background:rgba(255,255,255,0.35);"></div>
                </div>
            </div>
            <div id="boss-phase-label" style="font-size:9px;letter-spacing:3px;
                color:rgba(180,0,255,0.7);margin-top:4px;">PHASE 1</div>`;
        document.body.appendChild(this._bossBarEl);
    }

    // ── Challenge timer (haut DROITE) ─────────────────────────────────────────

    _createChallengeHUD() {
        this._challengeEl = document.createElement("div");
        this._challengeEl.id = "challenge-hud";
        // Haut droite, séparé du score centré et du message de vague gauche
        this._challengeEl.style.cssText = `
            position:fixed;
            top:16px;
            right:80px;
            pointer-events:none;z-index:45;
            font-family:'Courier New',monospace;
            text-align:right;
            display:none;`;

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

    // ── Health ────────────────────────────────────────────────────────────────

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

    // ── Ammo ──────────────────────────────────────────────────────────────────

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

    // ── Weapon slots ──────────────────────────────────────────────────────────

    addWeaponSlot(slotIdx, weaponInfo) {
        if (slotIdx < 0 || slotIdx >= this._slotEls.length) return;
        const el = this._slotEls[slotIdx];
        el.querySelector(".ws-name").textContent = weaponInfo.name;
        if (weaponInfo.iconColor) el.style.setProperty("--ws-accent", weaponInfo.iconColor);
    }

    highlightWeaponSlot(slotIdx) {
        this._slotEls.forEach((el, i) => el.classList.toggle("ws-active", i === slotIdx));
    }

    // ── Score ─────────────────────────────────────────────────────────────────

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
        if (mult <= 1) {
            multEl.style.opacity  = "0";
            labelEl.style.opacity = "0";
            return;
        }
        multEl.style.opacity    = "1";
        labelEl.style.opacity   = "1";
        multEl.textContent      = `×${mult.toFixed(1)}`;
        labelEl.textContent     = label;
        multEl.style.color      = decaying ? "#ff6600" : "#ffaa00";
        multEl.style.textShadow = decaying ? "0 0 12px #ff6600" : "0 0 20px #ffaa00";
    }

    showPointsPopup(points, opts = {}) {
        if (points <= 0 && !opts.label) return;
        const el = document.createElement("div");
        let txt = opts.label ? opts.label : `+${points}`;
        if (!opts.label && opts.weakpoint) txt += " ✦ WEAKPOINT";
        if (!opts.label && opts.streak > 2) txt += ` ×${opts.streak} STREAK`;

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
        setTimeout(() => { try { el.remove(); } catch(_){} }, 1300);
    }

    // ── Vague (FIX : à gauche, pas en superposition avec le score) ────────────

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

    // ── Boss bar ──────────────────────────────────────────────────────────────

    showBossBar(maxHp) {
        this._bossMaxHp = maxHp;
        this._bossBarEl.style.display = "block";
        this._bossBarEl.style.opacity = "1";
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
                SCORE : ${String(totalScore).padStart(8,"0")}
            </div>`;
        document.body.appendChild(banner);
        setTimeout(() => {
            banner.style.opacity = "0";
            banner.style.transition = "opacity 1.5s";
            setTimeout(() => banner.remove(), 1500);
        }, 3000);
    }

    // ── Challenge timer ───────────────────────────────────────────────────────

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

    // ── FPS ───────────────────────────────────────────────────────────────────

    updateFps(engine) {
        this.fpsContainer.innerHTML = engine.getFps().toFixed() + " fps";
    }

    // ── Upgrade screen ────────────────────────────────────────────────────────

    showUpgradeScreen(upgrades, onSelectCallback) {
        this.upgradeOverlay = document.createElement("div");
        this.upgradeOverlay.id = "upgrade-overlay";

        const title = document.createElement("div");
        title.className = "upgrade-title";
        title.innerText = ">> SYSTÈME DE MISE À JOUR DISPONIBLE <<";
        this.upgradeOverlay.appendChild(title);

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
                <div class="card-desc">${upgrade.description}</div>`;
            card.addEventListener("click", () => {
                this.upgradeOverlay.remove();
                onSelectCallback(upgrade);
            });
            cardsContainer.appendChild(card);
        });

        this.upgradeOverlay.appendChild(cardsContainer);
        document.body.appendChild(this.upgradeOverlay);
        requestAnimationFrame(() => { this.upgradeOverlay.style.opacity = "1"; });
    }
}