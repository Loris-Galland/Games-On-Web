/**
 * MinimapManager — src/Systems/MinimapManager.js
 * ------------------------------------------------
 * Affiche les 5 salles les plus proches (activeIdx ±2) en utilisant
 * leurs vraies coordonnées worldX/worldZ — donc les directions sont
 * correctes (droite, bas, haut...).
 * Redessin uniquement sur changement de salle ou toutes les 100ms.
 */

const T = 4; // tuile → unités monde

function getRoomType(roomIdx) {
    if (roomIdx === 0) return "spawn";
    const cycleLen   = 5;
    const cycle      = Math.ceil(roomIdx / cycleLen);
    const posInCycle = ((roomIdx - 1) % cycleLen) + 1;
    if (posInCycle <= 3) return "normal";
    if (posInCycle === 4) return "boss";
    if (cycle === 1) return "shop";
    if (cycle === 2) return "forge";
    return "challenge";
}

const COLORS = {
    spawn:     { bg: "#0d1f0d", border: "#00ff88", icon: "#00ff88" },
    normal:    { bg: "#090f18", border: "#1e3a5f", icon: "#3366aa" },
    boss:      { bg: "#1f0a0a", border: "#ff2244", icon: "#ff4466" },
    shop:      { bg: "#1a1500", border: "#ffcc00", icon: "#ffdd44" },
    forge:     { bg: "#1a0e00", border: "#ff7700", icon: "#ff9933" },
    challenge: { bg: "#0d0020", border: "#bb44ff", icon: "#cc66ff" },
};

const SIZE    = 220; // canvas carré en px
const PADDING = 18;  // marge interne
// Taille fixe d'une salle sur la minimap (px) — grande et lisible
const ROOM_PX = 44;

export class MinimapManager {
    constructor(map, player, waveManager = null) {
        this.map         = map;
        this.player      = player;
        this.waveManager = waveManager;

        this._visible        = true;
        this._canvas         = null;
        this._ctx            = null;
        this._container      = null;
        this._lastActiveIdx  = -2;
        this._dirty          = true;
        this._lastPlayerDraw = 0;

        this._visited  = new Set([0]);
        this._revealed = new Set([1]);

        this._buildDOM();
        this._redraw();
    }

    // ── DOM ───────────────────────────────────────────────────────────────────

    _buildDOM() {
        this._container = document.createElement("div");
        this._container.id = "minimap-container";
        this._container.innerHTML = `<canvas id="minimap-canvas" width="${SIZE}" height="${SIZE}"></canvas>`;
        document.body.appendChild(this._container);

        this._canvas = document.getElementById("minimap-canvas");
        this._ctx    = this._canvas.getContext("2d");

        document.addEventListener("keydown", (e) => {
            if (e.code === "KeyM" && !e.ctrlKey && !e.altKey && !e.shiftKey) this.toggle();
        });
        this._container.addEventListener("click", () => this.toggle());
        this._container.title = "[M] Carte";
    }

    // ── API ───────────────────────────────────────────────────────────────────

    toggle() {
        this._visible = !this._visible;
        this._container.style.opacity       = this._visible ? "1" : "0";
        this._container.style.pointerEvents = this._visible ? "auto" : "none";
    }

    update() {
        if (!this._visible) return;
        const activeIdx = this.map?._activeIdx ?? 0;
        if (activeIdx !== this._lastActiveIdx) {
            this._lastActiveIdx = activeIdx;
            this._markVisited(activeIdx);
            this._dirty = true;
        }
        const now = performance.now();
        if (this._dirty || now - this._lastPlayerDraw > 100) {
            this._redraw();
            this._dirty = false;
            this._lastPlayerDraw = now;
        }
    }

    onRoomEnter(roomIdx) {
        this._markVisited(roomIdx);
        this._dirty = true;
    }

    destroy() { this._container?.remove(); }

    // ── Visites ───────────────────────────────────────────────────────────────

    _markVisited(idx) {
        this._visited.add(idx);
        this._revealed.delete(idx);
        const total = this.map?.rooms?.length ?? 0;
        if (idx > 0)         this._revealed.add(idx - 1);
        if (idx < total - 1) this._revealed.add(idx + 1);
    }

    // ── Dessin principal ──────────────────────────────────────────────────────

