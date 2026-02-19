import * as BABYLON from "@babylonjs/core";

export class Projectile {
  constructor(scene, startPosition, direction, isEnemy = false) {
    this.scene = scene;
    this.speed = 40;
    this.isEnemy = isEnemy;

    // Creation de la forme du projectile
    this.mesh = BABYLON.MeshBuilder.CreateCylinder(
      "projectile",
      { height: 0.6, diameter: 0.05 },
      scene,
    );

    // Positionnement devant le tireur
    this.mesh.position = startPosition.clone().add(direction.scale(1.5));

    // Orientation vers la direction du tir
    this.direction = direction.normalize();
    this.mesh.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionRH(
      this.direction,
      BABYLON.Vector3.Up(),
    );
    this.mesh.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);

    // Application de la couleur lumineuse
    const mat = new BABYLON.StandardMaterial("projMat", scene);
    mat.emissiveColor = isEnemy
      ? new BABYLON.Color3(1, 0, 0)
      : new BABYLON.Color3(0, 1, 1);
    mat.disableLighting = true;
    this.mesh.material = mat;

    // Duree de vie avant destruction
    this.lifeTime = 2000;
    this.spawnTime = Date.now();

    // Ajout a la boucle de rendu
    this.observer = this.scene.onBeforeRenderObservable.add(() =>
      this.update(),
    );
  }

  // Mise a jour a chaque frame
  update() {
    const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

    // Lancement d'un rayon pour detecter les collisions
    const ray = new BABYLON.Ray(
      this.mesh.position,
      this.direction,
      this.speed * deltaTime,
    );
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) => mesh.isPickable && mesh !== this.mesh,
    );

    // Gestion de l'impact
    if (hit.hit) {
      this.onHit(hit);
      return;
    }

    // Avancement du projectile
    this.mesh.position.addInPlace(this.direction.scale(this.speed * deltaTime));

    // Destruction si le temps de vie est depasse
    if (Date.now() - this.spawnTime > this.lifeTime) {
      this.destroy();
    }
  }

  // Logique lors d'un impact
  onHit(hitResult) {
    const meshTouché = hitResult.pickedMesh;

    // Verification de la zone touchee
    if (meshTouché.name === "weakPoint") {
      console.log("Point faible touché ! ONE SHOT !");
      if (meshTouché.parent) meshTouché.parent.dispose();
    } else if (meshTouché.name === "enemyBody") {
      console.log("Armure touchée (pas de dégâts)");
    }

    this.destroy();
  }

  // Nettoyage de la memoire
  destroy() {
    this.scene.onBeforeRenderObservable.remove(this.observer);
    this.mesh.dispose();
  }
}