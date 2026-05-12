import * as BABYLON from "@babylonjs/core";

/**
 * SoundManager
 * ------------
 * Centralise tous les sons et musiques du jeu.
 *
 * Usage :
 *   const sm = new SoundManager(scene);
 *   await sm.init();
 *
 *   sm.play("shoot");
 *   sm.playMusic("combat");
 *   sm.setMasterVolume(0.8);
 */
export class SoundManager {

    // ── Catalogue des sons ────────────────────────────────────────────────────
    // Chaque entrée : { file, volume, loop, spatial }
    // spatial = true → son 3D positionné dans la scène

    static SFX_CATALOG = {
        // Combat — joueur
        shoot:          { file: "shoot.wav",          volume: 0.55, loop: false, spatial: false },
        shoot_secondary:{ file: "shoot_secondary.wav",volume: 0.6,  loop: false, spatial: false },
        impact_wall:    { file: "impact_wall.wav",     volume: 0.35, loop: false, spatial: false },
        reload:         { file: "reload.wav",          volume: 0.5,  loop: false, spatial: false },
        no_ammo:        { file: "no_ammo.wav",         volume: 0.4,  loop: false, spatial: false },

        // Dégâts joueur
        player_hurt:    { file: "player_hurt.wav",    volume: 0.7,  loop: false, spatial: false },
        player_death:   { file: "player_death.wav",   volume: 0.9,  loop: false, spatial: false },
        player_heal:    { file: "player_heal.wav",    volume: 0.5,  loop: false, spatial: false },

        // Ennemis
        enemy_death:    { file: "enemy_death.wav",    volume: 0.5,  loop: false, spatial: true  },
        enemy_spawn:    { file: "enemy_spawn.wav",    volume: 0.45, loop: false, spatial: true  },
        enemy_hit:      { file: "enemy_hit.wav",      volume: 0.4,  loop: false, spatial: true  },

        // Boss
        boss_hit:       { file: "boss_hit.wav",       volume: 0.65, loop: false, spatial: false },
        boss_death:     { file: "boss_death.wav",     volume: 1.0,  loop: false, spatial: false },
        boss_phase:     { file: "boss_phase.wav",     volume: 0.8,  loop: false, spatial: false },
        boss_appear:    { file: "boss_appear.wav",    volume: 0.9,  loop: false, spatial: false },

        // Gameplay
        upgrade_pick:   { file: "upgrade_pick.wav",   volume: 0.7,  loop: false, spatial: false },
        door_open:      { file: "door_open.wav",      volume: 0.6,  loop: false, spatial: false },
        door_close:     { file: "door_close.wav",     volume: 0.6,  loop: false, spatial: false },
        room_clear:     { file: "room_clear.wav",     volume: 0.75, loop: false, spatial: false },
        wave_start:     { file: "wave_start.wav",     volume: 0.5,  loop: false, spatial: false },
        weakpoint_kill: { file: "weakpoint_kill.wav", volume: 0.8,  loop: false, spatial: false },
        weapon_pickup:  { file: "weapon_pickup.wav",  volume: 0.7,  loop: false, spatial: false },

        // Mouvements joueur
        jump:           { file: "jump.wav",           volume: 0.3,  loop: false, spatial: false },
        land:           { file: "land.wav",           volume: 0.35, loop: false, spatial: false },
        dash:           { file: "dash.wav",           volume: 0.5,  loop: false, spatial: false },
        blink:          { file: "blink.wav",          volume: 0.55, loop: false, spatial: false },
        shield_on:      { file: "shield_on.wav",      volume: 0.55, loop: false, spatial: false },
        shield_off:     { file: "shield_off.wav",     volume: 0.4,  loop: false, spatial: false },
        emp:            { file: "emp.wav",            volume: 0.65, loop: false, spatial: false },

        // UI / Menus
        ui_hover:       { file: "ui_hover.wav",       volume: 0.2,  loop: false, spatial: false },
        ui_click:       { file: "ui_click.wav",       volume: 0.3,  loop: false, spatial: false },
        ui_back:        { file: "ui_back.wav",        volume: 0.25, loop: false, spatial: false },
        ui_confirm:     { file: "ui_confirm.wav",     volume: 0.4,  loop: false, spatial: false },
        game_over:      { file: "game_over.wav",      volume: 0.8,  loop: false, spatial: false },
        victory:        { file: "victory.wav",        volume: 0.9,  loop: false, spatial: false },
    };

