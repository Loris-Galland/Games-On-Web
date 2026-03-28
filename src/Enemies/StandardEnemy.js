import * as BABYLON from "@babylonjs/core";
import { BaseEnemy } from "./BaseEnemy";

/**
 * StandardEnemy
 * -------------
 * Ennemi de base — taille et vitesse moyennes.
 *
 *   Body   : 1.2 × 2.2 × 1.2   (gris foncé)
 *   Weak   : Ø 0.5              (rouge vif)
 *   Speed  : 0.65 u/s (défaut)
 */
export class StandardEnemy extends BaseEnemy {
    constructor(scene, position, player, speed = 0.65, navManager = null) {
        super(scene, position, player, speed, navManager);
    }

    _getConfig() {
        return {
            bodyName:      "enemyBody",
            bodySize:      { width: 1.2, height: 2.2, depth: 1.2 },
            bodyColor:     new BABYLON.Color3(0.2, 0.2, 0.25),
            ellipsoid:     new BABYLON.Vector3(0.55, 1.1, 0.55),
            halfHeight:    1.1,
            weakPointDiam: 0.5,
            weakPointY:    0.8,
            weakPointZ:    0.6,
            weakPointColor: new BABYLON.Color3(1, 0, 0),
        };
    }
}