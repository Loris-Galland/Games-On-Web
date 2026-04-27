/**
 * ScoreManager
 * ------------
 * Système de scoring AAA complet.
 *
 * Features :
 *   - Points de base par type d'ennemi (standard, scout, heavy, boss)
 *   - Multiplicateur de combo (jusqu'à ×8)
 *   - Bonus de précision (headshot/weakpoint)
 *   - Streak kill (multi-kill rapide)
 *   - Bonus par phase de boss
 *   - Bonus de fin de vague (rapidité, sans dommage)
 *   - Décroissance du combo si inactif
 *   - Callbacks UI temps réel
 *
 * Usage :
 *   const sm = new ScoreManager(hud);
 *   sm.onKill("scout", { weakpoint: true });
 *   sm.onKill("heavy");
 *   sm.onWaveComplete({ time: 30, damageTaken: 0 });
 *   sm.onBossPhase(2);
 *   sm.onBossKill();
 */
export class ScoreManager {

    // Points de base par type
    static BASE_POINTS = {
        standard: 100,
        scout:    180,
        heavy:    350,
        boss:    5000,
    };

    // Multiplicateurs de combo (par palier)
    static COMBO_THRESHOLDS = [
        { kills: 1,  mult: 1.0, label: ""          },
        { kills: 3,  mult: 1.5, label: "DOUBLE"    },
        { kills: 5,  mult: 2.0, label: "TRIPLE"    },
        { kills: 8,  mult: 2.5, label: "QUAD"      },
        { kills: 12, mult: 3.0, label: "PENTA"     },
        { kills: 18, mult: 4.0, label: "GODLIKE"   },
        { kills: 25, mult: 6.0, label: "LEGENDARY" },
        { kills: 40, mult: 8.0, label: "ARCHON"    },
    ];

    static COMBO_DECAY_TIME = 4.5; // secondes sans kill → combo reset

    constructor(hud = null) {
        this.hud = hud;

        this.totalScore      = 0;
        this.sessionKills    = { standard: 0, scout: 0, heavy: 0, boss: 0 };
        this.totalKills      = 0;
        this.weakpointKills  = 0;
        this.wavesCleared    = 0;
        this.roomsCleared    = 0;
        this.perfectWaves    = 0;   // vagues sans dégâts
        this.bossPhaseBonus  = 0;   // bonus accumulé durant le boss

        // Combo
        this._comboKills      = 0;
        this._comboMult       = 1.0;
        this._comboLabel      = "";
        this._comboTimer      = 0;  // secondes depuis le dernier kill
        this._comboDecaying   = false;
        this._comboIntervalId = null;

        // Streak (multi-kill < 1s)
        this._streakTimer     = 0;
        this._streakCount     = 0;
        this._lastKillTime    = 0;
        this._streakThreshold = 1.0; // secondes

        // Historique des événements pour l'écran de fin
        this._events = [];

        this._startDecayLoop();
    }

    // ── Kill ─────────────────────────────────────────────────────────────────

    /**
     * Appelé à chaque kill ennemi.
     * @param {"standard"|"scout"|"heavy"|"boss"} type
     * @param {{ weakpoint?: boolean, bossPhase?: number }} opts
     */
    onKill(type = "standard", opts = {}) {
        const now = Date.now();

        // Points de base
        const base = ScoreManager.BASE_POINTS[type] ?? 100;

        // Bonus weakpoint ×2.5
        const wpMult = opts.weakpoint ? 2.5 : 1.0;

        // Streak bonus
        const streakBonus = this._calcStreak(now);

        // Combo mult
        this._comboKills++;
        this._comboTimer = 0;
        this._comboDecaying = false;
        this._updateComboLevel();

        const earned = Math.round(base * wpMult * this._comboMult) + streakBonus;
        this.totalScore += earned;

        // Stats
        if (type in this.sessionKills) this.sessionKills[type]++;
        else this.sessionKills[type] = 1;
        this.totalKills++;
        if (opts.weakpoint) this.weakpointKills++;

        this._lastKillTime = now;

        // Log
        this._events.push({
            type: "kill", enemyType: type, points: earned, mult: this._comboMult,
            weakpoint: !!opts.weakpoint, streak: this._streakCount,
        });

        // Notify HUD
        this._notifyHUD({
            points: earned,
            combo: this._comboMult,
            comboLabel: this._comboLabel,
            streak: this._streakCount > 1 ? this._streakCount : 0,
            total: this.totalScore,
            weakpoint: !!opts.weakpoint,
        });

        return earned;
    }

    // ── Vague terminée ────────────────────────────────────────────────────────

    /**
     * @param {{ time: number, damageTaken: number, waveNumber: number }} opts
     */
    onWaveComplete(opts = {}) {
        this.wavesCleared++;
        let bonus = 0;
        const labels = [];

        // Bonus vitesse (< 30s)
        if (opts.time && opts.time < 30) {
            const speedBonus = Math.round(500 * (1 - opts.time / 30));
            bonus += speedBonus;
            labels.push(`SPEED +${speedBonus}`);
        }

        // Bonus aucun dégât
        if (opts.damageTaken === 0) {
            bonus += 800;
            this.perfectWaves++;
            labels.push("PERFECT +800");
        }

        // Bonus combo actif
        if (this._comboMult > 1) {
            const comboBonus = Math.round(300 * this._comboMult);
            bonus += comboBonus;
            labels.push(`COMBO +${comboBonus}`);
        }

        this.totalScore += bonus;
        this._events.push({ type: "wave", waveNumber: opts.waveNumber, bonus, labels });

        if (this.hud?.showWaveBonus) this.hud.showWaveBonus(bonus, labels);
        this._notifyHUD({ total: this.totalScore });

        return bonus;
    }

