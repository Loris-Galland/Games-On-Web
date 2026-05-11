/**
 * DebugPanel — src/UI/DebugPanel.js
 * Touche F2 pour ouvrir/fermer.
 * Upgrades affichés triés par rareté : COMMUN → RARE → LÉGENDAIRE
 */
export class DebugPanel {
    constructor(player, upgradeManager, waveManager, scoreManager) {
        this.player         = player;
        this.upgradeManager = upgradeManager;
        this.waveManager    = waveManager;
        this.scoreManager   = scoreManager;

        this._visible = false;
        this._panel   = null;

        this._build();
        this._listen();
    }

    _build() {
        const panel = document.createElement("div");
        panel.id = "debug-panel";
        panel.style.cssText = `
            position:fixed;top:50%;left:20px;transform:translateY(-50%);
            width:290px;max-height:82vh;overflow-y:auto;
            background:rgba(0,5,10,0.96);border:1px solid #00ff88;
            border-radius:4px;font-family:'Courier New',monospace;
            font-size:11px;color:#00ff88;z-index:9000;display:none;padding:0;`;

        panel.innerHTML = `
            <div style="padding:10px 14px;border-bottom:1px solid #00ff8833;
                display:flex;justify-content:space-between;align-items:center;
                position:sticky;top:0;background:rgba(0,5,10,0.98);z-index:1;">
                <span style="font-size:12px;letter-spacing:3px;font-weight:bold;">⚙ DEBUG [F2]</span>
                <span style="font-size:10px;color:#00ff8855;">clic = appliquer</span>
            </div>
            <div style="padding:10px 14px;border-bottom:1px solid #00ff8820;">
                <div style="font-size:9px;letter-spacing:2px;color:#00ff8855;margin-bottom:8px;">ACTIONS</div>
                <div id="dbg-actions" style="display:flex;flex-direction:column;gap:5px;"></div>
            </div>
            <div style="padding:10px 14px;">
                <div style="font-size:9px;letter-spacing:2px;color:#00ff8555;margin-bottom:8px;">UPGRADES</div>
                <div id="dbg-upgrades" style="display:flex;flex-direction:column;gap:3px;"></div>
            </div>`;

        document.body.appendChild(panel);
        this._panel = panel;

        this._buildActions();
        this._buildUpgrades();
    }

    _buildActions() {
        const c = this._panel.querySelector("#dbg-actions");
        [
            { label: "💀 Tuer tous les ennemis", color: "#ff4444", fn: () => this._killAll() },
            { label: "❤️  Soin complet",          color: "#ff88aa", fn: () => this.player.health.heal(100) },
            { label: "⚡ +2000 points",           color: "#ffcc00", fn: () => {
                if (this.scoreManager) {
                    this.scoreManager.totalScore += 2000;
                    this.player.hud?.updateScore?.(this.scoreManager.totalScore);
                }
            }},
            { label: "🔫 Recharger munitions",    color: "#aa88ff", fn: () => {
                const sc = this.player.shootController;
                if (sc?.daggerAmmo) {
                    sc.daggerAmmo.current = sc.daggerAmmo.max;
                    this.player.hud.updateAmmo(sc.daggerAmmo.current, sc.daggerAmmo.max);
                }
            }},
            { label: "🎁 Tous les upgrades",      color: "#00ffcc", fn: () => this._giveAll() },
        ].forEach(({ label, color, fn }) => c.appendChild(this._btn(label, color, fn)));
    }

    _buildUpgrades() {
        const c = this._panel.querySelector("#dbg-upgrades");
        if (!this.upgradeManager) return;

        const rarityOrder = { common: 0, rare: 1, legendary: 2 };
        const rarityColors = { common: "#aaaaaa", rare: "#00ccff", legendary: "#ffaa00" };
        const rarityLabels = { common: "●", rare: "◆", legendary: "★" };

        // Trier par rareté
        const sorted = [...this.upgradeManager.availableUpgrades].sort((a, b) => {
            const ra = rarityOrder[a.rarity?.id ?? "common"] ?? 0;
            const rb = rarityOrder[b.rarity?.id ?? "common"] ?? 0;
            return ra - rb;
        });

        // Insérer des séparateurs de groupe
        let lastRarity = null;
        sorted.forEach(u => {
            const rid = u.rarity?.id ?? "common";
            if (rid !== lastRarity) {
                lastRarity = rid;
                const sep = document.createElement("div");
                sep.style.cssText = `
                    font-size:9px;letter-spacing:2px;
                    color:${rarityColors[rid]};
                    opacity:0.7;margin-top:8px;margin-bottom:2px;
                    text-transform:uppercase;padding-left:2px;`;
                sep.textContent = `── ${u.rarity?.label ?? rid} ──`;
                c.appendChild(sep);
            }

            const color = rarityColors[rid] ?? "#aaaaaa";
            const icon  = rarityLabels[rid]  ?? "●";
            const btn   = this._btn(`${icon} ${u.name}`, color, () => {
                this.upgradeManager.applyUpgrade(u);
                this.player.hud?.showWaveMessage?.(`DEBUG: ${u.name}`);
            });
            btn.title = u.description;
            c.appendChild(btn);
        });
    }

    _btn(label, color, fn) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.style.cssText = `
            background:transparent;color:${color};
            border:1px solid ${color}44;
            font-family:'Courier New',monospace;font-size:10px;
            padding:5px 8px;cursor:pointer;text-align:left;
            width:100%;transition:background 0.1s;`;
        btn.addEventListener("mouseenter", () => { btn.style.background = color + "22"; });
        btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
        btn.addEventListener("click", fn);
        return btn;
    }

    _killAll() {
        if (!this.waveManager) return;
        [...(this.waveManager.enemiesAlive ?? [])].forEach(e => {
            try { if (e.body && !e.body.isDisposed()) e.body.dispose(); } catch (_) {}
        });
        if (this.waveManager._boss) {
            try { this.waveManager._boss.dispose?.(); } catch (_) {}
            this.waveManager._boss = null;
        }
        this.player.hud?.showWaveMessage?.("DEBUG: ennemis éliminés");
    }

    _giveAll() {
        if (!this.upgradeManager) return;
        this.upgradeManager.availableUpgrades.forEach(u => this.upgradeManager.applyUpgrade(u));
        this.player.hud?.showWaveMessage?.("DEBUG: tous les upgrades appliqués");
    }

    _listen() {
        window.addEventListener("keydown", (e) => {
            if (e.code === "F2") {
                e.preventDefault();
                this._visible = !this._visible;
                this._panel.style.display = this._visible ? "block" : "none";
                if (this._visible) document.exitPointerLock?.();
                else this.player.scene.getEngine().enterPointerlock?.();
            }
        });
    }
}