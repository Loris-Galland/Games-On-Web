import * as BABYLON from "@babylonjs/core";

/**
 * LightingManager
 * ---------------
 * Gère l'ambiance lumineuse cyber de chaque salle.
 *
 * - Une lumière hémisphérique globale sombre (base)
 * - 4 PointLights au plafond colorées selon le thème de la salle
 * - Une PointLight centrale "combat" qui pulse rouge quand des vagues sont actives
 * - Un effet de scintillement (flicker) léger sur une lumière aléatoire
 * - Post-processing : Bloom + légère correction colorimétrique cyber
 *
 * Usage :
 *   const lm = new LightingManager(scene, engine);
 *   lm.init();                            // crée lumières + post-process
 *   lm.setRoom(room);                     // reconfigure pour la salle active
 *   lm.setCombatMode(true/false);         // pulse rouge combat
 *   lm.update(dt);                        // à appeler chaque frame
 */
export class LightingManager {

    // Palette cyber par couleur de salle
    static ROOM_PALETTES = {
        blue:   { key: [0.1, 0.5, 1.0],  fill: [0.05, 0.1, 0.4],  accent: [0.0, 0.8, 1.0]  },
        green:  { key: [0.1, 0.9, 0.3],  fill: [0.05, 0.3, 0.1],  accent: [0.4, 1.0, 0.2]  },
        grey:   { key: [0.7, 0.8, 1.0],  fill: [0.15, 0.15, 0.2], accent: [0.5, 0.7, 1.0]  },
        orange: { key: [1.0, 0.5, 0.05], fill: [0.3, 0.1, 0.0],   accent: [1.0, 0.8, 0.0]  },
        red:    { key: [1.0, 0.1, 0.1],  fill: [0.3, 0.0, 0.0],   accent: [1.0, 0.3, 0.0]  },
    };

