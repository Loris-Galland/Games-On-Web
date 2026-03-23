// Dictionnaire des icones par categorie
const ICONS_BY_CATEGORY = {
    "HEALTH": "/assets/icons/health_icon.png",    
    "WEAPON": "/assets/icons/weapon_icon.png",
    "MOBILITY": "/assets/icons/dash_icon.png"
};

export class UpgradeManager {
    constructor(player) {
        this.player = player;
        
        this.availableUpgrades = [
            // Sante max
            {
                id: "health_up",
                category: "HEALTH",
                name: "BLINDAGE RENFORCÉ",
                description: "Ajoute +2 barres à votre intégrité système maximale.",
                apply: (p) => {
                    p.hud.addHealthSegments(2, p.health.maxHealth + 2);
                    p.health.increaseMax(2); 
                }
            },

            // Soin complet
            {
                id: "full_heal",
                category: "HEALTH",
                name: "RÉPARATION D'URGENCE",
                description: "Restaure 100% de l'intégrité système (Soin complet).",
                apply: (p) => {
                    // La fonction heal bloque au max automatiquement
                    p.health.heal(100); 
                }
            },

            // Armes munitions max
            {
                id: "ammo_up",
                category: "WEAPON",
                name: "CHARGEUR ÉTENDU",
                description: "Augmente la capacité maximale du chargeur de +2.",
                apply: (p) => {
                    if(p.shootController && p.shootController.daggerAmmo) {
                        // Ajout visuel puis logique
                        p.hud.addAmmoSegments(2);
                        p.shootController.daggerAmmo.increaseMax(2);
                    }
                }
            },

            // Armes vitesse de rechargement
            {
                id: "reload_up",
                category: "WEAPON",
                name: "RECHARGEMENT ÉCLAIR",
                description: "Réduit le temps de recharge des munitions de 30%.",
                apply: (p) => {
                    if(p.shootController && p.shootController.daggerAmmo) {
                        p.shootController.daggerAmmo.rechargeRateMs *= 0.7; 
                    }
                }
            },
            
            // Armes tir divise
            {
                id: "weapon_multishot",
                category: "WEAPON",
                name: "TIR DIVISÉ",
                description: "Ajoute un projectile supplémentaire à chaque tir.",
                apply: (p) => {
                    if(p.shootController) p.shootController.multishotEnabled = true; 
                }
            },

            // Mobilite
            {
                id: "dash_up",
                category: "MOBILITY",
                name: "PROPULSEURS LOURDS",
                description: "Augmente la vitesse de déplacement de 20%.",
                apply: (p) => {
                    p.speed *= 1.20;
                    p.camera.speed = p.speed; 
                }
            }
        ];

        // Assigne automatiquement l'icone selon la categorie
        this.availableUpgrades.forEach(upgrade => {
            upgrade.iconPath = ICONS_BY_CATEGORY[upgrade.category];
        });
    }

    getRandomUpgrades(count = 3) {
        const shuffled = [...this.availableUpgrades].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}