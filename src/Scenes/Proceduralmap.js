import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

// ─────────────────────────────────────────────
//  ASSETS
// ─────────────────────────────────────────────
const ASSETS = {
    floorsByRoom: {
        medbay:    ["Floor_Medbay.glb", "Floor_Medbay_Large.glb"],
        command: ["Floor_Metal_Square.glb", "Floor_Metal_Circles.glb"],
        cafeteria: ["Floor_Tile_Metal.glb"],
        engine:    ["Floor_Metal_Square_Grate.glb"],
        hydro:     ["Hydroponics_Floor.glb"],
        quarters:  ["Floor_Tile_Carpet_Blue.glb"],
        storage:   ["Floor_Metal_Square.glb"],
        spawn:     ["Floor_Metal_Circles.glb"],
        default:   ["Floor_Metal_Square.glb"],
    },
    walls: {
        blue:   "Wall_Blue.glb",
        green:  "Wall_Green.glb",
        grey:   "Wall_Grey.glb",
        orange: "Wall_Orange.glb",
        red:    "Wall_Red.glb",
    },
    wallsWithDoor: {
        blue:   "Wall_With_Door_Blue.glb",
        green:  "Wall_With_Door_Green.glb",
        grey:   "Wall_With_Door_Grey.glb",
        orange: "Wall_With_Door_Orange.glb",
        red:    "Wall_With_Door_Red.glb",
    },
    corridorWall: "Wall_Grey.glb",
    corridorFloor: "Floor_Mid_Path.glb",
    props: {
        command:   ["Command_Console.glb"],
        medbay:    ["Cryo_Tube_ON.glb"],
        hydro:     ["Hydroponic_Bay.glb"],
        cafeteria: ["Cafeteria_Table.glb"],
        engine:    ["Generator.glb"],
        storage:   ["Battery_Grey.glb"],
        quarters:  ["Bunk_Double_Blue.glb"],
        default:   ["End_Table.glb"],
    },
};

// Salles plus grandes : 6×6 à 8×8 tuiles
const ROOM_TYPES = [
    { type: "command",   cols: 8, rows: 8, color: "blue"   },
    { type: "medbay",    cols: 6, rows: 7, color: "green"  },
    { type: "engine",    cols: 7, rows: 6, color: "orange" },
    { type: "cafeteria", cols: 8, rows: 6, color: "grey"   },
    { type: "hydro",     cols: 6, rows: 6, color: "green"  },
    { type: "quarters",  cols: 7, rows: 7, color: "blue"   },
    { type: "storage",   cols: 6, rows: 6, color: "red"    },
];

// Salle de spawn : grande, vide, grise
const SPAWN_ROOM = { type: "spawn", cols: 7, rows: 7, color: "grey" };

// ─────────────────────────────────────────────
//  RNG
// ─────────────────────────────────────────────
function rng(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}
function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

// ─────────────────────────────────────────────
//  CLASSE PRINCIPALE
// ─────────────────────────────────────────────
export class ProceduralMap {
    constructor(scene, options = {}) {
        this.scene     = scene;
        this.seed      = options.seed      ?? Date.now();
        this.roomCount = options.roomCount ?? 6;  // salles hors spawn
        this.tileSize  = options.tileSize  ?? 4;
        this.assetBase = options.assetBase ?? "assets/";
        this.rand      = rng(this.seed);
        this._cache    = new Map();
        this._root     = new BABYLON.TransformNode("ProceduralMap", scene);
        this.rooms     = [];   // liste ordonnée : [spawn, room1, room2, ...]
        this.corridors = [];   // liste ordonnée : [{from, to, exitSide, entryX, entryZ, corridorTiles[]}]
        this.spawnPoint = BABYLON.Vector3.Zero();
    }

