import * as BABYLON from "@babylonjs/core";

export class DummyEnemy {
    constructor(scene, position, player, speed = 0.3) {
        this.scene  = scene;
        this.player = player;
        this.speed  = speed;

        this.gravity         = -9.81;
        this.verticalVelocity = 0;
        this.isGrounded      = false;

        // Corps principal
        this.body = BABYLON.MeshBuilder.CreateBox(
            "enemyBody",
            { width: 1.5, height: 2.5, depth: 1.5 },
            scene,
        );
        this.body.position = new BABYLON.Vector3(position.x, position.y + 1.25, position.z);
        this.body.ellipsoid = new BABYLON.Vector3(0.75, 1.25, 0.75);
        this.body.refreshBoundingInfo();
        this.body.showBoundingBox    = true;
        this.body.showSubMeshesBoundingBox = true;
        this.body.checkCollisions    = true;

        const bodyMat = new BABYLON.StandardMaterial("bodyMat", scene);
        bodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25);
        this.body.material   = bodyMat;

        // Point faible
        this.weakPoint = BABYLON.MeshBuilder.CreateSphere(
            "weakPoint",
            { diameter: 0.5 },
            scene,
        );
        this.weakPoint.parent     = this.body;
        this.weakPoint.position.y = 0.8;
        this.weakPoint.position.z = 0.75;

        const weakMat = new BABYLON.StandardMaterial("weakMat", scene);
        weakMat.emissiveColor  = new BABYLON.Color3(1, 0, 0);
        weakMat.disableLighting = true;
        this.weakPoint.material = weakMat;

        this.observer = this.scene.onBeforeRenderObservable.add(() => this._update());
        this.body.onDisposeObservable.add(() => {
            this.scene.onBeforeRenderObservable.remove(this.observer);
        });
    }

    _update() {
        if (!this.player || !this.player.camera) return;

        const deltaTime = this.scene.getEngine().getDeltaTime() / 1000;

        this.verticalVelocity += this.gravity * deltaTime;
        this.verticalVelocity = Math.max(this.verticalVelocity, -20);

        let horizontalVelocity = BABYLON.Vector3.Zero();
        const targetPos = this.player.camera.globalPosition.clone();
        targetPos.y = this.body.position.y;

        const distance = BABYLON.Vector3.Distance(this.body.position, targetPos);
        if (distance > 2) {
            const direction = targetPos.subtract(this.body.position).normalize();
            horizontalVelocity = direction.scale(this.speed * deltaTime);
        }

        const finalVelocity = new BABYLON.Vector3(
            horizontalVelocity.x,
            this.verticalVelocity * deltaTime,
            horizontalVelocity.z,
        );

        this.body.moveWithCollisions(finalVelocity);

        const ray = new BABYLON.Ray(
            this.body.position,
            new BABYLON.Vector3(0, -1, 0),
            1.35,
        );
        const hit = this.scene.pickWithRay(
            ray,
            (mesh) => mesh.checkCollisions && mesh !== this.body,
        );

        if (hit.hit && this.verticalVelocity < 0) {
            this.verticalVelocity = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        this.body.lookAt(targetPos);
    }
}