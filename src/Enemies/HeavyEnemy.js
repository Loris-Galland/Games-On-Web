import * as BABYLON from "@babylonjs/core";
import { BaseEnemy } from "./BaseEnemy";

/**
 * HeavyEnemy
 * ----------
 * Tank lent avec une petite zone critique difficile à toucher.
 *
 *   Body   : 2.2 × 3.2 × 2.2   (marron rouille)
 *   Weak   : Ø 0.28             (orange — petite cible)
 *   Speed  : 0.35 u/s (défaut)
 */
export class HeavyEnemy extends BaseEnemy {
    constructor(scene, position, player, speed = 0.35, navManager = null) {
        super(scene, position, player, speed, navManager);
    }

    _getConfig() {
        return {
            bodyName:       "enemyBodyHeavy",
            bodySize:       { width: 2.2, height: 3.2, depth: 2.2 },
            bodyColor:      new BABYLON.Color3(0.45, 0.18, 0.08),
            ellipsoid:      new BABYLON.Vector3(1.0, 1.6, 1.0),
            halfHeight:     1.6,
            weakPointDiam:  0.28,
            weakPointY:     1.2,
            weakPointZ:     1.1,
            weakPointColor: new BABYLON.Color3(1, 0.45, 0),
        };
    }
}