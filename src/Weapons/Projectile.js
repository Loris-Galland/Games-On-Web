import * as BABYLON from "@babylonjs/core";
import { EnemyParticles } from "../Enemies/EnemyParticles";

export class Projectile {
    constructor(scene, startPosition, direction, isEnemy = false) {
        this.scene   = scene;
        this.speed   = 40;
        this.isEnemy = isEnemy;

        this.mesh = BABYLON.MeshBuilder.CreateCylinder(
            "projectile",
            { height: 0.6, diameter: 0.05 },
            scene,
        );

        this.mesh.position = startPosition.clone().add(direction.scale(0.5));

        this.direction = direction.normalize();
        this.mesh.rotationQuaternion = BABYLON.Quaternion.FromLookDirectionRH(
            this.direction,
            BABYLON.Vector3.Up(),
        );
        this.mesh.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);

        const mat = new BABYLON.StandardMaterial("projMat", scene);
        mat.emissiveColor = isEnemy
            ? new BABYLON.Color3(1, 0, 0)
            : new BABYLON.Color3(0, 1, 1);
        mat.disableLighting = true;
        this.mesh.material  = mat;

        this.mesh.alwaysSelectAsActiveMesh = true;

        this.lifeTime  = 2000;
        this.spawnTime = Date.now();

        this.observer = this.scene.onBeforeRenderObservable.add(() => this.update());
    }

    update() {
        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        const ray = new BABYLON.Ray(
            this.mesh.position,
            this.direction,
            this.speed * deltaTime,
        );
        const hit = this.scene.pickWithRay(
            ray,
            (mesh) => mesh.isPickable && mesh !== this.mesh,
        );

        if (hit.hit) {
            this.onHit(hit);
            return;
        }

        this.mesh.position.addInPlace(this.direction.scale(this.speed * deltaTime));

        if (Date.now() - this.spawnTime > this.lifeTime) {
            this.destroy();
        }
    }

    onHit(hitResult) {
        const meshTouché = hitResult.pickedMesh;

        if (meshTouché.name === "weakPoint") {
            // Pas de particules d'impact sur les weakpoints — l'explosion de mort suffit
            if (meshTouché.parent) meshTouché.parent.dispose();

        } else if (
            meshTouché.name === "enemyBody"      ||
            meshTouché.name === "enemyBodyHeavy" ||
            meshTouché.name === "enemyBodyScout"
        ) {
            // Impact sur armure : petit splash cyan
            const impactPos = hitResult.pickedPoint ?? this.mesh.position.clone();
            const normal    = hitResult.getNormal(true) ?? BABYLON.Vector3.Up();
            EnemyParticles.projectileImpact(this.scene, impactPos, normal);

        } else {
            // Impact sur le décor (mur, sol, prop...)
            const impactPos = hitResult.pickedPoint ?? this.mesh.position.clone();
            const normal    = hitResult.getNormal(true) ?? BABYLON.Vector3.Up();
            EnemyParticles.projectileImpact(this.scene, impactPos, normal);
        }

        this.destroy();
    }

    destroy() {
        this.scene.onBeforeRenderObservable.remove(this.observer);
        this.mesh.dispose();
    }
}