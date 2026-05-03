import * as BABYLON from "@babylonjs/core";
import { StandardEnemy }    from "../Enemies/StandardEnemy";
import { HeavyEnemy }       from "../Enemies/HeavyEnemy";
import { ScoutEnemy }       from "../Enemies/ScoutEnemy";
import { BossEnemy }        from "../Enemies/BossEnemy";
import { EnemyParticles }   from "../Enemies/EnemyParticles";
import { resetSlotCounter } from "../Enemies/BaseEnemy";
import { WeaponShopRoom, ChallengeRoom, ForgeRoom } from "./SpecialRooms";

/**
 * WaveManager — Cycle 3×(4 normales + 1 boss + 1 spéciale)
 * ----------------------------------------------------------
 *
 * Structure des salles (roomIdx) :
 *   0         → Spawn (ignoré)
 *
 *   ── Cycle 1 ──
 *   1,2,3,4   → Combat normal (WAVES_PER_ROOM vagues chacune)
 *   5         → Boss #1
 *   6         → Spéciale : BOUTIQUE
 *
 *   ── Cycle 2 ──
 *   7,8,9,10  → Combat normal (plus difficile)
 *   11        → Boss #2
 *   12        → Spéciale : FORGE
 *
 *   ── Cycle 3 ──
 *   13,14,15,16 → Combat normal (encore plus difficile)
 *   17          → Boss #3 (frenzy dès le début)
 *   18          → Spéciale : DÉFI
 *
 *   Après la salle 18 : VICTOIRE
 *
 * Total salles = 18 + spawn = 19 salles.
 * Dans ProceduralMapData.js il faut roomCount: 18.
 */

const WAVES_PER_ROOM      = 3;
const SPAWN_WARNING_DELAY = 1800;

// Compositions par numéro de vague (1 à 3 par salle)
// Les salles de cycle 2 et 3 utilisent des multiplicateurs de difficulté
const BASE_WAVE_COMPOSITIONS = {
    1: [ { type: "standard", count: 6,  speedMult: 1.0 } ],
    2: [ { type: "standard", count: 8,  speedMult: 1.0 }, { type: "scout", count: 3, speedMult: 1.0 } ],
    3: [ { type: "standard", count: 8,  speedMult: 1.1 }, { type: "heavy", count: 3, speedMult: 1.0 } ],
};

// Classifiction par roomIdx → type de salle
// Généré dynamiquement pour les 3 cycles
function getRoomType(roomIdx) {
    if (roomIdx === 0) return "spawn";

    // Cycles : chaque cycle = 6 salles (4 normales + 1 boss + 1 spéciale)
    // Cycle 1 : salles 1-6
    // Cycle 2 : salles 7-12
    // Cycle 3 : salles 13-18
    const cycleLen  = 5;
    const cycle     = Math.ceil(roomIdx / cycleLen); // 1, 2 ou 3
    const posInCycle = ((roomIdx - 1) % cycleLen) + 1; // 1..6

    if (posInCycle <= 3) return "normal";
    if (posInCycle === 4) return "boss";
    // posInCycle === 5
    if (cycle === 1) return "shop";
    if (cycle === 2) return "forge";
    return "challenge"; // cycle 3
}

function getCycleForRoom(roomIdx) {
    return Math.ceil(roomIdx / 5);
}

export class WaveManager {
    constructor(scene, player, hud, scoreManager = null, weaponManager = null) {
        this.scene         = scene;
        this.player        = player;
        this.hud           = hud;
        this.scoreManager  = scoreManager;
        this.weaponManager = weaponManager;

        this.currentWave      = 0;
        this.enemiesAlive     = [];
        this.isWaveActive     = false;
        this._currentRoomIdx  = -1;
        this._clearedRooms    = new Set();
        this._visitedRooms    = new Set();
        this._doors           = [];
        this._boss            = null;
        this._specialRoom     = null;
        this._waveStartTime   = 0;
        this._damageTakenInWave = 0;
        this._prevHealth      = player.health?.currentHealth ?? 10;

        this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    // ── Entrée salle ─────────────────────────────────────────────────────────

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

        const type  = getRoomType(roomIdx);
        const cycle = getCycleForRoom(roomIdx);

        switch (type) {
            case "normal":
                this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
                this._startNormalWaves(cycle);
                break;
            case "boss":
                this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
                this._startBossRoom(roomCenter, cycle);
                break;
            case "shop":
                this._handleShopRoom(roomCenter);
                break;
            case "forge":
                this._handleForgeRoom(roomCenter);
                break;
            case "challenge":
                this._spawnDoors(entryPos, exitPos, entryRot, exitRot);
                this._handleChallengeRoom(roomCenter, cycle);
                break;
        }
    }

