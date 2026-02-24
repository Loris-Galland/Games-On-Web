import * as BABYLON from "@babylonjs/core";
import { PlayerShoot } from "./PlayerShoot";
import { Health } from "../Systems/Health";
import { PlayerHUD } from "../UI/PlayerHUD";

export class Player {
  constructor(scene, canvas) {
    this.scene = scene;
    this.canvas = canvas;

    // Configuration du joueur
    this.speed = 0.3;
    this.inputMap = {};
    this.maxHealth = 10;

    // Création de la caméra
    this.camera = new BABYLON.UniversalCamera(
      "playerCam",
      new BABYLON.Vector3(0, 0, 0),
      this.scene,
    );
    this.camera.attachControl(this.canvas, true);
    this.camera.checkCollisions = true; // Active la physique
    this.camera.applyGravity = true;
    this.camera.ellipsoid = new BABYLON.Vector3(0.25, 1, 0.25);
    this.camera.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0); // le bas de l'ellipsoïde touche pile le sol
    this.camera.slopLimit = 90; // angle max des pentes franchissables
    this.camera.stepOffset = 0.4; // hauteur max franchissable sans sauter (en unités)
    this.camera.minZ = 0.1;
    this.camera.speed = this.speed;
    this.camera.angularSensibility = 5000;

    // Configuration des touches
    this.camera.keysUp = [90, 87];
    this.camera.keysDown = [83];
    this.camera.keysLeft = [81, 65];
    this.camera.keysRight = [68];

    // Initialisation
    this._initInputs();
    this._initWeapon();

    // Systèmes
    this.hud = new PlayerHUD(this.maxHealth);
    this.health = new Health(
      this.maxHealth,
      (current) => this.hud.updateHealth(current),
      () => console.log("GAME OVER"),
    );
    this.shootController = new PlayerShoot(this);

    // Variables d'animation
    this.currentTilt = 0;
    this.bobTimer = 0;
    this.jumpForce = 0;

    // Boucle principale
    this.scene.registerBeforeRender(() => {
      this._updateCameraTilt();
      this._updateWeaponBobbing();
      this._updateJump();
    });
  }

  // Ecoute le clavier
  _initInputs() {
    this.scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();
      if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
        this.inputMap[key] = true;
        if (kbInfo.event.code === "Space") this._jump();
        if (kbInfo.event.code === "KeyK") this.health.takeDamage(1);
      } else {
        this.inputMap[key] = false;
      }
    });
  }

  // Logique du saut
  _jump() {
    if (this.jumpForce > 0) return;

    // Lance un rayon vers le bas pour vérifier le sol
    const ray = new BABYLON.Ray(
      this.camera.position,
      new BABYLON.Vector3(0, -1, 0),
      1.15,
    );
    const hit = this.scene.pickWithRay(
      ray,
      (mesh) => mesh.checkCollisions && mesh.name !== "weapon",
    );

    if (hit.hit) {
      this.jumpForce = 0.4;
    }
  }

  // Physique du saut
  _updateJump() {
    if (this.jumpForce > 0) {
      this.camera.cameraDirection.y += this.jumpForce;
      this.jumpForce -= 0.02; // Gravité
      if (this.jumpForce <= 0) this.jumpForce = 0;
    }
  }

  // Création de l'arme
  _initWeapon() {
    const weaponMat = new BABYLON.StandardMaterial("weaponMat", this.scene);
    weaponMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.3);

    this.weapon = BABYLON.MeshBuilder.CreateBox(
      "weapon",
      { width: 0.15, height: 0.2, depth: 0.6 },
      this.scene,
    );
    this.weapon.material = weaponMat;
    this.weapon.parent = this.camera;
    this.weaponOriginalPos = new BABYLON.Vector3(0.4, -0.4, 1);
    this.weapon.position = this.weaponOriginalPos.clone();
  }

  // Inclinaison de la caméra
  _updateCameraTilt() {
    let targetTilt = 0;
    if (this.inputMap["q"] || this.inputMap["a"]) targetTilt = 0.05;
    else if (this.inputMap["d"]) targetTilt = -0.05;

    this.currentTilt = BABYLON.Scalar.Lerp(this.currentTilt, targetTilt, 0.1);
    this.camera.rotation.z = this.currentTilt;
  }

  // Mouvement de l'arme en marchant
  _updateWeaponBobbing() {
    const isMoving =
      this.inputMap["z"] ||
      this.inputMap["w"] ||
      this.inputMap["s"] ||
      this.inputMap["q"] ||
      this.inputMap["a"] ||
      this.inputMap["d"];

    if (isMoving) {
      this.bobTimer += 0.2;
      this.weapon.position.y =
        this.weaponOriginalPos.y + Math.sin(this.bobTimer) * 0.04;
      this.weapon.position.x =
        this.weaponOriginalPos.x + Math.cos(this.bobTimer * 0.5) * 0.04;
    } else {
      this.weapon.position = BABYLON.Vector3.Lerp(
        this.weapon.position,
        this.weaponOriginalPos,
        0.1,
      );
      this.bobTimer = 0;
    }
  }
}
