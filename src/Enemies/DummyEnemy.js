import * as BABYLON from "@babylonjs/core";

export class DummyEnemy {
  constructor(scene, position, player) {
    this.scene = scene;
    this.player = player;
    this.speed = 3;

    // Creation du corps principal
    this.body = BABYLON.MeshBuilder.CreateBox(
      "enemyBody",
      { width: 1.5, height: 2.5, depth: 1.5 },
      scene,
    );
    this.body.position = position;
    this.body.checkCollisions = true;
    this.body.ellipsoid = new BABYLON.Vector3(0.75, 1.25, 0.75);

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

    this.weakPoint.position.y = 0.8;
    this.weakPoint.position.z = 0.75;

    const weakMat = new BABYLON.StandardMaterial("weakMat", scene);
    weakMat.emissiveColor = new BABYLON.Color3(1, 0, 0);
    weakMat.disableLighting = true;
    this.weakPoint.material = weakMat;

    // Ajout a la boucle de rendu pour l'IA
    this.observer = this.scene.onBeforeRenderObservable.add(() =>
      this.update(),
    );

    this.body.onDisposeObservable.add(() => {
      this.scene.onBeforeRenderObservable.remove(this.observer);
    });
  }

  update() {
    if (!this.player || !this.player.camera) return;

    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    // On recupere la position du joueur (mais on garde la hauteur de l'ennemi)
    const targetPos = this.player.camera.globalPosition.clone();
    targetPos.y = this.body.position.y;

    this.body.lookAt(targetPos);

    const distance = BABYLON.Vector3.Distance(this.body.position, targetPos);

    // Si l'ennemi est loin, il avance
    if (distance > 2) {
      const direction = targetPos.subtract(this.body.position).normalize();
      const velocity = direction.scale(this.speed * deltaTime);

      this.body.moveWithCollisions(velocity);
    } else {
    }
  }
}
