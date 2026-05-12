/**
 * SoundManager
 * ------------
 * Gère uniquement la musique (ambient + boss) et le volume global.
 * Les SFX sont gérés directement avec new Audio() dans chaque classe.
 *
 * Usage :
 *   const sm = new SoundManager();
 *   sm.playMusic("ambient");
 *   sm.playMusic("boss");
 *   sm.setMasterVolume(0.8);
 */
export class SoundManager {

    constructor() {
        this._currentMusic    = null;
        this._currentMusicKey = null;
        this._masterVolume    = 1.0;
        this._musicVolume     = 0.2;

        // Pistes audio natives
        this._musicTracks = {
            ambient: new Audio("sounds/music/music_ambiant.mp3"),
            boss:    new Audio("sounds/music/music_boss.mp3"),
        };

        Object.values(this._musicTracks).forEach(a => {
            a.loop   = true;
            a.volume = 0;
        });

        // Déblocage autoplay au premier clic/touche
        const unlock = () => {
            Object.values(this._musicTracks).forEach(a => {
                a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
            });
            window.removeEventListener("click",   unlock);
            window.removeEventListener("keydown", unlock);
        };
        window.addEventListener("click",   unlock);
        window.addEventListener("keydown", unlock);
    }

    // ── Init vide (pour ne pas casser l'appel existant dans main.js) ──────────
    async init() {}

    // ── Musique ───────────────────────────────────────────────────────────────

    playMusic(key) {
        if (this._currentMusicKey === key) return;

        // Fade out ancienne piste
        if (this._currentMusic) {
            const old = this._currentMusic;
            this._fadeAudio(old, 0, 1000, () => { old.pause(); old.currentTime = 0; });
        }

        const track = this._musicTracks[key];
        if (!track) { console.warn(`[SoundManager] Musique inconnue : "${key}"`); return; }

        track.currentTime = 0;
        track.play().catch(() => {});
        this._fadeAudio(track, this._musicVolume * this._masterVolume, 1000);

        this._currentMusic    = track;
        this._currentMusicKey = key;
    }

    stopMusic(fadeMs = 1000) {
        if (!this._currentMusic) return;
        const old = this._currentMusic;
        this._fadeAudio(old, 0, fadeMs, () => { old.pause(); old.currentTime = 0; });
        this._currentMusic    = null;
        this._currentMusicKey = null;
    }

    // ── Volume ────────────────────────────────────────────────────────────────

    setMasterVolume(v) {
        this._masterVolume = Math.max(0, Math.min(1, v));
        if (this._currentMusic) {
            this._currentMusic.volume = this._musicVolume * this._masterVolume;
        }
    }

    getMasterVolume() { return this._masterVolume; }

    // ── Fade audio natif ──────────────────────────────────────────────────────

    _fadeAudio(audio, targetVol, durationMs, onDone = null) {
        const steps    = 20;
        const interval = durationMs / steps;
        const startVol = audio.volume;
        const delta    = (targetVol - startVol) / steps;
        let   step     = 0;

        const id = setInterval(() => {
            step++;
            audio.volume = Math.max(0, Math.min(1, startVol + delta * step));
            if (step >= steps) {
                clearInterval(id);
                audio.volume = targetVol;
                onDone?.();
            }
        }, interval);
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    dispose() {
        this.stopMusic(0);
        Object.values(this._musicTracks).forEach(a => { a.pause(); a.src = ""; });
    }
}