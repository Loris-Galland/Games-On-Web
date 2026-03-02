import * as BABYLON from "@babylonjs/core";
import { Player } from "../Player/Player";
import { DummyEnemy } from "../Enemies/DummyEnemy";
import { WaveManager } from "../Systems/WaveManager";
import "@babylonjs/loaders/glTF";
import "@babylonjs/inspector";

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
    light.intensity = 1;

      BABYLON.SceneLoader.Append(
          "assets/",
          "GameV3.gltf",
          scene,
          function (loadedScene) {
              console.log("GLTF model loaded successfully!");

              // On parcourt tous les meshes nouvellement importés
              loadedScene.meshes.forEach((mesh) => {
                  if (mesh.name !== "__root__") { // le nœud racine gltf n'a pas besoin de collision
                      mesh.checkCollisions = true;
                      //mesh.showBoundingBox = true;
                      console.log("Collision activée sur :", mesh.name);
                  }
              });
          },
          function () {
              console.log("GLTF model is loading ...");
          },
          function (scene, message) {
              console.error("GLTF model not loaded!", message);
          }
      );

    // Instanciation du joueur
    this.player = new Player(scene, canvas);

    // Initialisation du gestionnaire de vagues
     const waveManager = new WaveManager(scene, this.player, this.player.hud);

    setTimeout(() => {
        waveManager.startNextWave();
    }, 2000);

      /*scene.debugLayer.show({
          embedMode: true, // s'affiche dans la page
      });*/
    return scene;
  }
}
