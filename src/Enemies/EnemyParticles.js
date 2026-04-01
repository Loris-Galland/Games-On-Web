import * as BABYLON from "@babylonjs/core";

/**
 * EnemyParticles
 * --------------
 * Effets de particules pour les ennemis et les projectiles.
 *
 * EnemyParticles.spawnWarning(scene, position, color, delay)
 * EnemyParticles.death(scene, position, color)
 * EnemyParticles.muzzleFlash(scene, weaponMesh, camera)
 * EnemyParticles.projectileImpact(scene, position)
 * EnemyParticles.colorForType(type)
 */
export class EnemyParticles {

    // ─────────────────────────────────────────────────────────────────────────
    // SPAWN WARNING
    // Pilier lumineux + anneau au sol + flash à l'apparition
    // ─────────────────────────────────────────────────────────────────────────
    static spawnWarning(scene, position, color, delay = 1800) {
        const emitter = BABYLON.MeshBuilder.CreateBox("_spawnEmitter", { size: 0.01 }, scene);
        emitter.position   = position.clone();
        emitter.position.y = 0.05;
        emitter.isVisible  = false;
        emitter.isPickable = false;

        // Texture partagée
        const tex = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

        // ── 1. Anneau au sol : particules qui s'étalent horizontalement ──────
        const ring = new BABYLON.ParticleSystem("spawnRing", 40, scene);
        ring.particleTexture = tex;
        ring.emitter         = emitter;
        ring.minEmitBox      = new BABYLON.Vector3(-0.1, 0, -0.1);
        ring.maxEmitBox      = new BABYLON.Vector3( 0.1, 0,  0.1);

        ring.color1    = new BABYLON.Color4(1, 1, 1, 1);
        ring.color2    = new BABYLON.Color4(color.r, color.g, color.b, 0.9);
        ring.colorDead = new BABYLON.Color4(color.r, color.g, color.b, 0);

        ring.minSize     = 0.25;
        ring.maxSize     = 0.55;
        ring.minLifeTime = 0.4;
        ring.maxLifeTime = 0.7;
        ring.emitRate    = 35;
        ring.blendMode   = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Direction horizontale : XZ seulement, très peu de Y
        ring.direction1   = new BABYLON.Vector3(-2.5, 0.1, -2.5);
        ring.direction2   = new BABYLON.Vector3( 2.5, 0.5,  2.5);
        ring.minEmitPower = 1.5;
        ring.maxEmitPower = 3.5;
        ring.gravity      = new BABYLON.Vector3(0, -1, 0);
        ring.updateSpeed  = 0.02;
        ring.start();

        // ── 2. Pilier vertical : colonnes de particules montantes ────────────
        const pillar = new BABYLON.ParticleSystem("spawnPillar", 50, scene);
        pillar.particleTexture = tex;
        pillar.emitter         = emitter;
        pillar.minEmitBox      = new BABYLON.Vector3(-0.3, 0, -0.3);
        pillar.maxEmitBox      = new BABYLON.Vector3( 0.3, 0,  0.3);

        pillar.color1    = new BABYLON.Color4(color.r, color.g, color.b, 1);
        pillar.color2    = new BABYLON.Color4(1, 1, 1, 0.8);
        pillar.colorDead = new BABYLON.Color4(color.r * 0.4, color.g * 0.4, color.b * 0.4, 0);

        pillar.minSize     = 0.18;
        pillar.maxSize     = 0.4;
        pillar.minLifeTime = 0.6;
        pillar.maxLifeTime = 1.1;
        pillar.emitRate    = 40;
        pillar.blendMode   = BABYLON.ParticleSystem.BLENDMODE_ADD;

        pillar.direction1   = new BABYLON.Vector3(-0.4, 3.5, -0.4);
        pillar.direction2   = new BABYLON.Vector3( 0.4, 6.0,  0.4);
        pillar.minEmitPower = 1;
        pillar.maxEmitPower = 2;
        pillar.gravity      = new BABYLON.Vector3(0, -2, 0);
        pillar.updateSpeed  = 0.02;
        pillar.start();

        // ── 3. Flash d'apparition (burst unique) ─────────────────────────────
        setTimeout(() => {
            const flash = new BABYLON.ParticleSystem("spawnFlash", 50, scene);
            flash.particleTexture  = tex;
            flash.emitter          = emitter;
            flash.minEmitBox       = new BABYLON.Vector3(-0.8, 0, -0.8);
            flash.maxEmitBox       = new BABYLON.Vector3( 0.8, 0.2,  0.8);

            flash.color1    = new BABYLON.Color4(1, 1, 1, 1);
            flash.color2    = new BABYLON.Color4(color.r, color.g, color.b, 1);
            flash.colorDead = new BABYLON.Color4(color.r, color.g, color.b, 0);

            flash.minSize          = 0.25;
            flash.maxSize          = 0.65;
            flash.minLifeTime      = 0.15;
            flash.maxLifeTime      = 0.35;
            flash.emitRate         = 0;
            flash.manualEmitCount  = 50;   // burst unique
            flash.blendMode        = BABYLON.ParticleSystem.BLENDMODE_ADD;

            flash.direction1   = new BABYLON.Vector3(-4, 1, -4);
            flash.direction2   = new BABYLON.Vector3( 4, 4,  4);
            flash.minEmitPower = 3;
            flash.maxEmitPower = 8;
            flash.gravity      = new BABYLON.Vector3(0, -4, 0);
            flash.updateSpeed  = 0.025;
            flash.start();

            // Arrêt du pilier + anneau, nettoyage total
            ring.stop();
            pillar.stop();

            setTimeout(() => {
                flash.stop();
                setTimeout(() => {
                    ring.dispose();
                    pillar.dispose();
                    flash.dispose();
                    emitter.dispose();
                }, 600);
            }, 350);

        }, delay);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEATH — explosion radiale, pas de particules qui montent
    // ─────────────────────────────────────────────────────────────────────────
    static death(scene, position, color) {
        const emitter = BABYLON.MeshBuilder.CreateBox("_deathEmitter", { size: 0.01 }, scene);
        emitter.position   = position.clone();
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const tex = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

        // ── Burst principal : explosion radiale au sol ────────────────────────
        const burst = new BABYLON.ParticleSystem("deathBurst", 60, scene);
        burst.particleTexture = tex;
        burst.emitter         = emitter;
        burst.minEmitBox      = new BABYLON.Vector3(-0.3, -0.1, -0.3);
        burst.maxEmitBox      = new BABYLON.Vector3( 0.3,  0.3,  0.3);

        burst.color1    = new BABYLON.Color4(1, 1, 1, 1);
        burst.color2    = new BABYLON.Color4(color.r, color.g, color.b, 0.9);
        burst.colorDead = new BABYLON.Color4(color.r * 0.2, color.g * 0.2, color.b * 0.2, 0);

        burst.minSize          = 0.15;
        burst.maxSize          = 0.45;
        burst.minLifeTime      = 0.25;
        burst.maxLifeTime      = 0.55;
        burst.emitRate         = 0;
        burst.manualEmitCount  = 60;
        burst.blendMode        = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Direction horizontale dominante — peu de Y, fort XZ
        burst.direction1   = new BABYLON.Vector3(-5, -0.5, -5);
        burst.direction2   = new BABYLON.Vector3( 5,  1.5,  5);
        burst.minEmitPower = 4;
        burst.maxEmitPower = 10;
        // Gravité légère pour que les particules retombent
        burst.gravity      = new BABYLON.Vector3(0, -8, 0);
        burst.updateSpeed  = 0.025;
        burst.start();

        // ── Éclats secondaires : quelques débris qui rebondissent bas ─────────
        const debris = new BABYLON.ParticleSystem("deathDebris", 20, scene);
        debris.particleTexture = tex;
        debris.emitter         = emitter;
        debris.minEmitBox      = new BABYLON.Vector3(-0.1, 0, -0.1);
        debris.maxEmitBox      = new BABYLON.Vector3( 0.1, 0.1,  0.1);

        debris.color1    = new BABYLON.Color4(1, 0.8, 0.3, 1);
        debris.color2    = new BABYLON.Color4(color.r, color.g, color.b, 0.7);
        debris.colorDead = new BABYLON.Color4(0, 0, 0, 0);

        debris.minSize         = 0.06;
        debris.maxSize         = 0.18;
        debris.minLifeTime     = 0.4;
        debris.maxLifeTime     = 0.8;
        debris.emitRate        = 0;
        debris.manualEmitCount = 20;
        debris.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;

        debris.direction1   = new BABYLON.Vector3(-3, 0.5, -3);
        debris.direction2   = new BABYLON.Vector3( 3, 2.5,  3);
        debris.minEmitPower = 2;
        debris.maxEmitPower = 6;
        debris.gravity      = new BABYLON.Vector3(0, -12, 0);
        debris.updateSpeed  = 0.02;
        debris.start();

        // Auto-nettoyage
        setTimeout(() => {
            burst.stop();
            debris.stop();
            setTimeout(() => {
                burst.dispose();
                debris.dispose();
                tex.dispose();
                emitter.dispose();
            }, 900);
        }, 80);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MUZZLE FLASH — flash court à la bouche du gun
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @param {BABYLON.Scene}        scene
     * @param {BABYLON.AbstractMesh} weaponMesh  le mesh "weapon" parented à la caméra
     */
    static muzzleFlash(scene, weaponMesh) {
        if (!weaponMesh) return;

        // Emetteur attaché au weapon mesh, décalé vers l'avant (bout du gun)
        const emitter = BABYLON.MeshBuilder.CreateBox("_muzzleEmitter", { size: 0.01 }, scene);
        emitter.parent    = weaponMesh;
        emitter.position  = new BABYLON.Vector3(0, 0, 0.35);   // bout du gun
        emitter.isVisible = false;
        emitter.isPickable = false;
        emitter.layerMask  = 0x10000000;   // même layer que le weapon

        const tex = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

        const ps = new BABYLON.ParticleSystem("muzzleFlash", 20, scene);
        ps.particleTexture = tex;
        ps.emitter         = emitter;
        ps.minEmitBox      = BABYLON.Vector3.Zero();
        ps.maxEmitBox      = BABYLON.Vector3.Zero();

        ps.color1    = new BABYLON.Color4(1, 1, 0.6, 1);
        ps.color2    = new BABYLON.Color4(0, 1, 1, 0.8);
        ps.colorDead = new BABYLON.Color4(0, 0.8, 0.8, 0);

        ps.minSize         = 0.04;
        ps.maxSize         = 0.12;
        ps.minLifeTime     = 0.04;
        ps.maxLifeTime     = 0.10;
        ps.emitRate        = 0;
        ps.manualEmitCount = 18;
        ps.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Direction vers l'avant local du weapon (Z+), légère dispersion
        ps.direction1   = new BABYLON.Vector3(-0.8, -0.8, 2);
        ps.direction2   = new BABYLON.Vector3( 0.8,  0.8, 5);
        ps.minEmitPower = 2;
        ps.maxEmitPower = 5;
        ps.updateSpeed  = 0.03;
        ps.layerMask    = 0x10000000;

        ps.start();

        // Très court — désattacher et détruire vite
        setTimeout(() => {
            ps.stop();
            emitter.parent = null;
            setTimeout(() => {
                ps.dispose();
                tex.dispose();
                emitter.dispose();
            }, 200);
        }, 80);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PROJECTILE IMPACT — petit splash sur surface non-ennemie
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * @param {BABYLON.Scene}   scene
     * @param {BABYLON.Vector3} position    point d'impact
     * @param {BABYLON.Vector3} normal      normale de surface (pour orienter l'éclat)
     */
    static projectileImpact(scene, position, normal = BABYLON.Vector3.Up()) {
        const emitter = BABYLON.MeshBuilder.CreateBox("_impactEmitter", { size: 0.01 }, scene);
        emitter.position   = position.clone();
        emitter.isVisible  = false;
        emitter.isPickable = false;

        const tex = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);

        const ps = new BABYLON.ParticleSystem("impactSplash", 25, scene);
        ps.particleTexture = tex;
        ps.emitter         = emitter;
        ps.minEmitBox      = new BABYLON.Vector3(-0.05, 0, -0.05);
        ps.maxEmitBox      = new BABYLON.Vector3( 0.05, 0,  0.05);

        ps.color1    = new BABYLON.Color4(0, 1, 1, 1);       // cyan (couleur du dagger)
        ps.color2    = new BABYLON.Color4(0, 0.6, 1, 0.7);
        ps.colorDead = new BABYLON.Color4(0, 0.3, 0.5, 0);

        ps.minSize         = 0.04;
        ps.maxSize         = 0.14;
        ps.minLifeTime     = 0.12;
        ps.maxLifeTime     = 0.28;
        ps.emitRate        = 0;
        ps.manualEmitCount = 25;
        ps.blendMode       = BABYLON.ParticleSystem.BLENDMODE_ADD;

        // Éclat qui suit la normale de la surface, légère dispersion latérale
        const n = normal.normalize();
        ps.direction1   = new BABYLON.Vector3(n.x - 1.5, n.y * 2 + 0.5, n.z - 1.5);
        ps.direction2   = new BABYLON.Vector3(n.x + 1.5, n.y * 4 + 1.5, n.z + 1.5);
        ps.minEmitPower = 1.5;
        ps.maxEmitPower = 4;
        ps.gravity      = new BABYLON.Vector3(0, -6, 0);
        ps.updateSpeed  = 0.025;

        ps.start();

        setTimeout(() => {
            ps.stop();
            setTimeout(() => {
                ps.dispose();
                tex.dispose();
                emitter.dispose();
            }, 400);
        }, 60);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Couleur par type
    // ─────────────────────────────────────────────────────────────────────────
    static colorForType(type) {
        switch (type) {
            case "heavy":   return new BABYLON.Color3(1, 0.45, 0);
            case "scout":   return new BABYLON.Color3(0, 0.95, 1);
            case "standard":
            default:        return new BABYLON.Color3(1, 0.1, 0.1);
        }
    }
}