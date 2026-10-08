import * as THREE from "three";
import type { SharedRoundState } from "../../shared/protocol";
import { assetLibrary } from "./AssetLibrary";
import { addCampDetailKit } from "./CampDetailKit";

export type ObjectiveStatus = {
  found: number;
  safe: number;
  total: number;
  prompt: string;
  monsterAwake: boolean;
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

export class ObjectiveSystem {
  private campers: Camper[] = [];
  private camperById = new Map<string, Camper>();
  private monster = new THREE.Group();
  private monsterAwake = false;
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
    this.monsterAwake = this.monsterAwake || found > 0;
    this.complete = safe === this.campers.length && this.campers.every((camper) => camper.boarded);
    this.updateBusDoor();

    return {
      found,
      safe,
      total: this.campers.length,
      prompt: this.interactionPrompt(player),
      monsterAwake: this.monsterAwake,
      caught: this.caught,
      complete: this.complete,
    };
  }

  updateShared(player: THREE.Vector3, state: SharedRoundState | null, dt = 1 / 60): ObjectiveStatus {
    if (!state) {
      return { found: 0, safe: 0, total: this.campers.length, prompt: "", monsterAwake: false, caught: false, complete: false };
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
      caught: state.phase === "LOST",
      complete: this.complete,
    };
  }

  destroy() {
    for (const camper of this.campers) camper.mesh.removeFromParent();
    this.monster.removeFromParent();
  }

  private createCampers() {
    CAMPERS.forEach(([name, x, y, z], index) => {
      const root = new THREE.Group();
      root.position.set(x, y, z);
      // Explicit requirement: campers are 50% of their previous rendered size.
      root.scale.setScalar(0.5);

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

      void assetLibrary.attach("camper", visual, { name: `camper-model-${index + 1}` }).then((model) => {
        if (!model) return;
        fallback.visible = false;
        model.traverse((object) => {
          object.userData.camperId = camper.id;
          object.userData.targetId = `camper:${camper.id}`;
          object.userData.prompt = `CALL TO ${name.toUpperCase()}`;
        });
      });
    });
  }

  private createCamperFallback(index: number) {
    const group = new THREE.Group();
    const shirtColors = [0xd7a844, 0xd46f4b, 0x5f8f7b, 0xc7789c, 0x5476a3, 0xc9853c, 0x6f8b55];
    const shortsColors = [0x334554, 0x56483d, 0x2e4d44, 0x45424b];
    const skinColors = [0xc99368, 0xd6a27a, 0xb97b57, 0xe0b28a];
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColors[index % shirtColors.length], roughness: 0.78 });
    const shorts = new THREE.MeshStandardMaterial({ color: shortsColors[index % shortsColors.length], roughness: 0.86 });
    const skin = new THREE.MeshStandardMaterial({ color: skinColors[index % skinColors.length], roughness: 0.88 });
    const shoes = new THREE.MeshStandardMaterial({ color: 0x30383a, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 5, 12), shirt);
    torso.position.y = 0.87;
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.26, 0.3), shorts);
    pelvis.position.y = 0.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), skin);
    head.position.y = 1.48;
    group.add(torso, pelvis, head);

    for (const side of [-1, 1]) {
      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.32, 4, 8), skin);
      upperArm.position.set(side * 0.32, 0.9, 0);
      upperArm.name = side < 0 ? "arm-left" : "arm-right";
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.4, 4, 8), skin);
      leg.position.set(side * 0.12, 0.19, 0);
      leg.name = side < 0 ? "leg-left" : "leg-right";
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.3), shoes);
      shoe.position.set(side * 0.12, -0.08, 0.08);
      group.add(upperArm, leg, shoe);
    }

    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.54, 0.2),
      new THREE.MeshStandardMaterial({ color: [0x8b4e3d, 0x3f6c5d, 0xc18b38][index % 3], roughness: 0.86 }),
    );
    pack.position.set(0, 0.88, -0.23);
    group.add(pack);
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = !this.mobile;
        object.receiveShadow = !this.mobile;
      }
    });
    return group;
  }

  private createMonster() {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.62, 1.8, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0x111816, roughness: 0.92 }),
    );
    body.position.y = 1.4;
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.25, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a0d0c, roughness: 1 }),
    );
    hood.position.y = 2.65;
    hood.rotation.x = Math.PI;
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xb79cff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMaterial);
    const rightEye = leftEye.clone();
    leftEye.position.set(-0.16, 2.53, 0.62);
    rightEye.position.set(0.16, 2.53, 0.62);
    this.monster.add(body, hood, leftEye, rightEye);
    this.monster.position.set(-32, 0, -29);
    this.monster.visible = false;
    this.scene.add(this.monster);
  }

  private updateLocalCampers(player: THREE.Vector3, interactPressed: boolean, dt: number) {
    const nearest = this.nearestHidden(player);
    if (interactPressed && nearest && nearest.distance < 2.6) {
      nearest.camper.state = "FOLLOWING";
      this.monsterAwake = true;
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
    const flatPlayer = new THREE.Vector3(player.x, 0, player.z);
    const delta = flatPlayer.clone().sub(this.monster.position);
    const distance = delta.length();
    const found = this.campers.filter((camper) => camper.state !== "HIDDEN").length;
    const speed = 1.55 + found * 0.12;
    if (distance > 0.001) this.monster.position.add(delta.normalize().multiplyScalar(Math.min(distance, speed * dt)));
    this.monster.lookAt(player.x, 0, player.z);
    if (distance < 1.15) this.caught = true;
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
