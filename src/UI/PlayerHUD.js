/**
 * PlayerHUD (version enrichie)
 * ----------------------------
 * Nouveautés :
 *   - Score en temps réel avec animation
 *   - Multiplicateur de combo + label (GODLIKE, ARCHON…)
 *   - Boss health bar avec phases
 *   - Slots d'armes (3 slots)
 *   - Popups points flottants
 *   - Timer défi
 *   - Bonus de fin de vague
 */
export class PlayerHUD {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this._createHUD();
        this._popupPool = [];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CRÉATION
    // ═══════════════════════════════════════════════════════════════════════════

    _createHUD() {
        // ── Health ────────────────────────────────────────────────────────────
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

        // ── Ammo / Weapon ─────────────────────────────────────────────────────
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

        // Reload bar
        this._reloadBar = document.createElement("div");
        this._reloadBar.className = "hud-reload-bar";
        this._reloadBar.style.display = "none";
        this.ammoContainer.appendChild(this._reloadBar);

        document.body.appendChild(this.ammoContainer);

        // ── Weapon slots ──────────────────────────────────────────────────────
        this._createWeaponSlots();

        // ── Score & Combo ─────────────────────────────────────────────────────
        this._createScoreHUD();

        // ── Boss bar ──────────────────────────────────────────────────────────
        this._createBossBar();

        // ── Wave / message ────────────────────────────────────────────────────
        this.waveText = document.createElement("div");
        this.waveText.id = "wave-hud";
        document.body.appendChild(this.waveText);

        // ── Challenge timer ───────────────────────────────────────────────────
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

        // ── Popup container ───────────────────────────────────────────────────
        this._popupContainer = document.createElement("div");
        this._popupContainer.id = "hud-popups";
        this._popupContainer.style.cssText = `
            position:fixed;top:50%;left:50%;
            transform:translate(-50%,-50%);
            pointer-events:none;z-index:50;`;
        document.body.appendChild(this._popupContainer);
    }

    // ── Weapon Slots ──────────────────────────────────────────────────────────

    _createWeaponSlots() {
        this._weaponSlotsEl = document.createElement("div");
        this._weaponSlotsEl.id = "weapon-slots";
        this._weaponSlotsEl.style.cssText = `
            position:fixed;bottom:140px;right:30px;
            display:flex;flex-direction:column;gap:6px;
            pointer-events:none;z-index:40;`;

        this._slotEls = [];
        for (let i = 0; i < 3; i++) {
            const slot = document.createElement("div");
            slot.className = "weapon-slot";
            slot.dataset.idx = i;
            slot.innerHTML = `
                <span class="ws-num">${i + 1}</span>
                <span class="ws-name">${i === 0 ? "PLASMA DAGGER" : "—"}</span>
            `;
            this._weaponSlotsEl.appendChild(slot);
            this._slotEls.push(slot);
        }

        document.body.appendChild(this._weaponSlotsEl);
    }

    // ── Score HUD ─────────────────────────────────────────────────────────────

    _createScoreHUD() {
        this._scoreEl = document.createElement("div");
        this._scoreEl.id = "score-hud";
        this._scoreEl.style.cssText = `
            position:fixed;top:20px;left:50%;transform:translateX(-50%);
            pointer-events:none;z-index:40;text-align:center;
            font-family:'Courier New',monospace;`;

        this._scoreEl.innerHTML = `
            <div id="combo-label" style="
                font-size:11px;letter-spacing:4px;color:#ff4400;
                text-shadow:0 0 10px #ff4400;text-transform:uppercase;
                height:16px;transition:opacity 0.3s;opacity:0;">
            </div>
            <div id="combo-mult" style="
                font-size:32px;font-weight:bold;letter-spacing:3px;
                color:#ffaa00;text-shadow:0 0 20px #ffaa00;
                height:38px;transition:all 0.2s;opacity:0;">
            </div>
            <div id="score-value" style="
                font-size:22px;letter-spacing:5px;color:#00ffcc;
                text-shadow:0 0 12px #00ffcc;margin-top:4px;">
                000000
            </div>
        `;
        document.body.appendChild(this._scoreEl);
    }

