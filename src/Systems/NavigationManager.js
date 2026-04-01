import * as BABYLON from "@babylonjs/core";

/**
 * NavigationManager
 * -----------------
 * Encapsule le RecastJSPlugin de Babylon.js pour construire un navmesh
 * à partir des colliders de la salle active, puis piloter les ennemis
 * comme des "crowd agents" Recast (pathfinding + évitement mutuel).
 *
 * Usage :
 *   const nav = new NavigationManager(scene);
 *   await nav.init();                       // charge recast-detour (1 seule fois)
 *   await nav.buildForRoom(colliderMeshes); // construit le navmesh
 *   const agentIdx = nav.addAgent(position, mesh);
 *   nav.setAgentTarget(agentIdx, targetPos);
 *   // dans la boucle : nav.update(dt)
 *   nav.removeAgent(agentIdx);
 *   nav.dispose();
 */
export class NavigationManager {
    constructor(scene) {
        this.scene   = scene;
        this._plugin = null;
        this._crowd  = null;
        this._agents = new Map(); // agentIdx → { mesh, targetPos }
        this._ready  = false;
        this._debugMesh = null;
    }

    // ── Initialisation (charge Recast via CDN global) ─────────────────────────
    // Nécessite dans index.html :
    // <script src="https://cdn.babylonjs.com/recast.js"></script>

    async init() {
        try {
            const recastInstance = await new Promise((resolve, reject) => {
                if (typeof Recast !== "undefined") {
                    Recast().then(resolve).catch(reject);
                } else {
                    const interval = setInterval(() => {
                        if (typeof Recast !== "undefined") {
                            clearInterval(interval);
                            Recast().then(resolve).catch(reject);
                        }
                    }, 100);
                }
            });
            this._plugin = new BABYLON.RecastJSPlugin(recastInstance);
        } catch (e) {
            console.error("[NavMesh] Impossible de charger recast-detour :", e);
            this._plugin = null;
        }
    }

    get isReady() { return this._ready && this._plugin !== null; }

    // ── Construction du navmesh pour une salle ────────────────────────────────

    /**
     * @param {BABYLON.AbstractMesh[]} meshes  — tous les meshes walkable
     *   (sols + rampes — PAS les murs ni les props)
     * @param {number} agentRadius   rayon des agents (défaut 0.6)
     * @param {number} agentHeight   hauteur des agents (défaut 2.2)
     */
    async buildForRoom(meshes, agentRadius = 0.6, agentHeight = 2.2) {
        if (!this._plugin) return;

        this._destroyCrowd();
        if (this._debugMesh) { this._debugMesh.dispose(); this._debugMesh = null; }
        this._ready = false;

        const valid = meshes.filter(m => m && !m.isDisposed() && m.getTotalVertices() > 0);
        if (valid.length === 0) {
            console.warn("[NavMesh] Aucun mesh walkable fourni");
            return;
        }

        const params = {
            cs:                     0.3,
            ch:                     0.2,
            walkableSlopeAngle:     45,
            walkableHeight:         agentHeight / 0.2,
            walkableClimb:          4,      // était 2 — augmenté pour les rampes hautes
            walkableRadius:         Math.ceil(agentRadius / 0.3),
            maxEdgeLen:             12,
            maxSimplificationError: 1.3,
            minRegionArea:          8,
            mergeRegionArea:        20,
            maxVertsPerPoly:        6,
            detailSampleDist:       6,
            detailSampleMaxError:   1,
        };

        try {
            // Bake world transform : les meshes GLB ont leurs vertices en local space,
            // on crée des meshes temporaires avec les vertices transformés en world space
            const baked = valid.map(m => {
                const worldMatrix = m.getWorldMatrix();
                const positions   = m.getVerticesData(BABYLON.VertexBuffer.PositionKind);
                if (!positions) return null;

                const transformed = new Float32Array(positions.length);
                for (let i = 0; i < positions.length; i += 3) {
                    const v = BABYLON.Vector3.TransformCoordinates(
                        new BABYLON.Vector3(positions[i], positions[i + 1], positions[i + 2]),
                        worldMatrix,
                    );
                    transformed[i]     = v.x;
                    transformed[i + 1] = v.y;
                    transformed[i + 2] = v.z;
                }

                const temp = new BABYLON.Mesh("_nav_" + m.name, this.scene);
                const vertexData = new BABYLON.VertexData();
                vertexData.positions = transformed;
                vertexData.indices   = m.getIndices();
                vertexData.applyToMesh(temp);
                return temp;
            }).filter(Boolean);

            // API synchrone (sans callback) — compatible CDN Recast
            this._plugin.createNavMesh(baked, params);

            // Nettoyer les meshes temporaires
            baked.forEach(m => m.dispose());

            this._crowd = this._plugin.createCrowd(30, agentRadius, this.scene);
            this._ready = true;
        } catch (e) {
            console.error("[NavMesh] Erreur buildForRoom :", e);
        }
    }

