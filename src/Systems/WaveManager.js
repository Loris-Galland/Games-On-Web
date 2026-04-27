import * as BABYLON from "@babylonjs/core";
import { StandardEnemy }    from "../Enemies/StandardEnemy";
import { HeavyEnemy }       from "../Enemies/HeavyEnemy";
import { ScoutEnemy }       from "../Enemies/ScoutEnemy";
import { BossEnemy }        from "../Enemies/BossEnemy";
import { EnemyParticles }   from "../Enemies/EnemyParticles";
import { resetSlotCounter } from "../Enemies/BaseEnemy";
import { WeaponShopRoom, ChallengeRoom, ForgeRoom } from "./SpecialRooms";

/**
 * WaveManager (version enrichie)
 * --------------------------------
 * Gère les vagues + intègre :
 *   - Boss room (dernière salle ou salle désignée)
 *   - Boutique d'armes (salle 2)
 *   - Salle de forge (salle 4)
 *   - Salle de défi (salle 5)
 *   - ScoreManager pour les kills
 */

const WAVES_PER_ROOM      = 3;
const SPAWN_WARNING_DELAY = 1800;

const WAVE_COMPOSITIONS = {
    1: [ { type: "standard", count: 6,  speedMult: 1.0 } ],
    2: [ { type: "standard", count: 8,  speedMult: 1.0 }, { type: "scout", count: 4, speedMult: 1.0 } ],
    3: [ { type: "standard", count: 8,  speedMult: 1.1 }, { type: "heavy", count: 4, speedMult: 1.0 } ],
    4: [ { type: "standard", count: 10, speedMult: 1.1 }, { type: "scout", count: 4, speedMult: 1.1 }, { type: "heavy", count: 4, speedMult: 1.0 } ],
    5: [ { type: "heavy",    count: 12, speedMult: 1.1 }, { type: "scout", count: 8, speedMult: 1.2 }, { type: "standard", count: 4, speedMult: 1.2 } ],
};

// Type de salle par index
const ROOM_SPECIAL_TYPE = {
    // 0 = spawn (ignoré)
    2: "shop",      // Salle 2 : boutique d'armes
    4: "forge",     // Salle 4 : forge
    5: "challenge", // Salle 5 : défi chronométré
    6: "boss",      // Salle 6 : boss final
};

