import * as BABYLON from "@babylonjs/core";

/**
 * WorldBuilder — Module de génération de monde pour Babylon.js
 * Permet de créer : reliefs, murs, plateformes, rampes, escaliers, tunnels, etc.
 */
export class WorldBuilder {
    /**
     * @param {BABYLON.Scene} scene
     * @param {object} options
     * @param {boolean} options.collisions - Activer les collisions par défaut (true)
     * @param {BABYLON.Color3} options.defaultColor - Couleur par défaut
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.collisions = options.collisions ?? true;
        this.defaultColor = options.defaultColor ?? new BABYLON.Color3(0.5, 0.5, 0.5);
        this._meshes = [];
    }

    // ─────────────────────────────────────────────
    // Utilitaires internes
    // ─────────────────────────────────────────────

    _applyMaterial(mesh, color) {
        const mat = new BABYLON.StandardMaterial(mesh.name + "_mat", this.scene);
        mat.diffuseColor = color ?? this.defaultColor;
        mesh.material = mat;
        return mat;
    }

    _register(mesh) {
        if (this.collisions) mesh.checkCollisions = true;
        mesh.receiveShadows = true;
        this._meshes.push(mesh);
        return mesh;
    }

    /** Retourne tous les meshes créés */
    getMeshes() {
        return this._meshes;
    }

    /** Supprime tous les meshes créés */
    clear() {
        this._meshes.forEach(m => m.dispose());
        this._meshes = [];
    }
    // ─────────────────────────────────────────────
    // ASSETS
    // ─────────────────────────────────────────────

    async loadAsset(name, opts = {}) {
        const {
            folder,
            file,
            position = BABYLON.Vector3.Zero(),
            rotation = BABYLON.Vector3.Zero(),
            scaling  = new BABYLON.Vector3(1, 1, 1),
            collisions = this.collisions,
        } = opts;

        const result = await BABYLON.SceneLoader.ImportMeshAsync("", folder, file, this.scene);

        const root = result.meshes[0];
        root.name     = name;
        root.position = position.clone();
        root.rotation = rotation.clone();
        root.scaling  = scaling.clone();

        result.meshes.forEach(mesh => {
            if (collisions) mesh.checkCollisions = true;
            this._meshes.push(mesh);
        });

        return result.meshes;
    }

    // ─────────────────────────────────────────────
    // SOL & TERRAIN
    // ─────────────────────────────────────────────

