/**
 * GameOverScreen (version enrichie)
 * -----------------------------------
 * Affiche un bilan complet avec :
 *   - Score total + grade (S/A/B/C/D)
 *   - Kills par type d'ennemi
 *   - Précision weakpoint
 *   - Perfect waves
 *   - Bonus boss
 *   - Classement ASCII
 */
export class GameOverScreen {

    constructor() {
        this._overlay = null;
    }

    /**
     * @param {object} stats
     *   stats.wavesCleared   {number}
     *   stats.roomsCleared   {number}
     *   stats.scoreManager   {ScoreManager}  optionnel
     */
    show(stats = {}) {
        if (this._overlay) return;
        document.exitPointerLock?.();

        const sm      = stats.scoreManager;
        const summary = sm?.getSummary?.() ?? {};

        const totalScore    = summary.totalScore    ?? 0;
        const grade         = summary.grade         ?? "D";
        const totalKills    = summary.totalKills    ?? stats.totalKills    ?? 0;
        const wavesCleared  = summary.wavesCleared  ?? stats.wavesCleared  ?? 0;
        const roomsCleared  = summary.roomsCleared  ?? stats.roomsCleared  ?? 0;
        const wpKills       = summary.weakpointKills ?? 0;
        const accuracy      = summary.accuracy       ?? 0;
        const perfectWaves  = summary.perfectWaves  ?? 0;
        const kills         = summary.sessionKills  ?? {};

        this._overlay = document.createElement("div");
        this._overlay.id = "game-over-overlay";

        const gradeColors = { S: "#ffcc00", A: "#00ffcc", B: "#00aaff", C: "#aaaaaa", D: "#ff4444" };
        const gradeColor  = gradeColors[grade] ?? "#ff4444";
        const gradeGlow   = gradeColor.replace("#", "");

        this._overlay.innerHTML = `
            <div class="go-scanline"></div>
            <div class="go-content" style="max-width:800px;">

                <!-- Titre glitch -->
                <div class="go-glitch" data-text="SYSTEM FAILURE">SYSTEM FAILURE</div>
                <div class="go-subtitle">INTEGRITY COMPROMISED — UNIT TERMINATED</div>

                <!-- Grade -->
                <div style="
                    font-family:'Courier New',monospace;
                    font-size:96px;font-weight:bold;
                    letter-spacing:8px;
                    color:${gradeColor};
                    text-shadow:0 0 40px ${gradeColor}, 0 0 80px ${gradeColor}88;
                    line-height:1;margin:10px 0;
                    animation:gradeIn 0.6s ease-out;">
                    ${grade}
                </div>
                <div style="font-family:'Courier New',monospace;font-size:11px;
                    letter-spacing:4px;color:rgba(255,255,255,0.35);margin-bottom:20px;">
                    PERFORMANCE RATING
                </div>

                <!-- Score principal -->
                <div style="
                    font-family:'Courier New',monospace;
                    font-size:42px;font-weight:bold;letter-spacing:6px;
                    color:#00ffcc;text-shadow:0 0 20px #00ffcc;
                    margin:8px 0;">
                    ${String(totalScore).padStart(8, "0")}
                </div>
                <div style="font-family:'Courier New',monospace;font-size:9px;
                    letter-spacing:3px;color:rgba(0,255,204,0.4);margin-bottom:28px;">
                    TOTAL SCORE
                </div>

                <!-- Stats grille -->
                <div style="
                    display:grid;grid-template-columns:repeat(3,1fr);
                    gap:12px;width:100%;max-width:640px;margin-bottom:24px;">

                    ${this._statCard("SECTEURS", String(roomsCleared).padStart(3,"0"), "#00ffcc")}
                    ${this._statCard("VAGUES", String(wavesCleared).padStart(3,"0"), "#00ffcc")}
                    ${this._statCard("KILLS", String(totalKills).padStart(3,"0"), "#ff4466")}
                    ${this._statCard("PRÉCISION", accuracy + "%", "#ffaa00")}
                    ${this._statCard("VAGUES PARFAITES", String(perfectWaves).padStart(2,"0"), "#aaffaa")}
                    ${this._statCard("WEAKPOINTS", String(wpKills).padStart(3,"0"), "#ff88ff")}
                </div>

                <!-- Kills par type -->
                ${totalKills > 0 ? `
                <div style="
                    font-family:'Courier New',monospace;
                    width:100%;max-width:640px;
                    border:1px solid rgba(0,255,204,0.15);
                    padding:16px 24px;
                    background:rgba(0,255,204,0.03);
                    margin-bottom:24px;">
                    <div style="font-size:9px;letter-spacing:4px;color:rgba(0,200,160,0.5);
                        text-transform:uppercase;margin-bottom:12px;">JOURNAL DE COMBAT</div>
                    <div style="display:flex;justify-content:space-around;">
                        ${this._killBadge("STANDARD", kills.standard ?? 0, "#ff4466")}
                        ${this._killBadge("SCOUT",    kills.scout    ?? 0, "#00ccff")}
                        ${this._killBadge("HEAVY",    kills.heavy    ?? 0, "#ff8800")}
                        ${this._killBadge("BOSS",     kills.boss     ?? 0, "#cc00ff")}
                    </div>
                </div>` : ""}

                <!-- Boutons -->
                <div class="go-buttons">
                    <button class="go-btn go-btn-primary" id="go-retry">
                        ↺ NOUVELLE TENTATIVE
                    </button>
                    <button class="go-btn go-btn-secondary" id="go-menu">
                        ← RETOUR AU TERMINAL
                    </button>
                </div>

                <div class="go-footer">ROGUE PROTOCOL v2.7 — SECTOR DATA LOST</div>
            </div>
        `;

        document.body.appendChild(this._overlay);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            this._overlay.classList.add("go-visible");
        }));

        document.getElementById("go-retry").addEventListener("click", () => {
            window.location.reload();
        });
        document.getElementById("go-menu").addEventListener("click", () => {
            window.location.reload();
        });
    }

    _statCard(label, value, color) {
        return `
            <div style="
                border:1px solid rgba(${this._hexToRgb(color)},0.25);
                padding:12px;background:rgba(${this._hexToRgb(color)},0.04);
                display:flex;flex-direction:column;align-items:center;gap:6px;">
                <span style="font-size:9px;letter-spacing:2px;
                    color:rgba(${this._hexToRgb(color)},0.6);text-transform:uppercase;">${label}</span>
                <span style="font-size:28px;font-weight:bold;letter-spacing:3px;
                    color:${color};text-shadow:0 0 10px ${color};">${value}</span>
            </div>`;
    }

    _killBadge(label, count, color) {
        return `
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
                <span style="font-size:20px;font-weight:bold;color:${color};
                    text-shadow:0 0 8px ${color};">${String(count).padStart(3,"0")}</span>
                <span style="font-size:9px;letter-spacing:2px;
                    color:rgba(200,200,200,0.5);">${label}</span>
            </div>`;
    }

    _hexToRgb(hex) {
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `${r},${g},${b}`;
    }

    hide() {
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    }
}