export class WaveManager {
    constructor(scene, player, hud, scoreManager = null, weaponManager = null) {
        this.scene         = scene;
        this.player        = player;
        this.hud           = hud;
        this.scoreManager  = scoreManager;
        this.weaponManager = weaponManager;

        this.currentWave     = 0;
        this.enemiesAlive    = [];
        this.isWaveActive    = false;

        this._currentRoomIdx = -1;
        this._clearedRooms   = new Set();
        this._visitedRooms   = new Set();

        this._doors          = [];
        this._boss           = null;
        this._specialRoom    = null;

        // Chrono pour bonus vitesse de vague
        this._waveStartTime  = 0;
        this._damageTakenInWave = 0;

        // Tracking dégâts reçus par le joueur pendant la vague
        this._healthObserver = null;
        this._prevHealth     = player.health?.currentHealth ?? 10;

        this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── API publique ──────────────────────────────────────────────────────────

    enterRoom(roomIdx, entryPos, exitPos, entryRot = 0, exitRot = 0, roomCenter = null, navManager = null) {
        this._clearEnemies();
        this._removeDoors();
        this._deactivateSpecialRoom();

        this._currentRoomIdx = roomIdx;
        this._roomCenter     = roomCenter;
        this._navManager     = navManager;

        if (roomIdx === 0) return;

        const isNew = !this._visitedRooms.has(roomIdx);
        this._visitedRooms.add(roomIdx);

        if (!isNew || this._clearedRooms.has(roomIdx)) return;

        const specialType = ROOM_SPECIAL_TYPE[roomIdx];

        if (specialType === "boss") {
            this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
            this._startBossRoom(roomCenter);

        } else if (specialType === "shop") {
            this._handleShopRoom(roomCenter);

        } else if (specialType === "forge") {
            this._handleForgeRoom(roomCenter);

        } else if (specialType === "challenge") {
            this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
            this._handleChallengeRoom(roomCenter);

        } else {
            this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
            this._startRoomWaves();
        }
    }

    // ── Salles spéciales ──────────────────────────────────────────────────────

    _handleShopRoom(center) {
        this._clearedRooms.add(this._currentRoomIdx);
        const shop = new WeaponShopRoom(this.scene, center ?? this.player.camera.position);
        this._specialRoom = shop;
        shop.activate(this.player, this.weaponManager, this.scoreManager, this.hud);
        // Portes ouvertes immédiatement — pas de combat
        this.hud?.showWaveMessage?.("ARMURERIE — LIBRE D'ACCÈS");
    }

    _handleForgeRoom(center) {
        this._clearedRooms.add(this._currentRoomIdx);
        const forge = new ForgeRoom(this.scene, center ?? this.player.camera.position);
        this._specialRoom = forge;
        forge.activate(this.player, this.weaponManager, this.scoreManager, this.hud);
        this.hud?.showWaveMessage?.("FORGE — AMELIOREZ VOTRE ARME");
    }

    _handleChallengeRoom(center) {
        const spawned = [];
        const challenge = new ChallengeRoom(this.scene, this.player, this.scoreManager, this.hud);
        this._specialRoom = challenge;

        challenge.start({
            timeLimit:   50,
            killTarget:  18,
            spawnFn: (count) => {
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const r     = 8 + Math.random() * 6;
                    const sp    = new BABYLON.Vector3(
                        (center?.x ?? 0) + Math.cos(angle) * r,
                        1.5,
                        (center?.z ?? 0) + Math.sin(angle) * r,
                    );
                    const type = i % 4 === 0 ? "scout" : "standard";
                    EnemyParticles.spawnWarning(this.scene, sp, EnemyParticles.colorForType(type), SPAWN_WARNING_DELAY);
                    setTimeout(() => {
                        const e = this._createEnemy(type, sp, 1.1);
                        if (e) {
                            // On hook le dispose pour notifier le challenge
                            const origDispose = e.body.onDisposeObservable;
                            e.body.onDisposeObservable.add(() => {
                                challenge.registerKill();
                                this._handleKill(type, false);
                            });
                            this.enemiesAlive.push(e);
                            spawned.push(e);
                        }
                    }, SPAWN_WARNING_DELAY);
                }
            },
        });
    }

    // ── Boss Room ─────────────────────────────────────────────────────────────

    _startBossRoom(center) {
        this.hud?.showWaveMessage?.("ARCHON-0 DÉTECTÉ — PRÉPARATION AU COMBAT");
        this.isWaveActive = true;

        const bossPos = new BABYLON.Vector3(
            (center?.x ?? 0),
            1.5,
            (center?.z ?? 0),
        );

        // Délai dramatique avant spawn boss
        setTimeout(() => {
            this._boss = new BossEnemy(
                this.scene,
                bossPos,
                this.player,
                this._navManager,
                (type, pos) => { // summon callback
                    const e = this._createEnemy(type, pos, 1.3);
                    if (e) {
                        e.body.onDisposeObservable.add(() => this._handleKill(type, false));
                        this.enemiesAlive.push(e);
                    }
                },
            );

            // HUD Boss Bar
            this.hud?.showBossBar?.(this._boss.maxHealth);

            // Hooks boss
            this._boss.onDamage = (current, max) => {
                this.hud?.updateBossBar?.(current, max);
            };

            this._boss.onPhase = (phase) => {
                this.hud?.showWaveMessage?.(`ARCHON-0 — PHASE ${phase}`);
                this.scoreManager?.onBossPhase?.(phase);
            };

            this._boss.onDeath = () => {
                this.hud?.hideBossBar?.();
                this.hud?.showWaveMessage?.("ARCHON-0 NEUTRALISÉ — VICTOIRE");
                this.scoreManager?.onBossKill?.();
                this.scoreManager?.onRoomClear?.();
                this.isWaveActive = false;
                this._clearedRooms.add(this._currentRoomIdx);
                setTimeout(() => this._openDoors(), 2000);
            };

            this.hud?.showWaveMessage?.("ARCHON-0 EST LÀ !");

        }, 3000);
    }

    // ── Vagues normales ───────────────────────────────────────────────────────

    _startRoomWaves() {
        this.currentWave  = 0;
        this.isWaveActive = false;
        this._prevHealth  = this.player.health?.currentHealth ?? 10;
        this._launchNextWave();
    }