    static MUSIC_CATALOG = {
        menu:       { file: "music_menu.mp3",       volume: 0.35, loop: true },
        ambient:    { file: "music_ambient.mp3",    volume: 0.25, loop: true },
        combat:     { file: "music_combat.mp3",     volume: 0.45, loop: true },
        boss:       { file: "music_boss.mp3",       volume: 0.55, loop: true },
        boss2:      { file: "music_boss2.mp3",      volume: 0.55, loop: true },
        boss3:      { file: "music_boss3.mp3",      volume: 0.6,  loop: true },
        game_over:  { file: "music_game_over.mp3",  volume: 0.4,  loop: false },
        victory:    { file: "music_victory.mp3",    volume: 0.5,  loop: false },
    };

    static BASE_PATH_SFX   = "sounds/sfx/";
    static BASE_PATH_MUSIC  = "sounds/music/";

    // ─────────────────────────────────────────────────────────────────────────

    constructor(scene) {
        this.scene = scene;

        /** @type {Map<string, BABYLON.Sound>} */
        this._sfx = new Map();

        /** @type {Map<string, BABYLON.Sound>} */
        this._music = new Map();

        /** Son de musique actuellement joué */
        this._currentMusic     = null;
        this._currentMusicKey  = null;

        // Volumes globaux (0‑1)
        this._masterVolume = 1.0;
        this._sfxVolume    = 1.0;
        this._musicVolume  = 1.0;

        this._loaded = false;
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    /**
     * Charge tous les sons de façon asynchrone.
     * À appeler une fois après la création de la scène.
     */
    async init() {
        const sfxPromises   = Object.entries(SoundManager.SFX_CATALOG).map(([key, cfg]) =>
            this._loadSfx(key, cfg)
        );
        const musicPromises = Object.entries(SoundManager.MUSIC_CATALOG).map(([key, cfg]) =>
            this._loadMusic(key, cfg)
        );

        await Promise.allSettled([...sfxPromises, ...musicPromises]);
        this._loaded = true;
        console.log("[SoundManager] Tous les sons chargés.");
    }

    _loadSfx(key, cfg) {
        return new Promise((resolve) => {
            const url = SoundManager.BASE_PATH_SFX + cfg.file;
            const sound = new BABYLON.Sound(
                `sfx_${key}`,
                url,
                this.scene,
                () => resolve(sound),
                {
                    loop:          cfg.loop,
                    autoplay:      false,
                    volume:        cfg.volume * this._sfxVolume * this._masterVolume,
                    spatialSound:  cfg.spatial ?? false,
                    maxDistance:   cfg.spatial ? 20 : undefined,
                    rolloffFactor: cfg.spatial ? 1.5 : undefined,
                }
            );
            // En cas d'échec de chargement (fichier manquant), on résout quand même
            sound.onEndedObservable?.add(() => {});
            setTimeout(() => resolve(sound), 5000); // timeout sécurité
            this._sfx.set(key, sound);
        });
    }

    _loadMusic(key, cfg) {
        return new Promise((resolve) => {
            const url = SoundManager.BASE_PATH_MUSIC + cfg.file;
            const sound = new BABYLON.Sound(
                `music_${key}`,
                url,
                this.scene,
                () => resolve(sound),
                {
                    loop:     cfg.loop,
                    autoplay: false,
                    volume:   0, // démarre à 0, le fade gère le volume
                }
            );
            setTimeout(() => resolve(sound), 8000);
            this._music.set(key, sound);
        });
    }

    // ── Lecture SFX ───────────────────────────────────────────────────────────

    /**
     * Joue un effet sonore.
     * @param {string} key          Clé dans SFX_CATALOG
     * @param {BABYLON.Vector3} [pos]  Position 3D (pour les sons spatiaux)
     */
    play(key, pos = null) {
        if (!this._loaded) return;
        const sound = this._sfx.get(key);
        if (!sound) { console.warn(`[SoundManager] Son inconnu : "${key}"`); return; }

        if (pos && sound.spatialSound) {
            sound.setPosition(pos);
        }

        // Si le son joue déjà, le cloner pour permettre la polyphonie
        if (sound.isPlaying) {
            sound.stop();
        }
        sound.play();
    }

    /**
     * Version polyphonique — permet plusieurs instances simultanées du même son
     * (ex: plusieurs ennemis qui meurent en même temps).
     */
    playPoly(key, pos = null) {
        if (!this._loaded) return;
        const original = this._sfx.get(key);
        if (!original) return;

        const cfg = SoundManager.SFX_CATALOG[key];
        const clone = original.clone();
        clone.setVolume(cfg.volume * this._sfxVolume * this._masterVolume);
        if (pos && cfg.spatial) clone.setPosition(pos);
        clone.play();
        // Auto-nettoyage après lecture
        clone.onEndedObservable.addOnce(() => clone.dispose());
    }

    // ── Musique ───────────────────────────────────────────────────────────────

    /**
     * Lance une musique avec fondu enchaîné.
     * @param {string} key          Clé dans MUSIC_CATALOG
     * @param {number} [fadeMs=1500]  Durée du crossfade en ms
     */
    playMusic(key, fadeMs = 1500) {
        if (!this._loaded) return;
        if (this._currentMusicKey === key) return; // déjà en cours

        const next = this._music.get(key);
        if (!next) { console.warn(`[SoundManager] Musique inconnue : "${key}"`); return; }

        const cfg        = SoundManager.MUSIC_CATALOG[key];
        const targetVol  = cfg.volume * this._musicVolume * this._masterVolume;
        const prev       = this._currentMusic;

        // Fade out de l'ancienne musique
        if (prev && prev.isPlaying) {
            this._fadeTo(prev, 0, fadeMs, () => prev.stop());
        }

        // Fade in de la nouvelle
        next.setVolume(0);
        next.play();
        this._fadeTo(next, targetVol, fadeMs);

        this._currentMusic    = next;
        this._currentMusicKey = key;
    }

    stopMusic(fadeMs = 1000) {
        if (!this._currentMusic) return;
        this._fadeTo(this._currentMusic, 0, fadeMs, () => {
            this._currentMusic?.stop();
            this._currentMusic    = null;
            this._currentMusicKey = null;
        });
    }

    // ── Volume ────────────────────────────────────────────────────────────────

    setMasterVolume(v) {
        this._masterVolume = Math.max(0, Math.min(1, v));
        this._refreshAllVolumes();
    }

    setSfxVolume(v) {
        this._sfxVolume = Math.max(0, Math.min(1, v));
        this._refreshSfxVolumes();
    }

    setMusicVolume(v) {
        this._musicVolume = Math.max(0, Math.min(1, v));
        this._refreshMusicVolumes();
    }

    getMasterVolume() { return this._masterVolume; }
    getSfxVolume()    { return this._sfxVolume; }
    getMusicVolume()  { return this._musicVolume; }

    _refreshAllVolumes() {
        this._refreshSfxVolumes();
        this._refreshMusicVolumes();
    }

    _refreshSfxVolumes() {
        this._sfx.forEach((sound, key) => {
            const cfg = SoundManager.SFX_CATALOG[key];
            if (cfg) sound.setVolume(cfg.volume * this._sfxVolume * this._masterVolume);
        });
    }

    _refreshMusicVolumes() {
        // Ne touche qu'à la musique actuellement jouée pour ne pas casser les fades
        if (this._currentMusic && this._currentMusicKey) {
            const cfg = SoundManager.MUSIC_CATALOG[this._currentMusicKey];
            if (cfg) this._currentMusic.setVolume(cfg.volume * this._musicVolume * this._masterVolume);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Fade linéaire vers un volume cible.
     * @param {BABYLON.Sound} sound
     * @param {number} targetVol
     * @param {number} durationMs
     * @param {Function} [onDone]
     */
    _fadeTo(sound, targetVol, durationMs, onDone = null) {
        const steps     = 30;
        const interval  = durationMs / steps;
        const startVol  = sound.getVolume();
        const delta     = (targetVol - startVol) / steps;
        let   step      = 0;

        const id = setInterval(() => {
            step++;
            const newVol = Math.max(0, Math.min(1, startVol + delta * step));
            sound.setVolume(newVol);
            if (step >= steps) {
                clearInterval(id);
                sound.setVolume(targetVol);
                onDone?.();
            }
        }, interval);
    }

    // ── Branchements pratiques ────────────────────────────────────────────────
    // Méthodes appelées directement par les autres systèmes

    /** Appelé par PlayerShoot.fireBasicDagger() */
    onShoot()               { this.play("shoot"); }

    /** Appelé par WeaponManager quand une arme secondaire tire */
    onShootSecondary()      { this.play("shoot_secondary"); }

    /** Appelé par Projectile.onHit() sur un mur/sol */
    onImpactWall()          { this.play("impact_wall"); }

    /** Appelé par PlayerShoot quand les munitions sont vides */
    onNoAmmo()              { this.play("no_ammo"); }

    /** Appelé par Ammo au début d'un rechargement */
    onReload()              { this.play("reload"); }

    /** Appelé par Health.takeDamage() sur le joueur */
    onPlayerHurt()          { this.play("player_hurt"); }

    /** Appelé par Player._onDeath() */
    onPlayerDeath()         { this.play("player_death"); this.stopMusic(500); }

    /** Appelé par EnemyParticles.death() ou BaseEnemy à la mort */
    onEnemyDeath(pos)       { this.playPoly("enemy_death", pos); }

    /** Appelé par EnemyParticles.spawnWarning() */
    onEnemySpawn(pos)       { this.playPoly("enemy_spawn", pos); }

    /** Appelé par BaseEnemy._takeDamage() */
    onEnemyHit(pos)         { this.playPoly("enemy_hit", pos); }

    /** Appelé par BossEnemy.takeDamage() */
    onBossHit()             { this.play("boss_hit"); }

    /** Appelé par BossEnemy._die() / onDeath */
    onBossDeath()           { this.play("boss_death"); }

    /** Appelé par BossEnemy._enterTransition() à chaque changement de phase */
    onBossPhase()           { this.play("boss_phase"); }

    /** Appelé par WaveManager._startBossRoom() */
    onBossAppear()          { this.play("boss_appear"); }

    /** Appelé par WaveManager._openDoors() */
    onDoorOpen()            { this.play("door_open"); }

    /** Appelé par WaveManager._spawnDoors() */
    onDoorClose()           { this.play("door_close"); }

    /** Appelé par WaveManager quand toutes les vagues sont terminées */
    onRoomClear()           { this.play("room_clear"); }

    /** Appelé par WaveManager._launchNextWave() */
    onWaveStart()           { this.play("wave_start"); }

    /** Appelé par UpgradeManager.applyUpgrade() */
    onUpgradePick()         { this.play("upgrade_pick"); }

    /** Appelé par WeaponManager quand le joueur ramasse une arme */
    onWeaponPickup()        { this.play("weapon_pickup"); }

    /** Appelé par Projectile.onHit() sur un weakpoint */
    onWeakpointKill()       { this.play("weakpoint_kill"); }

    /** Appelé par Player._jump() */
    onJump()                { this.play("jump"); }

    /** Appelé par Player quand il atterrit */
    onLand()                { this.play("land"); }

    /** Appelé par Player._tryDash() */
    onDash()                { this.play("dash"); }

    /** Appelé par Player._tryBlink() */
    onBlink()               { this.play("blink"); }

    /** Appelé par Player._tryShield() */
    onShieldOn()            { this.play("shield_on"); }
    onShieldOff()           { this.play("shield_off"); }

    /** Appelé par Player._tryEMP() */
    onEMP()                 { this.play("emp"); }

    /** Hover sur un bouton de menu */
    onUiHover()             { this.play("ui_hover"); }

    /** Clic sur un bouton de menu */
    onUiClick()             { this.play("ui_click"); }

    /** Retour dans un menu */
    onUiBack()              { this.play("ui_back"); }

    /** Confirmation (ex: démarrer le jeu) */
    onUiConfirm()           { this.play("ui_confirm"); }

    /** Musique selon le contexte de combat */
    onCombatStart(bossLevel = 0) {
        if (bossLevel === 3)     this.playMusic("boss3");
        else if (bossLevel === 2) this.playMusic("boss2");
        else if (bossLevel === 1) this.playMusic("boss");
        else                      this.playMusic("combat");
    }

    onCombatEnd()           { this.playMusic("ambient"); }

    onGameOver()            {
        this.stopMusic(400);
        setTimeout(() => {
            this.play("game_over");
            this.playMusic("game_over", 800);
        }, 500);
    }

    onVictory()             {
        this.stopMusic(400);
        setTimeout(() => {
            this.play("victory");
            this.playMusic("victory", 800);
        }, 500);
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    dispose() {
        this._sfx.forEach(s => s.dispose());
        this._music.forEach(s => s.dispose());
        this._sfx.clear();
        this._music.clear();
        this._currentMusic    = null;
        this._currentMusicKey = null;
    }
}