import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { DummyEnemy } from "../Enemies/DummyEnemy";
import { WaveManager } from "../Systems/WaveManager";

export class GameScene {
  constructor(canvasId) {
    // Récupération de l'élément HTML canvas
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(
        "ERREUR FATALE : Impossible de trouver le canvas avec l'ID '" +
          canvasId +
          "'",
      );
      return;
    }

    // Création du moteur 3D Babylon
    try {
      this.engine = new BABYLON.Engine(canvas, true);
    } catch (e) {
      console.error(
        "ERREUR MOTEUR : Le moteur Babylon n'a pas pu démarrer.",
        e,
      );
      return;
    }

    // Ajustement de la résolution pour les performances
    this.engine.setHardwareScalingLevel(1.5);

    if (!this.engine) {
      console.error(
        "ERREUR : this.engine est indéfini avant la création de la scène !",
      );
      return;
    }

    // Création du contenu de la scène
    this.scene = this._createScene(canvas);

    // Boucle de rendu qui dessine la scène à chaque frame
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Adaptation de la taille lors du redimensionnement de la fenêtre
    window.addEventListener("resize", () => {
      this.engine.resize();
    });
  }

  _createScene(canvas) {
    const scene = new BABYLON.Scene(this.engine);

    // Paramètres de physique
    scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
    scene.collisionsEnabled = true;

    // Ajout d'une lumière globale
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene,
    );
    light.intensity = 0.7;

    // Création du sol
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 200, height: 200 },
      scene,
    );
    ground.checkCollisions = true;
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = groundMat;

    // Création d'une caisse de test
    const box = BABYLON.MeshBuilder.CreateBox("crate", { size: 2 }, scene);
    box.position = new BABYLON.Vector3(5, 1, 5);
    box.checkCollisions = true;
    const boxMat = new BABYLON.StandardMaterial("boxMat", scene);
    boxMat.diffuseColor = new BABYLON.Color3(1, 0, 0);
    box.material = boxMat;

    // Instanciation du joueur
    this.player = new Player(scene, canvas);

    // Initialisation du gestionnaire de vagues
    const waveManager = new WaveManager(scene, this.player, this.player.hud);
    
    setTimeout(() => {
        waveManager.startNextWave();
    }, 2000);

    return scene;
  }
}
