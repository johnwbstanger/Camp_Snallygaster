import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { DoorState } from "../../shared/protocol";
import { assetLibrary } from "./AssetLibrary";

type DoorVisual = {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  body: CANNON.Body;
  open: boolean;
  hingeX: number;
  hingeZ: number;
  width: number;
};

type CabinSpec = readonly [string, string, number, number, number, number, number, number, number, boolean];
const CABINS: readonly CabinSpec[] = [
  ["DINING HALL", "door:dining", 0, -28, 21, 5.4, 11, 0x76513d, 0x292420, true],
  ["CABIN A", "door:cabin-a", -23, 3, 10, 4.1, 7.5, 0x82583f, 0x342923, false],
  ["CABIN B", "door:cabin-b", 23, 3, 10, 4.1, 7.5, 0x82583f, 0x342923, false],
  ["BATH HOUSE", "door:bath-house", -27, -23, 9, 3.7, 7, 0x5f756c, 0x2f4039, false],
  ["ARTS & CRAFTS", "door:arts-crafts", 27, -23, 10, 4, 7, 0x9b6848, 0x422f28, false],
  ["DIRECTOR", "door:director", 0, 12, 9, 3.8, 7, 0x704c38, 0x302720, false],
  ["CABIN C", "door:cabin-c", -45, 13, 10, 4, 7.5, 0x72513f, 0x342a24, false],
  ["CABIN D", "door:cabin-d", 45, 13, 10, 4, 7.5, 0x72513f, 0x342a24, false],
  ["INFIRMARY", "door:infirmary", -43, -40, 11, 4, 8, 0x637c72, 0x30443d, false],
  ["MAINTENANCE", "door:maintenance", 43, -40, 12, 4.2, 8, 0x545d54, 0x2b302b, false],
];

export class CampWorld {
  readonly scene = new THREE.Scene();
  readonly interactables: THREE.Object3D[] = [];
  private readonly doors = new Map<string, DoorVisual>();
  private readonly wood = new THREE.MeshStandardMaterial({ color: 0x6f4b35, roughness: 0.78, metalness: 0.01 });
  private readonly darkWood = new THREE.MeshStandardMaterial({ color: 0x2d251f, roughness: 0.82 });
  private readonly cream = new THREE.MeshStandardMaterial({ color: 0xe5d8bc, roughness: 0.76 });
  private readonly mustard = new THREE.MeshStandardMaterial({ color: 0xd8a83f, roughness: 0.58, metalness: 0.04 });
  private readonly metal = new THREE.MeshStandardMaterial({ color: 0x5c6461, roughness: 0.42, metalness: 0.48 });

  private dirt: THREE.CanvasTexture | null | undefined;

  constructor(private physics: CANNON.World, private mobile: boolean) {
    this.scene.background = new THREE.Color(0x24394a);
    this.scene.fog = new THREE.FogExp2(0x2a3d46, mobile ? 0.011 : 0.0085);
    this.addSky();
    this.addLights();
    this.addGround();
    this.addCamp();
    this.addProps();
    this.addTrees();
  }

