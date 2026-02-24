import * as BABYLON from "@babylonjs/core";

export class DummyEnemy {
  constructor(scene, position, player) {
    this.scene = scene;
    this.player = player;
    this.speed = 3;

    this.gravity = -9.81; // valeur réaliste
    this.verticalVelocity = 0;
    this.isGrounded = false;

    // Creation du corps principal
    this.body = BABYLON.MeshBuilder.CreateBox(
      "enemyBody",
      { width: 1.5, height: 2.5, depth: 1.5 },
      scene,
    );

    this.body.position = new BABYLON.Vector3(position.x, position.y + 1.25, position.z);
    this.body.ellipsoid = new BABYLON.Vector3(0.75, 1.25, 0.75);
    this.body.refreshBoundingInfo();
    this.body.showBoundingBox = true;
    this.body.showSubMeshesBoundingBox = true;
    this.body.checkCollisions = true;

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

        // Gravité accumulée
        this.verticalVelocity += this.gravity * deltaTime;
        this.verticalVelocity = Math.max(this.verticalVelocity, -20); // cap la chute

        // Déplacement horizontal
        let horizontalVelocity = BABYLON.Vector3.Zero();
        const targetPos = this.player.camera.globalPosition.clone();
        targetPos.y = this.body.position.y;

        const distance = BABYLON.Vector3.Distance(this.body.position, targetPos);
        if (distance > 2) {
            const direction = targetPos.subtract(this.body.position).normalize();
            horizontalVelocity = direction.scale(this.speed * deltaTime);
        }

        const finalVelocity = new BABYLON.Vector3(
            horizontalVelocity.x,
            this.verticalVelocity * deltaTime,
            horizontalVelocity.z
        );

        this.body.moveWithCollisions(finalVelocity);

        // Raycast sol — longueur = demi-hauteur ellipsoïde + petit buffer
        const ray = new BABYLON.Ray(
            this.body.position,
            new BABYLON.Vector3(0, -1, 0),
            1.35 // 1.25 + 0.1 buffer
        );
        const hit = this.scene.pickWithRay(
            ray,
            (mesh) => mesh.checkCollisions && mesh !== this.body
        );

        if (hit.hit && this.verticalVelocity < 0) {
            this.verticalVelocity = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        this.body.lookAt(targetPos);
    }
}