    // ── Salles normales ───────────────────────────────────────────────────────

    _startNormalWaves(cycle) {
        this.currentWave = 0;
        this.isWaveActive = false;
        this._prevHealth  = this.player.health?.currentHealth ?? 10;
        this._diffMult    = 1.0 + (cycle - 1) * 0.35; // cycle 2 → ×1.35, cycle 3 → ×1.70
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
        this.isWaveActive       = true;
        this._waveStartTime     = Date.now();
        this._damageTakenInWave = 0;
        this._prevHealth        = this.player.health?.currentHealth ?? 10;
        this._pendingSpawns     = 0;

        resetSlotCounter();
        this.hud?.updateWave?.(this.currentWave);
        this.hud?.showWaveMessage?.(`VAGUE ${this.currentWave} / ${WAVES_PER_ROOM}`);

        const composition = BASE_WAVE_COMPOSITIONS[this.currentWave] ?? BASE_WAVE_COMPOSITIONS[1];
        const diff        = this._diffMult ?? 1.0;
        const center      = this._roomCenter ?? this.player.camera.position;
        const total       = composition.reduce((a, g) => a + g.count, 0);
        let   globalIdx   = 0;

        for (const group of composition) {
            const scaledCount = Math.round(group.count * diff);
            for (let i = 0; i < scaledCount; i++) {
                const angle    = (globalIdx / Math.max(total, 1)) * Math.PI * 2 + Math.random() * 0.4;
                const radius   = 8 + Math.random() * 14;
                const spawnPos = new BABYLON.Vector3(
                    center.x + Math.cos(angle) * radius,
                    1.25,
                    center.z + Math.sin(angle) * radius,
                );

                EnemyParticles.spawnWarning(this.scene, spawnPos, EnemyParticles.colorForType(group.type), SPAWN_WARNING_DELAY);

                const type      = group.type;
                const speedMult = group.speedMult * diff;
                this._pendingSpawns++;
                setTimeout(() => {
                    this._pendingSpawns = Math.max(0, (this._pendingSpawns ?? 1) - 1);
                    if (!this.isWaveActive) return;
                    const enemy = this._createEnemy(type, spawnPos, speedMult);
                    if (enemy) {
                        enemy.body.onDisposeObservable.add(() => this._handleKill(type, false));
                        if (enemy.weakPoint) {
                            enemy.weakPoint.onDisposeObservable.add(() => this._handleKill(type, true));
                        }
                        this.enemiesAlive.push(enemy);
                    }
                }, SPAWN_WARNING_DELAY);

                globalIdx++;
            }
        }
    }

    // ── Boss ─────────────────────────────────────────────────────────────────

