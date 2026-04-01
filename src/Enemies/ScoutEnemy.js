import * as BABYLON from "@babylonjs/core";
import { BaseEnemy } from "./BaseEnemy";

export class ScoutEnemy extends BaseEnemy {
    constructor(scene, position, player, speed = 3, navManager = null) {
        super(scene, position, player, speed, navManager);
    }

    _getConfig() {
        return {
            enemyType:      "scout",
            bodyName:       "enemyBodyScout",
            bodySize:       { width: 0.7, height: 1.4, depth: 0.7 },
            bodyColor:      new BABYLON.Color3(0.35, 0.05, 0.55),
            ellipsoid:      new BABYLON.Vector3(0.32, 0.7, 0.32),
            halfHeight:     0.7,
            weakPointDiam:  0.75,
            weakPointY:     0.55,
            weakPointZ:     0.4,
            weakPointColor: new BABYLON.Color3(0, 0.95, 1),
            // Scout rapide, orbite serrée — harcèle de près
            encircleRadius: 1.5,
            angularDrift:   0.70,
        };
    }
}