    _redraw() {
        if (!this.map?.rooms || !this._ctx) return;

        const ctx       = this._ctx;
        const rooms     = this.map.rooms;
        const total     = rooms.length;
        const activeIdx = this.map._activeIdx ?? 0;

        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = "rgba(2, 6, 14, 0.96)";
        ctx.fillRect(0, 0, SIZE, SIZE);

        // Fenêtre : activeIdx ±2 (max 5 salles)
        const winStart = Math.max(0, activeIdx - 2);
        const winEnd   = Math.min(total - 1, activeIdx + 2);

        // Sous-ensemble de salles et couloirs à afficher
        const visibleRooms = [];
        for (let i = winStart; i <= winEnd; i++) {
            visibleRooms.push({ idx: i, room: rooms[i] });
        }

        // Calculer la projection centrée sur la salle active
        // On veut que la salle active soit au centre du canvas
        const proj = this._calcProj(visibleRooms, activeIdx, rooms);

        // Couloirs entre salles visibles
        const corridors = this.map.corridors ?? [];
        for (let i = winStart; i < winEnd; i++) {
            const corridor = corridors[i];
            if (!corridor) continue;
            const anyKnown = (this._visited.has(i) || this._revealed.has(i))
                          && (this._visited.has(i + 1) || this._revealed.has(i + 1));
            if (!anyKnown) continue;
            this._drawCorridor(ctx, corridor, i, i + 1, activeIdx, proj);
        }

        // Salles
        for (const { idx, room } of visibleRooms) {
            const vis = this._visited.has(idx);
            const rev = !vis && this._revealed.has(idx);
            if (!vis && !rev) continue;
            this._drawRoom(ctx, room, idx, idx === activeIdx, vis, rev, proj);
        }

        // Triangle joueur sur la salle active
        const activeRoom = rooms[activeIdx];
        if (activeRoom && this.player?.camera) {
            this._drawPlayer(ctx, activeRoom, proj);
        }
    }

    // ── Projection ────────────────────────────────────────────────────────────

    /**
     * Calcule scale + offset pour que les salles visibles tiennent dans le canvas,
     * centrées sur la salle active.
     */
    _calcProj(visibleRooms, activeIdx, allRooms) {
        const activeRoom = allRooms[activeIdx];

        // Centre de la salle active en tuiles
        const acx = activeRoom.worldX + activeRoom.cols / 2;
        const acz = activeRoom.worldZ + activeRoom.rows / 2;

        // Trouver les bounds des salles visibles
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const { room } of visibleRooms) {
            minX = Math.min(minX, room.worldX);
            maxX = Math.max(maxX, room.worldX + room.cols);
            minZ = Math.min(minZ, room.worldZ);
            maxZ = Math.max(maxZ, room.worldZ + room.rows);
        }

        const rangeX = Math.max(maxX - minX, 1);
        const rangeZ = Math.max(maxZ - minZ, 1);

        // Scale fixe basé sur ROOM_PX pour des cases bien grandes
        // On choisit que chaque salle (cols/rows ~4-8 tuiles) fasse ROOM_PX px
        const avgCols = visibleRooms.reduce((s, { room }) => s + room.cols, 0) / visibleRooms.length;
        const scale   = ROOM_PX / avgCols;

        // Offset pour centrer la salle active dans le canvas
        const cx = SIZE / 2;
        const cz = SIZE / 2;
        const ox = cx - acx * scale;
        const oz = cz - acz * scale;