    async generate() {
        this._buildChain();
        await this._buildGeometry();
        const r0 = this.rooms[0];
        const T  = this.tileSize;
        this.spawnPoint = new BABYLON.Vector3(
            (r0.worldX + r0.cols / 2) * T,
            0,
            (r0.worldZ + r0.rows / 2) * T,
        );
        return this;
    }

    getMeshes() { return this._root.getChildMeshes(); }

    // ─────────────────────────────────────────────
    //  LAYOUT : chaîne linéaire
    //  Chaque salle a 1 entrée (côté vers la précédente) et 1 sortie (côté vers la suivante)
    // ─────────────────────────────────────────────
    _buildChain() {
        const GAP = 3; // tuiles de couloir entre chaque salle

        // 1. Salle de spawn
        const spawn = { ...SPAWN_ROOM, worldX: 0, worldZ: 0, isSpawn: true };
        this.rooms.push(spawn);

        // 2. Salles suivantes, placées en chaîne
        // On alterne les directions : Est, Sud, Est, Sud... pour que la map ne parte pas en ligne droite
        const directions = [
            { side: 1, dx: 1, dz: 0 },  // Est
            { side: 2, dx: 0, dz: 1 },  // Sud
            { side: 1, dx: 1, dz: 0 },  // Est
            { side: 0, dx: 0, dz: -1 }, // Nord
            { side: 1, dx: 1, dz: 0 },  // Est
            { side: 2, dx: 0, dz: 1 },  // Sud
        ];

        for (let i = 0; i < this.roomCount; i++) {
            const prev = this.rooms[this.rooms.length - 1];
            const dir  = directions[i % directions.length];
            const tpl  = ROOM_TYPES[i % ROOM_TYPES.length];

            // Position de la nouvelle salle : après le couloir
            let worldX, worldZ;
            if (dir.dx === 1) {
                // vers l'Est : nouvelle salle à droite de prev + GAP
                worldX = prev.worldX + prev.cols + GAP;
                worldZ = prev.worldZ + Math.floor((prev.rows - tpl.rows) / 2); // centré verticalement
            } else if (dir.dx === -1) {
                worldX = prev.worldX - tpl.cols - GAP;
                worldZ = prev.worldZ + Math.floor((prev.rows - tpl.rows) / 2);
            } else if (dir.dz === 1) {
                // vers le Sud
                worldX = prev.worldX + Math.floor((prev.cols - tpl.cols) / 2); // centré horizontalement
                worldZ = prev.worldZ + prev.rows + GAP;
            } else {
                worldX = prev.worldX + Math.floor((prev.cols - tpl.cols) / 2);
                worldZ = prev.worldZ - tpl.rows - GAP;
            }

            const room = { ...tpl, worldX, worldZ, isSpawn: false };
            this.rooms.push(room);

            // Calcul du couloir entre prev et room
            this.corridors.push(this._calcCorridor(prev, room, dir.side));
        }
    }

    // Calcule les tuiles de couloir entre deux salles
    // exitSide : côté de sortie de `from` (0=Nord, 1=Est, 2=Sud, 3=Ouest)
    _calcCorridor(from, to, exitSide) {
        const tiles = []; // {x, z} en coordonnées de tuiles

        // Point de sortie de `from` (centre du mur de sortie)
        let sx, sz, tx, tz;

        if (exitSide === 1) { // Est
            sx = from.worldX + from.cols;
            sz = from.worldZ + Math.floor(from.rows / 2);
            tx = to.worldX;
            tz = to.worldZ + Math.floor(to.rows / 2);
        } else if (exitSide === 3) { // Ouest
            sx = from.worldX - 1;
            sz = from.worldZ + Math.floor(from.rows / 2);
            tx = to.worldX + to.cols - 1;
            tz = to.worldZ + Math.floor(to.rows / 2);
        } else if (exitSide === 2) { // Sud
            sx = from.worldX + Math.floor(from.cols / 2);
            sz = from.worldZ + from.rows;
            tx = to.worldX + Math.floor(to.cols / 2);
            tz = to.worldZ;
        } else { // Nord
            sx = from.worldX + Math.floor(from.cols / 2);
            sz = from.worldZ - 1;
            tx = to.worldX + Math.floor(to.cols / 2);
            tz = to.worldZ + to.rows - 1;
        }

        // Tracé en L : d'abord axe principal, puis ajustement latéral
        let cx = sx, cz = sz;
        const stepX = tx > cx ? 1 : tx < cx ? -1 : 0;
        const stepZ = tz > cz ? 1 : tz < cz ? -1 : 0;

        // Segment principal
        while (cx !== tx) { tiles.push({ x: cx, z: cz }); cx += stepX; }
        while (cz !== tz) { tiles.push({ x: cx, z: cz }); cz += stepZ; }

        return {
            from, to,
            exitSide,
            // Quelle tuile du mur de `from` est la sortie
            exitTileX: sx - (exitSide === 1 ? 0 : 0),
            exitTileZ: sz,
            // Quelle tuile du mur de `to` est l'entrée
            entryTileX: tx,
            entryTileZ: tz,
            tiles,
        };
    }

