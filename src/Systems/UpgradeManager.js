// Dictionnaire des icônes par catégorie
const ICONS_BY_CATEGORY = {
    "HEALTH": "/assets/icons/health_icon.png",    
    "WEAPON": "/assets/icons/weapon_icon.png",
    "MOBILITY": "/assets/icons/dash_icon.png"
};

export class UpgradeManager {
    constructor(player) {
        this.player = player;
        
        this.availableUpgrades = [
            // --- SANTÉ ---
            {
                id: "health_up",
                category: "HEALTH",
                name: "BLINDAGE RENFORCÉ",
                description: "Restaure l'intégrité système et ajoute +2 barres max.",
                apply: (p) => {
                    // 1. Crée les carrés visuels D'ABORD
                    p.hud.addHealthSegments(2, p.health.maxHealth + 2);
                    // 2. Met à jour la logique (ça va allumer les carrés en Cyan)
                    p.health.increaseMax(2); 
                }
            },

            // --- ARMES (MUNITIONS MAX) ---
            {
                id: "ammo_up",
                category: "WEAPON",
                name: "CHARGEUR ÉTENDU",
                description: "Augmente la capacité maximale du chargeur de +2.",
                apply: (p) => {
                    // CORRECTION ICI : on cible bien "daggerAmmo"
                    if(p.shootController && p.shootController.daggerAmmo) {
                        // 1. Crée les carrés HTML invisibles
                        p.hud.addAmmoSegments(2);
                        // 2. Met à jour la logique (ça va allumer les carrés en Violet néon)
                        p.shootController.daggerAmmo.increaseMax(2);
                    }
                }
            },

            // --- ARMES (VITESSE DE RECHARGEMENT) ---
            {
                id: "reload_up",
                category: "WEAPON",
                name: "RECHARGEMENT ÉCLAIR",
                description: "Réduit le temps de recharge des munitions de 30%.",
                apply: (p) => {
                    // CORRECTION ICI AUSSI
                    if(p.shootController && p.shootController.daggerAmmo) {
                        p.shootController.daggerAmmo.rechargeRateMs *= 0.7; 
                    }
                }
            },
            
            {
                id: "weapon_multishot",
                category: "WEAPON",
                name: "TIR DIVISÉ",
                description: "Ajoute un projectile supplémentaire à chaque tir.",
                apply: (p) => {
                    if(p.shootController) p.shootController.multishotEnabled = true; 
                }
            },

            // --- MOBILITÉ ---
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

        this.availableUpgrades.forEach(upgrade => {
            upgrade.iconPath = ICONS_BY_CATEGORY[upgrade.category];
        });
    }

    getRandomUpgrades(count = 3) {
        const shuffled = [...this.availableUpgrades].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
}