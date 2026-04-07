import * as BABYLON from "@babylonjs/core";

/**
 * LightingManager
 * ---------------
 * Gère l'ambiance lumineuse cyber + toute la pipeline graphique.
 *
 * API publique pour les paramètres graphiques :
 *   lm.setGraphicsParam(key, value)   — modifie un paramètre en live
 *   lm.getGraphicsParams()            — retourne tous les paramètres courants
 *   lm.applyGraphicsPreset(name)      — applique un preset (ultra/high/medium/low/custom)
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

    // Presets graphiques
    static PRESETS = {
        ultra: {
            bloomEnabled: true, bloomThreshold: 0.4, bloomWeight: 0.6, bloomKernel: 64, bloomScale: 0.5,
            vignetteEnabled: true, vignetteWeight: 3.0,
            contrast: 1.2, exposure: 1.1,
            chromaticAberrationEnabled: true, chromaticAberrationAmount: 12,
            fxaaEnabled: true,
            depthOfFieldEnabled: true, depthOfFieldFocalLength: 150, depthOfFieldFStop: 1.4, depthOfFieldFocusDistance: 2000,
            grainEnabled: true, grainAnimated: true, grainIntensity: 18,
            toneMappingEnabled: true, toneMappingType: 1,
            sharpenEnabled: true, sharpenEdgeAmount: 0.8, sharpenColorAmount: 0,
        },
        high: {
            bloomEnabled: true, bloomThreshold: 0.5, bloomWeight: 0.45, bloomKernel: 32, bloomScale: 0.4,
            vignetteEnabled: true, vignetteWeight: 2.5,
            contrast: 1.15, exposure: 1.05,
            chromaticAberrationEnabled: true, chromaticAberrationAmount: 6,
            fxaaEnabled: true,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 1.8, depthOfFieldFocusDistance: 2000,
            grainEnabled: false, grainAnimated: true, grainIntensity: 10,
            toneMappingEnabled: false, toneMappingType: 1,
            sharpenEnabled: false, sharpenEdgeAmount: 0.5, sharpenColorAmount: 0,
        },
        medium: {
            bloomEnabled: true, bloomThreshold: 0.6, bloomWeight: 0.3, bloomKernel: 16, bloomScale: 0.3,
            vignetteEnabled: true, vignetteWeight: 2.0,
            contrast: 1.1, exposure: 1.0,
            chromaticAberrationEnabled: false, chromaticAberrationAmount: 4,
            fxaaEnabled: true,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 2.8, depthOfFieldFocusDistance: 2000,
            grainEnabled: false, grainAnimated: false, grainIntensity: 8,
            toneMappingEnabled: false, toneMappingType: 1,
            sharpenEnabled: false, sharpenEdgeAmount: 0.3, sharpenColorAmount: 0,
        },
        low: {
            bloomEnabled: false, bloomThreshold: 0.7, bloomWeight: 0.2, bloomKernel: 8, bloomScale: 0.2,
            vignetteEnabled: false, vignetteWeight: 1.5,
            contrast: 1.0, exposure: 1.0,
            chromaticAberrationEnabled: false, chromaticAberrationAmount: 2,
            fxaaEnabled: false,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 4.0, depthOfFieldFocusDistance: 2000,
            grainEnabled: false, grainAnimated: false, grainIntensity: 5,
            toneMappingEnabled: false, toneMappingType: 0,
            sharpenEnabled: false, sharpenEdgeAmount: 0.2, sharpenColorAmount: 0,
        },
    };

    constructor(scene, engine) {
        this.scene  = scene;
        this.engine = engine;

        this.ambient = null;
        this._roomLights = [];
        this._combatLight = null;
        this._combatMode  = false;
        this._combatT     = 0;
        this._flickerT    = 0;
        this._flickerIdx  = 0;
        this._pulseT      = 0;
        this._currentRoom = null;
        this._pipeline    = null;

        // État courant des paramètres graphiques
        this._params = { ...LightingManager.PRESETS.high };
        this._currentPreset = "high";
    }

    // ── Initialisation ────────────────────────────────────────────────────────

    init() {
        this._createAmbient();
        this._createCombatLight();
        this._createPostProcess();
    }

    _createAmbient() {
        const old = this.scene.getLightByName("light");
        if (old) old.dispose();
        this.ambient = new BABYLON.HemisphericLight("ambientCyber", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.ambient.intensity   = 0.18;
        this.ambient.diffuse     = new BABYLON.Color3(0.2, 0.25, 0.35);
        this.ambient.groundColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        this.ambient.specular    = new BABYLON.Color3(0, 0, 0);
    }

    _createCombatLight() {
        this._combatLight = new BABYLON.PointLight("combatLight", new BABYLON.Vector3(0, 2.5, 0), this.scene);
        this._combatLight.diffuse   = new BABYLON.Color3(1, 0.05, 0.05);
        this._combatLight.intensity = 0;
        this._combatLight.range     = 60;
    }

    _createPostProcess() {
        try {
            this._pipeline = new BABYLON.DefaultRenderingPipeline(
                "cyberPipeline", true, this.scene, this.scene.cameras,
            );
            this._applyAllParams();
        } catch (e) {
            console.warn("[LightingManager] DefaultRenderingPipeline indisponible :", e.message);
        }
    }

    // ── API Paramètres Graphiques ─────────────────────────────────────────────

    /**
     * Retourne une copie des paramètres courants.
     */
    getGraphicsParams() {
        return { ...this._params };
    }

    /**
     * Modifie un paramètre graphique en live.
     * @param {string} key   — clé du paramètre (voir PRESETS)
     * @param {*}      value — valeur
     */
    setGraphicsParam(key, value) {
        this._params[key] = value;
        this._currentPreset = "custom";
        if (this._pipeline) this._applyParam(key, value);
    }

    /**
     * Applique un preset complet.
     * @param {string} name  "ultra" | "high" | "medium" | "low"
     */
    applyGraphicsPreset(name) {
        const preset = LightingManager.PRESETS[name];
        if (!preset) return;
        this._params = { ...preset };
        this._currentPreset = name;
        if (this._pipeline) this._applyAllParams();
    }

    getCurrentPreset() {
        return this._currentPreset;
    }

    // ── Application pipeline ──────────────────────────────────────────────────

    _applyAllParams() {
        const p = this._params;
        const pl = this._pipeline;
        if (!pl) return;

        // Bloom
        pl.bloomEnabled   = p.bloomEnabled;
        pl.bloomThreshold = p.bloomThreshold;
        pl.bloomWeight    = p.bloomWeight;
        pl.bloomKernel    = p.bloomKernel;
        pl.bloomScale     = p.bloomScale;

        // Image processing
        pl.imageProcessingEnabled = true;

        // Vignette
        pl.imageProcessing.vignetteEnabled    = p.vignetteEnabled;
        pl.imageProcessing.vignetteWeight     = p.vignetteWeight;
        pl.imageProcessing.vignetteCameraFov  = 0.5;
        pl.imageProcessing.vignetteColor      = new BABYLON.Color4(0, 0.02, 0.08, 0);
        pl.imageProcessing.vignetteBlendMode  = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;

        // Tone mapping
        pl.imageProcessing.toneMappingEnabled = p.toneMappingEnabled;
        pl.imageProcessing.toneMappingType    = p.toneMappingType;

        // Contraste / Exposition
        pl.imageProcessing.contrast  = p.contrast;
        pl.imageProcessing.exposure  = p.exposure;

        // FXAA
        pl.fxaaEnabled = p.fxaaEnabled;

        // Chromatic Aberration
        pl.chromaticAberrationEnabled = p.chromaticAberrationEnabled;
        if (pl.chromaticAberration) {
            pl.chromaticAberration.aberrationAmount = p.chromaticAberrationAmount;
        }

        // Depth of Field
        pl.depthOfFieldEnabled = p.depthOfFieldEnabled;
        if (pl.depthOfField) {
            pl.depthOfField.focalLength    = p.depthOfFieldFocalLength;
            pl.depthOfField.fStop          = p.depthOfFieldFStop;
            pl.depthOfField.focusDistance  = p.depthOfFieldFocusDistance;
        }

        // Grain
        pl.grainEnabled = p.grainEnabled;
        if (pl.grain) {
            pl.grain.animated  = p.grainAnimated;
            pl.grain.intensity = p.grainIntensity;
        }

        // Sharpen
        pl.sharpenEnabled = p.sharpenEnabled;
        if (pl.sharpen) {
            pl.sharpen.edgeAmount  = p.sharpenEdgeAmount;
            pl.sharpen.colorAmount = p.sharpenColorAmount;
        }
    }

    _applyParam(key, value) {
        const pl = this._pipeline;
        if (!pl) return;
        switch (key) {
            case "bloomEnabled":   pl.bloomEnabled   = value; break;
            case "bloomThreshold": pl.bloomThreshold = value; break;
            case "bloomWeight":    pl.bloomWeight    = value; break;
            case "bloomKernel":    pl.bloomKernel    = value; break;
            case "bloomScale":     pl.bloomScale     = value; break;
            case "vignetteEnabled": pl.imageProcessing.vignetteEnabled = value; break;
            case "vignetteWeight":  pl.imageProcessing.vignetteWeight  = value; break;
            case "contrast":  pl.imageProcessing.contrast  = value; break;
            case "exposure":  pl.imageProcessing.exposure  = value; break;
            case "toneMappingEnabled": pl.imageProcessing.toneMappingEnabled = value; break;
            case "toneMappingType":    pl.imageProcessing.toneMappingType    = value; break;
            case "fxaaEnabled": pl.fxaaEnabled = value; break;
            case "chromaticAberrationEnabled": pl.chromaticAberrationEnabled = value; break;
            case "chromaticAberrationAmount":
                if (pl.chromaticAberration) pl.chromaticAberration.aberrationAmount = value; break;
            case "depthOfFieldEnabled": pl.depthOfFieldEnabled = value; break;
            case "depthOfFieldFocalLength":
                if (pl.depthOfField) pl.depthOfField.focalLength = value; break;
            case "depthOfFieldFStop":
                if (pl.depthOfField) pl.depthOfField.fStop = value; break;
            case "depthOfFieldFocusDistance":
                if (pl.depthOfField) pl.depthOfField.focusDistance = value; break;
            case "grainEnabled": pl.grainEnabled = value; break;
            case "grainAnimated": if (pl.grain) pl.grain.animated   = value; break;
            case "grainIntensity": if (pl.grain) pl.grain.intensity = value; break;
            case "sharpenEnabled": pl.sharpenEnabled = value; break;
            case "sharpenEdgeAmount":  if (pl.sharpen) pl.sharpen.edgeAmount  = value; break;
            case "sharpenColorAmount": if (pl.sharpen) pl.sharpen.colorAmount = value; break;
        }
    }

    // ── Configuration par salle ───────────────────────────────────────────────

    setRoom(room) {
        this._currentRoom = room;
        this._disposRoomLights();
        this._spawnRoomLights(room);
    }

    _disposRoomLights() {
        for (const l of this._roomLights) { try { l.dispose(); } catch (_) {} }
        this._roomLights = [];
    }

    _spawnRoomLights(room) {
        const T       = 4;
        const palette = LightingManager.ROOM_PALETTES[room.color] ?? LightingManager.ROOM_PALETTES.grey;
        const cx      = (room.worldX + room.cols / 2) * T;
        const cz      = (room.worldZ + room.rows / 2) * T;
        const ceilY   = 2.8;
        const spread  = Math.min(room.cols, room.rows) * T * 0.3;

        const keyColor    = new BABYLON.Color3(...palette.key);
        const fillColor   = new BABYLON.Color3(...palette.fill);
        const accentColor = new BABYLON.Color3(...palette.accent);

        const offsets = [
            { x:  spread, z:  spread, color: keyColor,  intensity: 1.4, range: spread * 2.8 },
            { x: -spread, z: -spread, color: keyColor,  intensity: 1.2, range: spread * 2.8 },
            { x:  spread, z: -spread, color: fillColor, intensity: 0.9, range: spread * 2.5 },
            { x: -spread, z:  spread, color: fillColor, intensity: 0.9, range: spread * 2.5 },
        ];

        for (let i = 0; i < offsets.length; i++) {
            const o = offsets[i];
            const light = new BABYLON.PointLight(`roomLight_${i}`, new BABYLON.Vector3(cx + o.x, ceilY, cz + o.z), this.scene);
            light.diffuse   = o.color;
            light.specular  = accentColor.scale(0.3);
            light.intensity = o.intensity;
            light.range     = o.range;
            light._baseIntensity = o.intensity;
            this._roomLights.push(light);
        }

        const centerLight = new BABYLON.PointLight("roomLightCenter", new BABYLON.Vector3(cx, 0.8, cz), this.scene);
        centerLight.diffuse   = accentColor;
        centerLight.specular  = new BABYLON.Color3(0, 0, 0);
        centerLight.intensity = 0.35;
        centerLight.range     = spread * 2.0;
        centerLight._baseIntensity = 0.35;
        this._roomLights.push(centerLight);

        if (this._combatLight) this._combatLight.position = new BABYLON.Vector3(cx, 2.5, cz);
        this._flickerIdx = Math.floor(Math.random() * (this._roomLights.length - 1));
    }

    // ── Mode combat ───────────────────────────────────────────────────────────

    setCombatMode(active) {
        this._combatMode = active;
        if (!active && this._combatLight) this._combatLight.intensity = 0;
    }

    // ── Boucle ────────────────────────────────────────────────────────────────

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
                const flicker = 1 + Math.sin(this._flickerT * 23.7) * 0.08
                    + Math.sin(this._flickerT * 41.1) * 0.05
                    + (Math.random() < 0.015 ? -0.25 : 0);
                light.intensity = light._baseIntensity * Math.max(0.5, flicker);
            } else {
                const pulse = 1 + Math.sin(this._pulseT * 0.8 + i * 1.2) * 0.12;
                light.intensity = light._baseIntensity * pulse;
            }
        }
    }

    _animateCombat(dt) {
        if (!this._combatLight) return;
        if (this._combatMode) {
            this._combatT += dt;
            const p = (Math.sin(this._combatT * 5.5) + 1) * 0.5;
            this._combatLight.intensity = 0.4 + p * 0.7;
        } else {
            if (this._combatLight.intensity > 0.01) this._combatLight.intensity *= 0.92;
            else { this._combatLight.intensity = 0; this._combatT = 0; }
        }
    }

    dispose() {
        this._disposRoomLights();
        if (this._combatLight) this._combatLight.dispose();
        if (this._pipeline)    this._pipeline.dispose();
        if (this.ambient)      this.ambient.dispose();
    }
}