    // ─────────────────────────────────────────────
    //  CONSTRUCTION GÉOMÉTRIE
    // ─────────────────────────────────────────────
    async _buildGeometry() {
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            const corridorIn  = i > 0 ? this.corridors[i - 1] : null;
            const corridorOut = i < this.corridors.length ? this.corridors[i] : null;
            await this._buildRoom(room, corridorIn, corridorOut);
        }
        for (const corridor of this.corridors) {
            await this._buildCorridor(corridor);
        }
    }

    async _buildRoom(room, corridorIn, corridorOut) {
        const T  = this.tileSize;
        const ox = room.worldX * T;
        const oz = room.worldZ * T;

        const floorAssets = ASSETS.floorsByRoom[room.type] ?? ASSETS.floorsByRoom.default;
        const wallAsset   = ASSETS.walls[room.color]        ?? ASSETS.walls.grey;
        const doorAsset   = ASSETS.wallsWithDoor[room.color] ?? ASSETS.wallsWithDoor.grey;
        const propAssets  = ASSETS.props[room.type]          ?? ASSETS.props.default;

        // Déterminer les murs qui ont une porte
        // entrée = côté opposé à la sortie du couloir entrant
        // sortie = côté du couloir sortant
        const openings = new Set(); // "N", "S", "E", "W" + position en tuiles

        // Porte d'entrée (couloir précédent arrive sur ce mur)
        if (corridorIn) {
            const lastTile = corridorIn.tiles[corridorIn.tiles.length - 1];
            if (lastTile) {
                const side = this._detectRoomSide(room, lastTile);
                if (side) openings.add(side);
            }
        }
        // Porte de sortie (couloir suivant part de ce mur)
        if (corridorOut) {
            const firstTile = corridorOut.tiles[0];
            if (firstTile) {
                const side = this._detectRoomSide(room, firstTile);
                if (side) openings.add(side);
            }
        }

        const ps = [];

        // ── SOL ──
        for (let tx = 0; tx < room.cols; tx++)
            for (let tz = 0; tz < room.rows; tz++)
                ps.push(this._place(pick(floorAssets, this.rand),
                    new BABYLON.Vector3(ox + tx * T + T / 2, 0, oz + tz * T + T / 2)));

        // ── MURS ──
        // Nord (Z = worldZ) → rotation PI
        for (let tx = 0; tx < room.cols; tx++) {
            const tileX = room.worldX + tx;
            const isDoor = openings.has("N") &&
                (corridorIn  && this._isCorrTileOnWall(corridorIn.tiles,  tileX, room.worldZ - 1, "N") ||
                    corridorOut && this._isCorrTileOnWall(corridorOut.tiles, tileX, room.worldZ - 1, "N"));
            ps.push(this._place(isDoor ? doorAsset : wallAsset,
                new BABYLON.Vector3(ox + tx * T + T / 2, 0, oz),
                new BABYLON.Vector3(0, Math.PI, 0)));
        }
        // Sud (Z = worldZ + rows)
        for (let tx = 0; tx < room.cols; tx++) {
            const tileX = room.worldX + tx;
            const isDoor = openings.has("S") &&
                (corridorIn  && this._isCorrTileOnWall(corridorIn.tiles,  tileX, room.worldZ + room.rows, "S") ||
                    corridorOut && this._isCorrTileOnWall(corridorOut.tiles, tileX, room.worldZ + room.rows, "S"));
            ps.push(this._place(isDoor ? doorAsset : wallAsset,
                new BABYLON.Vector3(ox + tx * T + T / 2, 0, oz + room.rows * T)));
        }
        // Ouest (X = worldX)
        for (let tz = 0; tz < room.rows; tz++) {
            const tileZ = room.worldZ + tz;
            const isDoor = openings.has("W") &&
                (corridorIn  && this._isCorrTileOnWall(corridorIn.tiles,  room.worldX - 1, tileZ, "W") ||
                    corridorOut && this._isCorrTileOnWall(corridorOut.tiles, room.worldX - 1, tileZ, "W"));
            ps.push(this._place(isDoor ? doorAsset : wallAsset,
                new BABYLON.Vector3(ox, 0, oz + tz * T + T / 2),
                new BABYLON.Vector3(0, -Math.PI / 2, 0)));
        }
        // Est (X = worldX + cols)
        for (let tz = 0; tz < room.rows; tz++) {
            const tileZ = room.worldZ + tz;
            const isDoor = openings.has("E") &&
                (corridorIn  && this._isCorrTileOnWall(corridorIn.tiles,  room.worldX + room.cols, tileZ, "E") ||
                    corridorOut && this._isCorrTileOnWall(corridorOut.tiles, room.worldX + room.cols, tileZ, "E"));
            ps.push(this._place(isDoor ? doorAsset : wallAsset,
                new BABYLON.Vector3(ox + room.cols * T, 0, oz + tz * T + T / 2),
                new BABYLON.Vector3(0, Math.PI / 2, 0)));
        }

        // ── PROP ── (seulement si pas spawn)
        if (!room.isSpawn) {
            ps.push(this._place(
                pick(propAssets, this.rand),
                new BABYLON.Vector3(ox + (room.cols / 2) * T, 0, oz + (room.rows / 2) * T),
            ));
        }

        await Promise.all(ps);
    }

    // Détecte sur quel côté de la salle se trouve une tuile adjacente
    _detectRoomSide(room, tile) {
        if (tile.z === room.worldZ - 1 && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "N";
        if (tile.z === room.worldZ + room.rows && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "S";
        if (tile.x === room.worldX - 1 && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "W";
        if (tile.x === room.worldX + room.cols && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "E";
        return null;
    }

    // Vérifie si une tuile du couloir est adjacente à ce mur précis
    _isCorrTileOnWall(tiles, wallX, wallZ, side) {
        return tiles.some(t => {
            if (side === "N" || side === "S") return t.x === wallX && t.z === wallZ;
            return t.z === wallZ && t.x === wallX;
        });
    }

    // ─────────────────────────────────────────────
    //  COULOIR avec murs latéraux
    // ─────────────────────────────────────────────
    async _buildCorridor(corridor) {
        const T  = this.tileSize;
        const ps = [];
        const tileSet = new Set(corridor.tiles.map(t => `${t.x},${t.z}`));

        // Détermine si le couloir est plutôt horizontal ou vertical
        const isHorizontal = corridor.tiles.length > 1 &&
            Math.abs(corridor.tiles[0].x - corridor.tiles[corridor.tiles.length - 1].x) >=
            Math.abs(corridor.tiles[0].z - corridor.tiles[corridor.tiles.length - 1].z);

        for (const tile of corridor.tiles) {
            const wx = tile.x * T;
            const wz = tile.z * T;

            // Sol du couloir
            ps.push(this._place(ASSETS.corridorFloor,
                new BABYLON.Vector3(wx + T / 2, 0, wz + T / 2)));

            // Murs latéraux : on place un mur de chaque côté perpendiculaire à la direction
            // Pour un couloir horizontal (déplacement en X) → murs au Nord et Sud
            // Pour un couloir vertical (déplacement en Z) → murs à l'Est et Ouest

            const prevTile = corridor.tiles[corridor.tiles.indexOf(tile) - 1];
            const nextTile = corridor.tiles[corridor.tiles.indexOf(tile) + 1];
            const goingX   = (nextTile || prevTile) && ((nextTile?.x ?? prevTile?.x) !== tile.x);
            const goingZ   = (nextTile || prevTile) && ((nextTile?.z ?? prevTile?.z) !== tile.z);

            if (goingX || (!goingX && !goingZ)) {
                // Couloir horizontal → murs Nord (Z-) et Sud (Z+)
                // Mur Nord : seulement si la tuile au Nord n'est PAS une autre tuile de couloir
                if (!tileSet.has(`${tile.x},${tile.z - 1}`)) {
                    ps.push(this._place(ASSETS.corridorWall,
                        new BABYLON.Vector3(wx + T / 2, 0, wz),
                        new BABYLON.Vector3(0, Math.PI, 0)));
                }
                // Mur Sud
                if (!tileSet.has(`${tile.x},${tile.z + 1}`)) {
                    ps.push(this._place(ASSETS.corridorWall,
                        new BABYLON.Vector3(wx + T / 2, 0, wz + T)));
                }
            }
            if (goingZ) {
                // Couloir vertical → murs Ouest (X-) et Est (X+)
                if (!tileSet.has(`${tile.x - 1},${tile.z}`)) {
                    ps.push(this._place(ASSETS.corridorWall,
                        new BABYLON.Vector3(wx, 0, wz + T / 2),
                        new BABYLON.Vector3(0, -Math.PI / 2, 0)));
                }
                if (!tileSet.has(`${tile.x + 1},${tile.z}`)) {
                    ps.push(this._place(ASSETS.corridorWall,
                        new BABYLON.Vector3(wx + T, 0, wz + T / 2),
                        new BABYLON.Vector3(0, Math.PI / 2, 0)));
                }
            }
        }

        await Promise.all(ps);
    }

    // ─────────────────────────────────────────────
    //  PLACEMENT D'UN ASSET
    // ─────────────────────────────────────────────
    async _place(filename, position, rotation = BABYLON.Vector3.Zero()) {
        try {
            const container = await this._load(filename);
            const entries   = container.instantiateModelsToScene(
                () => `${filename}_${Math.random().toString(36).slice(2)}`,
                false,
                { doNotInstantiate: false },
            );
            const root = entries.rootNodes[0];
            if (!root) return;

            root.position = position;
            root.rotation = rotation;
            root.parent   = this._root;

            root.computeWorldMatrix(true);

            const isFloor = filename.includes("Floor") || filename.includes("Hazard") ||
                filename.includes("Hydro") || filename.includes("Path");
            const isWall  = filename.includes("Wall") || filename.includes("Corridor") ||
                filename.includes("Ramp") || filename.includes("Boundary");
            const hasColl = isFloor || isWall;

            root.getChildMeshes().forEach(m => {
                m.computeWorldMatrix(true);
                m.refreshBoundingInfo();
                m.checkCollisions = true;
                if (hasColl) m.freezeWorldMatrix();
            });
        } catch (e) {
            console.warn(`[ProceduralMap] ${filename}`, e.message);
        }
    }

    _load(filename) {
        if (this._cache.has(filename)) return this._cache.get(filename);
        const p = BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetBase, filename, this.scene);
        this._cache.set(filename, p);
        return p;
    }
}