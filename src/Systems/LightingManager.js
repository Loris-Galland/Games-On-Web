import * as BABYLON from "@babylonjs/core";

/**
 * LightingManager
 * ---------------
 * Gère l'ambiance lumineuse cyber + toute la pipeline graphique.
 *
 * API publique :
 *   lm.setGraphicsParam(key, value)
 *   lm.getGraphicsParams()
 *   lm.applyGraphicsPreset(name)   "ultra" | "high" | "medium" | "low"
 *   lm.getCurrentPreset()
 */
export class LightingManager {

    static ROOM_PALETTES = {
        blue:   { key: [0.1, 0.5, 1.0],  fill: [0.05, 0.1, 0.4],  accent: [0.0, 0.8, 1.0]  },
        green:  { key: [0.1, 0.9, 0.3],  fill: [0.05, 0.3, 0.1],  accent: [0.4, 1.0, 0.2]  },
        grey:   { key: [0.7, 0.8, 1.0],  fill: [0.15, 0.15, 0.2], accent: [0.5, 0.7, 1.0]  },
        orange: { key: [1.0, 0.5, 0.05], fill: [0.3, 0.1, 0.0],   accent: [1.0, 0.8, 0.0]  },
        red:    { key: [1.0, 0.1, 0.1],  fill: [0.3, 0.0, 0.0],   accent: [1.0, 0.3, 0.0]  },
    };

    // ── Presets ───────────────────────────────────────────────────────────────
    // ULTRA : effets visibles mais dosés — pas de surcharge
    // HIGH  : preset par défaut, bonne lisibilité
    // MEDIUM: léger, performant
    // LOW   : pipeline quasi nue
    static PRESETS = {
        ultra: {
            bloomEnabled: true,  bloomThreshold: 0.5, bloomWeight: 0.35, bloomKernel: 48, bloomScale: 0.4,
            vignetteEnabled: true,  vignetteWeight: 2.2,
            contrast: 1.12, exposure: 1.08,
            chromaticAberrationEnabled: true,  chromaticAberrationAmount: 4,
            fxaaEnabled: true,
            depthOfFieldEnabled: true,  depthOfFieldFocalLength: 200, depthOfFieldFStop: 10.0, depthOfFieldFocusDistance: 3000,
            grainEnabled: true,  grainAnimated: true,  grainIntensity: 8,
            toneMappingEnabled: true,  toneMappingType: 1,
            sharpenEnabled: false,  sharpenEdgeAmount: 0.45, sharpenColorAmount: 0,
        },
        high: {
            bloomEnabled: true,  bloomThreshold: 0.55, bloomWeight: 0.35, bloomKernel: 32, bloomScale: 0.35,
            vignetteEnabled: true,  vignetteWeight: 2.0,
            contrast: 1.1, exposure: 1.05,
            chromaticAberrationEnabled: true,  chromaticAberrationAmount: 3,
            fxaaEnabled: true,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 2.8, depthOfFieldFocusDistance: 2500,
            grainEnabled: false, grainAnimated: true,  grainIntensity: 6,
            toneMappingEnabled: false, toneMappingType: 1,
            sharpenEnabled: false, sharpenEdgeAmount: 0.3, sharpenColorAmount: 0,
        },
        medium: {
            bloomEnabled: true,  bloomThreshold: 0.65, bloomWeight: 0.25, bloomKernel: 16, bloomScale: 0.3,
            vignetteEnabled: true,  vignetteWeight: 1.6,
            contrast: 1.05, exposure: 1.0,
            chromaticAberrationEnabled: false, chromaticAberrationAmount: 3,
            fxaaEnabled: true,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 3.5, depthOfFieldFocusDistance: 2500,
            grainEnabled: false, grainAnimated: false, grainIntensity: 5,
            toneMappingEnabled: false, toneMappingType: 0,
            sharpenEnabled: false, sharpenEdgeAmount: 0.2, sharpenColorAmount: 0,
        },
        low: {
            bloomEnabled: false, bloomThreshold: 0.7, bloomWeight: 0.2, bloomKernel: 8, bloomScale: 0.2,
            vignetteEnabled: false, vignetteWeight: 1.2,
            contrast: 1.0, exposure: 1.0,
            chromaticAberrationEnabled: false, chromaticAberrationAmount: 2,
            fxaaEnabled: false,
            depthOfFieldEnabled: false, depthOfFieldFocalLength: 150, depthOfFieldFStop: 4.0, depthOfFieldFocusDistance: 2000,
            grainEnabled: false, grainAnimated: false, grainIntensity: 4,
            toneMappingEnabled: false, toneMappingType: 0,
            sharpenEnabled: false, sharpenEdgeAmount: 0.1, sharpenColorAmount: 0,
        },
    };