  updateDoors(states: DoorState[]) { for (const state of states ?? []) this.applyDoorState(state.id, state.open); }
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
    const angle = open ? -Math.PI * 0.48 : 0;
    door.pivot.rotation.y = angle;
    door.mesh.userData.prompt = open ? "CLOSE DOOR" : "OPEN DOOR";
    door.body.collisionResponse = true;
    door.body.quaternion.setFromEuler(0, angle, 0);
    const half = door.width / 2;
    door.body.position.x = door.hingeX + Math.cos(angle) * half;
    door.body.position.z = door.hingeZ - Math.sin(angle) * half;
    door.body.aabbNeedsUpdate = true;
    door.body.wakeUp();
  }

  private addLights() {
    this.scene.add(new THREE.HemisphereLight(0xb9b4c8, 0x1d2a1f, this.mobile ? 1.25 : 1.5));
    const moon = new THREE.DirectionalLight(0xbfd6d8, this.mobile ? 1.4 : 2.0);
    moon.position.set(-34, 52, 24);
    moon.castShadow = !this.mobile;
    if (!this.mobile) {
      moon.shadow.mapSize.set(2048, 2048);
      moon.shadow.camera.left = -85; moon.shadow.camera.right = 85;
      moon.shadow.camera.top = 85; moon.shadow.camera.bottom = -85;
      moon.shadow.camera.near = 1; moon.shadow.camera.far = 140; moon.shadow.bias = -0.0002;
    }
    this.scene.add(moon);
    const dusk = new THREE.DirectionalLight(0xf0a05a, 1.6); dusk.position.set(52, 18, -65); this.scene.add(dusk);
    for (const [x, z] of [[-8, 22], [0, -20], [-24, 7], [24, 7]] as const) {
      const lamp = new THREE.PointLight(0xffb45d, this.mobile ? 1.25 : 2.2, 18, 2); lamp.position.set(x, 2.3, z); this.scene.add(lamp);
    }
  }

  private noiseTexture(base: [number, number, number], variance: number, repeat: number) {
    const size = 256, canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const image = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i += 1) {
      const n = (Math.random() - 0.5) * variance, blade = Math.random() < 0.06 ? variance * 0.7 : 0;
      image.data[i * 4] = Math.max(0, Math.min(255, base[0] + n * 0.7 + blade * 0.3));
      image.data[i * 4 + 1] = Math.max(0, Math.min(255, base[1] + n + blade));
      image.data[i * 4 + 2] = Math.max(0, Math.min(255, base[2] + n * 0.6));
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = this.mobile ? 2 : 8;
    return texture;
  }

  private addSky() {
    const geometry = new THREE.SphereGeometry(170, 24, 16);
    const colors: number[] = [];
    const top = new THREE.Color(0x10182b), mid = new THREE.Color(0x4b4a6b), horizon = new THREE.Color(0xe08a4f);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i += 1) {
      const t = Math.max(0, position.getY(i) / 170);
      const color = t < 0.25 ? horizon.clone().lerp(mid, t / 0.25) : mid.clone().lerp(top, Math.min(1, (t - 0.25) / 0.6));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.name = "dusk-sky"; sky.renderOrder = -1; this.scene.add(sky);
  }

  private addGround() {
    const grass = this.noiseTexture([58, 88, 54], 46, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: grass ? 0xffffff : 0x3b5a3f, map: grass, roughness: 0.98 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = !this.mobile; this.scene.add(ground);
    const trails: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [0, 21, 11, 54, 0], [0, -8, 8, 54, 0], [-16, 3, 7, 38, Math.PI / 2.35],
      [16, 3, 7, 38, -Math.PI / 2.35], [-19, -20, 6, 34, Math.PI / 2.15],
      [19, -20, 6, 34, -Math.PI / 2.15], [-34, -16, 5, 42, -0.35], [34, -16, 5, 42, 0.35],
    ];
    for (const [x, z, width, length, rotation] of trails) this.addTrail(x, z, width, length, rotation);
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); this.physics.addBody(body);
  }

  private addTrail(x: number, z: number, width: number, length: number, rotation: number) {
    this.dirt ??= this.noiseTexture([128, 106, 76], 34, 3);
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(width, length), new THREE.MeshStandardMaterial({ color: this.dirt ? 0xffffff : 0x756347, map: this.dirt, roughness: 1 }));
    trail.rotation.x = -Math.PI / 2; trail.rotation.z = rotation; trail.position.set(x, 0.018, z); trail.receiveShadow = !this.mobile; this.scene.add(trail);
  }

  private addCamp() {
    for (const cabin of CABINS) {
      const [name, doorId, x, z, width, height, depth, wallColor, roofColor, lodge] = cabin;
      this.addCabin(name, doorId, x, z, width, height, depth, wallColor, roofColor, lodge);
    }
    this.addBus(); this.addFirepit(); this.addEntranceArch();
  }

  private addCabin(name: string, doorId: string, x: number, z: number, width: number, height: number, depth: number, wallColor: number, roofColor: number, lodge: boolean) {
    const group = new THREE.Group(); group.name = `building:${name}`; group.position.set(x, 0, z);
    const floorY = 0.32, visibleWall = 0.2, collisionWall = 0.46;
    const doorWidth = lodge ? 2.0 : 1.72, doorHeight = 2.45, wallY = floorY + height / 2;
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.72 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.82 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.24, depth), this.wood); floor.position.y = floorY - 0.12; floor.receiveShadow = !this.mobile; group.add(floor);

    const wall = (w: number, h: number, d: number, lx: number, ly: number, lz: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); mesh.position.set(lx, ly, lz); mesh.castShadow = !this.mobile; mesh.receiveShadow = !this.mobile; group.add(mesh);
    };
    wall(width, height, visibleWall, 0, wallY, -depth / 2);
    wall(visibleWall, height, depth, -width / 2, wallY, 0); wall(visibleWall, height, depth, width / 2, wallY, 0);
    const frontWidth = (width - doorWidth) / 2, frontOffset = doorWidth / 2 + frontWidth / 2;
    wall(frontWidth, height, visibleWall, -frontOffset, wallY, depth / 2); wall(frontWidth, height, visibleWall, frontOffset, wallY, depth / 2);
    const headerHeight = Math.max(0.5, height - doorHeight); wall(doorWidth, headerHeight, visibleWall, 0, floorY + doorHeight + headerHeight / 2, depth / 2);

    this.addStaticBox(x, wallY, z - depth / 2, width / 2, height / 2, collisionWall / 2);
    this.addStaticBox(x - width / 2, wallY, z, collisionWall / 2, height / 2, depth / 2);
    this.addStaticBox(x + width / 2, wallY, z, collisionWall / 2, height / 2, depth / 2);
    this.addStaticBox(x - frontOffset, wallY, z + depth / 2, frontWidth / 2, height / 2, collisionWall / 2);
    this.addStaticBox(x + frontOffset, wallY, z + depth / 2, frontWidth / 2, height / 2, collisionWall / 2);

    const sidingMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallColor).multiplyScalar(1.08), roughness: 0.66 });
    for (let i = 0; i < Math.floor(height / 0.32); i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(width - 0.28, 0.025, 0.045), sidingMat); slat.position.set(0, floorY + 0.18 + i * 0.32, depth / 2 + 0.115); group.add(slat);
    }
    const roofDepth = depth * 0.62 + 0.65;
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(width + 1.05, 0.28, roofDepth), roofMat); panel.position.set(0, height + 1.02, side * depth * 0.26); panel.rotation.x = side * 0.5; panel.castShadow = !this.mobile; group.add(panel);
    }
    const porchWidth = lodge ? Math.min(width * 0.8, 14.5) : Math.min(width * 0.72, 7);
    const porch = new THREE.Mesh(new THREE.BoxGeometry(porchWidth, 0.22, 2.35), this.wood); porch.position.set(0, 0.28, depth / 2 + 1.04); group.add(porch);
    for (const px of [-porchWidth / 2 + 0.42, porchWidth / 2 - 0.42]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.75, 0.2), this.darkWood); post.position.set(px, 1.62, depth / 2 + 1.72); group.add(post);
    }
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x527b7c, roughness: 0.18, metalness: 0.08, emissive: 0x1c3434, emissiveIntensity: 0.25 });
    const windowCount = lodge ? 4 : 2;
    for (let i = 0; i < windowCount; i += 1) {
      const t = i / (windowCount - 1), wx = THREE.MathUtils.lerp(-width * 0.36, width * 0.36, t);
      if (Math.abs(wx) < doorWidth * 0.72) continue;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.22, 0.16), this.cream); frame.position.set(wx, 2.06, depth / 2 + 0.14);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.95), windowMat); glass.position.set(wx, 2.06, depth / 2 + 0.235); group.add(frame, glass);
    }
    const sign = this.makeSign(name, lodge ? 5.2 : 3.8, lodge ? 1.05 : 0.86); sign.position.set(0, height - 0.04, depth / 2 + 0.26); group.add(sign);
    this.addInterior(group, name, width, depth);

    const pivot = new THREE.Group(); pivot.position.set(-doorWidth / 2, floorY, depth / 2 + 0.18);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.2), this.darkWood); door.position.set(doorWidth / 2, doorHeight / 2, 0); door.userData.targetId = doorId; door.userData.prompt = "OPEN DOOR";
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), this.metal); knob.position.set(doorWidth * 0.39, doorHeight * 0.52, 0.13); door.add(knob); pivot.add(door); group.add(pivot); this.interactables.push(door); this.scene.add(group);
    const hingeX = x - doorWidth / 2, hingeZ = z + depth / 2 + 0.18;
    const doorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(doorWidth / 2, doorHeight / 2, 0.16)) }); doorBody.position.set(x, floorY + doorHeight / 2, hingeZ); this.physics.addBody(doorBody);
    this.doors.set(doorId, { pivot, mesh: door, body: doorBody, open: false, hingeX, hingeZ, width: doorWidth });
  }

  private addInterior(group: THREE.Group, name: string, width: number, depth: number) {
    if (name === "DINING HALL") { for (const x of [-width * 0.27, 0, width * 0.27]) this.addTableTo(group, x, -0.4); return; }
    if (name.startsWith("CABIN")) {
      for (const side of [-1, 1]) for (const z of [-depth * 0.2, depth * 0.2]) {
        const x = side * (width / 2 - 0.95), frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 2), this.darkWood); frame.position.set(x, 0.95, z); group.add(frame);
        for (const y of [0.5, 1.23]) { const mattress = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1.82), new THREE.MeshStandardMaterial({ color: y < 1 ? 0xb99a63 : 0x587d70, roughness: 0.8 })); mattress.position.set(x, y, z); group.add(mattress); }
      }
      return;
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(Math.min(width * 0.62, 5), 1.05, 0.75), this.wood); counter.position.set(0, 0.76, -depth / 2 + 0.72); group.add(counter);
  }

  private addTableTo(parent: THREE.Group, x: number, z: number) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.15, 1.08), this.wood); top.position.set(x, 1, z); parent.add(top);
    for (const side of [-1, 1]) { const bench = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.13, 0.36), this.wood); bench.position.set(x, 0.58, z + side * 0.92); parent.add(bench); }
  }

  private addStaticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, rotationY = 0) {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, hz)) }); body.position.set(x, y, z); if (rotationY) body.quaternion.setFromEuler(0, rotationY, 0); this.physics.addBody(body); return body;
  }

  private addBus() {
    const root = new THREE.Group(); root.name = "camp-bus"; root.position.set(0, 0, 31); this.scene.add(root);
    const fallback = new THREE.Group(); fallback.name = "bus-fallback";
    const body = new THREE.Mesh(new THREE.BoxGeometry(7.8, 3.2, 3.15), this.mustard); body.position.y = 1.8; body.castShadow = !this.mobile; fallback.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 3.08), this.mustard); hood.position.set(4.15, 1.35, 0); fallback.add(hood);
    const glass = new THREE.MeshStandardMaterial({ color: 0x355f64, roughness: 0.16, metalness: 0.12 });
    for (const x of [-2.7, -1.55, -0.4, 0.75, 1.9]) for (const side of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.78), glass); w.position.set(x, 2.32, side * 1.586); w.rotation.y = side < 0 ? Math.PI : 0; fallback.add(w); }
    const doorPivot = new THREE.Group(); doorPivot.name = "bus-door"; doorPivot.position.set(2.6, 0.42, -1.61);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xd19d3e, roughness: 0.55 })); door.position.set(0.6, 1.08, 0); doorPivot.add(door); fallback.add(doorPivot);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111313, roughness: 0.95 });
    for (const x of [-2.5, 2.45]) for (const z of [-1.56, 1.56]) { const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.34, 18), tireMat); tire.rotation.x = Math.PI / 2; tire.position.set(x, 0.57, z); fallback.add(tire); }
    root.add(fallback);
    void assetLibrary.attach("bus", root, { name: "bus-model" }).then((model) => { if (!model) return; fallback.visible = false; const importedDoor = model.getObjectByName("door-1") ?? model.getObjectByName("door-2") ?? model.getObjectByName("Door_1"); if (importedDoor) importedDoor.name = "bus-door"; });
    const busPad = new THREE.Mesh(new THREE.BoxGeometry(9.4, 3.4, 3.8), new THREE.MeshBasicMaterial({ visible: false }));
    busPad.position.set(0, 1.8, 0); busPad.userData.targetId = "bus:extract"; busPad.userData.prompt = "START THE BUS"; root.add(busPad); this.interactables.push(busPad);
    this.addStaticBox(0.1, 1.65, 31, 4.45, 1.65, 1.6);
  }

  private addFirepit() {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 10, 32), new THREE.MeshStandardMaterial({ color: 0x45433e, roughness: 0.92 })); ring.rotation.x = Math.PI / 2; ring.position.set(-8, 0.22, 22);
    const embers = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.02, 0.2, 18), new THREE.MeshStandardMaterial({ color: 0xcc6330, emissive: 0x8f3617, emissiveIntensity: 2.2, roughness: 0.75 })); embers.position.set(-8, 0.14, 22); this.scene.add(ring, embers);
    for (let i = 0; i < 6; i += 1) { const a = i / 6 * Math.PI * 2; this.addBench(-8 + Math.cos(a) * 4.2, 22 + Math.sin(a) * 4.2, a + Math.PI / 2); }
  }

  private addEntranceArch() {
    const group = new THREE.Group(); group.position.set(0, 0, 43.5);
    for (const x of [-4.2, 4.2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 5.5, 14), this.darkWood); post.position.set(x, 2.75, 0); group.add(post); this.addStaticBox(x, 2.75, 43.5, 0.35, 2.75, 0.35); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.5, 0.5), this.darkWood); beam.position.y = 5.2; group.add(beam);
    const sign = this.makeSign("CAMP SNALLYGASTER", 6.5, 1.25); sign.position.set(0, 4.38, 0.3); group.add(sign); this.scene.add(group);
  }

  private addProps() {
    for (const [x, z, r] of [[-5.5, -17.5, 0.08], [5.5, -17.5, -0.08], [-10.5, -30, Math.PI / 2], [10.5, -30, Math.PI / 2]] as const) this.addPicnicTable(x, z, r);
    for (const [x, z, color] of [[-10.5, 18.5, 0xc96e45], [-6.2, -21.8, 0x447d70], [7.2, -22.6, 0xe0b24d], [31.5, -20, 0xc96e45]] as const) this.addCooler(x, z, color);
    this.addCrates(-38, -36); this.addCrates(38, -36); this.addCrates(28, -28);
    for (const [x, z] of [[-11, 20], [-5, 18], [-8, 27], [0, -18]] as const) this.addLantern(x, z);
    this.addCanoeRack(53, -4, Math.PI / 2); this.addCanoeRack(-53, -4, -Math.PI / 2);
  }

  private addPicnicTable(x: number, z: number, rotation: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
    const top = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.05), this.wood); top.position.y = 1.25; group.add(top);
    for (const side of [-1, 1]) { const bench = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.16, 0.44), this.wood); bench.position.set(0, 0.72, side * 1.05); group.add(bench); }
    this.scene.add(group); this.addStaticBox(x, 0.86, z, rotation ? 0.8 : 2.15, 0.86, rotation ? 2.15 : 0.8, rotation);
  }

  private addBench(x: number, z: number, rotation: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 0.55), this.wood); seat.position.y = 0.68;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.7), this.wood); back.position.set(0, 1.15, -0.27); back.rotation.x = -0.12; group.add(seat, back); this.scene.add(group); this.addStaticBox(x, 0.7, z, 1.45, 0.7, 0.38, rotation);
  }

  private addCooler(x: number, z: number, color: number) {
    const root = new THREE.Group(); root.position.set(x, 0, z); this.scene.add(root);
    const fallback = new THREE.Group(); const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.82, 0.9), new THREE.MeshStandardMaterial({ color, roughness: 0.58 })); body.position.y = 0.48;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.94), this.cream); lid.position.y = 0.98; fallback.add(body, lid); root.add(fallback);
    void assetLibrary.attach("cooler", root, { name: "cooler-model" }).then((model) => { if (model) fallback.visible = false; }); this.addStaticBox(x, 0.5, z, 0.76, 0.5, 0.48);
  }

  private addCrates(x: number, z: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    for (const [cx, cy, cz] of [[0, 0.5, 0], [1.1, 0.5, 0.15], [0.5, 1.45, -0.1]] as const) { const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.9, 0.95), this.wood); crate.position.set(cx, cy, cz); const band = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1), this.darkWood); band.position.set(cx, cy, cz); group.add(crate, band); }
    this.scene.add(group); this.addStaticBox(x + 0.5, 0.9, z, 1.25, 0.9, 0.65);
  }

  private addLantern(x: number, z: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z); const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.24, 14), this.metal); base.position.y = 0.18;
    const globe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0xffd992, emissive: 0xc0702e, emissiveIntensity: 2.2, roughness: 0.3 })); globe.position.y = 0.5; group.add(base, globe); this.scene.add(group);
  }

  private addCanoeRack(x: number, z: number, rotation: number) {
    const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; this.scene.add(group);
    for (const side of [-1, 1]) { const rack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), this.darkWood); rack.position.set(side * 1.65, 1.6, 0); group.add(rack); }
    for (let level = 0; level < 2; level += 1) { const slot = new THREE.Group(); slot.position.y = 1 + level * 1.1; group.add(slot); const fallback = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.1, 6, 16), new THREE.MeshStandardMaterial({ color: level ? 0x447d70 : 0xc96e45, roughness: 0.65 })); fallback.rotation.z = Math.PI / 2; fallback.scale.set(1, 0.45, 0.72); slot.add(fallback); void assetLibrary.attach("canoe", slot, { rotation: [0, 0, Math.PI / 2], scale: 0.95, name: `canoe-model-${level}` }).then((model) => { if (model) fallback.visible = false; }); }
    this.addStaticBox(x, 1.55, z, rotation ? 1 : 2.5, 1.55, rotation ? 2.5 : 1, rotation);
  }

  private addTrees() {
    const count = this.mobile ? 96 : 144;
    const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.48, 5.4, this.mobile ? 8 : 12);
    const crownGeometryA = new THREE.ConeGeometry(2.45, 5.5, this.mobile ? 8 : 12), crownGeometryB = new THREE.ConeGeometry(1.85, 4.4, this.mobile ? 8 : 12);
    const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshStandardMaterial({ color: 0x493427, roughness: 0.94 }), count);
    const foliage = new THREE.MeshStandardMaterial({ color: 0x183c2c, roughness: 0.92 }); const crownsA = new THREE.InstancedMesh(crownGeometryA, foliage, count), crownsB = new THREE.InstancedMesh(crownGeometryB, foliage, count);
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < count; i += 1) {
      const ring = i % 4, angle = i / count * Math.PI * 2 * 3.1 + (i % 9) * 0.16, radius = 61 + ring * 15 + (i % 7) * 3.4;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, scale = 0.78 + (i % 8) * 0.055;
      matrix.compose(new THREE.Vector3(x, 2.7 * scale, z), q, new THREE.Vector3(scale, scale, scale)); trunks.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(x, 6.6 * scale, z), q, new THREE.Vector3(scale, scale, scale)); crownsA.setMatrixAt(i, matrix);
      matrix.compose(new THREE.Vector3(x, 9 * scale, z), q, new THREE.Vector3(scale * 0.86, scale * 0.86, scale * 0.86)); crownsB.setMatrixAt(i, matrix);
      this.addStaticBox(x, 2.7 * scale, z, 0.42 * scale, 2.7 * scale, 0.42 * scale);
    }
    trunks.castShadow = !this.mobile; crownsA.castShadow = !this.mobile; crownsB.castShadow = !this.mobile;
    trunks.instanceMatrix.needsUpdate = true; crownsA.instanceMatrix.needsUpdate = true; crownsB.instanceMatrix.needsUpdate = true; this.scene.add(trunks, crownsA, crownsB);
  }

  private makeSign(label: string, width: number, height: number) {
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 256; const context = canvas.getContext("2d");
    if (context) { context.fillStyle = "#dfd0aa"; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#223f35"; context.fillRect(14, 14, canvas.width - 28, canvas.height - 28); context.fillStyle = "#efe1bd"; context.font = `800 ${label.length > 13 ? 72 : 88}px Arial Narrow, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(label, canvas.width / 2, canvas.height / 2 + 2); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: false })); sprite.scale.set(width, height, 1); return sprite;
  }
}
