import * as THREE from "three";
import type { SharedRoundState } from "../../shared/protocol";

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
      const group = new THREE.Group();
      const shirt = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.62, 3, 7),
        new THREE.MeshStandardMaterial({ color: [0xd7a844, 0xd46f4b, 0x5f8f7b, 0xc7789c][index % 4], roughness: 0.9 }),
      );
      shirt.position.y = 0.63;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xc99368, roughness: 0.95 }),
      );
      head.position.y = 1.28;
      group.add(shirt, head);
      group.position.set(x, y, z);
      group.scale.setScalar(this.mobile ? 0.95 : 1);
      this.scene.add(group);
      const camper: Camper = { id: `camper-${index + 1}`, name, mesh: group, state: "HIDDEN" };
      this.campers.push(camper);
      this.camperById.set(camper.id, camper);
    });
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