    /**
     * Crée un sol plat
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.height
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createGround(name, opts = {}) {
        const {
            width = 50,
            height = 50,
            position = BABYLON.Vector3.Zero(),
            color,
        } = opts;

        const ground = BABYLON.MeshBuilder.CreateGround(name, { width, height, subdivisions: 2 }, this.scene);
        ground.position = position.clone();
        this._applyMaterial(ground, color);
        return this._register(ground);
    }

    /**
     * Crée un terrain avec heightmap (image N&B)
     * @param {string} name
     * @param {object} opts
     * @param {string} opts.heightMapUrl - URL de la heightmap (image N&B)
     * @param {number} opts.width
     * @param {number} opts.height
     * @param {number} opts.maxHeight - Hauteur maximale du relief
     * @param {number} opts.subdivisions - Qualité du maillage
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createHeightMapTerrain(name, opts = {}) {
        const {
            heightMapUrl,
            width = 100,
            height = 100,
            maxHeight = 10,
            subdivisions = 100,
            position = BABYLON.Vector3.Zero(),
            color,
        } = opts;

        const ground = BABYLON.MeshBuilder.CreateGroundFromHeightMap(
            name,
            heightMapUrl,
            { width, height, subdivisions, maxHeight, minHeight: 0 },
            this.scene
        );
        ground.position = position.clone();
        this._applyMaterial(ground, color);
        return this._register(ground);
    }

    /**
     * Crée un terrain procédural avec du bruit (sinusoïdal)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.depth
     * @param {number} opts.subdivisions
     * @param {number} opts.maxHeight
     * @param {number} opts.scale - Fréquence des vagues
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createProceduralTerrain(name, opts = {}) {
        const {
            width = 50,
            depth = 50,
            subdivisions = 30,
            maxHeight = 3,
            scale = 0.1,
            position = BABYLON.Vector3.Zero(),
            color,
        } = opts;

        const ground = BABYLON.MeshBuilder.CreateGround(name, {
            width,
            height: depth,
            subdivisions,
            updatable: true,
        }, this.scene);

        // Déplacement procédural des vertices
        const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const z = positions[i + 2];
            positions[i + 1] = (Math.sin(x * scale * Math.PI * 2) * Math.cos(z * scale * Math.PI * 2)) * maxHeight;
        }
        ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        ground.createNormals(true);

        ground.position = position.clone();
        this._applyMaterial(ground, color);
        return this._register(ground);
    }

    // ─────────────────────────────────────────────
    // MURS
    // ─────────────────────────────────────────────

    /**
     * Crée un mur (boîte orientée)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.height
     * @param {number} opts.depth - Épaisseur
     * @param {BABYLON.Vector3} opts.position
     * @param {number} opts.rotationY - Rotation en radians
     * @param {BABYLON.Color3} opts.color
     */
    createWall(name, opts = {}) {
        const {
            width = 10,
            height = 3,
            depth = 0.5,
            position = BABYLON.Vector3.Zero(),
            rotationY = 0,
            color,
        } = opts;

        const wall = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, this.scene);
        wall.position = new BABYLON.Vector3(
            position.x,
            position.y + height / 2,
            position.z
        );
        wall.rotation.y = rotationY;
        this._applyMaterial(wall, color);
        return this._register(wall);
    }

    /**
     * Crée un enclos rectangulaire (4 murs)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width - Largeur de l'enclos
     * @param {number} opts.depth - Profondeur de l'enclos
     * @param {number} opts.wallHeight
     * @param {number} opts.wallThickness
     * @param {BABYLON.Vector3} opts.position - Centre de l'enclos
     * @param {BABYLON.Color3} opts.color
     * @param {boolean} opts.open - Laisser un côté ouvert (entrée)
     */
    createEnclosure(name, opts = {}) {
        const {
            width = 20,
            depth = 20,
            wallHeight = 3,
            wallThickness = 0.5,
            position = BABYLON.Vector3.Zero(),
            color,
            open = false,
        } = opts;

        const meshes = [];
        const half_w = width / 2;
        const half_d = depth / 2;

        const walls = [
            { pos: new BABYLON.Vector3(0, 0, -half_d), w: width, rot: 0 },            // avant
            { pos: new BABYLON.Vector3(0, 0,  half_d), w: width, rot: 0 },            // arrière
            { pos: new BABYLON.Vector3(-half_w, 0, 0), w: depth, rot: Math.PI / 2 },  // gauche
            { pos: new BABYLON.Vector3( half_w, 0, 0), w: depth, rot: Math.PI / 2 },  // droite
        ];

        walls.forEach((w, i) => {
            if (open && i === 0) return; // Laisse le mur avant ouvert
            const wall = this.createWall(`${name}_wall${i}`, {
                width: w.w,
                height: wallHeight,
                depth: wallThickness,
                position: new BABYLON.Vector3(
                    position.x + w.pos.x,
                    position.y,
                    position.z + w.pos.z
                ),
                rotationY: w.rot,
                color,
            });
            meshes.push(wall);
        });

        return meshes;
    }

    // ─────────────────────────────────────────────
    // PLATEFORMES & STRUCTURES
    // ─────────────────────────────────────────────

    /**
     * Crée une plateforme
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.depth
     * @param {number} opts.thickness
     * @param {BABYLON.Vector3} opts.position - Position du dessus de la plateforme
     * @param {BABYLON.Color3} opts.color
     */
    createPlatform(name, opts = {}) {
        const {
            width = 5,
            depth = 5,
            thickness = 0.3,
            position = new BABYLON.Vector3(0, 1, 0),
            color,
        } = opts;

        const platform = BABYLON.MeshBuilder.CreateBox(name, {
            width,
            height: thickness,
            depth,
        }, this.scene);
        platform.position = new BABYLON.Vector3(
            position.x,
            position.y - thickness / 2,
            position.z
        );
        this._applyMaterial(platform, color);
        return this._register(platform);
    }

    /**
     * Crée une série de plateformes flottantes
     * @param {string} name
     * @param {object[]} platforms - Tableau de { position, width, depth, color }
     */
    createPlatformSeries(name, platforms = []) {
        return platforms.map((p, i) =>
            this.createPlatform(`${name}_${i}`, p)
        );
    }

    /**
     * Crée une rampe inclinée
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.length
     * @param {number} opts.height - Dénivelé total
     * @param {BABYLON.Vector3} opts.position - Base de la rampe
     * @param {number} opts.rotationY
     * @param {BABYLON.Color3} opts.color
     */
    createRamp(name, opts = {}) {
        const {
            width = 4,
            length = 8,
            height = 3,
            position = BABYLON.Vector3.Zero(),
            rotationY = 0,
            color,
        } = opts;

        const angle = Math.atan2(height, length);
        const hyp = Math.sqrt(length * length + height * height);

        const ramp = BABYLON.MeshBuilder.CreateBox(name, {
            width,
            height: 0.3,
            depth: hyp,
        }, this.scene);

        ramp.position = new BABYLON.Vector3(
            position.x,
            position.y + height / 2,
            position.z + length / 2
        );
        ramp.rotation.x = -angle;
        ramp.rotation.y = rotationY;
        this._applyMaterial(ramp, color);
        return this._register(ramp);
    }

    /**
     * Crée un escalier
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.steps - Nombre de marches
     * @param {number} opts.stepWidth
     * @param {number} opts.stepHeight
     * @param {number} opts.stepDepth
     * @param {BABYLON.Vector3} opts.position - Base des escaliers
     * @param {number} opts.rotationY
     * @param {BABYLON.Color3} opts.color
     */
    createStairs(name, opts = {}) {
        const {
            steps = 8,
            stepWidth = 3,
            stepHeight = 0.3,
            stepDepth = 0.5,
            position = BABYLON.Vector3.Zero(),
            rotationY = 0,
            color,
        } = opts;

        const meshes = [];
        for (let i = 0; i < steps; i++) {
            const step = BABYLON.MeshBuilder.CreateBox(`${name}_step${i}`, {
                width: stepWidth,
                height: stepHeight * (i + 1),
                depth: stepDepth,
            }, this.scene);

            step.position = new BABYLON.Vector3(
                position.x,
                position.y + (stepHeight * (i + 1)) / 2,
                position.z + stepDepth * i
            );
            // Applique la rotation autour du point de départ
            step.rotation.y = rotationY;

            this._applyMaterial(step, color);
            this._register(step);
            meshes.push(step);
        }
        return meshes;
    }

    // ─────────────────────────────────────────────
    // STRUCTURES COMPLEXES
    // ─────────────────────────────────────────────

    /**
     * Crée un pilier / colonne
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.radius
     * @param {number} opts.height
     * @param {BABYLON.Vector3} opts.position - Base du pilier
     * @param {BABYLON.Color3} opts.color
     */
    createPillar(name, opts = {}) {
        const {
            radius = 0.5,
            height = 5,
            position = BABYLON.Vector3.Zero(),
            color,
        } = opts;

        const pillar = BABYLON.MeshBuilder.CreateCylinder(name, {
            diameter: radius * 2,
            height,
            tessellation: 12,
        }, this.scene);
        pillar.position = new BABYLON.Vector3(
            position.x,
            position.y + height / 2,
            position.z
        );
        this._applyMaterial(pillar, color);
        return this._register(pillar);
    }

    /**
     * Crée un toit / plafond
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.depth
     * @param {number} opts.thickness
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createCeiling(name, opts = {}) {
        return this.createPlatform(name, { ...opts });
    }

    /**
     * Crée une salle fermée (sol + plafond + 4 murs)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.width
     * @param {number} opts.depth
     * @param {number} opts.height
     * @param {BABYLON.Vector3} opts.position - Coin inférieur gauche
     * @param {BABYLON.Color3} opts.wallColor
     * @param {BABYLON.Color3} opts.floorColor
     * @param {boolean} opts.open - Laisser un côté ouvert
     */
    createRoom(name, opts = {}) {
        const {
            width = 15,
            depth = 15,
            height = 4,
            position = BABYLON.Vector3.Zero(),
            wallColor,
            floorColor,
            open = false,
        } = opts;

        const meshes = [];
        const center = new BABYLON.Vector3(
            position.x + width / 2,
            position.y,
            position.z + depth / 2
        );

        // Sol
        meshes.push(this.createGround(`${name}_floor`, {
            width,
            height: depth,
            position: new BABYLON.Vector3(center.x, position.y, center.z),
            color: floorColor,
        }));

        // Plafond
        meshes.push(this.createPlatform(`${name}_ceiling`, {
            width,
            depth,
            thickness: 0.3,
            position: new BABYLON.Vector3(center.x, position.y + height, center.z),
            color: wallColor,
        }));

        // Murs
        const walls = this.createEnclosure(`${name}_walls`, {
            width,
            depth,
            wallHeight: height,
            wallThickness: 0.3,
            position: new BABYLON.Vector3(center.x, position.y, center.z),
            color: wallColor,
            open,
        });
        meshes.push(...walls);

        return meshes;
    }

    /**
     * Crée un tunnel (couloir)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.length
     * @param {number} opts.width
     * @param {number} opts.height
     * @param {BABYLON.Vector3} opts.position
     * @param {number} opts.rotationY
     * @param {BABYLON.Color3} opts.color
     */
    createTunnel(name, opts = {}) {
        const {
            length = 20,
            width = 4,
            height = 3,
            position = BABYLON.Vector3.Zero(),
            rotationY = 0,
            color,
        } = opts;

        const meshes = [];

        // Sol
        meshes.push(this.createGround(`${name}_floor`, {
            width,
            height: length,
            position: new BABYLON.Vector3(position.x, position.y, position.z + length / 2),
            color,
        }));

        // Plafond
        meshes.push(this.createPlatform(`${name}_ceiling`, {
            width,
            depth: length,
            thickness: 0.3,
            position: new BABYLON.Vector3(position.x, position.y + height, position.z + length / 2),
            color,
        }));

        // Mur gauche
        meshes.push(this.createWall(`${name}_wallL`, {
            width: length,
            height,
            depth: 0.3,
            position: new BABYLON.Vector3(position.x - width / 2, position.y, position.z + length / 2),
            rotationY: Math.PI / 2,
            color,
        }));

        // Mur droit
        meshes.push(this.createWall(`${name}_wallR`, {
            width: length,
            height,
            depth: 0.3,
            position: new BABYLON.Vector3(position.x + width / 2, position.y, position.z + length / 2),
            rotationY: Math.PI / 2,
            color,
        }));

        // Applique la rotation Y sur tous les meshes autour de l'origine
        if (rotationY !== 0) {
            meshes.forEach(m => { m.rotation.y = rotationY; });
        }

        return meshes;
    }

    // ─────────────────────────────────────────────
    // DÉCORATIONS / PROPS
    // ─────────────────────────────────────────────

    /**
     * Crée une caisse
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.size
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createCrate(name, opts = {}) {
        const {
            size = 1,
            position = new BABYLON.Vector3(0, 0.5, 0),
            color = new BABYLON.Color3(0.6, 0.4, 0.2),
        } = opts;

        const crate = BABYLON.MeshBuilder.CreateBox(name, { size }, this.scene);
        crate.position = new BABYLON.Vector3(
            position.x,
            position.y + size / 2,
            position.z
        );
        this._applyMaterial(crate, color);
        return this._register(crate);
    }

    /**
     * Crée un rocher (sphère déformée)
     * @param {string} name
     * @param {object} opts
     * @param {number} opts.radius
     * @param {BABYLON.Vector3} opts.position
     * @param {BABYLON.Color3} opts.color
     */
    createRock(name, opts = {}) {
        const {
            radius = 1,
            position = BABYLON.Vector3.Zero(),
            color = new BABYLON.Color3(0.4, 0.4, 0.4),
        } = opts;

        const rock = BABYLON.MeshBuilder.CreateSphere(name, {
            diameter: radius * 2,
            segments: 6,
            updatable: true,
        }, this.scene);

        // Déformation aléatoire des vertices pour un aspect rocheux
        const positions = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            const factor = 0.7 + Math.random() * 0.6;
            positions[i]     *= factor * (0.8 + Math.random() * 0.4);
            positions[i + 1] *= factor * (0.6 + Math.random() * 0.5);
            positions[i + 2] *= factor * (0.8 + Math.random() * 0.4);
        }
        rock.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
        rock.createNormals(true);

        rock.position = new BABYLON.Vector3(
            position.x,
            position.y + radius * 0.5,
            position.z
        );
        this._applyMaterial(rock, color);
        return this._register(rock);
    }

    /**
     * Scattering : Place des objets aléatoirement dans une zone
     * @param {string} name
     * @param {function} factoryFn - Fonction qui prend (name, opts) et retourne un mesh
     * @param {object} opts
     * @param {number} opts.count - Nombre d'objets
     * @param {number} opts.areaX - Demi-largeur de la zone
     * @param {number} opts.areaZ - Demi-profondeur de la zone
     * @param {BABYLON.Vector3} opts.center
     * @param {object} opts.itemOpts - Options passées à factoryFn
     */
    scatter(name, factoryFn, opts = {}) {
        const {
            count = 10,
            areaX = 20,
            areaZ = 20,
            center = BABYLON.Vector3.Zero(),
            itemOpts = {},
        } = opts;

        const meshes = [];
        for (let i = 0; i < count; i++) {
            const pos = new BABYLON.Vector3(
                center.x + (Math.random() - 0.5) * areaX * 2,
                center.y,
                center.z + (Math.random() - 0.5) * areaZ * 2
            );
            const mesh = factoryFn.call(this, `${name}_${i}`, { ...itemOpts, position: pos });
            if (mesh) meshes.push(mesh);
        }
        return meshes;
    }
}