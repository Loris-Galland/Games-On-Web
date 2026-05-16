// Dictionnaire des icones par categorie
const ICONS_BY_CATEGORY = {
    "HEALTH":   "/assets/icons/health_icon.png",
    "WEAPON":   "/assets/icons/weapon_icon.png",
    "MOBILITY": "/assets/icons/dash_icon.png",
    "SPECIAL":  "/assets/icons/weapon_icon.png",
};

// common peut tomber plusieurs fois, pondération haute
// rare plus impactant, pondération moyenne
// legendary 1 seul exemplaire par run, retiré après obtention
export const RARITY = {
    COMMON:    { id: "common",    label: "COMMUN",     color: "#aaaaaa", glow: "rgba(170,170,170,0.3)" },
    RARE:      { id: "rare",      label: "RARE",       color: "#00ccff", glow: "rgba(0,200,255,0.4)"   },
    LEGENDARY: { id: "legendary", label: "LÉGENDAIRE", color: "#ffaa00", glow: "rgba(255,170,0,0.5)"   },
};

// Coût en points pour reroll (élevé intentionnellement)
export const REROLL_COST = 800;

export class UpgradeManager {
    constructor(player) {
        this.player = player;

        // Upgrades obtenus pendant ce run (pour l'affichage Tab)
        this.acquiredUpgrades = [];

        // Légendaires déjà pris (pour ne pas les redonner)
        this._usedLegendaries = new Set();
        this._acquiredIds     = new Set();

        this.availableUpgrades = [

            // ── SANTÉ ─────────────────────────────────────────────────────────

            {
                id: "health_up",
                category: "HEALTH",
                rarity: RARITY.COMMON,
                name: "BLINDAGE RENFORCÉ",
                description: "Ajoute +2 barres à votre intégrité système maximale.",
                apply: (p) => {
                    p.hud.addHealthSegments(2, p.health.maxHealth + 2);
                    p.health.increaseMax(2);
                },
            },
            {
                id: "full_heal",
                category: "HEALTH",
                rarity: RARITY.COMMON,
                name: "RÉPARATION D'URGENCE",
                description: "Restaure 100% de l'intégrité système (soin complet).",
                apply: (p) => {
                    p.health.heal(100);
                },
            },
            {
                id: "regen",
                category: "HEALTH",
                rarity: RARITY.RARE,
                name: "NANOBOTS MÉDICAUX",
                description: "Régénère 1 PV toutes les 8s si aucun dégât subi depuis 5s.",
                apply: (p) => {
                    if (p._regenInterval) return;
                    let lastDmgTime = 0;
                    const origTakeDmg = p.health.takeDamage?.bind(p.health);
                    if (origTakeDmg) {
                        p.health.takeDamage = (amt) => {
                            lastDmgTime = Date.now();
                            origTakeDmg(amt);
                        };
                    }
                    p._regenInterval = setInterval(() => {
                        if (p.isDead) return;
                        if (Date.now() - lastDmgTime >= 5000) p.health.heal(1);
                    }, 8000);
                },
            },
            {
                id: "lifesteal",
                category: "HEALTH",
                rarity: RARITY.RARE,
                name: "VOL DE VIE",
                description: "Chaque kill restaure 0.5 PV (soigne tous les 2 kills).",
                apply: (p) => {
                    p._lifeStealKills = p._lifeStealKills ?? 0;
                    const prev = p.onEnemyKilled;
                    p.onEnemyKilled = () => {
                        prev?.();
                        p._lifeStealKills++;
                        if (p._lifeStealKills % 2 === 0) p.health.heal(1);
                    };
                },
            },
            {
                id: "last_stand",
                category: "HEALTH",
                rarity: RARITY.LEGENDARY,
                name: "DERNIER SOUFFLE",
                description: "Une seule fois par run, survit à un coup fatal avec 1 PV.",
                apply: (p) => {
                    p._lastStandReady = true;
                    const origTakeDmg = p.health.takeDamage?.bind(p.health);
                    if (!origTakeDmg) return;
                    p.health.takeDamage = (amt) => {
                        if (p._lastStandReady && p.health.currentHealth - amt <= 0) {
                            p._lastStandReady = false;
                            p.health.currentHealth = 1;
                            const flash = document.createElement("div");
                            flash.style.cssText = "position:fixed;inset:0;background:rgba(255,0,0,0.5);pointer-events:none;z-index:9999;transition:opacity 1s";
                            document.body.appendChild(flash);
                            setTimeout(() => { flash.style.opacity = "0"; }, 100);
                            setTimeout(() => flash.remove(), 1200);
                            p.hud?.showWaveMessage?.("DERNIER SOUFFLE — SURVIE CRITIQUE");
                            return;
                        }
                        origTakeDmg(amt);
                    };
                },
            },

            // ── ARMES ─────────────────────────────────────────────────────────

            {
                id: "ammo_up",
                category: "WEAPON",
                rarity: RARITY.COMMON,
                name: "CHARGEUR ÉTENDU",
                description: "Augmente la capacité maximale du chargeur de +2.",
                apply: (p) => {
                    if (p.shootController && p.shootController.daggerAmmo) {
                        p.hud.addAmmoSegments(2);
                        p.shootController.daggerAmmo.increaseMax(2);
                    }
                },
            },
            {
                id: "reload_up",
                category: "WEAPON",
                rarity: RARITY.COMMON,
                name: "RECHARGEMENT ÉCLAIR",
                description: "Réduit le temps de recharge des munitions de 30%.",
                apply: (p) => {
                    if (p.shootController && p.shootController.daggerAmmo) {
                        p.shootController.daggerAmmo.rechargeRateMs *= 0.7;
                    }
                },
            },
            {
                id: "weapon_multishot",
                category: "WEAPON",
                rarity: RARITY.RARE,
                name: "TIR DIVISÉ",
                description: "Ajoute un projectile supplémentaire à chaque tir.",
                apply: (p) => {
                    if (p.shootController) p.shootController.multishotEnabled = true;
                },
            },
            {
                id: "damage_up",
                category: "WEAPON",
                rarity: RARITY.COMMON,
                name: "SURCHARGE DE PUISSANCE",
                description: "Augmente les dégâts de chaque projectile de +50%.",
                apply: (p) => {
                    if (p.shootController) {
                        p.shootController.damageMultiplier = (p.shootController.damageMultiplier ?? 1) * 1.5;
                    }
                },
            },
            {
                id: "firerate_up",
                category: "WEAPON",
                rarity: RARITY.COMMON,
                name: "CADENCE AUGMENTÉE",
                description: "Augmente la vitesse de tir de 25%.",
                apply: (p) => {
                    if (p.shootController) {
                        p.shootController.fireRateMs = (p.shootController.fireRateMs ?? 300) * 0.75;
                    }
                },
            },
            {
                id: "last_bullet",
                category: "WEAPON",
                rarity: RARITY.RARE,
                name: "COUP FINAL",
                description: "La dernière balle du chargeur inflige 3× les dégâts.",
                apply: (p) => {
                    if (p.shootController) p.shootController.lastBulletBonus = true;
                },
            },
            {
                id: "piercing",
                category: "WEAPON",
                rarity: RARITY.RARE,
                name: "PERFORATION",
                description: "Les projectiles traversent le premier ennemi touché.",
                apply: (p) => {
                    if (p.shootController) p.shootController.piercing = true;
                },
            },
            {
                id: "execution",
                category: "WEAPON",
                rarity: RARITY.RARE,
                name: "EXÉCUTION",
                description: "Tuer un ennemi à moins de 15% PV recharge 1 balle instantanément.",
                apply: (p) => {
                    if (p.shootController) p.shootController.executionRefund = true;
                },
            },
            {
                id: "explosive_rounds",
                category: "WEAPON",
                rarity: RARITY.LEGENDARY,
                name: "MUNITIONS EXPLOSIVES",
                description: "Chaque balle explose à l'impact dans un rayon de 1.5m.",
                apply: (p) => {
                    if (p.shootController) p.shootController.explosiveRounds = true;
                },
            },

            // ── MOBILITÉ ──────────────────────────────────────────────────────

            {
                id: "dash_up",
                category: "MOBILITY",
                rarity: RARITY.COMMON,
                name: "PROPULSEURS LOURDS",
                description: "Augmente la vitesse de déplacement de 20%.",
                apply: (p) => {
                    p.speed *= 1.20;
                    p.camera.speed = p.speed;
                },
            },
            {
                id: "dash",
                category: "MOBILITY",
                rarity: RARITY.RARE,
                name: "DASH PROPULSÉ",
                description: "Débloque le Dash (touche Shift). Impulsion rapide, cooldown 1.5s.",
                apply: (p) => {
                    if (p._dashEnabled) return;
                    p._dashEnabled  = true;
                    p._dashCooldown = 0;
                    p._DASH_CD      = 1500;
                    p._DASH_FORCE   = 18;
                    p._DASH_DUR     = 120;
                    p.hud?.showWaveMessage?.("DASH DÉBLOQUÉ — TOUCHE SHIFT");
                },
            },
            {
                id: "blink",
                category: "MOBILITY",
                rarity: RARITY.LEGENDARY,
                name: "TÉLÉPORTATION CIBLÉE",
                description: "Clic droit sur un ennemi → TP instantané à 1.5m devant lui. CD 3s.",
                apply: (p) => {
                    if (p._blinkEnabled) return;
                    p._blinkEnabled  = true;
                    p._blinkCooldown = 0;
                    p._BLINK_CD      = 3000;
                    p.hud?.showWaveMessage?.("BLINK DÉBLOQUÉ — CLIC DROIT SUR UN ENNEMI");
                },
            },
            {
                id: "stomp",
                category: "MOBILITY",
                rarity: RARITY.RARE,
                name: "ATTERRISSAGE LOURD",
                description: "Atterrir après un saut crée un shockwave qui repousse les ennemis proches.",
                apply: (p) => {
                    p._stompEnabled = true;
                },
            },

            // ── SPÉCIAL ───────────────────────────────────────────────────────

            {
                id: "emp_grenade",
                category: "SPECIAL",
                rarity: RARITY.RARE,
                name: "GRENADE EMP",
                description: "Touche G : ralentit les ennemis dans 4m pendant 3s. CD 10s.",
                apply: (p) => {
                    if (p._empEnabled) return;
                    p._empEnabled  = true;
                    p._empCooldown = 0;
                    p._EMP_CD      = 10000;
                    p.hud?.showWaveMessage?.("GRENADE EMP DÉBLOQUÉE — TOUCHE G");
                },
            },
            {
                id: "shield",
                category: "SPECIAL",
                rarity: RARITY.RARE,
                name: "BOUCLIER TEMPORAIRE",
                description: "Touche F : absorbe tous les dégâts pendant 2s. CD 8s.",
                apply: (p) => {
                    if (p._shieldEnabled) return;
                    p._shieldEnabled  = true;
                    p._shieldCooldown = 0;
                    p._SHIELD_CD      = 8000;
                    p._shieldActive   = false;
                    p.hud?.showWaveMessage?.("BOUCLIER DÉBLOQUÉ — TOUCHE F");
                },
            },
            {
                id: "berserk",
                category: "SPECIAL",
                rarity: RARITY.LEGENDARY,
                name: "MODE BERSERK",
                description: "Touche Q : 10s de dégâts ×2 + vitesse +30% + invincibilité. CD 45s.",
                apply: (p) => {
                    if (p._berserkEnabled) return;
                    p._berserkEnabled  = true;
                    p._berserkCooldown = 0;
                    p._BERSERK_CD      = 45000;
                    p._berserkActive   = false;
                    p.hud?.showWaveMessage?.("MODE BERSERK DÉBLOQUÉ — TOUCHE Q");
                },
            },
        ];

        // Assigne automatiquement l'icône selon la catégorie
        this.availableUpgrades.forEach(upgrade => {
            upgrade.iconPath = ICONS_BY_CATEGORY[upgrade.category] ?? "/vite.svg";
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TIRAGE
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Retourne `count` upgrades aléatoires.
     * - Les légendaires déjà pris sont exclus.
     * - Pondération : common ×6, rare ×3, legendary ×1
     */
    getRandomUpgrades(count = 3) {
         const pool = this.availableUpgrades.filter(u => {
            // Exclure TOUS les upgrades déjà acquis (toutes raretés)
            if (this._acquiredIds.has(u.id)) return false;
            return true;
        });

        // Construction de la pool pondérée
        const weighted = [];
        pool.forEach(u => {
            const w = u.rarity === RARITY.LEGENDARY ? 1 : u.rarity === RARITY.RARE ? 3 : 6;
            for (let i = 0; i < w; i++) weighted.push(u);
        });

        // Fisher-Yates shuffle
        for (let i = weighted.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [weighted[i], weighted[j]] = [weighted[j], weighted[i]];
        }

        // Dédoublonnage
        const picked = [];
        const seen   = new Set();
        for (const u of weighted) {
            if (!seen.has(u.id)) {
                picked.push(u);
                seen.add(u.id);
            }
            if (picked.length >= count) break;
        }
        return picked;
    }

    /**
     * Applique un upgrade et le mémorise pour l'écran Tab.
     * Remplace l'appel direct à upgrade.apply(player) dans GameScene.
     */
    applyUpgrade(upgrade) {
        upgrade.apply(this.player);
        this.acquiredUpgrades.push(upgrade);
        this._acquiredIds.add(upgrade.id); 
        if (upgrade.rarity === RARITY.LEGENDARY) {
            this._usedLegendaries.add(upgrade.id);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATS (utilisé par le panneau Tab)
    // ═══════════════════════════════════════════════════════════════════════════

    getPlayerStats() {
        const p = this.player;
        return {
            health:   `${p.health?.currentHealth ?? "?"} / ${p.health?.maxHealth ?? "?"} PV`,
            speed:    `${((p.speed ?? 0.5) * 100).toFixed(0)}%`,
            damage:   `×${(p.shootController?.damageMultiplier ?? 1).toFixed(1)}`,
            firerate: `${(p.shootController?.fireRateMs ?? 300).toFixed(0)} ms`,
            ammo:     `${p.shootController?.daggerAmmo?.max ?? "?"} balles`,
            dash:     p._dashEnabled    ? "OUI" : "NON",
            blink:    p._blinkEnabled   ? "OUI" : "NON",
            shield:   p._shieldEnabled  ? "OUI" : "NON",
            berserk:  p._berserkEnabled ? "OUI" : "NON",
            emp:      p._empEnabled     ? "OUI" : "NON",
        };
    }
}