    // ── Debug visuel du navmesh (optionnel) ───────────────────────────────────

    showDebug(visible = true) {
        if (!this._plugin || !this._ready) return;
        if (this._debugMesh) { this._debugMesh.dispose(); this._debugMesh = null; }
        if (!visible) return;
        this._debugMesh = this._plugin.createDebugNavMesh(this.scene);
        const mat = new BABYLON.StandardMaterial("navDebugMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.1, 0.4, 1);
        mat.alpha        = 0.25;
        mat.wireframe    = false;
        this._debugMesh.material  = mat;
        this._debugMesh.isPickable = false;
    }

    // ── Gestion des agents ────────────────────────────────────────────────────

    /**
     * Ajoute un agent au crowd.
     * @param {BABYLON.Vector3} position   position de départ
     * @param {BABYLON.AbstractMesh} mesh  mesh à piloter
     * @param {number} speed
     * @returns {number|null} index de l'agent, ou null si non prêt
     */
    addAgent(position, mesh, speed = 0.65) {
        if (!this.isReady) return null;

        // Forcer Y=0 pour le snap — le navmesh est au niveau du sol
        const posOnGround = new BABYLON.Vector3(position.x, 0, position.z);
        const snapped     = this._plugin.getClosestPoint(posOnGround);

        const agentParams = {
            radius:                0.55,
            height:                2.2,
            maxAcceleration:       200,
            maxSpeed:              speed,
            collisionQueryRange:   2.0,
            pathOptimizationRange: 8.0,
            separationWeight:      1.5,
        };

        try {
            const idx = this._crowd.addAgent(snapped, agentParams, mesh);
            this._agents.set(idx, { mesh, targetPos: null });
            return idx;
        } catch (e) {
            console.warn("[NavMesh] addAgent error:", e);
            return null;
        }
    }

    /**
     * Ordonne à l'agent d'aller vers une position.
     */
    setAgentTarget(agentIdx, targetPos) {
        if (!this.isReady || agentIdx === null) return;
        const info = this._agents.get(agentIdx);
        if (!info) return;
        info.targetPos = targetPos;
        try {
            const targetAdjusted = new BABYLON.Vector3(targetPos.x, targetPos.y - 1.5, targetPos.z);
            const snapped = this._plugin.getClosestPoint(targetAdjusted);
            this._crowd.agentGoto(agentIdx, snapped);
        } catch (e) { /* ignore */ }
    }

    /**
     * Retourne la vitesse actuelle d'un agent (Vector3).
     */
    getAgentVelocity(agentIdx) {
        if (!this.isReady || agentIdx === null) return BABYLON.Vector3.Zero();
        try { return this._crowd.getAgentVelocity(agentIdx); }
        catch (e) { return BABYLON.Vector3.Zero(); }
    }

    /**
     * Retourne la position navmesh d'un agent.
     */
    getAgentPosition(agentIdx) {
        if (!this.isReady || agentIdx === null) return null;
        try { return this._crowd.getAgentPosition(agentIdx); }
        catch (e) { return null; }
    }

    /**
     * Supprime un agent du crowd.
     */
    removeAgent(agentIdx) {
        if (!this.isReady || agentIdx === null) return;
        try {
            this._crowd.removeAgent(agentIdx);
            this._agents.delete(agentIdx);
        } catch (e) { /* ignore */ }
    }

    /**
     * Met à jour le crowd (appeler chaque frame).
     */
    update(dt) {
        if (!this.isReady) return;
        try { this._crowd.update(dt); }
        catch (e) { /* ignore */ }
    }

    // ── Nettoyage ─────────────────────────────────────────────────────────────

    _destroyCrowd() {
        if (this._crowd) {
            try { this._crowd.dispose(); } catch (e) { /* ignore */ }
            this._crowd = null;
        }
        this._agents.clear();
        this._ready = false;
    }

    dispose() {
        this._destroyCrowd();
        if (this._debugMesh) { this._debugMesh.dispose(); this._debugMesh = null; }
        if (this._plugin) {
            try { this._plugin.dispose(); } catch (e) { /* ignore */ }
            this._plugin = null;
        }
    }
}