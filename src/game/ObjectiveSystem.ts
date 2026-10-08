import * as THREE from "three";
import type { SharedRoundState } from "../../shared/protocol";
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
  state: "HIDDEN" | "FOLLOWING" | "SAFE";
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

    const found = this.campers.filter((camper) => camper.state !== "HIDDEN").length;
    const safe = this.campers.filter((camper) => camper.state === "SAFE").length;
    this.monsterAwake = this.monsterAwake || found > 0;
    this.complete = safe === this.campers.length;

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

  updateShared(player: THREE.Vector3, state: SharedRoundState | null): ObjectiveStatus {
    if (!state) {
      return { found: 0, safe: 0, total: this.campers.length, prompt: "", monsterAwake: false, caught: false, complete: false };
    }

    for (const sharedCamper of state.campers) {
      const camper = this.camperById.get(sharedCamper.id);
      if (!camper) continue;
      camper.state = sharedCamper.state;
      camper.mesh.position.lerp(new THREE.Vector3(sharedCamper.position.x, sharedCamper.position.y, sharedCamper.position.z), 0.65);
      camper.mesh.visible = true;
    }

    this.monsterAwake = state.monster.awake;
    this.monster.visible = state.monster.awake;
    this.monster.position.lerp(new THREE.Vector3(state.monster.x, state.monster.y, state.monster.z), 0.58);
    if (state.monster.awake) this.monster.lookAt(player.x, this.monster.position.y, player.z);

    return {
      found: state.campersFound,
      safe: state.campersSafe,
      total: state.campers.length,
      prompt: this.interactionPrompt(player),
      monsterAwake: state.monster.awake,
      caught: state.phase === "LOST",
      complete: state.phase === "WON",
    };
  }

  destroy() {
    for (const camper of this.campers) camper.mesh.removeFromParent();
    this.monster.removeFromParent();
  }

  private createCampers() {
    CAMPERS.forEach(([name, x, y, z], index) => {
      const group = this.createCamperModel(index);
      group.position.set(x, y, z);
      group.scale.setScalar(this.mobile ? 0.92 : 1);
      this.scene.add(group);
      const camper: Camper = { id: `camper-${index + 1}`, name, mesh: group, state: "HIDDEN" };
      this.campers.push(camper);
      this.camperById.set(camper.id, camper);
    });
  }

  private createCamperModel(index: number) {
    const group = new THREE.Group();
    const shirtColors = [0xd7a844, 0xd46f4b, 0x5f8f7b, 0xc7789c, 0x5476a3, 0xc9853c, 0x6f8b55];
    const shortsColors = [0x334554, 0x56483d, 0x2e4d44, 0x45424b];
    const skinColors = [0xc99368, 0xd6a27a, 0xb97b57, 0xe0b28a];
    const hairColors = [0x3b2a21, 0x6a442d, 0x241d1a, 0x9b6b3f];
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirtColors[index % shirtColors.length], roughness: 0.92 });
    const shortsMaterial = new THREE.MeshStandardMaterial({ color: shortsColors[index % shortsColors.length], roughness: 0.95 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: skinColors[index % skinColors.length], roughness: 0.95 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: hairColors[index % hairColors.length], roughness: 1 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: index % 2 === 0 ? 0xd8d0bb : 0x33383a, roughness: 0.9 });
    const packMaterial = new THREE.MeshStandardMaterial({ color: [0x8b4e3d, 0x3f6c5d, 0xc18b38][index % 3], roughness: 0.96 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 4, this.mobile ? 7 : 10), shirtMaterial);
    torso.position.y = 0.83;
    torso.scale.set(1, 1.05, 0.86);

    const shorts = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.33, 0.34), shortsMaterial);
    shorts.position.y = 0.5;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, this.mobile ? 8 : 12, this.mobile ? 6 : 10), skinMaterial);
    head.position.y = 1.48;
    head.scale.set(0.95, 1.05, 0.92);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.235, this.mobile ? 7 : 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMaterial);
    hair.position.y = 1.55;

    const armGeometry = new THREE.CapsuleGeometry(0.075, 0.34, 3, this.mobile ? 6 : 8);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeometry, skinMaterial);
      arm.position.set(side * 0.34, 0.86, 0);
      arm.rotation.z = side * -0.14;
      group.add(arm);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.36, 3, this.mobile ? 6 : 8), skinMaterial);
      leg.position.set(side * 0.14, 0.22, 0);
      group.add(leg);

      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.35), shoeMaterial);
      shoe.position.set(side * 0.14, -0.05, 0.08);
      group.add(shoe);
    }

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.24), packMaterial);
    backpack.position.set(0, 0.88, -0.26);
    backpack.rotation.x = -0.08;

    const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.48, this.mobile ? 7 : 10), new THREE.MeshStandardMaterial({ color: 0xd4c19c, roughness: 1 }));
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 1.12, -0.37);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.1, this.mobile ? 8 : 12), shirtMaterial);
    cap.position.y = 1.7;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.22), shirtMaterial);
    brim.position.set(0, 1.68, 0.18);

    group.add(torso, shorts, head, hair, backpack, bedroll, cap, brim);
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
      new THREE.CapsuleGeometry(0.62, 1.8, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x111816, roughness: 1 }),
    );
    body.position.y = 1.4;
    const hood = new THREE.Mesh(
      new THREE.ConeGeometry(0.8, 1.25, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a0d0c, roughness: 1 }),
    );
    hood.position.y = 2.65;
    hood.rotation.x = Math.PI;
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xb79cff });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), eyeMaterial);
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
        0.8,
        player.z + Math.cos(angle) * (2.0 + Math.floor(index / 3) * 0.7),
      );
      const delta = target.sub(camper.mesh.position);
      const distance = delta.length();
      if (distance > 0.12) camper.mesh.position.add(delta.normalize().multiplyScalar(Math.min(distance, dt * 3.4)));
      camper.mesh.lookAt(player.x, camper.mesh.position.y, player.z);

      if (player.distanceTo(new THREE.Vector3(0, player.y, 31)) < 5.2) {
        camper.state = "SAFE";
        const safeIndex = this.campers.filter((candidate) => candidate.state === "SAFE").length;
        camper.mesh.position.set(-3 + safeIndex * 0.75, 0.8, 34);
      }
    });
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
    return nearest && nearest.distance < 2.6 ? `E / CLICK / USE · CALL TO ${nearest.camper.name.toUpperCase()}` : "";
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
