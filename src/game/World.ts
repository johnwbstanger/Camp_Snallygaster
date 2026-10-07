import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { CamperState, PlayerState } from "../../shared/GameRoomState";

type VecLike = { x: number; y: number; z: number };

type DoorVisual = {
  pivot: THREE.Group;
  openAngle: number;
};

export class CampWorld {
  readonly scene = new THREE.Scene();
  readonly interactables: THREE.Object3D[] = [];

  private remotePlayers = new Map<string, THREE.Group>();
  private campers = new Map<string, THREE.Group>();
  private doors = new Map<string, DoorVisual>();
  private monster: THREE.Group;
  private gun: THREE.Group;
  private hemi: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private fogColor = new THREE.Color(0x17231f);

  constructor(private physics: any) {
    this.scene.background = this.fogColor;
    this.scene.fog = new THREE.Fog(this.fogColor, 18, 105);

    this.hemi = new THREE.HemisphereLight(0xb7c7bb, 0x172016, 1.35);
    this.scene.add(this.hemi);

    this.moon = new THREE.DirectionalLight(0xbfd5d9, 1.5);
    this.moon.position.set(-25, 45, 18);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(512, 512);
    this.moon.shadow.camera.left = -55;
    this.moon.shadow.camera.right = 55;
    this.moon.shadow.camera.top = 55;
    this.moon.shadow.camera.bottom = -55;
    this.scene.add(this.moon);

    this.buildGround();
    this.buildCamp();
    this.buildTrees();
    this.buildBus();

    this.monster = this.makeMonster();
    this.monster.visible = false;
    this.scene.add(this.monster);

    this.gun = this.makeGun();
    this.gun.visible = false;
    this.scene.add(this.gun);
  }

  updateRemotePlayers(players: PlayerState[], localId: string | null) {
    const seen = new Set<string>();
    for (const player of players) {
      if (!player?.id || player.id === localId) continue;
      seen.add(player.id);
      let mesh = this.remotePlayers.get(player.id);
      if (!mesh) {
        mesh = this.makeCounselor(0x31584a);
        this.remotePlayers.set(player.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(player.position.x, player.position.y, player.position.z);
      mesh.rotation.y = player.rotationY;
      mesh.scale.y = player.crouching ? 0.75 : 1;
      mesh.rotation.z = player.downed ? Math.PI / 2 : 0;
    }

    for (const [id, mesh] of this.remotePlayers) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        this.remotePlayers.delete(id);
      }
    }
  }

