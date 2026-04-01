import * as BABYLON from "@babylonjs/core";
import { StandardEnemy }              from "../Enemies/StandardEnemy";
import { HeavyEnemy }                 from "../Enemies/HeavyEnemy";
import { ScoutEnemy }                 from "../Enemies/ScoutEnemy";
import { EnemyParticles }             from "../Enemies/EnemyParticles";
import { resetSlotCounter }           from "../Enemies/BaseEnemy";

const WAVES_PER_ROOM      = 5;
const SPAWN_WARNING_DELAY = 1800;

const WAVE_COMPOSITIONS = {
    1: [ { type: "standard", count: 10, speedMult: 1.0 } ],
    2: [ { type: "standard", count: 10, speedMult: 1.0 }, { type: "scout",    count: 5, speedMult: 1.0 } ],
    3: [ { type: "standard", count: 10, speedMult: 1.1 }, { type: "heavy",    count: 5, speedMult: 1.0 } ],
    4: [ { type: "standard", count: 15, speedMult: 1.1 }, { type: "scout",    count: 5, speedMult: 1.1 }, { type: "heavy", count: 5, speedMult: 1.0 } ],
    5: [ { type: "heavy",    count: 20, speedMult: 1.1 }, { type: "scout",    count: 10, speedMult: 1.2 }, { type: "standard", count: 5, speedMult: 1.2 } ],
};

export class WaveManager {
    constructor(scene, player, hud) {
        this.scene  = scene;
        this.player = player;
        this.hud    = hud;

        this.currentWave    = 0;
        this.enemiesAlive   = [];
        this.isWaveActive   = false;

        this._currentRoomIdx = -1;
        this._clearedRooms   = new Set();
        this._visitedRooms   = new Set();

        this._doors = [];

        this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── API publique ──────────────────────────────────────────────────────────

    enterRoom(roomIdx, entryPos, exitPos, entryRot = 0, exitRot = 0, roomCenter = null, navManager = null) {
        this._clearEnemies();
        this._removeDoors();

        this._currentRoomIdx = roomIdx;
        this._roomCenter     = roomCenter;
        this._navManager     = navManager;

        if (roomIdx === 0) return;

        const isNew = !this._visitedRooms.has(roomIdx);
        this._visitedRooms.add(roomIdx);

        if (!isNew || this._clearedRooms.has(roomIdx)) return;

        this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
        this._startRoomWaves();
    }

    // ── Portes ────────────────────────────────────────────────────────────────

    _spawnDoors(entryPos, exitPos, entryRot, exitRot) {
        if (!entryPos && !exitPos) return;

        const mat = new BABYLON.StandardMaterial("doorMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.05, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);
        mat.alpha = 0.92;

        const makeBarrier = (name, pos, rotY) => {
            if (!pos) return null;
            const door = BABYLON.MeshBuilder.CreateBox(name, { width: 4, height: 3.5, depth: 0.25 }, this.scene);
            door.position   = pos.clone();
            door.position.y = 1.75;
            door.rotation.y = rotY;
            door.material   = mat;
            door.checkCollisions = true;
            door.isPickable      = false;

            door._pulseT = 0;
            const obs = this.scene.onBeforeRenderObservable.add(() => {
                door._pulseT += 0.05;
                mat.emissiveColor = new BABYLON.Color3(0.7 + Math.sin(door._pulseT) * 0.2, 0.05, 0.05);
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
            let elapsed = 0;
            const startY = door.position.y;
            const obs = this.scene.onBeforeRenderObservable.add(() => {
                elapsed += this.scene.getEngine().getDeltaTime();
                const t = Math.min(elapsed / 800, 1);
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

    // ── Vagues ────────────────────────────────────────────────────────────────

    _startRoomWaves() {
        this.currentWave  = 0;
        this.isWaveActive = false;
        this._launchNextWave();
    }

    _launchNextWave() {
        if (this.currentWave >= WAVES_PER_ROOM) {
            this._clearedRooms.add(this._currentRoomIdx);
            this.hud.showWaveMessage("SECTEUR SÉCURISÉ — PORTES OUVERTES");
            this._openDoors();
            return;
        }

        this.currentWave++;
        this.isWaveActive = true;

        // Réinitialise le compteur de slots : chaque vague recommence à "front"
        resetSlotCounter();

        this.hud.updateWave(this.currentWave);
        this.hud.showWaveMessage(`VAGUE ${this.currentWave} / ${WAVES_PER_ROOM}`);

        const composition = WAVE_COMPOSITIONS[this.currentWave] ?? WAVE_COMPOSITIONS[1];
        const center      = this._roomCenter ?? this.player.camera.position;
        const total       = composition.reduce((acc, g) => acc + g.count, 0);

        let globalIdx = 0;
        for (const group of composition) {
            for (let i = 0; i < group.count; i++) {
                const angle    = (globalIdx / total) * Math.PI * 2 + Math.random() * 0.4;
                const radius   = 8 + Math.random() * 14;
                const spawnPos = new BABYLON.Vector3(
                    center.x + Math.cos(angle) * radius,
                    1.25,
                    center.z + Math.sin(angle) * radius,
                );

                const type      = group.type;
                const speedMult = group.speedMult;

                EnemyParticles.spawnWarning(
                    this.scene,
                    spawnPos,
                    EnemyParticles.colorForType(type),
                    SPAWN_WARNING_DELAY,
                );

                setTimeout(() => {
                    if (!this.isWaveActive) return;
                    const enemy = this._createEnemy(type, spawnPos, speedMult);
                    if (enemy) this.enemiesAlive.push(enemy);
                }, SPAWN_WARNING_DELAY);

                globalIdx++;
            }
        }
    }

    _createEnemy(type, spawnPos, speedMult) {
        switch (type) {
            case "heavy":
                return new HeavyEnemy(this.scene, spawnPos, this.player, 2 * speedMult, this._navManager);
            case "scout":
                return new ScoutEnemy(this.scene, spawnPos, this.player, 5 * speedMult, this._navManager);
            case "standard":
            default:
                return new StandardEnemy(this.scene, spawnPos, this.player, 3 * speedMult, this._navManager);
        }
    }

    _clearEnemies() {
        this.enemiesAlive.forEach(enemy => {
            if (enemy.body && !enemy.body.isDisposed()) enemy.body.dispose();
        });
        this.enemiesAlive = [];
        this.isWaveActive = false;
    }

    // ── Boucle principale ─────────────────────────────────────────────────────

    _update() {
        if (!this.isWaveActive) return;

        const allSpawned = this.enemiesAlive.length > 0;
        if (!allSpawned) return;

        this.enemiesAlive = this.enemiesAlive.filter(
            e => e.body && !e.body.isDisposed(),
        );

        if (this.enemiesAlive.length === 0) {
            this.isWaveActive = false;
            if (this.currentWave < WAVES_PER_ROOM) {
                this.hud.showWaveMessage(`VAGUE ${this.currentWave} TERMINÉE`);
                setTimeout(() => this._launchNextWave(), 3000);
            } else {
                this._launchNextWave();
            }
        }
    }
}