    // ── Boss ─────────────────────────────────────────────────────────────────

    onBossPhase(phase) {
        const phaseBonus = phase * 1500;
        this.bossPhaseBonus += phaseBonus;
        this.totalScore    += phaseBonus;
        this._events.push({ type: "bossPhase", phase, bonus: phaseBonus });
        if (this.hud?.showBossPhaseBonus) this.hud.showBossPhaseBonus(phase, phaseBonus);
        this._notifyHUD({ total: this.totalScore });
        return phaseBonus;
    }

    onBossKill() {
        const bonus = ScoreManager.BASE_POINTS.boss * this._comboMult + this.bossPhaseBonus;
        this.totalScore += bonus;
        this.sessionKills.boss = (this.sessionKills.boss ?? 0) + 1;
        this.totalKills++;
        this._events.push({ type: "bossKill", bonus });
        this._notifyHUD({ total: this.totalScore, bossKill: true });
        return bonus;
    }

    // ── Salle terminée ────────────────────────────────────────────────────────

    onRoomClear() {
        this.roomsCleared++;
        const bonus = 250 * this.roomsCleared;
        this.totalScore += bonus;
        this._events.push({ type: "roomClear", bonus });
        this._notifyHUD({ total: this.totalScore });
        return bonus;
    }

    // ── Combo & Streak ────────────────────────────────────────────────────────

    _updateComboLevel() {
        let level = ScoreManager.COMBO_THRESHOLDS[0];
        for (const t of ScoreManager.COMBO_THRESHOLDS) {
            if (this._comboKills >= t.kills) level = t;
        }
        this._comboMult  = level.mult;
        this._comboLabel = level.label;
    }

    _calcStreak(now) {
        const elapsed = (now - this._lastKillTime) / 1000;
        if (elapsed < this._streakThreshold) {
            this._streakCount++;
            const streakBonus = this._streakCount >= 3 ? (this._streakCount - 2) * 50 : 0;
            return streakBonus;
        } else {
            this._streakCount = 1;
            return 0;
        }
    }

    _startDecayLoop() {
        // Décroissance du combo si pas de kill pendant COMBO_DECAY_TIME s
        this._comboIntervalId = setInterval(() => {
            if (this._comboKills === 0) return;

            this._comboTimer += 0.1;
            if (this._comboTimer >= ScoreManager.COMBO_DECAY_TIME) {
                this._comboKills    = 0;
                this._comboMult     = 1.0;
                this._comboLabel    = "";
                this._comboTimer    = 0;
                this._comboDecaying = false;
                this._notifyHUD({ combo: 1.0, comboLabel: "", total: this.totalScore });
            } else if (this._comboTimer >= ScoreManager.COMBO_DECAY_TIME * 0.6) {
                this._comboDecaying = true;
            }
        }, 100);
    }

    // ── HUD notification ─────────────────────────────────────────────────────

    _notifyHUD(data) {
        if (!this.hud) return;
        if (this.hud.updateScore)    this.hud.updateScore(data.total ?? this.totalScore);
        if (this.hud.updateCombo && (data.combo !== undefined || data.comboLabel !== undefined)) {
            this.hud.updateCombo(
                data.combo ?? this._comboMult,
                data.comboLabel ?? this._comboLabel,
                this._comboDecaying,
            );
        }
        if (data.points && this.hud.showPointsPopup) {
            this.hud.showPointsPopup(data.points, {
                combo:     data.combo,
                weakpoint: data.weakpoint,
                streak:    data.streak,
                label:     data.comboLabel,
            });
        }
        if (data.bossKill && this.hud.showBossKillBanner) {
            this.hud.showBossKillBanner(this.totalScore);
        }
    }

    // ── Résumé final ──────────────────────────────────────────────────────────

    getSummary() {
        return {
            totalScore:     this.totalScore,
            totalKills:     this.totalKills,
            weakpointKills: this.weakpointKills,
            accuracy:       this.totalKills > 0 ? Math.round((this.weakpointKills / this.totalKills) * 100) : 0,
            sessionKills:   { ...this.sessionKills },
            wavesCleared:   this.wavesCleared,
            roomsCleared:   this.roomsCleared,
            perfectWaves:   this.perfectWaves,
            maxCombo:       Math.max(...ScoreManager.COMBO_THRESHOLDS.filter(t => t.kills <= this._comboKills).map(t => t.mult), 1),
            events:         [...this._events],
            grade:          this._calcGrade(),
        };
    }

    _calcGrade() {
        const s = this.totalScore;
        if (s >= 50000) return "S";
        if (s >= 30000) return "A";
        if (s >= 15000) return "B";
        if (s >= 5000)  return "C";
        return "D";
    }

    // ── Reset ─────────────────────────────────────────────────────────────────

    reset() {
        clearInterval(this._comboIntervalId);
        this.totalScore     = 0;
        this.sessionKills   = { standard: 0, scout: 0, heavy: 0, boss: 0 };
        this.totalKills     = 0;
        this.weakpointKills = 0;
        this.wavesCleared   = 0;
        this.roomsCleared   = 0;
        this.perfectWaves   = 0;
        this.bossPhaseBonus = 0;
        this._comboKills    = 0;
        this._comboMult     = 1.0;
        this._comboLabel    = "";
        this._comboTimer    = 0;
        this._streakCount   = 0;
        this._events        = [];
        this._startDecayLoop();
    }

    dispose() {
        clearInterval(this._comboIntervalId);
    }
}