  updateCampers(campers: CamperState[]) {
    const seen = new Set<string>();
    for (const camper of campers ?? []) {
      if (!camper?.id) continue;
      seen.add(camper.id);
      let mesh = this.campers.get(camper.id);
      if (!mesh) {
        mesh = this.makeCamper();
        mesh.userData.camperId = camper.id;
        this.campers.set(camper.id, mesh);
        this.scene.add(mesh);
        mesh.traverse((child) => {
          child.userData.targetId = `camper:${camper.id}`;
          child.userData.prompt = "HELP CAMPER";
          this.interactables.push(child);
        });
      }
      mesh.position.set(camper.position.x, camper.position.y, camper.position.z);
      mesh.visible = !camper.safe;
      const hidden = !camper.found && camper.state === "HIDING";
      mesh.scale.setScalar(hidden ? 0.82 : 1);
    }

    for (const [id, mesh] of this.campers) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        this.campers.delete(id);
      }
    }
  }

  updateMonster(monster: any) {
    if (!monster?.position) return;
    this.monster.visible = monster.state !== "DORMANT" && monster.state !== "DEAD";
    this.monster.position.set(monster.position.x, monster.position.y, monster.position.z);
    this.monster.rotation.y = monster.rotationY ?? 0;
    const stunned = monster.state === "STUNNED";
    this.monster.rotation.z = stunned ? 0.14 : 0;
  }

  updateDoors(doors: any[]) {
    for (const door of doors ?? []) {
      const visual = this.doors.get(door.id);
      if (!visual) continue;
      visual.pivot.rotation.y = THREE.MathUtils.lerp(
        visual.pivot.rotation.y,
        door.open ? visual.openAngle : 0,
        0.24,
      );
    }
  }

  updateGun(spawned: boolean, discovered: boolean, pickedUp: boolean, position: VecLike) {
    this.gun.visible = !!spawned && !!discovered && !pickedUp;
    if (position) this.gun.position.set(position.x, position.y, position.z);
  }

  updateLighting(roundElapsed: number) {
    const t = THREE.MathUtils.clamp((roundElapsed ?? 0) / 780, 0, 1);
    this.hemi.intensity = THREE.MathUtils.lerp(1.35, 0.65, t);
    this.moon.intensity = THREE.MathUtils.lerp(1.5, 2.15, t);
    this.fogColor.setRGB(
      THREE.MathUtils.lerp(0.09, 0.025, t),
      THREE.MathUtils.lerp(0.14, 0.045, t),
      THREE.MathUtils.lerp(0.12, 0.055, t),
    );
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.fogColor);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.fogColor);
  }

  revealNearbyHiddenCampers(campers: CamperState[], camera: THREE.Camera) {
    for (const camper of campers ?? []) {
      const mesh = this.campers.get(camper.id);
      if (!mesh || camper.safe) continue;
      if (camper.found) {
        mesh.visible = true;
        continue;
      }
      const distance = camera.position.distanceTo(mesh.position);
      mesh.visible = distance < 8;
    }
  }

  updatePhysicsVisuals() {
    // Static world geometry has no visual sync work. Kept as the Game-facing hook.
  }

  private buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x35533e, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const trail = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 88),
      new THREE.MeshStandardMaterial({ color: 0x8a7252, roughness: 1 }),
    );
    trail.rotation.x = -Math.PI / 2;
    trail.position.y = 0.015;
    trail.position.z = 1;
    this.scene.add(trail);

    if (this.physics) {
      const body = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
      this.physics.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.1, 60), body);
    }
  }

  private buildCamp() {
    this.addBuilding("CABIN A", -20, 7, 8, 7, 0x75513f, "door:cabinA");
    this.addBuilding("CABIN B", -10, -10, 8, 7, 0x694939, "door:cabinB");
    this.addBuilding("DINING HALL", 14, 7, 13, 9, 0x8b6548, "door:dining");
    this.addBuilding("BATHHOUSE", 2, -16, 8, 6, 0x6d7868, "door:bath");
    this.addBuilding("ARTS & CRAFTS", 17, -14, 9, 7, 0x9a6f4f, "door:arts");
    this.addBuilding("MAINTENANCE", 27, -21, 9, 7, 0x5b5f52, "door:maintenance");
    this.addBuilding("DIRECTOR", 5, 13, 9, 7, 0x865b43, "door:director");

    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.6, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x594332, roughness: 0.9 }),
    );
    drawer.position.set(6.1, 0.45, 11.4);
    drawer.userData.targetId = "drawer:director";
    drawer.userData.prompt = "OPEN DESK DRAWER";
    this.scene.add(drawer);
    this.interactables.push(drawer);
  }

  private addBuilding(
    label: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    color: number,
    doorId: string,
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const wallMat = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3c3028, roughness: 0.95 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, 3.2, depth), wallMat);
    wall.position.y = 1.6;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 2.1, 4), roofMat);
    roof.position.y = 4.1;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const sign = this.makeSign(label);
    sign.position.set(0, 2.4, depth / 2 + 0.08);
    group.add(sign);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.85, 0, depth / 2 + 0.05);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 2.45, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x43352b, roughness: 0.88 }),
    );
    door.position.set(0.85, 1.22, 0);
    door.userData.targetId = doorId;
    door.userData.prompt = "OPEN DOOR";
    doorPivot.add(door);
    group.add(doorPivot);
    this.doors.set(doorId, { pivot: doorPivot, openAngle: -Math.PI * 0.46 });
    this.interactables.push(door);

    this.scene.add(group);

    // Keep collision conservative: one central obstacle leaves enough room around doors on mobile.
    if (this.physics) {
      const body = this.physics.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.45, z),
      );
      this.physics.createCollider(
        RAPIER.ColliderDesc.cuboid(width * 0.47, 1.45, depth * 0.47),
        body,
      );
    }
  }

  private buildTrees() {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.8, 6);
    const crownGeo = new THREE.ConeGeometry(1.35, 4.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b392d, roughness: 1 });
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x244734, roughness: 1 });

    const placements: Array<[number, number]> = [];
    for (let i = 0; i < 52; i++) {
      const angle = (i / 52) * Math.PI * 2 + (i % 4) * 0.13;
      const radius = 38 + (i % 7) * 2.2;
      placements.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
    }

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, placements.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, placements.length);
    const matrix = new THREE.Matrix4();
    placements.forEach(([x, z], index) => {
      matrix.makeTranslation(x, 1.4, z);
      trunks.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, 4.4, z);
      crowns.setMatrixAt(index, matrix);
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.scene.add(trunks, crowns);
  }

  private buildBus() {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.3, 7.2),
      new THREE.MeshStandardMaterial({ color: 0xd49b3f, roughness: 0.72 }),
    );
    body.position.y = 1.7;
    body.castShadow = true;
    bus.add(body);
    for (const x of [-1.7, 1.7]) {
      for (const z of [-2.2, 2.2]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.28, 12),
          new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 1 }),
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.7, z);
        bus.add(wheel);
      }
    }
    bus.position.set(0, 0, 43);
    this.scene.add(bus);
  }

  private makeCounselor(color: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.9, 5, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    body.position.y = 1.05;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc7956d, roughness: 0.9 }),
    );
    head.position.y = 1.85;
    g.add(body, head);
    return g;
  }

  private makeCamper() {
    const g = this.makeCounselor(0xb7643f);
    g.scale.setScalar(0.78);
    return g;
  }

  private makeMonster() {
    const g = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ color: 0x4a5546, roughness: 0.88 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 1.15, 5, 8), material);
    body.position.y = 1.2;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b6655, roughness: 1 }),
    );
    head.position.y = 2.1;
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.07, 12),
      new THREE.MeshStandardMaterial({ color: 0x252c25, roughness: 1 }),
    );
    brim.position.y = 2.38;
    g.add(body, head, brim);
    return g;
  }

  private makeGun() {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.78),
      new THREE.MeshStandardMaterial({ color: 0x9a9a91, metalness: 0.7, roughness: 0.32 }),
    );
    mesh.userData.targetId = "gun";
    mesh.userData.prompt = "TAKE HANDGUN";
    g.add(mesh);
    this.interactables.push(mesh);
    return g;
  }

  private makeSign(label: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#d9c59a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#263f34";
      ctx.font = "bold 30px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.set(3.2, 0.8, 1);
    return sprite;
  }
}
