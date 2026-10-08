import * as THREE from "three";
import * as CANNON from "cannon-es";

export class CampWorld {
  readonly scene = new THREE.Scene();

  constructor(private physics: CANNON.World, private mobile: boolean) {
    this.scene.background = new THREE.Color(0x22382f);
    this.scene.fog = new THREE.Fog(0x22382f, 24, 96);
    this.addLights();
    this.addGround();
    this.addCamp();
    this.addTrees();
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0xf5dca0, 0x16231d, this.mobile ? 1.8 : 2.2));
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
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x4f684c, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.mobile;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 58),
      new THREE.MeshStandardMaterial({ color: 0x776c5b, roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, 23);
    this.scene.add(road);

    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(body);
  }

  private addCamp() {
    this.addCabin("Dining Hall", 0, -18, 18, 5, 9, 0x7e5036, 0x3b2c24);
    this.addCabin("Cabin A", -19, 4, 9, 4, 7, 0x965b3f, 0x493128);
    this.addCabin("Cabin B", 19, 4, 9, 4, 7, 0x965b3f, 0x493128);
    this.addCabin("Bath House", -18, -22, 8, 3.4, 6, 0x6d7c6e, 0x38473d);
    this.addCabin("Arts Cabin", 19, -22, 8, 3.6, 6, 0xb26e48, 0x5d382b);
    this.addCabin("Director", 0, 9, 8, 3.4, 6, 0x6e4a34, 0x3c2c24);
    this.addBus();
    this.addFirepit();
  }

  private addCabin(name: string, x: number, z: number, width: number, height: number, depth: number, wallColor: number, roofColor: number) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.94 }),
    );
    wall.name = name;
    wall.position.set(x, height / 2, z);
    wall.castShadow = !this.mobile;
    wall.receiveShadow = !this.mobile;
    this.scene.add(wall);

    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(0, Math.max(width, depth) * 0.72, Math.min(width, depth) * 1.02, 4, 1, false, Math.PI / 4),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 1 }),
    );
    roof.rotation.z = Math.PI / 2;
    roof.scale.set(1, width / Math.max(width, depth), 1);
    roof.position.set(x, height + 0.45, z);
    roof.castShadow = !this.mobile;
    this.scene.add(roof);

    const porch = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(width * 0.58, 5.5), 0.16, 1.35),
      new THREE.MeshStandardMaterial({ color: 0x76523a, roughness: 1 }),
    );
    porch.position.set(x, 0.12, z + depth / 2 + 0.65);
    this.scene.add(porch);

    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)) });
    body.position.set(x, height / 2, z);
    this.physics.addBody(body);
  }

  private addBus() {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 3.1, 3),
      new THREE.MeshStandardMaterial({ color: 0xd8ae3f, roughness: 0.8 }),
    );
    body.position.y = 1.75;
    body.castShadow = !this.mobile;
    bus.add(body);

    const glass = new THREE.MeshStandardMaterial({ color: 0x41666a, roughness: 0.28, metalness: 0.08 });
    for (const x of [-2.4, -1.15, 0.1, 1.35, 2.6]) {
      const window = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.78), glass);
      window.position.set(x, 2.15, 1.506);
      bus.add(window);
    }
    const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x171918, roughness: 1 });
    for (const x of [-2.4, 2.4]) {
      for (const z of [-1.45, 1.45]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 10), tireMaterial);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(x, 0.55, z);
        bus.add(tire);
      }
    }
    bus.position.set(0, 0, 31);
    this.scene.add(bus);

    const collider = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(3.75, 1.55, 1.5)) });
    collider.position.set(0, 1.55, 31);
    this.physics.addBody(collider);
  }

  private addFirepit() {
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x4c4942, roughness: 1 });
    const emberMaterial = new THREE.MeshStandardMaterial({ color: 0xd86f36, emissive: 0x6d2d12, emissiveIntensity: 1.4, roughness: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 6, 18), ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-4, 0.18, 23);
    const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.9, 0.18, 12), emberMaterial);
    embers.position.set(-4, 0.12, 23);
    this.scene.add(ring, embers);
  }

  private addTrees() {
    const count = 42;
    const trunkGeometry = new THREE.CylinderGeometry(0.32, 0.48, 4.5, this.mobile ? 6 : 8);
    const crownGeometry = new THREE.ConeGeometry(2.2, 6, this.mobile ? 6 : 8);
    const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: 0x59412f, roughness: 1 }), count);
    const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshStandardMaterial({ color: 0x294b37, roughness: 1 }), count);
    trunks.castShadow = !this.mobile;
    crowns.castShadow = !this.mobile;
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.17;
      const radius = 38 + (i % 7) * 3.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.88 + (i % 5) * 0.055;
      matrix.compose(new THREE.Vector3(x, 2.25 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(x, 6.8 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
      crowns.setMatrixAt(i, matrix);

      const collider = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(0.5 * scale, 0.5 * scale, 4.5 * scale, 8) });
      collider.position.set(x, 2.25 * scale, z);
      this.physics.addBody(collider);
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }
}
