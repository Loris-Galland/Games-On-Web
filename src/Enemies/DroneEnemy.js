import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "./EnemyParticles";

/**
 * DroneEnemy
 * ----------
 * Drone volant : flotte au-dessus du joueur, tire des projectiles en direction
 * du joueur à intervalle régulier. Se déplace lentement en orbite.
 */
export class DroneEnemy {

    static MAX_HEALTH  = 2;
    static FLOAT_HEIGHT = 3.5;  // hauteur au-dessus du sol

    constructor(scene, position, player) {
        this.scene  = scene;
        this.player = player;

        this.currentHealth = DroneEnemy.MAX_HEALTH;

        this._fireTimer     = 1.0 + Math.random() * 1.5;
        this._FIRE_INTERVAL = 3.0;
        this._orbitAngle    = Math.random() * Math.PI * 2;
        this._orbitRadius   = 5 + Math.random() * 4;
        this._orbitSpeed    = 0.4 + Math.random() * 0.3;
        this._bobTimer      = Math.random() * Math.PI * 2;

        this.body = BABYLON.MeshBuilder.CreateBox("droneBody", {
            width: 0.8, height: 0.25, depth: 0.8,
        }, scene);
        this.body.position    = new BABYLON.Vector3(position.x, DroneEnemy.FLOAT_HEIGHT, position.z);
        this.body.isPickable  = true;
        this.body.checkCollisions = true;   // respecte les murs
        this.body.ellipsoid       = new BABYLON.Vector3(0.5, 0.2, 0.5);

        const mat = new BABYLON.StandardMaterial("droneMat_" + Math.random().toString(36).slice(2), scene);
        mat.diffuseColor  = new BABYLON.Color3(0.1, 0.1, 0.4);
        mat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.3);
        this.body.material = mat;

        this._rotors = [];
        const rotorOffsets = [
            new BABYLON.Vector3( 0.5, 0,  0.5),
            new BABYLON.Vector3(-0.5, 0,  0.5),
            new BABYLON.Vector3( 0.5, 0, -0.5),
            new BABYLON.Vector3(-0.5, 0, -0.5),
        ];
        for (const offset of rotorOffsets) {
            const rotor = BABYLON.MeshBuilder.CreateBox("droneRotor", {
                width: 0.15, height: 0.05, depth: 0.4,
            }, scene);
            rotor.parent   = this.body;
            rotor.position = offset;
            rotor.material = mat;
            this._rotors.push(rotor);
        }

        this.weakPoint = BABYLON.MeshBuilder.CreateSphere("weakPoint", { diameter: 0.65 }, scene);
        this.weakPoint.parent    = this.body;
        this.weakPoint.position  = new BABYLON.Vector3(0, -0.2, 0);
        this.weakPoint.isPickable = true;

        const weakMat = new BABYLON.StandardMaterial("droneWeakMat_" + Math.random().toString(36).slice(2), scene);
        weakMat.emissiveColor   = new BABYLON.Color3(1, 0.2, 1);   // magenta visible
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        this._light = new BABYLON.PointLight("droneLight_" + Math.random(), this.body.position.clone(), scene);
        this._light.diffuse   = new BABYLON.Color3(0.2, 0.4, 1);
        this._light.intensity = 0.4;
        this._light.range     = 4;

        this._observer = scene.onBeforeRenderObservable.add(() => this._update());

        this.body.onDisposeObservable.add(() => {
            scene.onBeforeRenderObservable.remove(this._observer);
            this._light.dispose();
            EnemyParticles.death(scene, this.body.position.clone(), new BABYLON.Color3(0.2, 0.4, 1));
        });

