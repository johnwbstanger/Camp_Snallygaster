import * as THREE from "three";
import * as CANNON from "cannon-es";

export class CampWorld {
  readonly scene = new THREE.Scene();

  constructor(private physics: CANNON.World, private mobile: boolean) {
    this.scene.background = new THREE.Color(0x22382f);
    this.scene.fog = new THREE.Fog(0x22382f, 24, 92);
    this.addLights();
    this.addGround();
    this.addCamp();
    this.addTrees();
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight(0xf5dca0, 0x16231d, this.mobile ? 1.8 : 2.2);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd27b, this.mobile ? 1.1 : 1.5);
    sun.position.set(-18, 28, 12);
    sun.castShadow = !this.mobile;
    if (!this.mobile) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -45;
      sun.shadow.camera.right = 45;
      sun.shadow.camera.top = 45;
      sun.shadow.camera.bottom = -45;
    }
    this.scene.add(sun);
  }

  private addGround() {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x4f684c, roughness: 1 }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = !this.mobile;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(body);
  }

  private addCamp() {
    this.addBox("Dining Hall", 0, 2.5, -18, 18, 5, 9, 0x7e5036);
    this.addBox("Cabin A", -19, 2, 4, 9, 4, 7, 0x965b3f);
    this.addBox("Cabin B", 19, 2, 4, 9, 4, 7, 0x965b3f);
    this.addBox("Bath House", -18, 1.7, -22, 8, 3.4, 6, 0x6d7c6e);
    this.addBox("Arts Cabin", 19, 1.8, -22, 8, 3.6, 6, 0xb26e48);
    this.addBox("Director", 0, 1.7, 9, 8, 3.4, 6, 0x6e4a34);

    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 3.1, 3),
      new THREE.MeshStandardMaterial({ color: 0xd8ae3f, roughness: 0.8 }),
    );
    bus.position.set(0, 1.55, 31);
    bus.castShadow = !this.mobile;
    this.scene.add(bus);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 55),
      new THREE.MeshStandardMaterial({ color: 0x776c5b, roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, 24);
    this.scene.add(road);
  }

  private addTrees() {
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x59412f, roughness: 1 });
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x294b37, roughness: 1 });
    const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.48, 4.5, this.mobile ? 6 : 8);
    const crownGeometry = new THREE.ConeGeometry(2.2, 6, this.mobile ? 6 : 8);

    for (let i = 0; i < 42; i += 1) {
      const angle = (i / 42) * Math.PI * 2 + (i % 3) * 0.17;
      const radius = 38 + (i % 7) * 3.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.set(x, 2.25, z);
      const crown = new THREE.Mesh(crownGeometry, crownMaterial);
      crown.position.set(x, 6.8, z);
      this.scene.add(trunk, crown);

      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.5, 0.5, 4.5, 8) });
      body.position.set(x, 2.25, z);
      this.physics.addBody(body);
    }
  }

  private addBox(name: string, x: number, y: number, z: number, width: number, height: number, depth: number, color: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
    );
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = !this.mobile;
    mesh.receiveShadow = !this.mobile;
    this.scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({ mass: 0, shape });
    body.position.set(x, y, z);
    this.physics.addBody(body);
  }
}
