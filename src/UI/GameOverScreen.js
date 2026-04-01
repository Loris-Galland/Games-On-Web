/**
 * GameOverScreen
 * --------------
 * Affiche l'écran de game over avec animation glitch et stats,
 * puis propose de redémarrer ou de retourner au menu.
 *
 * Usage :
 *   const go = new GameOverScreen();
 *   go.show({ wavesCleared: 3, roomsCleared: 2 });
 */
export class GameOverScreen {

    constructor() {
        this._overlay = null;
    }

    /**
     * @param {object} stats
     *   stats.wavesCleared  {number}  vagues totales terminées
     *   stats.roomsCleared  {number}  salles nettoyées
     */
    show(stats = {}) {
        if (this._overlay) return; // déjà affiché

        document.exitPointerLock?.();

        this._overlay = document.createElement("div");
        this._overlay.id = "game-over-overlay";

        const wavesCleared = stats.wavesCleared ?? 0;
        const roomsCleared = stats.roomsCleared ?? 0;

        this._overlay.innerHTML = `
            <div class="go-scanline"></div>

            <div class="go-content">
                <div class="go-glitch" data-text="SYSTEM FAILURE">SYSTEM FAILURE</div>
                <div class="go-subtitle">INTEGRITY COMPROMISED — UNIT TERMINATED</div>

                <div class="go-stats">
                    <div class="go-stat">
                        <span class="go-stat-label">SECTORS CLEARED</span>
                        <span class="go-stat-value">${String(roomsCleared).padStart(3, "0")}</span>
                    </div>
                    <div class="go-stat">
                        <span class="go-stat-label">WAVES SURVIVED</span>
                        <span class="go-stat-value">${String(wavesCleared).padStart(3, "0")}</span>
                    </div>
                </div>

                <div class="go-buttons">
                    <button class="go-btn go-btn-secondary" id="go-menu">
                        ← RETURN TO TERMINAL
                    </button>
                </div>

                <div class="go-footer">ROGUE PROTOCOL v2.7 — SECTOR DATA LOST</div>
            </div>
        `;

        document.body.appendChild(this._overlay);

        // Animation d'apparition (léger délai pour le CSS transition)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._overlay.classList.add("go-visible");
            });
        });

        // Bouton menu (reload aussi — à adapter si tu as un vrai système de menu)
        document.getElementById("go-menu").addEventListener("click", () => {
            window.location.reload();
        });
    }

    hide() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }
}