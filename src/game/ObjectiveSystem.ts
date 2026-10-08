import * as THREE from "three";
import type { SharedRoundState, DoorState } from "../../shared/protocol";
import {
  chooseRandomMonster,
  getMonsterDefinition,
  type MonsterDefinition,
  type MonsterKind,
} from "../../shared/monsterLibrary";
import { hasCampLineOfSight, MONSTER_HOME } from "../../shared/campVision";
import { addCampDetailKit } from "./CampDetailKit";

export type ObjectiveStatus = {
  found: number;
  safe: number;
  total: number;
  prompt: string;
  monsterAwake: boolean;
  monsterName: string;
  caught: boolean;
  complete: boolean;
};

type Camper = {
  id: string;
  name: string;
  mesh: THREE.Group;
  visual: THREE.Group;
  fallback: THREE.Group;
  state: "HIDDEN" | "FOLLOWING" | "SAFE";
  boarding: number;
  boarded: boolean;
  walkPhase: number;
};

const CAMPERS = [
  ["Ben", -21, 0.8, 8],
  ["Maya", -11, 0.8, -10],
  ["Jamie", 13, 0.8, 9],
  ["Katie", 20, 0.8, -17],
  ["Nate", -19, 0.8, -18],
  ["Jess", -4, 0.8, 21],
  ["Luke", 25, 0.8, 16],
] as const;

const BUS_DOOR = new THREE.Vector3(2.95, 0.02, 29.55);
const BUS_INSIDE = new THREE.Vector3(1.35, 0.3, 31.0);
const CAMPER_RENDER_SCALE = 0.82;

export class ObjectiveSystem {
  private campers: Camper[] = [];
  private camperById = new Map<string, Camper>();
  private monster = new THREE.Group();
  private monsterAwake = false;
  private monsterDefinition: MonsterDefinition = chooseRandomMonster();
  private monsterKind: MonsterKind = this.monsterDefinition.id;
  private caught = false;
  private complete = false;

  constructor(private scene: THREE.Scene, private mobile: boolean) {
    addCampDetailKit(this.scene, this.mobile);
    this.createCampers();
    this.createMonster();
  }

  updateLocal(player: THREE.Vector3, interactPressed: boolean, dt: number): ObjectiveStatus {
    if (!this.caught && !this.complete) {
      this.updateLocalCampers(player, interactPressed, dt);
      this.updateLocalMonster(player, dt);
    }
    this.updateBoarding(dt);

    const found = this.campers.filter((camper) => camper.state !== "HIDDEN").length;
    const safe = this.campers.filter((camper) => camper.state === "SAFE").length;
    this.complete = safe === this.campers.length && this.campers.every((camper) => camper.boarded);
    this.updateBusDoor();

    return {
      found,
      safe,
      total: this.campers.length,
      prompt: this.interactionPrompt(player),
      monsterAwake: this.monsterAwake,
      monsterName: this.monsterDefinition.name,
      caught: this.caught,
      complete: this.complete,
    };
  }

  updateShared(player: THREE.Vector3, state: SharedRoundState | null, dt = 1 / 60): ObjectiveStatus {
    if (!state) {
      return {
        found: 0,
        safe: 0,
        total: this.campers.length,
        prompt: "",
        monsterAwake: false,
        monsterName: this.monsterDefinition.name,
        caught: false,
        complete: false,
      };
    }

    for (const sharedCamper of state.campers) {
      const camper = this.camperById.get(sharedCamper.id);
      if (!camper) continue;
      const nextState = sharedCamper.state;
      if (nextState === "SAFE" && camper.state !== "SAFE") {
        camper.state = "SAFE";
        camper.boarding = 0;
        camper.boarded = false;
      } else if (nextState !== "SAFE") {
        camper.state = nextState;
        camper.boarding = 0;
        camper.boarded = false;
        const target = new THREE.Vector3(sharedCamper.position.x, sharedCamper.position.y, sharedCamper.position.z);
        this.moveHumanlike(camper, target, dt, 12);
      }
      camper.mesh.visible = !camper.boarded;
    }

    this.updateBoarding(dt);
    this.setMonsterKind(state.monster.kind ?? this.monsterKind);
    this.monsterAwake = state.monster.awake;
    this.monster.visible = state.monster.awake;
    this.monster.position.lerp(new THREE.Vector3(state.monster.x, state.monster.y, state.monster.z), 0.58);
    if (state.monster.awake) this.monster.lookAt(player.x, this.monster.position.y, player.z);
    this.complete = state.phase === "WON" && this.campers.every((camper) => camper.boarded);
    this.updateBusDoor();

    return {
      found: state.campersFound,
      safe: state.campersSafe,
      total: state.campers.length,
      prompt: this.interactionPrompt(player),
      monsterAwake: state.monster.awake,
      monsterName: this.monsterDefinition.name,
      caught: state.phase === "LOST",
      complete: this.complete,
    };
  }