        this.body._takeDamage      = (dmg) => this._takeDamage(dmg);
        this.weakPoint._takeDamage = (dmg) => this._takeDamage(dmg * 2);
    }


    /**
     * @param {number} dmg
     */
    _takeDamage(dmg = 1) {
        if (this.body.isDisposed()) return;
        this.currentHealth -= dmg;

        const mat = this.body.material;
        const orig = mat.emissiveColor.clone();
        mat.emissiveColor = new BABYLON.Color3(1, 0, 0);
        setTimeout(() => { if (!this.body.isDisposed()) mat.emissiveColor = orig; }, 80);

        if (this.currentHealth <= 0) {
            this.weakPoint.dispose();
            this.body.dispose();
        }
    }

    _fireProjectile() {
    const from      = this.body.position.clone();
    const playerPos = this.player.camera.globalPosition.clone();
    const dir       = playerPos.subtract(from).normalize();

    const proj = BABYLON.MeshBuilder.CreateSphere("droneProj", { diameter: 0.18 }, this.scene);
    proj.position   = from.clone();
    proj.isPickable = false;

    const projMat = new BABYLON.StandardMaterial("droneProjMat", this.scene);
    projMat.emissiveColor   = new BABYLON.Color3(0.3, 0.6, 1);
    projMat.disableLighting = true;
    proj.material = projMat;

    const projLight = new BABYLON.PointLight("droneProjLight", from.clone(), this.scene);
    projLight.diffuse   = new BABYLON.Color3(0.3, 0.6, 1);
    projLight.intensity = 0.6;
    projLight.range     = 3;

    const SPEED    = 12;
    const LIFETIME = 3000;
    const spawn    = Date.now();

    const obs = this.scene.onBeforeRenderObservable.add(() => {
        if (proj.isDisposed()) { this.scene.onBeforeRenderObservable.remove(obs); projLight.dispose(); return; }

        const dt = this.scene.getEngine().getDeltaTime() / 1000;

        const camPos       = this.player.camera.globalPosition;
        const distToPlayer = BABYLON.Vector3.Distance(proj.position, camPos);

        if (distToPlayer < 0.9 && !this.player.isDead) {
            this.player.health?.takeDamage(1);
            EnemyParticles.projectileImpact(this.scene, proj.position.clone(), BABYLON.Vector3.Up());
            this.scene.onBeforeRenderObservable.remove(obs);
            projLight.dispose();
            proj.dispose();
            return;
        }

        const ray = new BABYLON.Ray(proj.position.clone(), dir, SPEED * dt * 1.5);
        const hit = this.scene.pickWithRay(ray, m =>
            m.isPickable && m !== proj && !m.name.startsWith("drone") &&
            !m.name.startsWith("weapon") && !m.name.startsWith("weakPoint") &&
            !m.name.startsWith("spider")
        );

        if (hit.hit) {
            EnemyParticles.projectileImpact(
                this.scene,
                hit.pickedPoint,
                hit.getNormal(true) ?? BABYLON.Vector3.Up(),
            );
            this.scene.onBeforeRenderObservable.remove(obs);
            projLight.dispose();
            proj.dispose();
            return;
        }

        proj.position.addInPlace(dir.scale(SPEED * dt));
        projLight.position.copyFrom(proj.position);

        if (Date.now() - spawn > LIFETIME) {
            this.scene.onBeforeRenderObservable.remove(obs);
            projLight.dispose();
            proj.dispose();
        }
    });
}

    _update() {
        if (this.body.isDisposed() || !this.player?.camera) return;

        const dt        = this.scene.getEngine().getDeltaTime() / 1000;
        const playerPos = this.player.camera.globalPosition;

        this._orbitAngle += this._orbitSpeed * dt;
        this._bobTimer   += dt * 1.5;

        const targetX = playerPos.x + Math.cos(this._orbitAngle) * this._orbitRadius;
        const targetZ = playerPos.z + Math.sin(this._orbitAngle) * this._orbitRadius;
        const targetY = DroneEnemy.FLOAT_HEIGHT + Math.sin(this._bobTimer) * 0.3;

        const desired = new BABYLON.Vector3(targetX, targetY, targetZ);
        const delta   = desired.subtract(this.body.position).scale(0.04);
        this.body.moveWithCollisions(delta);

        this._light.position.copyFrom(this.body.position);

        this._rotors.forEach((r, i) => {
            r.rotation.y += (i % 2 === 0 ? 1 : -1) * 8 * dt;
        });

        const toPlayer = playerPos.subtract(this.body.position);
        toPlayer.y = 0;
        if (toPlayer.length() > 0.1) {
            const angle = Math.atan2(toPlayer.x, toPlayer.z);
            this.body.rotation.y = BABYLON.Scalar.Lerp(this.body.rotation.y, angle, 0.08);
        }

        this._light.intensity = 0.3 + Math.sin(this._bobTimer * 3) * 0.1;

        this._fireTimer -= dt;
        if (this._fireTimer <= 0) {
            this._fireTimer = this._FIRE_INTERVAL + Math.random() * 0.5;
            this._fireProjectile();
        }
    }

    dispose() {
        this._light?.dispose();
        if (!this.weakPoint?.isDisposed()) this.weakPoint?.dispose();
        if (!this.body?.isDisposed())      this.body?.dispose();
    }
}