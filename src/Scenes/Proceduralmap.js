import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import {
    T, H1, H2,
    SPAWN_ROOM, CORRIDOR_LEN, QUAD_NAMES,
    FLOOR_BY_COLOR, WALL, RAMP,
    ROOM_TYPES, QUAD_PATTERNS, LAYOUTS,
} from "./ProceduralMapData";

// ── Utilitaires ───────────────────────────────────────────────────────────────

function rng(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function pick(arr, rand) {
    return arr[Math.floor(rand() * arr.length)];
}

function resolveRot(rot, rand) {
    if (Array.isArray(rot)) return rot[Math.floor(rand() * rot.length)];
    if (rot !== undefined)  return rot;
    return Math.floor(rand() * 4) * (Math.PI / 2);
}

// Retourne l'origine (worldX, worldZ en tuiles) et la taille (cols, rows) d'un quadrant
// dans l'espace global de la salle.
function quadBounds(room, quad) {
    const hC = Math.floor(room.cols / 2);
    const hR = Math.floor(room.rows / 2);
    const oX = (quad === "NE" || quad === "SE") ? room.worldX + hC : room.worldX;
    const oZ = (quad === "SW" || quad === "SE") ? room.worldZ + hR : room.worldZ;
    return { oX, oZ, cols: hC, rows: hR };
}

// ── Classe principale ─────────────────────────────────────────────────────────

export class ProceduralMap {
    constructor(scene, options = {}) {
        this.scene     = scene;
        this.seed      = options.seed      ?? Date.now();
        this.roomCount = options.roomCount ?? 6;
        this.assetBase = options.assetBase ?? "assets/";
        this.rand      = rng(this.seed);
        this._cache    = new Map();
        this._root     = new BABYLON.TransformNode("ProceduralMap", scene);

        this.rooms     = [];
        this.corridors = [];
        this.spawnPoint = BABYLON.Vector3.Zero();

        this._activeNode     = null;
        this._corridorNode   = null;
        this._corridorInNode = null;
        this._activeIdx      = -1;
        this._loading        = false;
        this._camera         = null;
        this._onRoomReady    = null;
        this._builtRooms     = new Map();
        this._lastTransition = 0;
        this._cooldownMs     = 1500;
        this._lastTriggerKey = null;
    }

    // ── API publique ──────────────────────────────────────────────────────────

    async generate() {
        this._buildChain();
        const r0 = this.rooms[0];
        this.spawnPoint = new BABYLON.Vector3(
            (r0.worldX + r0.cols / 2) * T, 0, (r0.worldZ + r0.rows / 2) * T,
        );
        await this._activateRoom(0);
        return this;
    }

    attachCamera(camera) {
        this._camera = camera;
        this._setupTriggerLoop();
    }

    // ── Construction de la chaîne de salles ───────────────────────────────────

    _buildChain() {
        this.rooms.push({ ...SPAWN_ROOM, worldX: 0, worldZ: 0, isSpawn: true });
        const dirs = [
            { side: 1, dx: 1,  dz: 0  },
            { side: 2, dx: 0,  dz: 1  },
            { side: 1, dx: 1,  dz: 0  },
            { side: 0, dx: 0,  dz: -1 },
            { side: 1, dx: 1,  dz: 0  },
            { side: 2, dx: 0,  dz: 1  },
        ];
        for (let i = 0; i < this.roomCount; i++) {
            const prev = this.rooms[this.rooms.length - 1];
            const dir  = dirs[i % dirs.length];
            const tpl  = ROOM_TYPES[i % ROOM_TYPES.length];
            let wx, wz;
            if      (dir.dx ===  1) { wx = prev.worldX + prev.cols + CORRIDOR_LEN; wz = prev.worldZ + Math.floor((prev.rows - tpl.rows) / 2); }
            else if (dir.dx === -1) { wx = prev.worldX - tpl.cols  - CORRIDOR_LEN; wz = prev.worldZ + Math.floor((prev.rows - tpl.rows) / 2); }
            else if (dir.dz ===  1) { wx = prev.worldX + Math.floor((prev.cols - tpl.cols) / 2); wz = prev.worldZ + prev.rows + CORRIDOR_LEN; }
            else                    { wx = prev.worldX + Math.floor((prev.cols - tpl.cols) / 2); wz = prev.worldZ - tpl.rows - CORRIDOR_LEN;  }
            this.rooms.push({ ...tpl, worldX: wx, worldZ: wz, isSpawn: false });
            this.corridors.push(this._calcCorridor(prev, this.rooms[this.rooms.length - 1], dir.side));
        }
    }

    _calcCorridor(from, to, exitSide) {
        const tiles = [];
        let sx, sz, tx, tz;
        if      (exitSide === 1) { sx = from.worldX + from.cols; sz = from.worldZ + Math.floor(from.rows / 2); tx = to.worldX - 1;           tz = to.worldZ + Math.floor(to.rows / 2); }
        else if (exitSide === 3) { sx = from.worldX - 1;         sz = from.worldZ + Math.floor(from.rows / 2); tx = to.worldX + to.cols;      tz = to.worldZ + Math.floor(to.rows / 2); }
        else if (exitSide === 2) { sx = from.worldX + Math.floor(from.cols / 2); sz = from.worldZ + from.rows; tx = to.worldX + Math.floor(to.cols / 2); tz = to.worldZ - 1;           }
        else                     { sx = from.worldX + Math.floor(from.cols / 2); sz = from.worldZ - 1;         tx = to.worldX + Math.floor(to.cols / 2); tz = to.worldZ + to.rows;      }
        let cx = sx, cz = sz;
        const sX = tx > cx ? 1 : tx < cx ? -1 : 0;
        const sZ = tz > cz ? 1 : tz < cz ? -1 : 0;
        while (cx !== tx + sX) { tiles.push({ x: cx, z: cz }); cx += sX; }
        while (cz !== tz + sZ) { tiles.push({ x: cx, z: cz }); cz += sZ; }
        return { from, to, exitSide, tiles };
    }

    // ── Activation d'une salle ────────────────────────────────────────────────

    async _activateRoom(idx, comingFromIdx = null) {
        if (this._loading || idx === this._activeIdx) return;
        this._loading = true;

        const room = this.rooms[idx];
        const cIn  = idx > 0                     ? this.corridors[idx - 1] : null;
        const cOut = idx < this.corridors.length  ? this.corridors[idx]    : null;

        let roomNode;
        if (this._builtRooms.has(idx)) {
            roomNode = this._builtRooms.get(idx);
        } else {
            roomNode = new BABYLON.TransformNode(`room_${idx}`, this.scene);
            roomNode.parent = this._root;
            await this._buildRoom(room, cIn, cOut, roomNode);
            this._builtRooms.set(idx, roomNode);
        }

        if (this._activeNode && this._activeNode !== roomNode) this._activeNode.setEnabled(false);
        roomNode.setEnabled(true);
        this._activeNode = roomNode;
        this._activeIdx  = idx;

        await this._buildCorridorDisplay(idx);
        await this._buildCorridorInDisplay(idx);

        const comingBack = comingFromIdx !== null && comingFromIdx > idx;
        const spawnEntry = this._calcEntrySpawn(room, cIn);
        const spawnExit  = this._calcExitSpawn(room, cOut);
        const spawnPos   = comingBack ? spawnExit : spawnEntry;

        if (this._onRoomReady) {
            await new Promise(resolve => setTimeout(resolve, 50));
            this._onRoomReady(room, idx, spawnPos, { spawnEntry, spawnExit, comingBack });
        }

        this._lastTriggerKey = null;
        this._lastTransition = performance.now();
        this._loading = false;
    }

    // ── Couloirs ──────────────────────────────────────────────────────────────

    async _buildCorridorDisplay(roomIdx) {
        if (this._corridorNode) {
            this._corridorNode.getChildMeshes().forEach(m => m.dispose());
            this._corridorNode.dispose();
            this._corridorNode = null;
        }
        if (roomIdx >= this.corridors.length) return;
        const corridor = this.corridors[roomIdx];
        const node = new BABYLON.TransformNode(`corrOut_${roomIdx}`, this.scene);
        node.parent = this._root;
        this._corridorNode = node;
        await this._buildCorridorGeometry(corridor.tiles, node, roomIdx, false);
    }

    async _buildCorridorInDisplay(roomIdx) {
        if (this._corridorInNode) {
            this._corridorInNode.getChildMeshes().forEach(m => m.dispose());
            this._corridorInNode.dispose();
            this._corridorInNode = null;
        }
        if (roomIdx === 0) return;
        const corridor = this.corridors[roomIdx - 1];
        const node = new BABYLON.TransformNode(`corrIn_${roomIdx}`, this.scene);
        node.parent = this._root;
        this._corridorInNode = node;
        const tilesRev = [...corridor.tiles].reverse();
        await this._buildCorridorGeometry(tilesRev, node, roomIdx, true);
    }

    async _buildCorridorGeometry(tiles, node, roomIdx, isReturn) {
        const tileSet = new Set(tiles.map(t => `${t.x},${t.z}`));
        const ps = [];
        const darkMat = new BABYLON.StandardMaterial(`cMat_${roomIdx}_${isReturn}`, this.scene);
        darkMat.diffuseColor  = new BABYLON.Color3(0.08, 0.08, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.05);

        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i], wx = tile.x * T, wz = tile.z * T;
            const prev = tiles[i - 1], next = tiles[i + 1];
            const gX = next ? next.x !== tile.x : prev ? prev.x !== tile.x : false;
            const gZ = next ? next.z !== tile.z : prev ? prev.z !== tile.z : false;
            const prog = i / tiles.length;

            const fb = BABYLON.MeshBuilder.CreateBox(`cf_${i}_${roomIdx}_${isReturn}`, { width: T, height: 0.1, depth: T }, this.scene);
            fb.position = new BABYLON.Vector3(wx + T / 2, -0.05, wz + T / 2);
            fb.material = darkMat; fb.checkCollisions = false; fb.isPickable = false; fb.parent = node;
            this._mkCol(`cF_${i}_${roomIdx}_${isReturn}`, wx + T / 2, -0.1, wz + T / 2, T, 0.2, T, node);
            //this._mkCol(`cC_${i}_${roomIdx}_${isReturn}`, wx + T / 2, 3.1, wz + T / 2, T, 0.2, T, node);

            if (gX) {
                if (!tileSet.has(`${tile.x},${tile.z - 1}`)) { ps.push(this._vis("Wall_Grey.glb", new BABYLON.Vector3(wx + T / 2, 0, wz),     new BABYLON.Vector3(0, Math.PI, 0), node)); this._mkCol(`cWN_${i}_${roomIdx}_${isReturn}`, wx + T / 2, 1.5, wz,     T, 3, 0.3, node); }
                if (!tileSet.has(`${tile.x},${tile.z + 1}`)) { ps.push(this._vis("Wall_Grey.glb", new BABYLON.Vector3(wx + T / 2, 0, wz + T), BABYLON.Vector3.Zero(),             node)); this._mkCol(`cWS_${i}_${roomIdx}_${isReturn}`, wx + T / 2, 1.5, wz + T, T, 3, 0.3, node); }
            }
            if (gZ) {
                if (!tileSet.has(`${tile.x - 1},${tile.z}`)) { ps.push(this._vis("Wall_Grey.glb", new BABYLON.Vector3(wx,     0, wz + T / 2), new BABYLON.Vector3(0, -Math.PI / 2, 0), node)); this._mkCol(`cWW_${i}_${roomIdx}_${isReturn}`, wx,     1.5, wz + T / 2, 0.3, 3, T, node); }
                if (!tileSet.has(`${tile.x + 1},${tile.z}`)) { ps.push(this._vis("Wall_Grey.glb", new BABYLON.Vector3(wx + T, 0, wz + T / 2), new BABYLON.Vector3(0,  Math.PI / 2, 0), node)); this._mkCol(`cWE_${i}_${roomIdx}_${isReturn}`, wx + T, 1.5, wz + T / 2, 0.3, 3, T, node); }
            }

            if (prog > 0.3) {
                const alpha = Math.min(0.97, (prog - 0.3) * 1.5);
                const fm = new BABYLON.StandardMaterial(`fm_${i}_${roomIdx}_${isReturn}`, this.scene);
                fm.diffuseColor  = new BABYLON.Color3(0, 0, 0);
                fm.emissiveColor = new BABYLON.Color3(0, 0, 0);
                fm.alpha = alpha; fm.backFaceCulling = false; fm.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
                const fp = BABYLON.MeshBuilder.CreateBox(`fp_${i}_${roomIdx}_${isReturn}`, { width: T * 0.98, height: 3.5, depth: T * 0.98 }, this.scene);
                fp.position = new BABYLON.Vector3(wx + T / 2, 1.75, wz + T / 2);
                fp.material = fm; fp.isPickable = false; fp.checkCollisions = false; fp.parent = node;
            }
        }

        if (tiles.length >= 2) {
            const tTile  = tiles[tiles.length - 2];
            const prefix = isReturn ? "trigIn" : "trig";
            const trigger = BABYLON.MeshBuilder.CreateBox(`${prefix}_${roomIdx}`, { width: T * 1.5, height: 4, depth: T * 1.5 }, this.scene);
            trigger.position = new BABYLON.Vector3(tTile.x * T + T / 2, 1, tTile.z * T + T / 2);
            trigger.isVisible = false; trigger.checkCollisions = false; trigger.isPickable = false; trigger.parent = node;
            trigger._toRoom   = isReturn ? roomIdx - 1 : roomIdx + 1;
            trigger._fromRoom = roomIdx;
        }
        await Promise.all(ps);
    }

    // ── Déclencheur de transition ─────────────────────────────────────────────

    _setupTriggerLoop() {
        this.scene.registerBeforeRender(() => {
            if (!this._camera || this._loading) return;
            const cam = this._camera.position;
            const now = performance.now();
            const triggerSources = [];
            if (this._corridorNode)    triggerSources.push({ node: this._corridorNode,    prefix: "trig_"   });
            if (this._corridorInNode)  triggerSources.push({ node: this._corridorInNode,  prefix: "trigIn_" });
            let inAnyTrigger = false;
            for (const { node, prefix } of triggerSources) {
                for (const m of node.getChildMeshes()) {
                    if (!m.name.startsWith(prefix)) continue;
                    const p = m.getAbsolutePosition();
                    const inside = Math.abs(cam.x - p.x) < T * 1.2 && Math.abs(cam.z - p.z) < T * 1.2;
                    if (!inside) continue;
                    inAnyTrigger = true;
                    const key = m.name;
                    if (now - this._lastTransition < this._cooldownMs) break;
                    if (key === this._lastTriggerKey) break;
                    const to    = m._toRoom;
                    const valid = prefix === "trig_" ? (to !== undefined && to < this.rooms.length) : (to !== undefined && to >= 0);
                    if (valid) {
                        this._lastTriggerKey = key;
                        this._lastTransition = now;
                        this._activateRoom(to, m._fromRoom);
                    }
                    break;
                }
            }
            if (!inAnyTrigger) this._lastTriggerKey = null;
        });
    }

    // ── Construction d'une salle ──────────────────────────────────────────────

    async _buildRoom(room, cIn, cOut, parent) {
        const ox = room.worldX * T, oz = room.worldZ * T;
        const rW = room.cols * T,   rD = room.rows * T;
        const wSet   = WALL[room.color]           ?? WALL.grey;
        const floors = FLOOR_BY_COLOR[room.color] ?? FLOOR_BY_COLOR.grey;

        const openings = new Set();
        if (cIn)  { const l = cIn.tiles[cIn.tiles.length - 1]; if (l) { const s = this._side(room, l); if (s) openings.add(s); } }
        if (cOut) { const f = cOut.tiles[0];                   if (f) { const s = this._side(room, f); if (s) openings.add(s); } }

        const ps = [];

        // Sol
        for (let tx = 0; tx < room.cols; tx++)
            for (let tz = 0; tz < room.rows; tz++)
                ps.push(this._vis(pick(floors, this.rand), new BABYLON.Vector3(ox + tx * T + T / 2, H1, oz + tz * T + T / 2), BABYLON.Vector3.Zero(), parent));
        this._mkCol(`fRDC_${ox}_${oz}`, ox + rW / 2, -0.1, oz + rD / 2, rW, 0.2, rD, parent);

        // Murs N/S
        for (let tx = 0; tx < room.cols; tx++) {
            const wx = ox + tx * T + T / 2, tX = room.worldX + tx;
            const dN = openings.has("N") && ((cIn  && this._at(cIn.tiles,  tX, room.worldZ - 1))        || (cOut && this._at(cOut.tiles, tX, room.worldZ - 1)));
            const dS = openings.has("S") && ((cIn  && this._at(cIn.tiles,  tX, room.worldZ + room.rows)) || (cOut && this._at(cOut.tiles, tX, room.worldZ + room.rows)));
            ps.push(this._vis(dN ? wSet.door : wSet.base, new BABYLON.Vector3(wx, H1,     oz      ), new BABYLON.Vector3(0, Math.PI, 0), parent));
            ps.push(this._vis(dS ? wSet.door : wSet.base, new BABYLON.Vector3(wx, H1,     oz + rD ), BABYLON.Vector3.Zero(),             parent));
            if (!dN) this._mkCol(`wN_${tx}_${ox}`,  wx, H1 + 1.5, oz,      T, 3, 0.3, parent);
            if (!dS) this._mkCol(`wS_${tx}_${ox}`,  wx, H1 + 1.5, oz + rD, T, 3, 0.3, parent);
            if (!dN) {
                ps.push(this._vis(wSet.base, new BABYLON.Vector3(wx, H1 + 3, oz      ), new BABYLON.Vector3(0, Math.PI, 0), parent));
                this._mkCol(`wNH_${tx}_${ox}`, wx, H1 + 4.5, oz,      T, 3, 0.3, parent);
            }
            if (!dS) {
                ps.push(this._vis(wSet.base, new BABYLON.Vector3(wx, H1 + 3, oz + rD ), BABYLON.Vector3.Zero(),             parent));
                this._mkCol(`wSH_${tx}_${ox}`, wx, H1 + 4.5, oz + rD, T, 3, 0.3, parent);
            }
            if (tx % 3 === 1) {
                ps.push(this._vis(wSet.light, new BABYLON.Vector3(wx, H1, oz      ), new BABYLON.Vector3(0, Math.PI, 0), parent));
                ps.push(this._vis(wSet.light, new BABYLON.Vector3(wx, H1, oz + rD ), BABYLON.Vector3.Zero(),             parent));
            }
        }
        // Murs E/W
        for (let tz = 0; tz < room.rows; tz++) {
            const wz = oz + tz * T + T / 2, tZ = room.worldZ + tz;
            const dW = openings.has("W") && ((cIn  && this._at(cIn.tiles,  room.worldX - 1,        tZ)) || (cOut && this._at(cOut.tiles, room.worldX - 1,        tZ)));
            const dE = openings.has("E") && ((cIn  && this._at(cIn.tiles,  room.worldX + room.cols, tZ)) || (cOut && this._at(cOut.tiles, room.worldX + room.cols, tZ)));
            ps.push(this._vis(dW ? wSet.door : wSet.base, new BABYLON.Vector3(ox,      H1, wz), new BABYLON.Vector3(0, -Math.PI / 2, 0), parent));
            ps.push(this._vis(dE ? wSet.door : wSet.base, new BABYLON.Vector3(ox + rW, H1, wz), new BABYLON.Vector3(0,  Math.PI / 2, 0), parent));
            if (!dW) this._mkCol(`wW_${tz}_${oz}`,  ox,      H1 + 1.5, wz, 0.3, 3, T, parent);
            if (!dE) this._mkCol(`wE_${tz}_${oz}`,  ox + rW, H1 + 1.5, wz, 0.3, 3, T, parent);
            if (!dW) {
                ps.push(this._vis(wSet.base, new BABYLON.Vector3(ox,      H1 + 3, wz), new BABYLON.Vector3(0, -Math.PI / 2, 0), parent));
                this._mkCol(`wWH_${tz}_${oz}`, ox,      H1 + 4.5, wz, 0.3, 3, T, parent);
            }
            if (!dE) {
                ps.push(this._vis(wSet.base, new BABYLON.Vector3(ox + rW, H1 + 3, wz), new BABYLON.Vector3(0,  Math.PI / 2, 0), parent));
                this._mkCol(`wEH_${tz}_${oz}`, ox + rW, H1 + 4.5, wz, 0.3, 3, T, parent);
            }
            if (tz % 3 === 1) {
                ps.push(this._vis(wSet.light, new BABYLON.Vector3(ox,      H1, wz), new BABYLON.Vector3(0, -Math.PI / 2, 0), parent));
                ps.push(this._vis(wSet.light, new BABYLON.Vector3(ox + rW, H1, wz), new BABYLON.Vector3(0,  Math.PI / 2, 0), parent));
            }
        }

        if (!room.isSpawn) {
            const lay   = pick(LAYOUTS[room.type] ?? LAYOUTS.default, this.rand);
            const qpats = QUAD_PATTERNS[room.type] ?? QUAD_PATTERNS.default;

            // Props floor 1 — un pattern aléatoire par quadrant (sauf rampCorner)
            for (const quad of QUAD_NAMES) {
                if (quad === lay.rampCorner) continue;
                const pool = qpats[quad];
                if (!pool || pool.length === 0) continue;
                const pattern = pick(pool, this.rand);
                const { oX, oZ, cols: qC, rows: qR } = quadBounds(room, quad);
                const margin  = T * 1.0;
                const usableW = qC * T - margin * 2;
                const usableD = qR * T - margin * 2;
                for (const item of pattern) {
                    const px  = oX * T + margin + item.ox * usableW;
                    const pz  = oZ * T + margin + item.oz * usableD;
                    const rot = resolveRot(item.rot, this.rand);
                    ps.push(this._place(item.a, new BABYLON.Vector3(px, H1, pz), new BABYLON.Vector3(0, rot, 0), parent));
                }
            }

            if (lay.hasFloor2) await this._buildFloor2(room, lay, parent);
        }

        const ROOF_Y = 8;
        const roofColors = {
            blue:   new BABYLON.Color3(0.10, 0.13, 0.22),
            green:  new BABYLON.Color3(0.09, 0.17, 0.11),
            grey:   new BABYLON.Color3(0.13, 0.13, 0.16),
            orange: new BABYLON.Color3(0.22, 0.12, 0.06),
            red:    new BABYLON.Color3(0.20, 0.07, 0.07),
        };
        const roofMat = new BABYLON.StandardMaterial(`roofMat_${ox}_${oz}`, this.scene);
        roofMat.diffuseColor    = roofColors[room.color] ?? roofColors.grey;
        roofMat.emissiveColor   = (roofColors[room.color] ?? roofColors.grey).scale(0.3);
        roofMat.specularColor   = new BABYLON.Color3(0, 0, 0);
        roofMat.backFaceCulling = false;  // visible depuis en-dessous

        const roof = BABYLON.MeshBuilder.CreateBox(`roof_${ox}_${oz}`,
            { width: rW, height: 0.2, depth: rD }, this.scene);
        roof.position        = new BABYLON.Vector3(ox + rW / 2, ROOF_Y, oz + rD / 2);
        roof.material        = roofMat;
        roof.checkCollisions = false;
        roof.isPickable      = false;
        roof.parent          = parent;
        roof.alwaysSelectAsActiveMesh = true;
        await Promise.all(ps);
    }

    // ── Étage 2 / balcon ──────────────────────────────────────────────────────

    async _buildFloor2(room, lay, parent) {
        const ox = room.worldX * T, oz = room.worldZ * T;
        const wSet   = WALL[room.color]           ?? WALL.grey;
        const floors = FLOOR_BY_COLOR[room.color] ?? FLOOR_BY_COLOR.grey;
        const ps = [];

        const fCols = Math.floor(room.cols * 0.4);
        const fRows = Math.floor(room.rows * 0.35); // identique à l'original — pas de réduction
        const corner = lay.rampCorner ?? "NW";

        // Identique à l'original
        let sCo, sRo;
        if      (corner === "NW") { sCo = 0;                sRo = 0;                }
        else if (corner === "NE") { sCo = room.cols - fCols; sRo = 0;               }
        else if (corner === "SW") { sCo = 0;                sRo = room.rows - fRows; }
        else                      { sCo = room.cols - fCols; sRo = room.rows - fRows; }

        const eOx = ox + sCo * T, eOz = oz + sRo * T;
        const eW  = fCols * T,    eD  = fRows * T;

        // Dalles balcon
        for (let tx = sCo; tx < sCo + fCols; tx++)
            for (let tz = sRo; tz < sRo + fRows; tz++)
                ps.push(this._vis(pick(floors, this.rand), new BABYLON.Vector3(ox + tx * T + T / 2, H2, oz + tz * T + T / 2), BABYLON.Vector3.Zero(), parent));
        this._mkCol(`f2_${ox}_${oz}`, eOx + eW / 2, H2 - 0.1, eOz + eD / 2, eW, 0.2, eD, parent);

        const openSide = (corner === "NW" || corner === "NE") ? "S" : "N";

        // Murs balcon — identiques à l'original
        for (let tx = sCo; tx < sCo + fCols; tx++) {
            const wx = ox + tx * T + T / 2;
            if (openSide !== "N") ps.push(this._vis(wSet.f2, new BABYLON.Vector3(wx, H2, eOz),      new BABYLON.Vector3(0, Math.PI, 0), parent));
            if (openSide !== "S") ps.push(this._vis(wSet.f2, new BABYLON.Vector3(wx, H2, eOz + eD), BABYLON.Vector3.Zero(),             parent));
        }
        for (let tz = sRo; tz < sRo + fRows; tz++) {
            const wz = oz + tz * T + T / 2;
            if (openSide !== "W") ps.push(this._vis(wSet.f2, new BABYLON.Vector3(eOx,      H2, wz), new BABYLON.Vector3(0, -Math.PI / 2, 0), parent));
            if (openSide !== "E") ps.push(this._vis(wSet.f2, new BABYLON.Vector3(eOx + eW, H2, wz), new BABYLON.Vector3(0,  Math.PI / 2, 0), parent));
        }

        if (openSide !== "N") this._mkCol(`w2N_${ox}`, eOx + eW / 2, H2 + 1.5, eOz,          eW,  3, 0.3, parent);
        if (openSide !== "S") this._mkCol(`w2S_${ox}`, eOx + eW / 2, H2 + 1.5, eOz + eD,     eW,  3, 0.3, parent);
        if (openSide !== "W") this._mkCol(`w2W_${oz}`, eOx,           H2 + 1.5, eOz + eD / 2, 0.3, 3, eD,  parent);
        if (openSide !== "E") this._mkCol(`w2E_${oz}`, eOx + eW,      H2 + 1.5, eOz + eD / 2, 0.3, 3, eD,  parent);

        // ── Rampes ────────────────────────────────────────────────────────────
        // scale(1,1,-2) étire 2x vers -Z local depuis le pivot.
        // Avec scale -1 (original) : pivot à rZ+T*0.5 → s'étend de rZ à rZ+T.
        // Avec scale -2             : pivot à rZ+T*0.5 → s'étend de rZ-T/2 à rZ+T*1.5.
        // Correction : décaler pivot de +T/2 → s'étend de rZ à rZ+2T. ✓
        if (openSide === "N" || openSide === "S") {
            const rZ    = openSide === "N" ? eOz - T : eOz + eD;
            const rRot  = openSide === "N" ? 0 : Math.PI;
            const isFlip = rRot !== 0;
            const count = fCols;
            for (let i = 0; i < count; i++) {
                const rX   = eOx + i * T + T / 2;
                const asset =
                    i === 0          ? (isFlip ? RAMP.R[room.color] ?? RAMP.R.grey : RAMP.L[room.color] ?? RAMP.L.grey)
                        : i === count - 1 ? (isFlip ? RAMP.L[room.color] ?? RAMP.L.grey : RAMP.R[room.color] ?? RAMP.R.grey)
                            :                   RAMP.base[room.color] ?? RAMP.base.grey;
                const posZ = openSide === "N" ? rZ: rZ + T;
                ps.push(this._place(
                    asset,
                    new BABYLON.Vector3(rX, H1, posZ),
                    new BABYLON.Vector3(0, rRot, 0),
                    parent,
                    new BABYLON.Vector3(1, 1, -2),
                ));
            }
        } else {
            const rX    = openSide === "W" ? eOx - T : eOx + eW + T;
            const rRot  = openSide === "W" ? -Math.PI / 2 : Math.PI / 2;
            const count = fRows;
            for (let i = 0; i < count; i++) {
                const rZ  = eOz + i * T + T / 2;
                const asset =
                    i === 0          ? RAMP.L[room.color] ?? RAMP.L.grey
                        : i === count - 1 ? RAMP.R[room.color] ?? RAMP.R.grey
                            :                   RAMP.base[room.color] ?? RAMP.base.grey;
                ps.push(this._place(
                    asset,
                    new BABYLON.Vector3(rX + T / 2, H1, rZ),
                    new BABYLON.Vector3(0, rRot, 0),
                    parent,
                    new BABYLON.Vector3(1, 1, -2),
                ));
            }
        }

        // Props floor 2
        for (const item of lay.floor2) {
            const px  = eOx + item.ox * eW;
            const pz  = eOz + item.oz * eD;
            const rot = resolveRot(item.rot, this.rand);
            ps.push(this._place(item.a, new BABYLON.Vector3(px, H2, pz), new BABYLON.Vector3(0, rot, 0), parent));
        }

        await Promise.all(ps);
    }

    // ── Points de spawn joueur ────────────────────────────────────────────────

    _calcEntrySpawn(room, cIn) {
        const OFFSET = 0.5;
        const ox = room.worldX * T, oz = room.worldZ * T;
        const cx = (room.worldX + room.cols / 2) * T, cz = (room.worldZ + room.rows / 2) * T;
        if (!cIn || !cIn.tiles.length) return new BABYLON.Vector3(cx, 2, cz);
        const e = cIn.tiles[cIn.tiles.length - 1], s = this._side(room, e);
        switch (s) {
            case "N": return new BABYLON.Vector3((e.x + 0.5) * T, 2, oz + OFFSET * T);
            case "S": return new BABYLON.Vector3((e.x + 0.5) * T, 2, oz + (room.rows - OFFSET) * T);
            case "W": return new BABYLON.Vector3(ox + OFFSET * T, 2, (e.z + 0.5) * T);
            case "E": return new BABYLON.Vector3(ox + (room.cols - OFFSET) * T, 2, (e.z + 0.5) * T);
            default:  return new BABYLON.Vector3(cx, 2, cz);
        }
    }

    _calcExitSpawn(room, cOut) {
        const OFFSET = 0.5;
        const ox = room.worldX * T, oz = room.worldZ * T;
        const cx = (room.worldX + room.cols / 2) * T, cz = (room.worldZ + room.rows / 2) * T;
        if (!cOut || !cOut.tiles.length) return new BABYLON.Vector3(cx, 2, cz);
        const e = cOut.tiles[0], s = this._side(room, e);
        switch (s) {
            case "N": return new BABYLON.Vector3((e.x + 0.5) * T, 2, oz + OFFSET * T);
            case "S": return new BABYLON.Vector3((e.x + 0.5) * T, 2, oz + (room.rows - OFFSET) * T);
            case "W": return new BABYLON.Vector3(ox + OFFSET * T, 2, (e.z + 0.5) * T);
            case "E": return new BABYLON.Vector3(ox + (room.cols - OFFSET) * T, 2, (e.z + 0.5) * T);
            default:  return new BABYLON.Vector3(cx, 2, cz);
        }
    }

    // ── Helpers géométrie ─────────────────────────────────────────────────────

    _side(room, tile) {
        if (tile.z === room.worldZ - 1          && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "N";
        if (tile.z === room.worldZ + room.rows  && tile.x >= room.worldX && tile.x < room.worldX + room.cols) return "S";
        if (tile.x === room.worldX - 1          && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "W";
        if (tile.x === room.worldX + room.cols  && tile.z >= room.worldZ && tile.z < room.worldZ + room.rows) return "E";
        return null;
    }

    _at(tiles, x, z) {
        return tiles.some(t => t.x === x && t.z === z);
    }

    _mkCol(name, cx, cy, cz, w, h, d, parent) {
        const b = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
        b.position = new BABYLON.Vector3(cx, cy, cz);
        b.isVisible = false; b.checkCollisions = true; b.isPickable = false;
        b.parent = parent; b.freezeWorldMatrix();
    }

    _applyOcclusion(mesh) {
        if (!mesh.isVisible) return;
        mesh.occlusionType               = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
        mesh.occlusionQueryAlgorithmType = BABYLON.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_ACCURATE;
    }

    // ── Chargement / instanciation de modèles ─────────────────────────────────

    async _place(filename, position, rotation = BABYLON.Vector3.Zero(), parent = this._root, scaling = null) {
        try {
            const c = await this._load(filename);
            const e = c.instantiateModelsToScene(() => `${filename}_${Math.random().toString(36).slice(2)}`, false, { doNotInstantiate: false });
            const r = e.rootNodes[0]; if (!r) return;
            r.position = position; r.rotation = rotation;
            if (scaling) r.scaling = scaling;
            r.parent = parent; r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m => { m.computeWorldMatrix(true); m.refreshBoundingInfo(); m.checkCollisions = true; this._applyOcclusion(m); });
        } catch (e) { console.warn(`[Map] ${filename}`, e.message); }
    }

    async _vis(filename, position, rotation = BABYLON.Vector3.Zero(), parent = this._root) {
        try {
            const c = await this._load(filename);
            const e = c.instantiateModelsToScene(() => `${filename}_${Math.random().toString(36).slice(2)}`, false, { doNotInstantiate: false });
            const r = e.rootNodes[0]; if (!r) return;
            r.position = position; r.rotation = rotation; r.parent = parent; r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m => { m.computeWorldMatrix(true); m.refreshBoundingInfo(); m.checkCollisions = false; this._applyOcclusion(m); });
        } catch (e) { console.warn(`[Map] ${filename}`, e.message); }
    }

    _load(filename) {
        if (this._cache.has(filename)) return this._cache.get(filename);
        const p = BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetBase, filename, this.scene);
        this._cache.set(filename, p);
        return p;
    }
}