    _startBossRoom(center, cycle) {
        this.isWaveActive = true;
        const cycleLabel  = ["I", "II", "III"][cycle - 1] ?? cycle;
        this.hud?.showWaveMessage?.(`ARCHON-${cycle} DÉTECTÉ — PRÉPAREZ-VOUS`);

        // Difficulté boss selon cycle : hp + vitesse croissants
        const hpMultiplier    = 1.0 + (cycle - 1) * 0.5;   // ×1.0 / ×1.5 / ×2.0
        const speedMultiplier = 1.0 + (cycle - 1) * 0.25;

        const bossPos = new BABYLON.Vector3(center?.x ?? 0, 1.5, center?.z ?? 0);

        setTimeout(() => {
            this._boss = new BossEnemy(
                this.scene, bossPos, this.player, this._navManager,
                (type, pos) => {
                    const e = this._createEnemy(type, pos, 1.2 * speedMultiplier);
                    if (e) {
                        e.body.onDisposeObservable.add(() => this._handleKill(type, false));
                        this.enemiesAlive.push(e);
                    }
                },
            );

            // Appliquer les modificateurs de cycle
            this._boss.maxHealth     = Math.round(20 * hpMultiplier);
            this._boss.currentHealth = this._boss.maxHealth;
            this._boss.speed         = 2.5 * speedMultiplier;

            // Phase 3 activée directement en cycle 3
            if (cycle >= 3) {
                this._boss.phase = 3;
                this._boss.speed = 4.0;
            }

            this.hud?.showBossBar?.(this._boss.maxHealth);

            this._boss.onDamage = (current, max) => {
                this.hud?.updateBossBar?.(current, max);
            };

            this._boss.onPhase = (phase) => {
                this.hud?.showWaveMessage?.(`ARCHON-${cycle} — PHASE ${phase}`);
                this.scoreManager?.onBossPhase?.(phase);
            };

            this._boss.onDeath = () => {
                this.hud?.hideBossBar?.();
                this.hud?.showWaveMessage?.(`ARCHON-${cycleLabel} NEUTRALISÉ`);
                this.scoreManager?.onBossKill?.();
                this.scoreManager?.onRoomClear?.();
                this.isWaveActive = false;
                this._boss = null;
                this._clearedRooms.add(this._currentRoomIdx);
                setTimeout(() => this._openDoors(), 2000);
            };

            this.hud?.showWaveMessage?.(`ARCHON-${cycleLabel} EST LÀ !`);
        }, 3000);
    }

    // ── Salles spéciales ──────────────────────────────────────────────────────

    _handleShopRoom(center) {
        this._clearedRooms.add(this._currentRoomIdx);
        const shop = new WeaponShopRoom(this.scene, center ?? this.player.camera.position);
        this._specialRoom = shop;
        shop.activate(this.player, this.weaponManager, this.scoreManager, this.hud);
        this.hud?.showWaveMessage?.("ARMURERIE — APPROCHEZ UN SOCLE");
    }

    _handleForgeRoom(center) {
        this._clearedRooms.add(this._currentRoomIdx);
        const forge = new ForgeRoom(this.scene, center ?? this.player.camera.position);
        this._specialRoom = forge;
        forge.activate(this.player, this.weaponManager, this.scoreManager, this.hud);
        this.hud?.showWaveMessage?.("FORGE — AMÉLIOREZ VOTRE ARME");
    }

    _handleChallengeRoom(center, cycle) {
        const diff    = 1.0 + (cycle - 1) * 0.4;
        const target  = Math.round(18 * diff);
        const timeLimit = 55;

        const challenge = new ChallengeRoom(this.scene, this.player, this.scoreManager, this.hud);
        this._specialRoom = challenge;

        challenge.start({
            timeLimit,
            killTarget: target,
            spawnFn: (count) => {
                for (let i = 0; i < count; i++) {
                    const angle = (i / count) * Math.PI * 2;
                    const r     = 8 + Math.random() * 6;
                    const sp    = new BABYLON.Vector3(
                        (center?.x ?? 0) + Math.cos(angle) * r,
                        1.5,
                        (center?.z ?? 0) + Math.sin(angle) * r,
                    );
                    const type  = i % 3 === 0 ? "scout" : "standard";
                    EnemyParticles.spawnWarning(this.scene, sp, EnemyParticles.colorForType(type), SPAWN_WARNING_DELAY);
                    setTimeout(() => {
                        const e = this._createEnemy(type, sp, 1.1 * (1.0 + (cycle - 1) * 0.2));
                        if (e) {
                            e.body.onDisposeObservable.add(() => {
                                challenge.registerKill();
                                this._handleKill(type, false);
                            });
                            this.enemiesAlive.push(e);
                        }
                    }, SPAWN_WARNING_DELAY);
                }
            },
        });

        // La salle de défi du cycle 3 est la dernière — on écoute sa complétion
        if (cycle === 3) {
            const origEnd = challenge._end.bind(challenge);
            challenge._end = (success) => {
                origEnd(success);
                if (success) {
                    setTimeout(() => this._triggerVictory(), 2000);
                }
            };
        }

        this._clearedRooms.add(this._currentRoomIdx);
    }