    // ── Boss Bar ──────────────────────────────────────────────────────────────

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
            <div style="font-size:11px;letter-spacing:4px;color:#cc00ff;
                text-shadow:0 0 8px #cc00ff;text-transform:uppercase;
                margin-bottom:5px;">
                ★ ARCHON-0 ★
            </div>
            <div style="position:relative;width:100%;height:14px;
                background:rgba(0,0,0,0.7);border:1px solid rgba(180,0,255,0.5);
                border-radius:2px;overflow:hidden;">
                <div id="boss-bar-fill" style="
                    height:100%;width:100%;
                    background:linear-gradient(90deg,#8800ff,#cc00ff,#ff00aa);
                    transition:width 0.3s ease;
                    box-shadow:0 0 10px rgba(180,0,255,0.6);">
                </div>
                <div id="boss-phase-markers" style="
                    position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
                    <!-- Marqueurs de phase à 60% et 30% -->
                    <div style="position:absolute;top:0;bottom:0;left:60%;width:2px;background:rgba(255,255,255,0.4);"></div>
                    <div style="position:absolute;top:0;bottom:0;left:30%;width:2px;background:rgba(255,255,255,0.4);"></div>
                </div>
            </div>
            <div id="boss-phase-label" style="
                font-size:9px;letter-spacing:3px;color:rgba(180,0,255,0.7);
                margin-top:4px;">PHASE 1</div>
        `;
        document.body.appendChild(this._bossBarEl);
    }

    // ── Challenge HUD ─────────────────────────────────────────────────────────

    _createChallengeHUD() {
        this._challengeEl = document.createElement("div");
        this._challengeEl.id = "challenge-hud";
        this._challengeEl.style.cssText = `
            position:fixed;top:120px;left:50%;transform:translateX(-50%);
            pointer-events:none;z-index:45;
            font-family:'Courier New',monospace;text-align:center;
            display:none;`;

        this._challengeEl.innerHTML = `
            <div style="font-size:10px;letter-spacing:4px;color:#ffaa00;
                text-transform:uppercase;margin-bottom:4px;">DÉFI EN COURS</div>
            <div id="challenge-timer" style="font-size:36px;font-weight:bold;
                letter-spacing:4px;color:#ffaa00;text-shadow:0 0 16px #ffaa00;">00</div>
            <div id="challenge-kills" style="font-size:13px;letter-spacing:3px;
                color:rgba(255,170,0,0.7);margin-top:3px;">0 / 0</div>
        `;
        document.body.appendChild(this._challengeEl);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MISE À JOUR
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

    // ── Ammo / Weapon ─────────────────────────────────────────────────────────

    updateAmmo(currentAmmo, maxAmmo) {
        // Ajuste le nombre de segments si besoin
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

    /**
     * Mise à jour unifiée pour les armes secondaires.
     * @param {number} current
     * @param {number} max
     * @param {string} name
     * @param {boolean} reloading
     */
    updateWeaponAmmo(current, max, name = "WEAPON", reloading = false) {
        this.ammoTitle.innerText = reloading ? `${name} // RELOADING...` : `WEAPON // ${name}`;

        // Barre de rechargement
        if (reloading) {
            this._reloadBar.style.display = "block";
            this._reloadBar.style.animation = "reloadAnim 1s linear infinite";
        } else {
            this._reloadBar.style.display = "none";
        }

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

    // ── Weapon Slots ──────────────────────────────────────────────────────────

    addWeaponSlot(slotIdx, weaponInfo) {
        if (slotIdx < 0 || slotIdx >= this._slotEls.length) return;
        const el = this._slotEls[slotIdx];
        el.querySelector(".ws-name").textContent = weaponInfo.name;
        el.style.borderColor = weaponInfo.iconColor ?? "#00ffcc";
    }

    highlightWeaponSlot(slotIdx) {
        this._slotEls.forEach((el, i) => {
            el.classList.toggle("ws-active", i === slotIdx);
        });
    }

    // ── Score ─────────────────────────────────────────────────────────────────

    updateScore(total) {
        const el = document.getElementById("score-value");
        if (el) {
            el.textContent = String(total).padStart(6, "0");
            el.style.transform = "scale(1.12)";
            el.style.color = "#00ffcc";
            setTimeout(() => {
                el.style.transform = "scale(1)";
            }, 150);
        }
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
        el.className = "hud-pts-popup";

        let txt = `+${points}`;
        if (opts.weakpoint) txt += " ✦ WEAKPOINT";
        if (opts.streak > 2) txt += ` ×${opts.streak} STREAK`;
        if (opts.label)      txt = opts.label;

        el.textContent = txt;
        el.style.cssText = `
            position:absolute;
            left:${-60 + Math.random() * 120}px;
            top:${Math.random() * 40 - 20}px;
            font-family:'Courier New',monospace;
            font-size:${opts.label ? 18 : 15}px;
            font-weight:bold;
            letter-spacing:2px;
            color:${opts.weakpoint ? "#ff88ff" : opts.label ? "#ffaa00" : "#00ffcc"};
            text-shadow:0 0 10px currentColor;
            white-space:nowrap;
            pointer-events:none;
            animation:popupFloat 1.2s ease-out forwards;
        `;
        this._popupContainer.appendChild(el);
        setTimeout(() => { try { el.remove(); } catch(_){} }, 1300);
    }

    // ── Wave ──────────────────────────────────────────────────────────────────

    updateWave(waveNumber) {
        this.waveText.innerText = `VAGUE ${waveNumber}`;
        this.waveText.style.opacity = "1";
        setTimeout(() => { this.waveText.style.opacity = "0"; }, 2000);
    }

    showWaveMessage(message) {
        this.waveText.innerText = message;
        this.waveText.style.opacity = "1";
        clearTimeout(this._waveHideTimer);
        this._waveHideTimer = setTimeout(() => { this.waveText.style.opacity = "0"; }, 2500);
    }

    showWaveBonus(bonus, labels = []) {
        if (bonus <= 0) return;
        labels.forEach((lbl, i) => {
            setTimeout(() => this.showPointsPopup(0, { label: lbl }), i * 300);
        });
    }

    // ── Boss Bar ──────────────────────────────────────────────────────────────

    showBossBar(maxHp) {
        this._bossMaxHp = maxHp;
        this._bossBarEl.style.display = "block";
        this._bossBarEl.style.animation = "bossBarIn 0.5s ease-out";
        this.updateBossBar(maxHp, maxHp);
    }

    updateBossBar(current, max) {
        const fill = document.getElementById("boss-bar-fill");
        if (fill) {
            const pct = Math.max(0, (current / max) * 100).toFixed(1);
            fill.style.width = pct + "%";

            // Couleur selon vie
            if (pct < 30)      fill.style.background = "linear-gradient(90deg,#ff0000,#ff4400)";
            else if (pct < 60) fill.style.background = "linear-gradient(90deg,#ff4400,#ff8800)";
            else               fill.style.background = "linear-gradient(90deg,#8800ff,#cc00ff,#ff00aa)";
        }
    }

    hideBossBar() {
        this._bossBarEl.style.opacity = "0";
        this._bossBarEl.style.transition = "opacity 1s";
        setTimeout(() => {
            this._bossBarEl.style.display = "none";
            this._bossBarEl.style.opacity = "1";
        }, 1000);
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
            display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            background:rgba(0,0,0,0.7);
            font-family:'Courier New',monospace;
            pointer-events:none;z-index:300;
            animation:bossKillIn 0.5s ease-out;`;

        banner.innerHTML = `
            <div style="font-size:60px;font-weight:bold;letter-spacing:10px;
                color:#cc00ff;text-shadow:0 0 40px #cc00ff;
                animation:glitch 0.5s infinite;">ARCHON-0</div>
            <div style="font-size:24px;letter-spacing:6px;color:#ffffff;
                margin-top:10px;">NEUTRALISÉ</div>
            <div style="font-size:16px;letter-spacing:4px;color:#00ffcc;
                margin-top:30px;">SCORE : ${String(totalScore).padStart(8, "0")}</div>
        `;
        document.body.appendChild(banner);
        setTimeout(() => {
            banner.style.opacity = "0";
            banner.style.transition = "opacity 1.5s";
            setTimeout(() => banner.remove(), 1500);
        }, 3000);
    }

    // ── Challenge Timer ───────────────────────────────────────────────────────

    updateChallengeTimer(seconds, killed, target) {
        this._challengeEl.style.display = "block";
        const timerEl  = document.getElementById("challenge-timer");
        const killsEl  = document.getElementById("challenge-kills");
        if (timerEl) {
            timerEl.textContent = String(seconds).padStart(2, "0");
            timerEl.style.color = seconds <= 10 ? "#ff0000" : "#ffaa00";
        }
        if (killsEl) killsEl.textContent = `${killed} / ${target}`;
        if (seconds <= 0) {
            setTimeout(() => { this._challengeEl.style.display = "none"; }, 1500);
        }
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
                <div class="card-desc">${upgrade.description}</div>
            `;
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