    constructor(scene, engine) {
        this.scene  = scene;
        this.engine = engine;

        this.ambient      = null;
        this._roomLights  = [];
        this._combatLight = null;
        this._combatMode  = false;
        this._combatT     = 0;
        this._flickerT    = 0;
        this._flickerIdx  = 0;
        this._pulseT      = 0;
        this._currentRoom = null;
        this._pipeline    = null;

        this._params        = { ...LightingManager.PRESETS.low };
        this._currentPreset = "low";
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    init() {
        this._createAmbient();
        this._createCombatLight();
        this._createPostProcess();
    }

    _createAmbient() {
        const old = this.scene.getLightByName("light");
        if (old) old.dispose();

        // Ambiance globale rehaussée — les grandes salles (16×16) en ont besoin
        this.ambient = new BABYLON.HemisphericLight("ambientCyber", new BABYLON.Vector3(0, 1, 0), this.scene);
        this.ambient.intensity   = 0.55;   // ↑ était 0.18 — les coins éloignés restaient noirs
        this.ambient.diffuse     = new BABYLON.Color3(0.5, 0.55, 0.65);
        this.ambient.groundColor = new BABYLON.Color3(0.15, 0.15, 0.22);
        this.ambient.specular    = new BABYLON.Color3(0, 0, 0);
    }

    _createCombatLight() {
        this._combatLight = new BABYLON.PointLight("combatLight", new BABYLON.Vector3(0, 2.5, 0), this.scene);
        this._combatLight.diffuse   = new BABYLON.Color3(1, 0.05, 0.05);
        this._combatLight.intensity = 0;
        this._combatLight.range     = 80;
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

    // ── API Graphiques ────────────────────────────────────────────────────────

    getGraphicsParams() { return { ...this._params }; }

    setGraphicsParam(key, value) {
        this._params[key] = value;
        this._currentPreset = "custom";
        if (this._pipeline) this._applyParam(key, value);
    }

    applyGraphicsPreset(name) {
        const preset = LightingManager.PRESETS[name];
        if (!preset) return;
        this._params = { ...preset };
        this._currentPreset = name;
        if (this._pipeline) this._applyAllParams();
    }

    getCurrentPreset() { return this._currentPreset; }

    // ── Application pipeline ──────────────────────────────────────────────────

    _applyAllParams() {
        const p  = this._params;
        const pl = this._pipeline;
        if (!pl) return;

        pl.bloomEnabled   = p.bloomEnabled;
        pl.bloomThreshold = p.bloomThreshold;
        pl.bloomWeight    = p.bloomWeight;
        pl.bloomKernel    = p.bloomKernel;
        pl.bloomScale     = p.bloomScale;

        pl.imageProcessingEnabled = true;
        pl.imageProcessing.vignetteEnabled    = p.vignetteEnabled;
        pl.imageProcessing.vignetteWeight     = p.vignetteWeight;
        pl.imageProcessing.vignetteCameraFov  = 0.5;
        pl.imageProcessing.vignetteColor      = new BABYLON.Color4(0, 0.02, 0.08, 0);
        pl.imageProcessing.vignetteBlendMode  = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
        pl.imageProcessing.toneMappingEnabled = p.toneMappingEnabled;
        pl.imageProcessing.toneMappingType    = p.toneMappingType;
        pl.imageProcessing.contrast           = p.contrast;
        pl.imageProcessing.exposure           = p.exposure;

        pl.fxaaEnabled = p.fxaaEnabled;

        pl.chromaticAberrationEnabled = p.chromaticAberrationEnabled;
        if (pl.chromaticAberration) pl.chromaticAberration.aberrationAmount = p.chromaticAberrationAmount;

        pl.depthOfFieldEnabled = p.depthOfFieldEnabled;
        if (pl.depthOfField) {
            pl.depthOfField.focalLength   = p.depthOfFieldFocalLength;
            pl.depthOfField.fStop         = p.depthOfFieldFStop;
            pl.depthOfField.focusDistance = p.depthOfFieldFocusDistance;
        }

        pl.grainEnabled = p.grainEnabled;
        if (pl.grain) { pl.grain.animated = p.grainAnimated; pl.grain.intensity = p.grainIntensity; }

        pl.sharpenEnabled = p.sharpenEnabled;
        if (pl.sharpen) { pl.sharpen.edgeAmount = p.sharpenEdgeAmount; pl.sharpen.colorAmount = p.sharpenColorAmount; }
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
            case "contrast":        pl.imageProcessing.contrast  = value; break;
            case "exposure":        pl.imageProcessing.exposure  = value; break;
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
            case "grainAnimated":  if (pl.grain) pl.grain.animated   = value; break;
            case "grainIntensity": if (pl.grain) pl.grain.intensity  = value; break;
            case "sharpenEnabled": pl.sharpenEnabled = value; break;
            case "sharpenEdgeAmount":  if (pl.sharpen) pl.sharpen.edgeAmount  = value; break;
            case "sharpenColorAmount": if (pl.sharpen) pl.sharpen.colorAmount = value; break;
        }
    }

    // ── Salles ────────────────────────────────────────────────────────────────

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
        const ceilY   = 3.0;

        // Les grandes salles (16×16) ont un spread plus grand → on augmente range et intensity en conséquence
        const spread   = Math.min(room.cols, room.rows) * T * 0.28;
        // Facteur d'échelle : une salle 16×16 = 4× la surface d'une 8×8
        const sizeFactor = Math.sqrt((room.cols * room.rows) / 64);

        const keyColor    = new BABYLON.Color3(...palette.key);
        const fillColor   = new BABYLON.Color3(...palette.fill);
        const accentColor = new BABYLON.Color3(...palette.accent);

        // 4 lumières en croix au plafond, intensité scalée avec la taille de la salle
        const baseIntensities = [2.2, 2.0, 1.6, 1.6];
        const offsets = [
            { x:  spread, z:  spread, color: keyColor  },
            { x: -spread, z: -spread, color: keyColor  },
            { x:  spread, z: -spread, color: fillColor },
            { x: -spread, z:  spread, color: fillColor },
        ];

        for (let i = 0; i < offsets.length; i++) {
            const o     = offsets[i];
            const base  = baseIntensities[i] * sizeFactor;
            const range = spread * 3.2 * sizeFactor;
            const light = new BABYLON.PointLight(`roomLight_${i}`, new BABYLON.Vector3(cx + o.x, ceilY, cz + o.z), this.scene);
            light.diffuse        = o.color;
            light.specular       = accentColor.scale(0.2);
            light.intensity      = base;
            light.range          = range;
            light._baseIntensity = base;
            this._roomLights.push(light);
        }

        // Lumière centrale basse (accent coloré au sol)
        const centerBase  = 0.8 * sizeFactor;
        const centerLight = new BABYLON.PointLight("roomLightCenter", new BABYLON.Vector3(cx, 0.8, cz), this.scene);
        centerLight.diffuse        = accentColor;
        centerLight.specular       = new BABYLON.Color3(0, 0, 0);
        centerLight.intensity      = centerBase;
        centerLight.range          = spread * 2.5 * sizeFactor;
        centerLight._baseIntensity = centerBase;
        this._roomLights.push(centerLight);

        if (this._combatLight) this._combatLight.position = new BABYLON.Vector3(cx, 2.5, cz);
        this._flickerIdx = Math.floor(Math.random() * (this._roomLights.length - 1));
    }

    // ── Combat ────────────────────────────────────────────────────────────────

    setCombatMode(active) {
        this._combatMode = active;
        if (!active && this._combatLight) this._combatLight.intensity = 0;
    }

    // ── Update ────────────────────────────────────────────────────────────────

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
                const flicker = 1 + Math.sin(this._flickerT * 23.7) * 0.06
                    + Math.sin(this._flickerT * 41.1) * 0.04
                    + (Math.random() < 0.01 ? -0.18 : 0);
                light.intensity = light._baseIntensity * Math.max(0.6, flicker);
            } else {
                const pulse = 1 + Math.sin(this._pulseT * 0.8 + i * 1.2) * 0.08;
                light.intensity = light._baseIntensity * pulse;
            }
        }
    }

    _animateCombat(dt) {
        if (!this._combatLight) return;
        if (this._combatMode) {
            this._combatT += dt;
            const p = (Math.sin(this._combatT * 5.5) + 1) * 0.5;
            this._combatLight.intensity = 0.5 + p * 0.8;
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