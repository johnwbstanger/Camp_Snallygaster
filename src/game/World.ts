import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { DoorState } from "../../shared/protocol";

type DoorVisual = {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  body: CANNON.Body;
  open: boolean;
};

export class CampWorld {
  readonly scene = new THREE.Scene();
  readonly interactables: THREE.Object3D[] = [];

  private readonly doors = new Map<string, DoorVisual>();
  private readonly wood = new THREE.MeshStandardMaterial({ color: 0x76513c, roughness: 0.92 });
  private readonly darkWood = new THREE.MeshStandardMaterial({ color: 0x3d3028, roughness: 0.97 });
  private readonly cream = new THREE.MeshStandardMaterial({ color: 0xe7d9b7, roughness: 0.9 });
  private readonly mustard = new THREE.MeshStandardMaterial({ color: 0xd9aa42, roughness: 0.82 });
  private readonly metal = new THREE.MeshStandardMaterial({ color: 0x676d69, roughness: 0.5, metalness: 0.35 });

  constructor(private physics: CANNON.World, private mobile: boolean) {
    this.scene.background = new THREE.Color(0x22382f);
    this.scene.fog = new THREE.Fog(0x22382f, 34, mobile ? 125 : 155);
    this.addLights();
    this.addGround();
    this.addCamp();
    this.addProps();
    this.addTrees();
  }

  updateDoors(states: DoorState[]) {
    for (const state of states ?? []) this.applyDoorState(state.id, state.open);
  }

  toggleLocalDoor(id: string) {
    const door = this.doors.get(id);
    if (!door) return false;
    this.applyDoorState(id, !door.open);
    return true;
  }

