import * as BABYLON from "@babylonjs/core";

export class DummyEnemy {
  constructor(scene, position) {
    // Creation du corps principal
    this.body = BABYLON.MeshBuilder.CreateBox(
      "enemyBody",
      { width: 1.5, height: 2.5, depth: 1.5 },
      scene,
    );
    this.body.position = position;
    this.body.checkCollisions = true;

    // Application de la couleur du corps
    const bodyMat = new BABYLON.StandardMaterial("bodyMat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
    this.body.material = bodyMat;

    // Creation du point faible
    this.weakPoint = BABYLON.MeshBuilder.CreateSphere(
      "weakPoint",
      { diameter: 0.5 },
      scene,
    );
    this.weakPoint.parent = this.body;

    // Positionnement du point faible sur l'ennemi
    this.weakPoint.position.y = 0.8;
    this.weakPoint.position.z = -0.75;

    // Application de la couleur du point faible
    const weakMat = new BABYLON.StandardMaterial("weakMat", scene);
    weakMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    weakMat.disableLighting = true;
    this.weakPoint.material = weakMat;
  }
}
