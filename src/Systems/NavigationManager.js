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
        this.scene  = scene;
        this._plugin = null;
        this._crowd  = null;
        this._agents = new Map(); // agentIdx → { mesh, targetPos }
        this._ready  = false;
        this._debugMesh = null;
    }

    // ── Initialisation (charge Recast WASM) ───────────────────────────────────

    async init() {
        // recast-detour doit être installé : npm install recast-detour
        try {
            const Recast = await import("recast-detour");
            const recastInstance = await Recast.default();
            this._plugin = new BABYLON.RecastJSPlugin(recastInstance);
            console.log("[NavMesh] RecastJSPlugin initialisé");
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

        // Nettoyage précédent
        this._destroyCrowd();
        if (this._debugMesh) { this._debugMesh.dispose(); this._debugMesh = null; }
        this._ready = false;

        // Filtrer les meshes vides ou sans géométrie
        const valid = meshes.filter(m => m && !m.isDisposed() && m.getTotalVertices() > 0);
        if (valid.length === 0) {
            console.warn("[NavMesh] Aucun mesh walkable fourni");
            return;
        }

        const params = {
            cs:                  0.3,   // résolution voxel XZ (plus petit = plus précis)
            ch:                  0.2,   // résolution voxel Y
            walkableSlopeAngle:  45,    // pente max franchissable (degrés)
            walkableHeight:      agentHeight / 0.2,  // en voxels
            walkableClimb:       2,     // marche max en voxels (~0.4u)
            walkableRadius:      Math.ceil(agentRadius / 0.3),
            maxEdgeLen:          12,
            maxSimplificationError: 1.3,
            minRegionArea:       8,
            mergeRegionArea:     20,
            maxVertsPerPoly:     6,
            detailSampleDist:    6,
            detailSampleMaxError: 1,
        };

        return new Promise((resolve) => {
            try {
                this._plugin.createNavMesh(valid, params, (navmeshData) => {
                    if (!navmeshData) {
                        console.warn("[NavMesh] Données navmesh invalides");
                        resolve();
                        return;
                    }
                    this._plugin.buildFromNavmeshData(navmeshData);

                    // Crowd : max 30 agents, rayon 0.6
                    this._crowd = this._plugin.createCrowd(30, agentRadius, this.scene);

                    this._ready = true;
                    console.log("[NavMesh] Navmesh + Crowd prêts");
                    resolve();
                });
            } catch (e) {
                console.error("[NavMesh] Erreur buildForRoom :", e);
                resolve();
            }
        });
    }

    // ── Debug visuel du navmesh (optionnel) ───────────────────────────────────

    showDebug(visible = true) {
        if (!this._plugin || !this._ready) return;
        if (this._debugMesh) { this._debugMesh.dispose(); this._debugMesh = null; }
        if (!visible) return;
        this._debugMesh = this._plugin.createDebugNavMesh(this.scene);
        const mat = new BABYLON.StandardMaterial("navDebugMat", this.scene);
        mat.diffuseColor = new BABYLON.Color3(0.1, 0.4, 1);
        mat.alpha = 0.25;
        mat.wireframe = false;
        this._debugMesh.material = mat;
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

        // Snapper la position sur le navmesh
        const snapped = this._plugin.getClosestPoint(position);

        const agentParams = {
            radius:             0.55,
            height:             2.2,
            maxAcceleration:    200,
            maxSpeed:           speed,
            collisionQueryRange: 2.0,
            pathOptimizationRange: 8.0,
            separationWeight:   1.5,
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
            const snapped = this._plugin.getClosestPoint(targetPos);
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