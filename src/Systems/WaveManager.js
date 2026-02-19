import * as BABYLON from "@babylonjs/core";
import { DummyEnemy } from "../Enemies/DummyEnemy";

export class WaveManager {
  constructor(scene, player, hud) {
    this.scene = scene;
    this.player = player;
    this.hud = hud;

    this.currentWave = 0;
    this.enemiesAlive = [];
    this.isWaveActive = false;

    this.scene.onBeforeRenderObservable.add(() => this.update());
  }

  // Génération d'une nouvelle vague
  startNextWave() {
    this.currentWave++;
    this.isWaveActive = true;

    this.hud.updateWave(this.currentWave);
    console.log(`--- DÉBUT DE LA VAGUE ${this.currentWave} ---`);

    const enemiesToSpawn = 1 + this.currentWave * 2;

    // Apparition aléatoire autour du joueur
    for (let i = 0; i < enemiesToSpawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 15;
      const x = this.player.camera.position.x + Math.cos(angle) * radius;
      const z = this.player.camera.position.z + Math.sin(angle) * radius;

      const spawnPos = new BABYLON.Vector3(x, 1.25, z);

      const enemy = new DummyEnemy(this.scene, spawnPos, this.player);
      this.enemiesAlive.push(enemy);
    }
  }

  // Suivi des ennemis en vie
  update() {
    if (!this.isWaveActive) return;

    this.enemiesAlive = this.enemiesAlive.filter(
      (enemy) => !enemy.body.isDisposed(),
    );

    // Passage à la vague suivante
    if (this.enemiesAlive.length === 0) {
      this.isWaveActive = false;
      this.hud.showWaveMessage("VAGUE TERMINÉE");

      setTimeout(() => {
        this.startNextWave();
      }, 3000);
    }
  }
}
