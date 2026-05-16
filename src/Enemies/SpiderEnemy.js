import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "./EnemyParticles";

/**
 * SpiderEnemy
 * -----------
 * Araignée murale : se colle sur les murs/plafond, tire un laser hitscan
 * vers le joueur, puis se repositionne instantanément sur une autre surface.
 * Inspiré de la mission Jazz dans Transformers : Fall of Cybertron.
 */
export class SpiderEnemy {

    // HP total avant mort
    static MAX_HEALTH = 3;

    constructor(scene, position, player) {
        this.scene  = scene;
        this.player = player;

        this.currentHealth = SpiderEnemy.MAX_HEALTH;

        // ── Timers ────────────────────────────────────────────────────────────
        this._fireTimer      = 1.5 + Math.random() * 1.0; // délai avant premier tir
        this._FIRE_INTERVAL  = 2.5;   // secondes entre chaque tir
        this._laserDuration  = 0.12;  // secondes pendant lesquelles le laser est visible
        this._laserTimer     = 0;
        this._repositionCd   = 0;     // cooldown après repositionnement

        // ── Surfaces possibles : sol exclu, uniquement murs verticaux + plafond
        this._wallNormals = [
            new BABYLON.Vector3( 1, 0,  0),
            new BABYLON.Vector3(-1, 0,  0),
            new BABYLON.Vector3( 0, 0,  1),
            new BABYLON.Vector3( 0, 0, -1),
            new BABYLON.Vector3( 0, 1,  0), // plafond uniquement, pas le sol
        ];

        // ── Body (araignée = boîte aplatie) ──────────────────────────────────
        this.body = BABYLON.MeshBuilder.CreateBox("spiderBody", {
            width: 1.4, height: 0.4, depth: 1.4,
        }, scene);
        this.body.position  = position.clone();
        this.body.isPickable = true;
        this.body.checkCollisions = false;

        const mat = new BABYLON.StandardMaterial("spiderMat_" + Math.random().toString(36).slice(2), scene);
        mat.diffuseColor  = new BABYLON.Color3(0.5, 0.15, 0.0);   // orange foncé visible
        mat.emissiveColor = new BABYLON.Color3(0.3, 0.08, 0.0);
        this.body.material = mat;

        // ── Point faible (noyau central lumineux) — agrandi ──────────────────
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 0.65 }, scene);
        this.weakPoint.parent   = this.body;
        this.weakPoint.position = BABYLON.Vector3.Zero();
        this.weakPoint.isPickable = true;

        const weakMat = new BABYLON.StandardMaterial("spiderWeakMat_" + Math.random().toString(36).slice(2), scene);
        weakMat.emissiveColor   = new BABYLON.Color3(1, 0.4, 0);   // orange vif
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        // ── Pattes (8 lignes visuelles) ───────────────────────────────────────
        this._legs = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const leg = BABYLON.MeshBuilder.CreateBox("spiderLeg", {
                width: 0.05, height: 0.05, depth: 0.5,
            }, scene);
            leg.parent    = this.body;
            leg.position  = new BABYLON.Vector3(Math.cos(angle) * 0.3, 0, Math.sin(angle) * 0.3);
            leg.rotation.y = angle;
            leg.material  = mat;
            this._legs.push(leg);
        }

        // ── Laser mesh (ligne visible brièvement) ────────────────────────────
        this._laserMesh = null;

        // ── Se positionner immédiatement sur un mur ───────────────────────────
        this._snapToWall(position);

        // ── Boucle principale ─────────────────────────────────────────────────
        this._observer = scene.onBeforeRenderObservable.add(() => this._update());

        // ── Mort ──────────────────────────────────────────────────────────────
        this.body.onDisposeObservable.add(() => {
            scene.onBeforeRenderObservable.remove(this._observer);
            this._laserMesh?.dispose();
            EnemyParticles.death(scene, this.body.position.clone(), new BABYLON.Color3(0, 1, 0.4));
        });

        // takeDamage exposé pour les projectiles du joueur
        this.body._takeDamage    = (dmg) => this._takeDamage(dmg);
        this.weakPoint._takeDamage = (dmg) => this._takeDamage(dmg * 2); // point faible = x2
    }

    // ── Dégâts ───────────────────────────────────────────────────────────────

    _takeDamage(dmg = 1) {
        if (this.body.isDisposed()) return;
        this.currentHealth -= dmg;
        // Flash rouge
        const mat = this.body.material;
        const orig = mat.emissiveColor.clone();
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        setTimeout(() => { if (!this.body.isDisposed()) mat.emissiveColor = orig; }, 80);

        if (this.currentHealth <= 0) {
            this.weakPoint.dispose();
            this.body.dispose();
        }
    }

    // ── Snap sur un mur par raycast ──────────────────────────────────────────

    _snapToWall(fromPos) {
    const RAY_LEN = 30;
    const candidates = [];

    for (const normal of this._wallNormals) {
        const dir = normal.negate();
        const ray = new BABYLON.Ray(fromPos, dir, RAY_LEN);
        const hit = this.scene.pickWithRay(ray, m =>
            m.checkCollisions &&
            m !== this.body &&
            !m.name.startsWith("spider") &&
            !m.name.startsWith("fRDC") &&   // ← exclure sol
            !m.name.startsWith("cF_")       // ← exclure sol couloir
        );
        if (!hit.hit || hit.distance <= 0.3) continue;

        const hitNormal = hit.getNormal(true);
        if (!hitNormal) continue;
        if (hitNormal.y > 0.5)  continue; // c'est le sol
        if (hitNormal.y < -0.5) continue; // dessous de dalle

        candidates.push({ hit, normal, dist: hit.distance });
    }

    if (candidates.length === 0) return;

    const valid = candidates.filter(c => c.dist > 1.0);
    const chosen = valid.length > 0
        ? valid[Math.floor(Math.random() * valid.length)]
        : candidates[0];

    const offset = 0.2;
    this.body.position = chosen.hit.pickedPoint.add(chosen.normal.scale(offset));
    this._currentNormal = chosen.normal.clone();
    this._orientToNormal(chosen.normal);
}

    _orientToNormal(normal) {
        // Aligner l'axe Y du mesh avec la normale du mur
        if (Math.abs(normal.y) > 0.9) {
            // Plafond ou sol
            this.body.rotation.x = normal.y > 0 ? Math.PI : 0;
            this.body.rotation.z = 0;
        } else {
            // Mur vertical
            const angle = Math.atan2(normal.x, normal.z);
            this.body.rotation.y = angle;
            this.body.rotation.x = -Math.PI / 2;
        }
    }

    // ── Repositionnement après tir ────────────────────────────────────────────

    _reposition() {
        const from = this.body.position.clone();
        const playerPos = this.player.camera.globalPosition;
        const angle  = Math.random() * Math.PI * 2;
        const radius = 5 + Math.random() * 8;
        const newFrom = new BABYLON.Vector3(
            playerPos.x + Math.cos(angle) * radius,
            playerPos.y + 1 + Math.random() * 3,
            playerPos.z + Math.sin(angle) * radius,
        );

        // FX départ
        EnemyParticles.death(this.scene, from, new BABYLON.Color3(1, 0.4, 0));

        // Calcul destination réelle avant de bouger
        const tempPos = newFrom.clone();
        this.body.position = tempPos;
        this._snapToWall(tempPos);
        const dest = this.body.position.clone();

        // ── Marqueur de destination visible ~0.5s avant l'apparition ──────────
        const marker = BABYLON.MeshBuilder.CreateSphere("_spiderMarker", { diameter: 0.5 }, this.scene);
        marker.position   = dest.clone();
        marker.isPickable = false;
        const markerMat = new BABYLON.StandardMaterial("_spiderMarkerMat", this.scene);
        markerMat.emissiveColor   = new BABYLON.Color3(1, 0.6, 0);
        markerMat.disableLighting = true;
        markerMat.alpha = 0.8;
        marker.material = markerMat;

        // Pulsation + disparition
        let t = 0;
        const obs = this.scene.onBeforeRenderObservable.add(() => {
            t += this.scene.getEngine().getDeltaTime() / 1000;
            markerMat.alpha = 0.5 + Math.sin(t * 20) * 0.3;
            if (t > 0.5) {
                this.scene.onBeforeRenderObservable.remove(obs);
                marker.dispose();
                markerMat.dispose();
            }
        });

        this._repositionCd = 0.6;

        // FX arrivée
        setTimeout(() => {
            EnemyParticles.death(this.scene, dest, new BABYLON.Color3(1, 0.4, 0));
        }, 500);
    }

    // ── Tir laser hitscan ────────────────────────────────────────────────────

    _fireLaser() {
        const from      = this.body.position.clone();
        const playerPos = this.player.camera.globalPosition.clone();
        const dir       = playerPos.subtract(from).normalize();

        // Raycast hitscan
        const ray = new BABYLON.Ray(from, dir, 50);
        const hit = this.scene.pickWithRay(ray, m =>
            m !== this.body && m !== this.weakPoint && m.isPickable &&
            !m.name.startsWith("spider") && !m.name.startsWith("_dash") &&
            !m.name.startsWith("weapon") && !m.name.startsWith("drone")
        );

        // Le joueur n'est pas un mesh pickable — on vérifie si le rayon
        // atteint le joueur avant de toucher un mur
        const distToPlayer = BABYLON.Vector3.Distance(from, playerPos);
        const distToWall   = hit.hit ? hit.distance : 999;
        if (distToPlayer < distToWall && !this.player.isDead) {
            this.player.health?.takeDamage(1);
        }

        const endPoint = hit.hit ? hit.pickedPoint.clone() : playerPos.clone();

        // ── Visuel laser ──────────────────────────────────────────────────────
        this._laserMesh?.dispose();

        const path = [from, endPoint];
        this._laserMesh = BABYLON.MeshBuilder.CreateTube("spiderLaser", {
            path,
            radius:       0.05,
            tessellation: 6,
            updatable:    false,
        }, this.scene);
        this._laserMesh.isPickable = false;

        const laserMat = new BABYLON.StandardMaterial("spiderLaserMat", this.scene);
        laserMat.emissiveColor   = new BABYLON.Color3(1, 0.5, 0);  // orange comme le corps
        laserMat.disableLighting = true;
        laserMat.alpha           = 0.9;
        this._laserMesh.material = laserMat;

        if (hit.hit) {
            EnemyParticles.projectileImpact(this.scene, hit.pickedPoint, hit.getNormal(true) ?? BABYLON.Vector3.Up());
        }

        this._laserTimer = this._laserDuration;
        setTimeout(() => this._reposition(), 150);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    _update() {
        if (this.body.isDisposed() || !this.player?.camera) return;

        const dt = this.scene.getEngine().getDeltaTime() / 1000;

        // Pas de rotation vers le joueur — le body reste fixe collé au mur
        // pour éviter de traverser la géométrie

        // Laser visible
        if (this._laserTimer > 0) {
            this._laserTimer -= dt;
            if (this._laserTimer <= 0) {
                this._laserMesh?.dispose();
                this._laserMesh = null;
            } else {
                // Pulsation alpha
                if (this._laserMesh?.material) {
                    this._laserMesh.material.alpha = 0.5 + 0.5 * (this._laserTimer / this._laserDuration);
                }
            }
        }

        // Cooldown repositionnement
        if (this._repositionCd > 0) {
            this._repositionCd -= dt;
            return;
        }

        // Timer de tir
        this._fireTimer -= dt;
        if (this._fireTimer <= 0) {
            this._fireTimer = this._FIRE_INTERVAL + Math.random() * 0.5;
            this._fireLaser();
        }
    }

    // ── Dispose ──────────────────────────────────────────────────────────────

    dispose() {
        this._laserMesh?.dispose();
        if (!this.weakPoint.isDisposed()) this.weakPoint.dispose();
        if (!this.body.isDisposed())      this.body.dispose();
    }
}