        return { scale, ox, oz };
    }

    // tuile → canvas px
    _tc(tx, tz, p) {
        return { x: tx * p.scale + p.ox, y: tz * p.scale + p.oz };
    }

    // ── Couloir ───────────────────────────────────────────────────────────────

    _drawCorridor(ctx, corridor, fromIdx, toIdx, activeIdx, proj) {
        if (!corridor.tiles?.length) return;
        const isActive = fromIdx === activeIdx || toIdx === activeIdx;
        const bothVis  = this._visited.has(fromIdx) && this._visited.has(toIdx);

        ctx.save();
        ctx.strokeStyle = isActive ? "rgba(0, 210, 255, 0.85)" : "rgba(40, 85, 150, 0.55)";
        ctx.lineWidth   = isActive ? 3 : 1.8;
        if (!bothVis) ctx.setLineDash([3, 3]);
        ctx.lineCap  = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        corridor.tiles.forEach((tile, i) => {
            const p = this._tc(tile.x + 0.5, tile.z + 0.5, proj);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
    }

    // ── Salle ─────────────────────────────────────────────────────────────────

    _drawRoom(ctx, room, idx, isActive, isVisited, isRevealed, proj) {
        const type = getRoomType(idx);
        const col  = COLORS[type] ?? COLORS.normal;

        const tl = this._tc(room.worldX,             room.worldZ,             proj);
        const br = this._tc(room.worldX + room.cols,  room.worldZ + room.rows,  proj);
        const pw = br.x - tl.x;
        const ph = br.y - tl.y;
        const cx = tl.x + pw / 2;
        const cy = tl.y + ph / 2;

        ctx.save();

        if (isActive) { ctx.shadowColor = col.border; ctx.shadowBlur = 16; }

        // Fond
        ctx.fillStyle = isRevealed ? "rgba(8, 12, 22, 0.6)" : col.bg;
        ctx.fillRect(tl.x, tl.y, pw, ph);
        ctx.shadowBlur = 0;

        // Halo interne (salle active)
        if (isActive) {
            ctx.fillStyle = `rgba(${this._rgb(col.border)}, 0.12)`;
            ctx.fillRect(tl.x + 1, tl.y + 1, pw - 2, ph - 2);
        }

        // Bordure
        ctx.strokeStyle = isRevealed
            ? "rgba(28, 52, 90, 0.5)"
            : isActive
                ? col.border
                : `rgba(${this._rgb(col.border)}, ${isVisited ? "0.6" : "0.25"})`;
        ctx.lineWidth = isActive ? 2.2 : 1.2;
        ctx.strokeRect(tl.x, tl.y, pw, ph);

        // Contenu
        if (isRevealed) {
            ctx.font         = `${Math.round(Math.min(pw, ph) * 0.38)}px monospace`;
            ctx.fillStyle    = "rgba(40, 70, 125, 0.75)";
            ctx.textAlign    = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", cx, cy);
        } else {
            // Icône bien visible — taille généreuse
            const iconSize = Math.min(pw, ph) * 0.48;
            this._drawIcon(ctx, type, cx, cy, iconSize, col.icon, isActive ? 1.0 : 0.80);
        }

        ctx.restore();
    }

    // ── Icônes ────────────────────────────────────────────────────────────────

    _drawIcon(ctx, type, cx, cy, size, color, alpha) {
        if (size < 2) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = color;
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(1.5, size * 0.1);
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";

        switch (type) {
            case "spawn": {
                ctx.beginPath(); ctx.arc(cx, cy, size * 0.52, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2); ctx.fill();
                break;
            }
            case "normal": {
                ctx.globalAlpha = alpha * 0.5;
                const s = size * 0.38;
                ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
                break;
            }
            case "boss": {
                const r1 = size * 0.54, r2 = size * 0.22;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4 - Math.PI / 2;
                    const r = i % 2 === 0 ? r1 : r2;
                    i === 0
                        ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
                        : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
                }
                ctx.closePath(); ctx.fill();
                break;
            }
            case "shop": {
                ctx.font = `bold ${Math.round(size * 1.1)}px monospace`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText("$", cx, cy);
                break;
            }
            case "forge": {
                const hs = size * 0.5;
                ctx.lineWidth = Math.max(1.5, size * 0.12);
                ctx.beginPath();
                ctx.moveTo(cx + hs * 0.2,  cy - hs * 0.42);
                ctx.lineTo(cx - hs * 0.2,  cy + hs * 0.62);
                ctx.stroke();
                ctx.fillRect(cx - hs * 0.48, cy - hs * 0.72, hs * 0.96, hs * 0.34);
                break;
            }
            case "challenge": {
                ctx.beginPath(); ctx.arc(cx, cy, size * 0.50, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - size * 0.32); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + size * 0.22, cy + size * 0.1); ctx.stroke();
                ctx.beginPath(); ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2); ctx.fill();
                break;
            }
            default: break;
        }
        ctx.restore();
    }

    // ── Joueur ────────────────────────────────────────────────────────────────

    _drawPlayer(ctx, activeRoom, proj) {
        // Position caméra en tuiles
        const cam   = this.player.camera;
        const tileX = cam.globalPosition.x / T;
        const tileZ = cam.globalPosition.z / T;
        const p     = this._tc(tileX, tileZ, proj);
        const yaw   = -cam.rotation.y;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(yaw + Math.PI);

        ctx.fillStyle   = "#00ffcc";
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur  = 7;

        const R = 6;
        ctx.beginPath();
        ctx.moveTo(0,       -R * 1.1);
        ctx.lineTo(R * 0.6,  R * 0.8);
        ctx.lineTo(0,        R * 0.3);
        ctx.lineTo(-R * 0.6, R * 0.8);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _rgb(hex) {
        return [
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16),
        ].join(", ");
    }
}