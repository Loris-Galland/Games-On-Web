import * as BABYLON from "@babylonjs/core";
import { DummyEnemy } from "../Enemies/DummyEnemy";

const WAVES_PER_ROOM = 5;

export class WaveManager {
    constructor(scene, player, hud) {
        this.scene  = scene;
        this.player = player;
        this.hud    = hud;

        // Vague en cours dans la salle active (1..WAVES_PER_ROOM)
        this.currentWave    = 0;
        this.enemiesAlive   = [];
        this.isWaveActive   = false;

        // Salle courante et salles déjà terminées
        this._currentRoomIdx  = -1;
        this._clearedRooms    = new Set(); // salles dont toutes les vagues sont terminées
        this._visitedRooms    = new Set(); // salles déjà visitées (au moins une fois)

        // Portes actives (meshes)
        this._doors = [];

        this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── API publique appelée par GameScene à chaque changement de salle ──

    /**
     * roomIdx   : index de la nouvelle salle
     * entryPos  : BABYLON.Vector3 — centre de la porte d'entrée (côté couloir entrant)
     * exitPos   : BABYLON.Vector3 — centre de la porte de sortie (côté couloir sortant)
     * entryRot  : rotation Y de la porte d'entrée (rad)
     * exitRot   : rotation Y de la porte de sortie (rad)
     */
    enterRoom(roomIdx, entryPos, exitPos, entryRot = 0, exitRot = 0, roomCenter = null) {
        // Nettoyage des ennemis précédents
        this._clearEnemies();
        this._removeDoors();

        this._currentRoomIdx = roomIdx;
        this._roomCenter     = roomCenter; // centre de la salle pour le spawn

        // Salle spawn (idx 0) → jamais de vagues
        if (roomIdx === 0) return;

        const isNew = !this._visitedRooms.has(roomIdx);
        this._visitedRooms.add(roomIdx);

        if (!isNew || this._clearedRooms.has(roomIdx)) {
            return;
        }

        this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
        this._startRoomWaves();
    }

    // ── Spawn / suppression des portes ──────────────────────────────────

    _spawnDoors(entryPos, exitPos, entryRot, exitRot) {
        if (!entryPos && !exitPos) return;

        const mat = new BABYLON.StandardMaterial("doorMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.05, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);
        mat.alpha = 0.92;

        const makeBarrier = (name, pos, rotY) => {
            if (!pos) return null;
            const door = BABYLON.MeshBuilder.CreateBox(name, {
                width: 4,
                height: 3.5,
                depth: 0.25,
            }, this.scene);
            door.position = pos.clone();
            door.position.y = 1.75;
            door.rotation.y = rotY;
            door.material   = mat;
            door.checkCollisions = true;
            door.isPickable      = false;

            // Effet lumineux pulsant
            door._pulseT = 0;
            const obs = this.scene.onBeforeRenderObservable.add(() => {
                door._pulseT += 0.05;
                const alpha = 0.7 + Math.sin(door._pulseT) * 0.2;
                mat.emissiveColor = new BABYLON.Color3(alpha, 0.05, 0.05);
            });
            door._obs = obs;

            return door;
        };

        const entry = makeBarrier("door_entry", entryPos, entryRot);
        const exit  = makeBarrier("door_exit",  exitPos,  exitRot);

        if (entry) this._doors.push(entry);
        if (exit)  this._doors.push(exit);
    }

    _openDoors() {
        this._doors.forEach(door => {
            if (door._obs) this.scene.onBeforeRenderObservable.remove(door._obs);
            // Animation d'ouverture : monte le mesh vers le haut
            let elapsed = 0;
            const startY = door.position.y;
            const obs = this.scene.onBeforeRenderObservable.add(() => {
                elapsed += this.scene.getEngine().getDeltaTime();
                const t = Math.min(elapsed / 800, 1); // 800 ms
                door.position.y = startY + t * 5;
                if (t >= 1) {
                    door.checkCollisions = false;
                    this.scene.onBeforeRenderObservable.remove(obs);
                    door.dispose();
                }
            });
        });
        this._doors = [];
    }

    _removeDoors() {
        this._doors.forEach(door => {
            if (door._obs) this.scene.onBeforeRenderObservable.remove(door._obs);
            if (!door.isDisposed()) door.dispose();
        });
        this._doors = [];
    }

    // ── Gestion des vagues ───────────────────────────────────────────────

    _startRoomWaves() {
        this.currentWave  = 0;
        this.isWaveActive = false;
        this._launchNextWave();
    }

    _launchNextWave() {
        if (this.currentWave >= WAVES_PER_ROOM) {
            // Toutes les vagues terminées pour cette salle
            this._clearedRooms.add(this._currentRoomIdx);
            this.hud.showWaveMessage("SECTEUR SÉCURISÉ — PORTES OUVERTES");
            this._openDoors();
            return;
        }

        this.currentWave++;
        this.isWaveActive = true;

        this.hud.updateWave(this.currentWave);
        this.hud.showWaveMessage(`VAGUE ${this.currentWave} / ${WAVES_PER_ROOM}`);

        const enemiesToSpawn = this.currentWave * 2; // 2, 4, 6, 8, 10
        // Vitesse croissante : vague 1 → 0.29, vague 5 → 0.65
        const enemySpeed = 0.2 + this.currentWave * 0.09;

        // Spawn autour du centre de la salle (pas de la position joueur)
        const center = this._roomCenter ?? this.player.camera.position;

        for (let i = 0; i < enemiesToSpawn; i++) {
            const angle  = (i / enemiesToSpawn) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 8 + Math.random() * 14;
            const x = center.x + Math.cos(angle) * radius;
            const z = center.z + Math.sin(angle) * radius;

            const spawnPos = new BABYLON.Vector3(x, 1.25, z);
            const enemy    = new DummyEnemy(this.scene, spawnPos, this.player, enemySpeed);
            this.enemiesAlive.push(enemy);
        }
    }

    _clearEnemies() {
        this.enemiesAlive.forEach(enemy => {
            if (enemy.body && !enemy.body.isDisposed()) enemy.body.dispose();
        });
        this.enemiesAlive = [];
        this.isWaveActive = false;
    }

    // ── Boucle principale ────────────────────────────────────────────────

    _update() {
        if (!this.isWaveActive) return;

        this.enemiesAlive = this.enemiesAlive.filter(
            e => e.body && !e.body.isDisposed(),
        );

        if (this.enemiesAlive.length === 0) {
            this.isWaveActive = false;

            if (this.currentWave < WAVES_PER_ROOM) {
                this.hud.showWaveMessage(`VAGUE ${this.currentWave} TERMINÉE`);
                setTimeout(() => this._launchNextWave(), 3000);
            } else {
                this._launchNextWave(); // déclenche la fin de salle
            }
        }
    }
}