    _launchNextWave() {
        if (this.currentWave >= WAVES_PER_ROOM) {
            this._clearedRooms.add(this._currentRoomIdx);
            this.scoreManager?.onRoomClear?.();
            this.hud?.showWaveMessage?.("SECTEUR SÉCURISÉ — PORTES OUVERTES");
            this._openDoors();
            return;
        }

        this.currentWave++;
        this.isWaveActive    = true;
        this._waveStartTime  = Date.now();
        this._damageTakenInWave = 0;
        this._prevHealth     = this.player.health?.currentHealth ?? 10;

        resetSlotCounter();

        this.hud?.updateWave?.(this.currentWave);
        this.hud?.showWaveMessage?.(`VAGUE ${this.currentWave} / ${WAVES_PER_ROOM}`);

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
                    this.scene, spawnPos,
                    EnemyParticles.colorForType(type),
                    SPAWN_WARNING_DELAY,
                );

                setTimeout(() => {
                    if (!this.isWaveActive) return;
                    const enemy = this._createEnemy(type, spawnPos, speedMult);
                    if (enemy) {
                        // Hook mort pour le scoring
                        enemy.body.onDisposeObservable.add(() => {
                            this._handleKill(type, false);
                        });
                        // Bonus weakpoint
                        if (enemy.weakPoint) {
                            enemy.weakPoint.onDisposeObservable.add(() => {
                                this._handleKill(type, true);
                            });
                        }
                        this.enemiesAlive.push(enemy);
                    }
                }, SPAWN_WARNING_DELAY);

                globalIdx++;
            }
        }
    }

    // ── Kill scoring ──────────────────────────────────────────────────────────

    _handleKill(type, isWeakpoint) {
        if (!this.scoreManager) return;
        this.scoreManager.onKill(type, { weakpoint: isWeakpoint });
    }

    // ── Update ────────────────────────────────────────────────────────────────

    _update() {
        // Tracking dégâts pour bonus vague
        if (this.isWaveActive && this.player.health) {
            const hp = this.player.health.currentHealth;
            if (hp < this._prevHealth) {
                this._damageTakenInWave += (this._prevHealth - hp);
                this._prevHealth = hp;
            }
        }

        if (!this.isWaveActive) return;

        const allSpawned = this.enemiesAlive.length > 0;
        if (!allSpawned) return;

        this.enemiesAlive = this.enemiesAlive.filter(
            e => e.body && !e.body.isDisposed(),
        );

        if (this.enemiesAlive.length === 0 && !this._boss) {
            this.isWaveActive = false;

            // Bonus fin de vague
            const waveTime   = (Date.now() - this._waveStartTime) / 1000;
            const damageTaken = this._damageTakenInWave;
            this.scoreManager?.onWaveComplete?.({
                time:         waveTime,
                damageTaken,
                waveNumber:   this.currentWave,
            });

            if (this.currentWave < WAVES_PER_ROOM) {
                this.hud?.showWaveMessage?.(`VAGUE ${this.currentWave} TERMINÉE`);
                setTimeout(() => this._launchNextWave(), 3000);
            } else {
                this._launchNextWave();
            }
        }
    }

    // ── Ennemis ───────────────────────────────────────────────────────────────

    _createEnemy(type, spawnPos, speedMult) {
        switch (type) {
            case "heavy":
                return new HeavyEnemy(this.scene, spawnPos, this.player, 2 * speedMult, this._navManager);
            case "scout":
                return new ScoutEnemy(this.scene, spawnPos, this.player, 6 * speedMult, this._navManager);
            case "standard":
            default:
                return new StandardEnemy(this.scene, spawnPos, this.player, 4 * speedMult, this._navManager);
        }
    }

    _clearEnemies() {
        this.enemiesAlive.forEach(enemy => {
            if (enemy.body && !enemy.body.isDisposed()) enemy.body.dispose();
        });
        this.enemiesAlive = [];
        this.isWaveActive = false;

        if (this._boss) {
            this._boss.dispose?.();
            this._boss = null;
        }

        this.hud?.hideBossBar?.();
    }

    _deactivateSpecialRoom() {
        if (this._specialRoom) {
            this._specialRoom.deactivate?.();
            this._specialRoom = null;
        }
    }

    // ── Portes ────────────────────────────────────────────────────────────────

    _spawnDoors(entryPos, exitPos, entryRot, exitRot) {
        if (!entryPos && !exitPos) return;

        const mat = new BABYLON.StandardMaterial("doorMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.05, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);
        mat.alpha         = 0.92;

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
}