  private applyDoorState(id: string, open: boolean) {
    const door = this.doors.get(id);
    if (!door) return;
    door.open = open;
    door.pivot.rotation.y = open ? -Math.PI * 0.46 : 0;
    door.body.collisionResponse = !open;
    door.body.wakeUp();
    door.mesh.userData.prompt = open ? "CLOSE DOOR" : "OPEN DOOR";
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0xf0d9a6, 0x142019, this.mobile ? 1.65 : 2.0));
    const sun = new THREE.DirectionalLight(0xffcf7a, this.mobile ? 1.0 : 1.35);
    sun.position.set(-36, 42, 22);
    sun.castShadow = !this.mobile;
    if (!this.mobile) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -80;
      sun.shadow.camera.right = 80;
      sun.shadow.camera.top = 80;
      sun.shadow.camera.bottom = -80;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 120;
    }
    this.scene.add(sun);

    const fireGlow = new THREE.PointLight(0xff8a4c, this.mobile ? 1.4 : 2.4, 22, 2);
    fireGlow.position.set(-8, 2.1, 22);
    this.scene.add(fireGlow);
  }

  private addGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 280),
      new THREE.MeshStandardMaterial({ color: 0x496548, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.mobile;
    this.scene.add(ground);

    this.addTrail(0, 21, 11, 54, 0);
    this.addTrail(0, -8, 8, 54, 0);
    this.addTrail(-16, 3, 7, 38, Math.PI / 2.35);
    this.addTrail(16, 3, 7, 38, -Math.PI / 2.35);
    this.addTrail(-19, -20, 6, 34, Math.PI / 2.15);
    this.addTrail(19, -20, 6, 34, -Math.PI / 2.15);
    this.addTrail(-34, -16, 5, 42, -0.35);
    this.addTrail(34, -16, 5, 42, 0.35);

    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(body);
  }

  private addTrail(x: number, z: number, width: number, length: number, rotation: number) {
    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshStandardMaterial({ color: 0x8b7557, roughness: 1 }),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.rotation.z = rotation;
    trail.position.set(x, 0.018, z);
    trail.receiveShadow = !this.mobile;
    this.scene.add(trail);
  }

  private addCamp() {
    this.addCabin("DINING HALL", "door:dining", 0, -28, 21, 5.4, 11, 0x7c5038, 0x342923, true);
    this.addCabin("CABIN A", "door:cabin-a", -23, 3, 10, 4.1, 7.5, 0x8f5b40, 0x463128);
    this.addCabin("CABIN B", "door:cabin-b", 23, 3, 10, 4.1, 7.5, 0x8f5b40, 0x463128);
    this.addCabin("BATH HOUSE", "door:bath-house", -27, -23, 9, 3.7, 7, 0x66786d, 0x33463c);
    this.addCabin("ARTS & CRAFTS", "door:arts-crafts", 27, -23, 10, 4, 7, 0xa96846, 0x52362b);
    this.addCabin("DIRECTOR", "door:director", 0, 12, 9, 3.8, 7, 0x704c38, 0x3a2b24);
    this.addCabin("CABIN C", "door:cabin-c", -45, 13, 10, 4, 7.5, 0x78523d, 0x3e3029);
    this.addCabin("CABIN D", "door:cabin-d", 45, 13, 10, 4, 7.5, 0x78523d, 0x3e3029);
    this.addCabin("INFIRMARY", "door:infirmary", -43, -40, 11, 4, 8, 0x6b8176, 0x35483f);
    this.addCabin("MAINTENANCE", "door:maintenance", 43, -40, 12, 4.2, 8, 0x595d52, 0x30332d);
    this.addBus();
    this.addFirepit();
    this.addEntranceArch();
  }

  private addCabin(
    name: string,
    doorId: string,
    x: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    wallColor: number,
    roofColor: number,
    lodge = false,
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const floorY = 0.34;
    const wallThickness = 0.24;
    const doorWidth = lodge ? 1.95 : 1.65;
    const doorHeight = 2.5;
    const wallY = floorY + height / 2;
    const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.97 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, depth), this.wood);
    floor.position.y = floorY - 0.11;
    floor.receiveShadow = !this.mobile;
    group.add(floor);

    const addWall = (geometry: THREE.BoxGeometry, localX: number, localY: number, localZ: number) => {
      const wall = new THREE.Mesh(geometry, wallMaterial);
      wall.position.set(localX, localY, localZ);
      wall.castShadow = !this.mobile;
      wall.receiveShadow = !this.mobile;
      group.add(wall);
    };

    addWall(new THREE.BoxGeometry(width, height, wallThickness), 0, wallY, -depth / 2);
    addWall(new THREE.BoxGeometry(wallThickness, height, depth), -width / 2, wallY, 0);
    addWall(new THREE.BoxGeometry(wallThickness, height, depth), width / 2, wallY, 0);

    const frontSegmentWidth = (width - doorWidth) / 2;
    const frontOffset = doorWidth / 2 + frontSegmentWidth / 2;
    addWall(new THREE.BoxGeometry(frontSegmentWidth, height, wallThickness), -frontOffset, wallY, depth / 2);
    addWall(new THREE.BoxGeometry(frontSegmentWidth, height, wallThickness), frontOffset, wallY, depth / 2);
    const headerHeight = Math.max(0.4, height - doorHeight);
    addWall(
      new THREE.BoxGeometry(doorWidth, headerHeight, wallThickness),
      0,
      floorY + doorHeight + headerHeight / 2,
      depth / 2,
    );

    this.addStaticBox(x, wallY, z - depth / 2, width / 2, height / 2, wallThickness / 2);
    this.addStaticBox(x - width / 2, wallY, z, wallThickness / 2, height / 2, depth / 2);
    this.addStaticBox(x + width / 2, wallY, z, wallThickness / 2, height / 2, depth / 2);
    this.addStaticBox(x - frontOffset, wallY, z + depth / 2, frontSegmentWidth / 2, height / 2, wallThickness / 2);
    this.addStaticBox(x + frontOffset, wallY, z + depth / 2, frontSegmentWidth / 2, height / 2, wallThickness / 2);

    const roofDepth = depth * 0.6 + 0.55;
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.8, 0.22, roofDepth), roofMaterial);
      panel.position.set(0, height + 1.05, side * depth * 0.25);
      panel.rotation.x = side * 0.48;
      panel.castShadow = !this.mobile;
      group.add(panel);
    }

    const porchWidth = lodge ? Math.min(width * 0.78, 13) : Math.min(width * 0.66, 6.2);
    const porch = new THREE.Mesh(new THREE.BoxGeometry(porchWidth, 0.2, 2.2), this.wood);
    porch.position.set(0, 0.3, depth / 2 + 1.0);
    porch.receiveShadow = !this.mobile;
    group.add(porch);

    for (const px of [-porchWidth / 2 + 0.35, porchWidth / 2 - 0.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.18), this.darkWood);
      post.position.set(px, 1.65, depth / 2 + 1.55);
      group.add(post);
    }

    const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x6f9692, roughness: 0.28, metalness: 0.08 });
    const windowCount = lodge ? 4 : 2;
    for (let i = 0; i < windowCount; i += 1) {
      const t = i / (windowCount - 1);
      const wx = THREE.MathUtils.lerp(-width * 0.34, width * 0.34, t);
      if (Math.abs(wx) < doorWidth) continue;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.15, 0.16), this.cream);
      frame.position.set(wx, 2.15, depth / 2 + 0.14);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.88), windowMaterial);
      glass.position.set(wx, 2.15, depth / 2 + 0.23);
      group.add(frame, glass);
    }

    const sign = this.makeSign(name, lodge ? 4.8 : 3.6, lodge ? 1.05 : 0.82);
    sign.position.set(0, height - 0.1, depth / 2 + 0.26);
    group.add(sign);

    if (lodge) {
      const chimney = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 2.5, 0.85),
        new THREE.MeshStandardMaterial({ color: 0x735d4b, roughness: 1 }),
      );
      chimney.position.set(width * 0.3, height + 1.55, -0.8);
      group.add(chimney);
      this.addDiningInterior(group, width, depth);
    } else if (name.startsWith("CABIN")) {
      this.addCabinInterior(group, width, depth);
    } else {
      this.addUtilityInterior(group, width, depth);
    }

    const pivot = new THREE.Group();
    pivot.position.set(-doorWidth / 2, floorY, depth / 2 + 0.16);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.14), this.darkWood);
    door.position.set(doorWidth / 2, doorHeight / 2, 0);
    door.userData.targetId = doorId;
    door.userData.prompt = "OPEN DOOR";
    pivot.add(door);
    group.add(pivot);
    this.interactables.push(door);

    this.scene.add(group);

    const doorBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(doorWidth / 2, doorHeight / 2, 0.1)),
    });
    doorBody.position.set(x, floorY + doorHeight / 2, z + depth / 2 + 0.16);
    this.physics.addBody(doorBody);
    this.doors.set(doorId, { pivot, mesh: door, body: doorBody, open: false });
  }

  private addDiningInterior(group: THREE.Group, width: number, depth: number) {
    for (const x of [-width * 0.26, 0, width * 0.26]) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 1.05), this.wood);
      table.position.set(x, 1.0, -0.6);
      group.add(table);
      for (const side of [-1, 1]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.12, 0.35), this.wood);
        bench.position.set(x, 0.58, -0.6 + side * 0.92);
        group.add(bench);
      }
    }
    const serving = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 1.0, 0.75), this.darkWood);
    serving.position.set(0, 0.75, -depth / 2 + 0.75);
    group.add(serving);
  }

  private addCabinInterior(group: THREE.Group, width: number, depth: number) {
    const bunkMaterial = new THREE.MeshStandardMaterial({ color: 0x82573f, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const x = side * (width / 2 - 1.0);
      for (const z of [-depth * 0.2, depth * 0.2]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.55, 2.1), bunkMaterial);
        frame.position.set(x, 0.95, z);
        group.add(frame);
        for (const y of [0.48, 1.25]) {
          const mattress = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 0.14, 1.85),
            new THREE.MeshStandardMaterial({ color: y < 1 ? 0xd4ba7c : 0x668f82, roughness: 0.95 }),
          );
          mattress.position.set(x, y, z);
          group.add(mattress);
        }
      }
    }
  }

  private addUtilityInterior(group: THREE.Group, width: number, depth: number) {
    const counter = new THREE.Mesh(new THREE.BoxGeometry(Math.min(width * 0.62, 5), 1.05, 0.75), this.wood);
    counter.position.set(0, 0.75, -depth / 2 + 0.72);
    group.add(counter);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.65), this.darkWood);
    cabinet.position.set(-width / 2 + 1.05, 1.05, -depth / 2 + 0.7);
    group.add(cabinet);
  }

  private addStaticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) });
    body.position.set(x, y, z);
    this.physics.addBody(body);
  }

  private addBus() {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.8, 3.2, 3.15), this.mustard);
    body.position.y = 1.8;
    body.castShadow = !this.mobile;
    bus.add(body);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.5, 3.08), this.mustard);
    hood.position.set(4.1, 1.35, 0);
    bus.add(hood);

    const glass = new THREE.MeshStandardMaterial({ color: 0x456d70, roughness: 0.24, metalness: 0.08 });
    for (const x of [-2.6, -1.4, -0.2, 1.0, 2.2]) {
      for (const side of [-1, 1]) {
        const window = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.76), glass);
        window.position.set(x, 2.25, side * 1.586);
        window.rotation.y = side < 0 ? Math.PI : 0;
        bus.add(window);
      }
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 3.3), this.metal);
    bumper.position.set(4.78, 0.82, 0);
    bus.add(bumper);

    const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x171918, roughness: 1 });
    for (const x of [-2.45, 2.45]) {
      for (const z of [-1.55, 1.55]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, this.mobile ? 10 : 16), tireMaterial);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(x, 0.56, z);
        bus.add(tire);
      }
    }

    bus.position.set(0, 0, 31);
    this.scene.add(bus);
    this.addStaticBox(0.45, 1.6, 31, 4.45, 1.6, 1.58);
  }

  private addFirepit() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.22, 8, this.mobile ? 18 : 28),
      new THREE.MeshStandardMaterial({ color: 0x4c4942, roughness: 1 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-8, 0.22, 22);

    const embers = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 1.02, 0.2, 14),
      new THREE.MeshStandardMaterial({ color: 0xd86f36, emissive: 0x7b3216, emissiveIntensity: 1.5, roughness: 0.8 }),
    );
    embers.position.set(-8, 0.14, 22);
    this.scene.add(ring, embers);

    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      this.addBench(-8 + Math.cos(angle) * 4.2, 22 + Math.sin(angle) * 4.2, angle + Math.PI / 2);
    }
  }

  private addEntranceArch() {
    const group = new THREE.Group();
    group.position.set(0, 0, 43.5);
    for (const x of [-4.2, 4.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 5.4, 10), this.darkWood);
      post.position.set(x, 2.7, 0);
      group.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 0.5), this.darkWood);
    beam.position.y = 5.15;
    group.add(beam);
    const sign = this.makeSign("CAMP SNALLYGASTER", 6.5, 1.25);
    sign.position.set(0, 4.35, 0.3);
    group.add(sign);
    this.scene.add(group);
  }

  private addProps() {
    this.addPicnicTable(-5.5, -17.5, 0.08);
    this.addPicnicTable(5.5, -17.5, -0.08);
    this.addPicnicTable(-10.5, -30, Math.PI / 2);
    this.addPicnicTable(10.5, -30, Math.PI / 2);

    this.addCooler(-10.5, 18.5, 0xc96e45);
    this.addCooler(-6.2, -21.8, 0x447d70);
    this.addCooler(7.2, -22.6, 0xe0b24d);
    this.addCooler(31.5, -20, 0xc96e45);

    this.addCrates(-38, -36);
    this.addCrates(38, -36);
    this.addCrates(28, -28);

    this.addLantern(-11, 20);
    this.addLantern(-5, 18);
    this.addLantern(-8, 27);
    this.addLantern(0, -18);

    this.addCanoeRack(53, -4, Math.PI / 2);
    this.addCanoeRack(-53, -4, -Math.PI / 2);
  }

  private addPicnicTable(x: number, z: number, rotation: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.05), this.wood);
    top.position.y = 1.25;
    group.add(top);
    for (const side of [-1, 1]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.16, 0.44), this.wood);
      bench.position.set(0, 0.72, side * 1.05);
      group.add(bench);
    }
    for (const xLeg of [-1.45, 1.45]) {
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.18), this.darkWood);
        leg.position.set(xLeg, 0.62, side * 0.58);
        leg.rotation.z = side * 0.24;
        group.add(leg);
      }
    }
    this.scene.add(group);
  }

  private addBench(x: number, z: number, rotation: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.55), this.wood);
    seat.position.y = 0.68;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.7), this.wood);
    back.position.set(0, 1.15, -0.27);
    back.rotation.x = -0.12;
    group.add(seat, back);
    this.scene.add(group);
  }

  private addCooler(x: number, z: number, color: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.82, 0.9),
      new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
    );
    body.position.y = 0.48;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.94), this.cream);
    lid.position.y = 0.98;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.055, 6, 16, Math.PI), this.metal);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.2, 0);
    group.add(body, lid, handle);
    this.scene.add(group);
  }

  private addCrates(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const positions = [[0, 0.5, 0], [1.1, 0.5, 0.15], [0.5, 1.45, -0.1]] as const;
    for (const [cx, cy, cz] of positions) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.95), this.wood);
      crate.position.set(cx, cy, cz);
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.11, 1.0), this.darkWood);
      band.position.set(cx, cy, cz);
      group.add(crate, band);
    }
    this.scene.add(group);
  }

  private addLantern(x: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.24, 12), this.metal);
    base.position.y = 0.18;
    const globe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0xf4d88b, emissive: 0xa95e28, emissiveIntensity: 1.2, roughness: 0.35 }),
    );
    globe.position.y = 0.5;
    group.add(base, globe);
    this.scene.add(group);
  }

  private addCanoeRack(x: number, z: number, rotation: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    for (const side of [-1, 1]) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), this.darkWood);
      rack.position.set(side * 1.6, 1.6, 0);
      group.add(rack);
    }
    for (let level = 0; level < 2; level += 1) {
      const canoe = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.42, 3.1, 5, this.mobile ? 8 : 14),
        new THREE.MeshStandardMaterial({ color: level === 0 ? 0xc96e45 : 0x447d70, roughness: 0.78 }),
      );
      canoe.rotation.z = Math.PI / 2;
      canoe.scale.set(1, 0.45, 0.72);
      canoe.position.y = 1.0 + level * 1.1;
      group.add(canoe);
    }
    this.scene.add(group);
  }

  private addTrees() {
    const count = this.mobile ? 96 : 148;
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 5.2, this.mobile ? 7 : 10);
    const crownGeometry = new THREE.ConeGeometry(2.4, 6.8, this.mobile ? 7 : 10);
    const trunks = new THREE.InstancedMesh(
      trunkGeometry,
      new THREE.MeshStandardMaterial({ color: 0x553d2e, roughness: 1 }),
      count,
    );
    const crowns = new THREE.InstancedMesh(
      crownGeometry,
      new THREE.MeshStandardMaterial({ color: 0x284e38, roughness: 1 }),
      count,
    );
    trunks.castShadow = !this.mobile;
    crowns.castShadow = !this.mobile;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    for (let i = 0; i < count; i += 1) {
      const ring = i % 3;
      const angle = (i / count) * Math.PI * 2 * 2.75 + (i % 7) * 0.19;
      const radius = 62 + ring * 17 + (i % 9) * 3.8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const scale = 0.84 + (i % 6) * 0.065;

      matrix.compose(new THREE.Vector3(x, 2.6 * scale, z), quaternion, new THREE.Vector3(scale, scale, scale));
      trunks.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(x, 7.4 * scale, z), quaternion, new THREE.Vector3(scale, scale, scale));
      crowns.setMatrixAt(i, matrix);

      if (i % 5 === 0 && radius < 92) {
        const collider = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Cylinder(0.48 * scale, 0.48 * scale, 5.2 * scale, 8),
        });
        collider.position.set(x, 2.6 * scale, z);
        this.physics.addBody(collider);
      }
    }

    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    this.scene.add(trunks, crowns);
  }

  private makeSign(label: string, width: number, height: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    if (context) {
      context.fillStyle = "#e8d9b4";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#284b3d";
      context.fillRect(12, 12, canvas.width - 24, canvas.height - 24);
      context.fillStyle = "#e8d9b4";
      context.font = `800 ${label.length > 13 ? 54 : 66}px Arial Narrow, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: false }));
    sprite.scale.set(width, height, 1);
    return sprite;
  }
}