    constructor(scene, engine) {
        this.scene  = scene;
        this.engine = engine;

        // Lumière ambiante de base (très sombre, sera compensée par les PointLights)
        this.ambient = null;

        // Lumières de salle (recréées à chaque setRoom)
        this._roomLights = [];

        // Lumière de combat
        this._combatLight = null;
        this._combatMode  = false;
        this._combatT     = 0;

        // Timers d'animation
        this._flickerT   = 0;
        this._flickerIdx = 0;
        this._pulseT     = 0;

        // Référence salle courante
        this._currentRoom = null;

        // Post-processing pipeline
        this._pipeline = null;
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    init() {
        this._createAmbient();
        this._createCombatLight();
        this._createPostProcess();
    }

    _createAmbient() {
        // Supprime l'ancienne lumière hémisphérique si elle existe
        const old = this.scene.getLightByName("light");
        if (old) old.dispose();

        // Ambiance de base très sombre — le rendu est assuré par les PointLights
        this.ambient = new BABYLON.HemisphericLight(
            "ambientCyber",
            new BABYLON.Vector3(0, 1, 0),
            this.scene,
        );
        this.ambient.intensity   = 0.18;
        this.ambient.diffuse     = new BABYLON.Color3(0.2, 0.25, 0.35);
        this.ambient.groundColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        this.ambient.specular    = new BABYLON.Color3(0, 0, 0);
    }

    _createCombatLight() {
        this._combatLight = new BABYLON.PointLight(
            "combatLight",
            new BABYLON.Vector3(0, 2.5, 0),
            this.scene,
        );
        this._combatLight.diffuse   = new BABYLON.Color3(1, 0.05, 0.05);
        this._combatLight.intensity = 0;
        this._combatLight.range     = 60;
    }

    _createPostProcess() {
        // DefaultRenderingPipeline : Bloom + légère correction colorimétrique
        // Disponible dans @babylonjs/core sans import supplémentaire
        try {
            this._pipeline = new BABYLON.DefaultRenderingPipeline(
                "cyberPipeline",
                true,          // HDR désactivé pour les perf
                this.scene,
                this.scene.cameras,
            );

            // Bloom subtil — fait ressortir les émissives des murs/props
            this._pipeline.bloomEnabled    = false;
            this._pipeline.bloomThreshold  = 0.55;
            this._pipeline.bloomWeight     = 0.45;
            this._pipeline.bloomKernel     = 32;
            this._pipeline.bloomScale      = 0.4;

            // Légère vignette pour l'immersion
            this._pipeline.imageProcessingEnabled = true;
            this._pipeline.imageProcessing.vignetteEnabled  = true;
            this._pipeline.imageProcessing.vignetteWeight   = 2.5;
            this._pipeline.imageProcessing.vignetteCameraFov = 0.5;
            this._pipeline.imageProcessing.vignetteColor    = new BABYLON.Color4(0, 0.02, 0.08, 0);
            this._pipeline.imageProcessing.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

            // Légère saturation cyber
            this._pipeline.imageProcessing.colorGradingEnabled = false;
            this._pipeline.imageProcessing.contrast    = 1.15;
            this._pipeline.imageProcessing.exposure    = 1.05;

        } catch (e) {
            console.warn("[LightingManager] DefaultRenderingPipeline indisponible :", e.message);
        }
    }

    // ── Configuration par salle ───────────────────────────────────────────────

    /**
     * @param {object} room   objet room { color, worldX, worldZ, cols, rows }
     */
    setRoom(room) {
        this._currentRoom = room;
        this._disposRoomLights();
        this._spawnRoomLights(room);
    }

    _disposRoomLights() {
        for (const l of this._roomLights) {
            try { l.dispose(); } catch (_) {}
        }
        this._roomLights = [];
    }

    _spawnRoomLights(room) {
        const T       = 4;
        const palette = LightingManager.ROOM_PALETTES[room.color] ?? LightingManager.ROOM_PALETTES.grey;
        const cx      = (room.worldX + room.cols / 2) * T;
        const cz      = (room.worldZ + room.rows / 2) * T;
        const ceilY   = 2.8;   // juste sous le plafond (H1=0, murs=3)
        const spread  = Math.min(room.cols, room.rows) * T * 0.3;

        const keyColor    = new BABYLON.Color3(...palette.key);
        const fillColor   = new BABYLON.Color3(...palette.fill);
        const accentColor = new BABYLON.Color3(...palette.accent);

        // ── 4 lumières de plafond en croix ────────────────────────────────────
        const offsets = [
            { x:  spread, z:  spread, color: keyColor,    intensity: 1.4, range: spread * 2.8 },
            { x: -spread, z: -spread, color: keyColor,    intensity: 1.2, range: spread * 2.8 },
            { x:  spread, z: -spread, color: fillColor,   intensity: 0.9, range: spread * 2.5 },
            { x: -spread, z:  spread, color: fillColor,   intensity: 0.9, range: spread * 2.5 },
        ];

        for (let i = 0; i < offsets.length; i++) {
            const o = offsets[i];
            const light = new BABYLON.PointLight(
                `roomLight_${i}`,
                new BABYLON.Vector3(cx + o.x, ceilY, cz + o.z),
                this.scene,
            );
            light.diffuse   = o.color;
            light.specular  = accentColor.scale(0.3);
            light.intensity = o.intensity;
            light.range     = o.range;
            light._baseIntensity = o.intensity;
            this._roomLights.push(light);
        }

        // ── 1 lumière centrale d'accent (bas, couleur accent) ─────────────────
        const centerLight = new BABYLON.PointLight(
            "roomLightCenter",
            new BABYLON.Vector3(cx, 0.8, cz),
            this.scene,
        );
        centerLight.diffuse   = accentColor;
        centerLight.specular  = new BABYLON.Color3(0, 0, 0);
        centerLight.intensity = 0.35;
        centerLight.range     = spread * 2.0;
        centerLight._baseIntensity = 0.35;
        this._roomLights.push(centerLight);

        // Repositionne aussi la lumière de combat au centre de la salle
        if (this._combatLight) {
            this._combatLight.position = new BABYLON.Vector3(cx, 2.5, cz);
        }

        // Choisit une lumière aléatoire pour le flicker
        this._flickerIdx = Math.floor(Math.random() * (this._roomLights.length - 1));
    }

    // ── Mode combat ───────────────────────────────────────────────────────────

    setCombatMode(active) {
        this._combatMode = active;
        if (!active && this._combatLight) {
            this._combatLight.intensity = 0;
        }
    }

    // ── Boucle d'animation ────────────────────────────────────────────────────

    update(dt) {
        this._pulseT   += dt;
        this._flickerT += dt;

        this._animateRoomLights(dt);
        this._animateCombat(dt);
    }

    _animateRoomLights(dt) {
        for (let i = 0; i < this._roomLights.length; i++) {
            const light = this._roomLights[i];
            if (!light || !light._baseIntensity) continue;

            if (i === this._flickerIdx) {
                // Flicker : variation rapide irrégulière
                const flicker = 1 + Math.sin(this._flickerT * 23.7) * 0.08
                    + Math.sin(this._flickerT * 41.1) * 0.05
                    + (Math.random() < 0.015 ? -0.25 : 0); // drop occasionnel
                light.intensity = light._baseIntensity * Math.max(0.5, flicker);
            } else {
                // Pulse doux et lent
                const pulse = 1 + Math.sin(this._pulseT * 0.8 + i * 1.2) * 0.12;
                light.intensity = light._baseIntensity * pulse;
            }
        }
    }

    _animateCombat(dt) {
        if (!this._combatLight) return;
        if (this._combatMode) {
            this._combatT += dt;
            // Pulse rouge rapide et agressif
            const p = (Math.sin(this._combatT * 5.5) + 1) * 0.5;
            this._combatLight.intensity = 0.4 + p * 0.7;
        } else {
            // Extinction progressive
            if (this._combatLight.intensity > 0.01) {
                this._combatLight.intensity *= 0.92;
            } else {
                this._combatLight.intensity = 0;
                this._combatT = 0;
            }
        }
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    dispose() {
        this._disposRoomLights();
        if (this._combatLight) this._combatLight.dispose();
        if (this._pipeline)    this._pipeline.dispose();
        if (this.ambient)      this.ambient.dispose();
    }
}