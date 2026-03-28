import * as BABYLON from "@babylonjs/core";
import { BaseEnemy } from "./BaseEnemy";

/**
 * ScoutEnemy
 * ----------
 * Rapide et fragile — grand point faible facile à toucher… si on arrive à viser.
 *
 *   Body   : 0.7 × 1.4 × 0.7   (violet électrique)
 *   Weak   : Ø 0.75             (cyan brillant — grosse cible)
 *   Speed  : 1.4 u/s (défaut)
 */
export class ScoutEnemy extends BaseEnemy {
    constructor(scene, position, player, speed = 1.4, navManager = null) {
        super(scene, position, player, speed, navManager);
    }

    _getConfig() {
        return {
            bodyName:       "enemyBodyScout",
            bodySize:       { width: 0.7, height: 1.4, depth: 0.7 },
            bodyColor:      new BABYLON.Color3(0.35, 0.05, 0.55),
            ellipsoid:      new BABYLON.Vector3(0.32, 0.7, 0.32),
            halfHeight:     0.7,
            weakPointDiam:  0.75,
            weakPointY:     0.55,
            weakPointZ:     0.4,
            weakPointColor: new BABYLON.Color3(0, 0.95, 1),
        };
    }
}