    // ── Victoire ──────────────────────────────────────────────────────────────

    _triggerVictory() {
        document.exitPointerLock?.();
        const summary = this.scoreManager?.getSummary?.() ?? {};

        const overlay = document.createElement("div");
        overlay.id = "victory-overlay";
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:600;
            background:#000;display:flex;flex-direction:column;
            align-items:center;justify-content:center;
            font-family:'Courier New',monospace;
            opacity:0;transition:opacity 0.8s;overflow:hidden;`;

        const gradeColors = { S:"#ffcc00", A:"#00ffcc", B:"#00aaff", C:"#aaaaaa", D:"#ff4444" };
        const grade       = summary.grade ?? "B";
        const gc          = gradeColors[grade] ?? "#00ffcc";

        overlay.innerHTML = `
            <style>
                @keyframes vic-glitch{0%,90%,100%{transform:translate(0)}91%{transform:translate(-3px,1px)}93%{transform:translate(3px,-1px)}95%{transform:translate(-2px,2px)}97%{transform:translate(2px,-2px)}}
                @keyframes vic-scan{0%{background-position:0 0}100%{background-position:0 100vh}}
                @keyframes vic-grade{0%{opacity:0;transform:scale(2.5)}60%{opacity:1;transform:scale(0.9)}100%{opacity:1;transform:scale(1)}}
                @keyframes vic-flicker{0%,19%,21%,23%,75%,77%,100%{opacity:1}20%,22%,76%{opacity:0.3}}
                #vic-scanline{position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,204,0.015) 2px,rgba(0,255,204,0.015) 4px);pointer-events:none;z-index:0;animation:vic-scan 8s linear infinite;}
                #vic-title{font-size:64px;font-weight:bold;letter-spacing:12px;color:#00ffcc;text-shadow:0 0 30px #00ffcc,0 0 60px #00ffcc44;animation:vic-glitch 2.5s infinite;}
                #vic-grade-el{font-size:96px;font-weight:bold;letter-spacing:8px;color:${gc};text-shadow:0 0 50px ${gc};animation:vic-grade 0.7s ease-out;line-height:1;}
                #vic-subtitle{font-size:12px;letter-spacing:5px;color:rgba(0,255,204,0.4);animation:vic-flicker 3s infinite;}
                #vic-restart{background:transparent;border:2px solid #00ffcc;color:#00ffcc;font-family:'Courier New',monospace;font-size:18px;letter-spacing:3px;text-transform:uppercase;padding:14px 50px;cursor:pointer;clip-path:polygon(0 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%);transition:all 0.2s ease;}
                #vic-restart:hover{background:#00ffcc;color:#000;box-shadow:0 0 30px #00ffcc88;}
                .vic-stat{display:flex;flex-direction:column;align-items:center;gap:6px;}
            </style>
            <div id="vic-scanline"></div>
            <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:18px;max-width:800px;width:100%;padding:40px;">
                <div id="vic-subtitle">ARCHON PROTOCOL — MISSION ACCOMPLIE</div>
                <div id="vic-title">VICTOIRE</div>
                <div id="vic-grade-el">${grade}</div>
                <div style="font-size:9px;letter-spacing:3px;color:rgba(0,255,204,0.4);text-transform:uppercase;">PERFORMANCE RATING</div>
                <div style="font-size:38px;font-weight:bold;letter-spacing:6px;color:#00ffcc;text-shadow:0 0 20px #00ffcc;">
                    ${String(summary.totalScore ?? 0).padStart(8,"0")}
                </div>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;width:100%;max-width:640px;border:1px solid rgba(0,255,204,0.2);padding:20px 30px;background:rgba(0,255,204,0.03);">
                    ${this._victoryStatEl("KILLS",     summary.totalKills   ?? 0, "#ff4466")}
                    ${this._victoryStatEl("VAGUES",    summary.wavesCleared ?? 0, "#00ffcc")}
                    ${this._victoryStatEl("PARFAITES", summary.perfectWaves ?? 0, "#aaffaa")}
                    ${this._victoryStatEl("PRÉCISION", (summary.accuracy ?? 0)+"%", "#ffaa00")}
                </div>
                <button id="vic-restart">↺ REJOUER</button>
                <div style="font-size:10px;letter-spacing:2px;color:#223344;margin-top:8px;">ROGUE PROTOCOL v2.7 — TOUTES MENACES NEUTRALISÉES</div>
            </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => { overlay.style.opacity = "1"; }));
        overlay.querySelector("#vic-restart")?.addEventListener("click", () => window.location.reload());
    }

    _victoryStatEl(label, value, color) {
        return `<div class="vic-stat">
            <span style="font-size:28px;font-weight:bold;color:${color};text-shadow:0 0 10px ${color};">${value}</span>
            <span style="font-size:9px;letter-spacing:2px;color:rgba(200,200,200,0.5);text-transform:uppercase;">${label}</span>
        </div>`;
    }

    // ── Scoring ───────────────────────────────────────────────────────────────

    _handleKill(type, isWeakpoint) {
        this.scoreManager?.onKill?.(type, { weakpoint: isWeakpoint });
    }

    // ── Update ────────────────────────────────────────────────────────────────

    _update() {
        if (this.isWaveActive && this.player.health) {
            const hp = this.player.health.currentHealth;
            if (hp < this._prevHealth) {
                this._damageTakenInWave += (this._prevHealth - hp);
                this._prevHealth = hp;
            }
        }

        if (!this.isWaveActive || this._boss) return;

        // Attendre que tous les spawns soient résolus
        if ((this._pendingSpawns ?? 0) > 0) return;
        if (this.enemiesAlive.length === 0) return;

        this.enemiesAlive = this.enemiesAlive.filter(e => e.body && !e.body.isDisposed());

        if (this.enemiesAlive.length === 0) {
            this.isWaveActive = false;

            const waveTime    = (Date.now() - this._waveStartTime) / 1000;
            const damageTaken = this._damageTakenInWave;
            this.scoreManager?.onWaveComplete?.({
                time: waveTime, damageTaken, waveNumber: this.currentWave,
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

    _createEnemy(type, spawnPos, speedMult = 1) {
        switch (type) {
            case "heavy":    return new HeavyEnemy(this.scene, spawnPos, this.player, 2 * speedMult, this._navManager);
            case "scout":    return new ScoutEnemy(this.scene, spawnPos, this.player, 4 * speedMult, this._navManager);
            default:         return new StandardEnemy(this.scene, spawnPos, this.player, 3 * speedMult, this._navManager);
        }
    }

    _clearEnemies() {
        this.enemiesAlive.forEach(e => { try { if (!e.body?.isDisposed()) e.body.dispose(); } catch(_){} });
        this.enemiesAlive = [];
        this.isWaveActive = false;
        if (this._boss) { this._boss.dispose?.(); this._boss = null; }
        this.hud?.hideBossBar?.();
    }

    _deactivateSpecialRoom() {
        if (this._specialRoom) { this._specialRoom.deactivate?.(); this._specialRoom = null; }
    }

    // ── Portes ────────────────────────────────────────────────────────────────

    _spawnDoors(entryPos, exitPos, entryRot, exitRot) {
        if (!entryPos && !exitPos) return;
        const mat = new BABYLON.StandardMaterial("doorMat", this.scene);
        mat.diffuseColor  = new BABYLON.Color3(0.05, 0.05, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0.8, 0.1, 0.1);
        mat.alpha         = 0.92;

        const make = (name, pos, rotY) => {
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

        const entry = make("door_entry", entryPos, entryRot);
        const exit  = make("door_exit",  exitPos,  exitRot);
        if (entry) this._doors.push(entry);
        if (exit)  this._doors.push(exit);
    }

    _openDoors() {
        // Signaler au joueur qu'il peut sortir
        this.hud?.showExitIndicator?.();

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
            try { if (!door.isDisposed()) door.dispose(); } catch(_){}
        });
        this._doors = [];
    }
}