  destroy() {
    for (const camper of this.campers) camper.mesh.removeFromParent();
    this.disposeMonsterVisuals();
    this.monster.removeFromParent();
  }

  private createCampers() {
    CAMPERS.forEach(([name, x, y, z], index) => {
      const root = new THREE.Group();
      root.position.set(x, y, z);
      root.scale.setScalar(CAMPER_RENDER_SCALE);

      const visual = new THREE.Group();
      visual.name = "camper-visual";
      const fallback = this.createCamperFallback(index);
      fallback.name = "camper-fallback";
      visual.add(fallback);
      root.add(visual);
      this.scene.add(root);

      const camper: Camper = {
        id: `camper-${index + 1}`,
        name,
        mesh: root,
        visual,
        fallback,
        state: "HIDDEN",
        boarding: 0,
        boarded: false,
        walkPhase: index * 0.7,
      };
      this.campers.push(camper);
      this.camperById.set(camper.id, camper);

      root.traverse((object) => {
        object.userData.camperId = camper.id;
        object.userData.targetId = `camper:${camper.id}`;
        object.userData.prompt = `CALL TO ${name.toUpperCase()}`;
      });
    });
  }

  private createCamperFallback(index: number) {
    const group = new THREE.Group();
    const shirtColors = [0xd7a844, 0xd46f4b, 0x5f8f7b, 0xc7789c, 0x5476a3, 0xc9853c, 0x6f8b55];
    const shortsColors = [0x334554, 0x56483d, 0x2e4d44, 0x45424b];
    const packColors = [0x8b4e3d, 0x3f6c5d, 0xc18b38, 0x4c5875];
    const skinColors = [0xc99368, 0xd6a27a, 0xb97b57, 0xe0b28a, 0x8f5d42];
    const hairColors = [0x3f2f24, 0x211d1b, 0x7b5738, 0xb08a55, 0x442b22];
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColors[index % shirtColors.length], roughness: 0.82 });
    const shorts = new THREE.MeshStandardMaterial({ color: shortsColors[index % shortsColors.length], roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: skinColors[index % skinColors.length], roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: hairColors[index % hairColors.length], roughness: 0.95 });
    const shoes = new THREE.MeshStandardMaterial({ color: index % 2 ? 0xd8d0bd : 0x30383a, roughness: 0.9 });
    const socks = new THREE.MeshStandardMaterial({ color: 0xd9d6c9, roughness: 0.95 });
    const packMat = new THREE.MeshStandardMaterial({ color: packColors[index % packColors.length], roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 6, 14), shirt);
    torso.position.y = 0.91;
    const shortsBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.3, 0.32), shorts);
    shortsBody.position.y = 0.53;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), skin);
    head.position.y = 1.5;
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.226, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.57;
    group.add(torso, shortsBody, head, hairCap);

    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 4, 10), shirt);
      sleeve.position.set(side * 0.31, 1.02, 0);
      sleeve.name = side < 0 ? "arm-left" : "arm-right";
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 10), skin);
      forearm.position.set(side * 0.31, 0.76, 0);
      sleeve.add(forearm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), skin);
      leg.position.set(side * 0.12, 0.21, 0);
      leg.name = side < 0 ? "leg-left" : "leg-right";
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.17, 12), socks);
      sock.position.set(side * 0.12, 0.0, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.32), shoes);
      shoe.position.set(side * 0.12, -0.11, 0.08);
      group.add(sleeve, leg, sock, shoe);
    }

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.56, 0.22, 2, 2, 2), packMat);
    pack.position.set(0, 0.91, -0.25);
    const topRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0xc49b59, roughness: 0.92 }));
    topRoll.rotation.z = Math.PI / 2;
    topRoll.position.set(0, 1.2, -0.28);
    group.add(pack, topRoll);

    if (index % 3 === 0) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.08, 18), shirt);
      cap.position.y = 1.7;
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.18), shirt);
      brim.position.set(0, 1.68, 0.17);
      group.add(cap, brim);
    }

    const neckerchief = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), new THREE.MeshStandardMaterial({ color: 0xb43f34, roughness: 0.86 }));
    neckerchief.rotation.x = Math.PI;
    neckerchief.position.set(0, 1.23, 0.18);
    group.add(neckerchief);

    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = !this.mobile;
        object.receiveShadow = !this.mobile;
      }
    });
    return group;
  }

  private createMonster() {
    this.monster.name = "round-monster";
    this.monster.position.set(MONSTER_HOME.x, MONSTER_HOME.y, MONSTER_HOME.z);
    this.monster.visible = false;
    this.scene.add(this.monster);
    this.rebuildMonsterVisual();
  }

  private setMonsterKind(kind: MonsterKind) {
    if (kind === this.monsterKind) return;
    this.monsterKind = kind;
    this.monsterDefinition = getMonsterDefinition(kind);
    this.rebuildMonsterVisual();
  }

  private rebuildMonsterVisual() {
    this.disposeMonsterVisuals();
    const definition = this.monsterDefinition;
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: definition.bodyColor, roughness: 0.9 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: definition.accentColor, roughness: 0.82 });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: definition.eyeColor });

    const addEyes = (y: number, z: number, spread: number, size = 0.055) => {
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), eyeMaterial);
        eye.position.set(side * spread, y, z);
        this.monster.add(eye);
      }
    };

    if (definition.archetype === "winged") {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.55, 6, 12), bodyMaterial);
      torso.position.y = 1.45;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), bodyMaterial);
      head.position.set(0, 2.58, 0.16);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 8), accentMaterial);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 2.52, 0.66);
      this.monster.add(torso, head, beak);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.7, 3), accentMaterial);
        wing.rotation.z = side * 1.12;
        wing.position.set(side * 1.0, 1.75, -0.05);
        this.monster.add(wing);
      }
      addEyes(2.64, 0.49, 0.14, 0.052);
    } else if (definition.archetype === "feline") {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.45, 6, 12), bodyMaterial);
      torso.rotation.z = Math.PI / 2;
      torso.position.set(0, 0.92, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), accentMaterial);
      head.position.set(0, 1.08, 0.92);
      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.48), bodyMaterial);
      muzzle.position.set(0, 0.98, 1.25);
      this.monster.add(torso, head, muzzle);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 4), accentMaterial);
        ear.position.set(side * 0.24, 1.48, 0.88);
        this.monster.add(ear);
        for (const front of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.52, 4, 8), bodyMaterial);
          leg.position.set(side * 0.42, 0.43, front * 0.47);
          this.monster.add(leg);
        }
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.6, 9), accentMaterial);
      tail.rotation.x = Math.PI / 2.7;
      tail.position.set(0, 1.06, -1.0);
      this.monster.add(tail);
      addEyes(1.14, 1.27, 0.16, 0.05);
    } else if (definition.archetype === "brute") {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 1.55, 6, 14), bodyMaterial);
      torso.position.y = 1.55;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), accentMaterial);
      head.position.set(0, 2.8, 0.1);
      this.monster.add(torso, head);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.35, 5, 10), bodyMaterial);
        arm.position.set(side * 0.82, 1.5, 0);
        arm.rotation.z = side * 0.18;
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.95, 5, 10), accentMaterial);
        leg.position.set(side * 0.3, 0.42, 0);
        this.monster.add(arm, leg);
      }
      addEyes(2.88, 0.52, 0.17, 0.045);
    } else if (definition.archetype === "stalker") {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.45, 5, 10), bodyMaterial);
      torso.position.y = 1.35;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), accentMaterial);
      head.position.set(0, 2.42, 0.18);
      this.monster.add(torso, head);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 1.72, 4, 8), bodyMaterial);
        arm.position.set(side * 0.48, 1.05, 0.16);
        arm.rotation.z = side * 0.12;
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.45, 4, 8), bodyMaterial);
        leg.position.set(side * 0.2, 0.25, -0.06);
        this.monster.add(arm, leg);
      }
      addEyes(2.48, 0.5, 0.12, 0.043);
    } else {
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.65, 6, 12), bodyMaterial);
      torso.position.y = 1.45;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 16, 12), accentMaterial);
      head.position.set(0, 2.55, 0.18);
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.25, 0.58), bodyMaterial);
      snout.position.set(0, 2.45, 0.58);
      this.monster.add(torso, head, snout);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.48, 4), accentMaterial);
        ear.position.set(side * 0.24, 2.94, 0.12);
        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.15, 5, 10), bodyMaterial);
        arm.position.set(side * 0.64, 1.4, 0.08);
        arm.rotation.z = side * 0.18;
        this.monster.add(ear, arm);
      }
      addEyes(2.62, 0.52, 0.14, 0.05);
    }

    this.monster.scale.setScalar(definition.scale);
    this.monster.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = !this.mobile;
        object.receiveShadow = !this.mobile;
      }
    });
  }

  private disposeMonsterVisuals() {
    for (const child of [...this.monster.children]) {
      child.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      });
      this.monster.remove(child);
    }
  }

  private updateLocalCampers(player: THREE.Vector3, interactPressed: boolean, dt: number) {
    const nearest = this.nearestHidden(player);
    if (interactPressed && nearest && nearest.distance < 2.6) {
      nearest.camper.state = "FOLLOWING";
      this.monsterAwake = true;
      this.monster.position.set(MONSTER_HOME.x, MONSTER_HOME.y, MONSTER_HOME.z);
    }

    const followers = this.campers.filter((camper) => camper.state === "FOLLOWING");
    followers.forEach((camper, index) => {
      const angle = Math.PI + (index - (followers.length - 1) / 2) * 0.42;
      const target = new THREE.Vector3(
        player.x + Math.sin(angle) * (2.0 + Math.floor(index / 3) * 0.7),
        0.05,
        player.z + Math.cos(angle) * (2.0 + Math.floor(index / 3) * 0.7),
      );
      this.moveHumanlike(camper, target, dt, 5.4);

      if (player.distanceTo(new THREE.Vector3(0, player.y, 31)) < 5.2) {
        camper.state = "SAFE";
        camper.boarding = 0;
        camper.boarded = false;
      }
    });
  }

  private moveHumanlike(camper: Camper, target: THREE.Vector3, dt: number, speed: number) {
    const delta = target.clone().sub(camper.mesh.position);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.035) {
      camper.visual.position.y = THREE.MathUtils.lerp(camper.visual.position.y, 0, 0.2);
      return;
    }
    const direction = delta.normalize();
    camper.mesh.position.addScaledVector(direction, Math.min(distance, speed * dt));
    camper.mesh.rotation.y = Math.atan2(direction.x, direction.z);
    camper.walkPhase += dt * (8 + speed * 0.7);
    camper.visual.position.y = Math.abs(Math.sin(camper.walkPhase)) * 0.035;

    const armLeft = camper.fallback.getObjectByName("arm-left");
    const armRight = camper.fallback.getObjectByName("arm-right");
    const legLeft = camper.fallback.getObjectByName("leg-left");
    const legRight = camper.fallback.getObjectByName("leg-right");
    const swing = Math.sin(camper.walkPhase) * 0.55;
    if (armLeft) armLeft.rotation.x = swing;
    if (armRight) armRight.rotation.x = -swing;
    if (legLeft) legLeft.rotation.x = -swing * 0.65;
    if (legRight) legRight.rotation.x = swing * 0.65;
  }

  private updateBoarding(dt: number) {
    const safeCampers = this.campers.filter((camper) => camper.state === "SAFE" && !camper.boarded);
    safeCampers.forEach((camper, queueIndex) => {
      const wait = Math.max(0, queueIndex * 0.28 - camper.boarding);
      if (wait > 0) {
        camper.boarding += dt;
        return;
      }

      const toDoor = camper.mesh.position.distanceTo(BUS_DOOR);
      if (toDoor > 0.14) {
        this.moveHumanlike(camper, BUS_DOOR, dt, 4.2);
        camper.boarding += dt;
        return;
      }
      const toInside = camper.mesh.position.distanceTo(BUS_INSIDE);
      if (toInside > 0.12) {
        this.moveHumanlike(camper, BUS_INSIDE, dt, 2.8);
        camper.boarding += dt;
        return;
      }
      camper.boarded = true;
      camper.mesh.visible = false;
      camper.visual.position.y = 0;
    });
  }

  private updateBusDoor() {
    const door = this.scene.getObjectByName("bus-door");
    if (!door) return;
    const anyoneBoarding = this.campers.some((camper) => camper.state === "SAFE" && !camper.boarded);
    const allBoarded = this.campers.every((camper) => camper.state === "SAFE" && camper.boarded);
    const target = anyoneBoarding && !allBoarded ? -Math.PI * 0.48 : 0;
    door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, target, 0.14);
  }

  private updateLocalMonster(player: THREE.Vector3, dt: number) {
    this.monster.visible = this.monsterAwake;
    if (!this.monsterAwake) return;

    const doors = this.localDoorStates();
    if (!hasCampLineOfSight(this.monster.position, player, doors)) {
      this.monsterAwake = false;
      this.monster.visible = false;
      this.monster.position.set(MONSTER_HOME.x, MONSTER_HOME.y, MONSTER_HOME.z);
      return;
    }

    const flatPlayer = new THREE.Vector3(player.x, 0, player.z);
    const delta = flatPlayer.clone().sub(this.monster.position);
    const distance = delta.length();
    const found = this.campers.filter((camper) => camper.state !== "HIDDEN").length;
    const speed = this.monsterDefinition.baseSpeed + found * this.monsterDefinition.speedPerCamper;
    if (distance > 0.001) this.monster.position.add(delta.normalize().multiplyScalar(Math.min(distance, speed * dt)));
    this.monster.lookAt(player.x, 0, player.z);
    if (distance < this.monsterDefinition.catchDistance) this.caught = true;
  }

  private localDoorStates(): DoorState[] {
    const states: DoorState[] = [];
    const seen = new Set<string>();
    this.scene.traverse((object) => {
      const id = object.userData.targetId;
      if (typeof id !== "string" || !id.startsWith("door:") || seen.has(id)) return;
      seen.add(id);
      states.push({ id, open: object.userData.prompt === "CLOSE DOOR" });
    });
    return states;
  }

  private interactionPrompt(player: THREE.Vector3) {
    const nearest = this.nearestHidden(player);
    return nearest && nearest.distance < 2.6 ? `E / USE · CALL TO ${nearest.camper.name.toUpperCase()}` : "";
  }

  private nearestHidden(player: THREE.Vector3) {
    let best: { camper: Camper; distance: number } | null = null;
    for (const camper of this.campers) {
      if (camper.state !== "HIDDEN") continue;
      const distance = player.distanceTo(camper.mesh.position);
      if (!best || distance < best.distance) best = { camper, distance };
    }
    return best;
  }
}
