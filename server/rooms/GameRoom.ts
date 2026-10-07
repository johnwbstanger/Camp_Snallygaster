import { Room, Client } from "@colyseus/core";
import RAPIER from "@dimforge/rapier3d-compat";
import type { GameRoomState, PlayerState, CamperState } from "../shared/GameRoomState.js";
import { GameRoomState as GameRoomStateClass, Vec3, PlayerState as PlayerStateClass, CamperState as CamperStateClass, MonsterState as MonsterStateClass, DoorState as DoorStateClass, GunState as GunStateClass } from "../shared/GameRoomState.js";
import { generateRoomCode } from "../shared/utils.js";

let RAPIER_READY = false;

RAPIER.init().then(() => {
  RAPIER_READY = true;
});

const CAMPER_NAMES = [
  "Ben", "Sam", "Jamie", "Maya", "Tommy", "Katie", "Nate", "Jess",
  "Luke", "Hannah", "Eric", "Rachel", "Max", "Danny",
];

const HIDING_SPOTS: { id: string; position: Vec3; label: string }[] = [
  { id: "cabin-a-bed-1", position: { x: -18, y: 0.8, z: 6 }, label: "under a cabin bunk" },
  { id: "cabin-a-closet", position: { x: -22, y: 0.8, z: 9 }, label: "inside a cabin closet" },
  { id: "cabin-b-bed-1", position: { x: -12, y: 0.8, z: -10 }, label: "under a bunk" },
  { id: "cabin-b-desk", position: { x: -8, y: 0.8, z: -12 }, label: "under a desk" },
  { id: "dining-table", position: { x: 11, y: 0.8, z: 8 }, label: "under a dining table" },
  { id: "kitchen-counter", position: { x: 18, y: 0.8, z: 8 }, label: "behind the kitchen counter" },
  { id: "kitchen-pantry", position: { x: 20, y: 0.8, z: 3 }, label: "inside the pantry" },
  { id: "bath-stall", position: { x: 3, y: 0.8, z: -15 }, label: "inside a bathroom stall" },
  { id: "arts-cabinet", position: { x: 17, y: 0.8, z: -13 }, label: "inside the arts cabin" },
  { id: "maintenance-crates", position: { x: 25, y: 0.8, z: -20 }, label: "behind maintenance crates" },
  { id: "treehouse", position: { x: -28, y: 5.8, z: -22 }, label: "inside the treehouse" },
  { id: "dock-canoe", position: { x: 31, y: 0.8, z: 20 }, label: "behind a canoe" },
  { id: "firepit-table", position: { x: -4, y: 0.8, z: 23 }, label: "under a picnic table" },
  { id: "director-closet", position: { x: 4, y: 0.8, z: 12 }, label: "inside the director's closet" },
];

const DOOR_IDS = [
  "door:cabinA", "door:cabinB", "door:dining", "door:bath",
  "door:arts", "door:maintenance", "door:director", "drawer:director",
];

const BUS_CENTER: Vec3 = { x: 0, y: 0, z: 40 };
const WORLD_LIMIT = 48;
const MONSTER_BASE_SPEED = 3.2;
const MONSTER_CHASE_SPEED = 6.2;
const MONSTER_HEALTH = 5;

export class GameRoom extends Room<GameRoomStateClass> {
  private physics: any = null;
  private lastNoise: { position: Vec3; intensity: number; at: number } | null = null;
  private monsterStunUntil = 0;
  private monsterRoamAngle = 0;
  private roundStartedAt = 0;
  private maxPlayers = 6;

  async onCreate() {
    this.state = new GameRoomStateClass();
    this.state.hostId = "";
    this.state.phase = "LOBBY";

    if (RAPIER_READY) {
      this.physics = new RAPIER.World({ x: 0, y: -18, z: 0 });
    }

    // Setup doors
    for (const doorId of DOOR_IDS) {
      const door = new DoorStateClass();
      door.id = doorId;
      door.open = false;
      this.state.doors.push(door);
    }

    // Setup gun
    this.state.gun = new GunStateClass();
    this.state.gun.spawned = process.env.FORCE_HANDGUN_SPAWN === "true" || Math.random() < 0.35;
    this.state.gun.discovered = false;
    this.state.gun.pickedUp = false;
    this.state.gun.position = new Vec3();
    this.state.gun.position.x = 6.1;
    this.state.gun.position.y = 1.1;
    this.state.gun.position.z = 11.4;

    // Setup monster
    this.state.monster = new MonsterStateClass();
    this.state.monster.position = new Vec3();
    this.state.monster.position.x = -36;
    this.state.monster.position.y = 1;
    this.state.monster.position.z = -34;
    this.state.monster.rotationY = 0;
    this.state.monster.state = "DORMANT";
    this.state.monster.health = MONSTER_HEALTH;

    this.onMessage("JOIN", (client, data: any) => this.handleJoin(client, data));
    this.onMessage("START", (client) => this.handleStart(client));
    this.onMessage("MOVE", (client, data: any) => this.handleMove(client, data));
    this.onMessage("INTERACT", (client, data: any) => this.handleInteract(client, data));
    this.onMessage("DROP_CAMPER", (client) => this.handleDropCamper(client));
    this.onMessage("TOGGLE_FLASHLIGHT", (client, data: any) => this.handleToggleFlashlight(client, data));
    this.onMessage("FIRE", (client, data: any) => this.handleFire(client, data));
    this.onMessage("RELOAD", (client) => this.handleReload(client));
    this.onMessage("REVIVE", (client, data: any) => this.handleRevive(client, data));
    this.onMessage("RADIO", (client, data: any) => this.handleRadio(client, data));

    this.setSimulationInterval(() => this.update(), 1000 / 60);
  }

  onJoin(client: Client) {
    console.log("Player joined:", client.sessionId);
  }

  onLeave(client: Client) {
    console.log("Player left:", client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (player) {
      for (const camper of this.state.campers) {
        if (camper.followingPlayerId === client.sessionId) camper.followingPlayerId = null;
        if (camper.carriedByPlayerId === client.sessionId) camper.carriedByPlayerId = null;
      }
      if (this.state.gun.ownerId === client.sessionId) {
        this.state.gun.ownerId = null;
        this.state.gun.pickedUp = false;
        this.state.gun.discovered = true;
        this.state.gun.position = new Vec3();
        Object.assign(this.state.gun.position, player.position);
      }
      this.state.players.delete(client.sessionId);
    }
  }

  private handleJoin(client: Client, data: { name: string }) {
    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.size >= this.maxPlayers) return;

    const player = new PlayerStateClass();
    player.id = client.sessionId;
    player.name = String(data.name || "Counselor").slice(0, 18) || "Counselor";
    player.position = new Vec3();
    player.position.x = Math.random() * 3 - 1.5;
    player.position.y = 1;
    player.position.z = 39;
    player.rotationY = Math.PI;

    this.state.players.set(client.sessionId, player);

    if (!this.state.hostId) {
      this.state.hostId = client.sessionId;
    }

    console.log(`${player.name} joined (Host: ${this.state.hostId === client.sessionId})`);
  }

  private handleStart(client: Client) {
    if (this.state.hostId !== client.sessionId) return;
    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.size < 1) return;

    this.createRound();
  }

  private createRound() {
    this.state.phase = "ACTIVE";
    this.roundStartedAt = Date.now();
    this.lastNoise = null;
    this.monsterStunUntil = 0;
    this.monsterRoamAngle = Math.random() * Math.PI * 2;

    const shuffledSpots = [...HIDING_SPOTS].sort(() => Math.random() - 0.5).slice(0, 7);
    const shuffledNames = [...CAMPER_NAMES].sort(() => Math.random() - 0.5).slice(0, 7);

    this.state.campers.clear();
    for (let i = 0; i < 7; i++) {
      const camper = new CamperStateClass();
      camper.id = `camper-${i + 1}`;
      camper.name = shuffledNames[i];
      camper.position = new Vec3();
      Object.assign(camper.position, shuffledSpots[i].position);
      camper.hidingSpotId = shuffledSpots[i].id;
      camper.state = "HIDING";
      camper.found = false;
      camper.safe = false;
      this.state.campers.push(camper);
    }

    this.state.monster.position.x = -36;
    this.state.monster.position.y = 1;
    this.state.monster.position.z = -34;
    this.state.monster.rotationY = 0;
    this.state.monster.state = "DORMANT";
    this.state.monster.health = MONSTER_HEALTH;
    this.state.monster.targetPlayerId = null;

    for (const door of this.state.doors) door.open = false;

    for (const player of this.state.players.values()) {
      player.position.x = Math.random() * 3 - 1.5;
      player.position.y = 1;
      player.position.z = 39;
      player.rotationY = Math.PI;
      player.crouching = false;
      player.sprinting = false;
      player.downed = false;
      player.carryingCamperId = null;
      player.followingCamperIds.clear();
      player.flashlightOn = false;
      player.hasGun = false;
      player.gunEquipped = false;
      player.ammo = 0;
      player.reserveAmmo = 0;
    }

    this.state.campersSafe = 0;
  }

  private handleMove(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.downed || this.state.phase !== "ACTIVE") return;

    player.position.x = data.position.x;
    player.position.y = data.position.y;
    player.position.z = data.position.z;
    player.rotationY = data.rotationY;
    player.crouching = data.crouching;
    player.sprinting = data.sprinting;

    if (player.sprinting) {
      this.lastNoise = { position: { ...player.position }, intensity: 0.45, at: Date.now() };
    }
  }

  private handleInteract(client: Client, data: { targetId: string }) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.downed || this.state.phase !== "ACTIVE") return;

    const targetId = data.targetId;

    // Handle doors
    const door = this.state.doors.find((d) => d.id === targetId);
    if (door) {
      door.open = !door.open;
      this.lastNoise = { position: { ...player.position }, intensity: 0.65, at: Date.now() };
      if (targetId === "drawer:director" && door.open && this.state.gun.spawned && !this.state.gun.discovered) {
        this.state.gun.discovered = true;
      }
      return;
    }

    // Handle gun pickup
    if (targetId === "gun" && this.state.gun.spawned && this.state.gun.discovered && !this.state.gun.pickedUp) {
      this.state.gun.pickedUp = true;
      this.state.gun.ownerId = client.sessionId;
      player.hasGun = true;
      player.gunEquipped = true;
      player.ammo = 7;
      player.reserveAmmo = Math.floor(Math.random() * 8);
      return;
    }

    // Handle camper interaction
    if (targetId.startsWith("camper:")) {
      const camperId = targetId.slice(7);
      const camper = this.state.campers.find((c) => c.id === camperId);
      if (!camper || camper.safe) return;

      if (!camper.found) {
        camper.found = true;
        camper.state = "FOUND";
      }

      if (!camper.carriedByPlayerId && camper.followingPlayerId === client.sessionId && !player.carryingCamperId) {
        camper.carriedByPlayerId = client.sessionId;
        camper.followingPlayerId = null;
        camper.state = "CARRIED";
        player.followingCamperIds = player.followingCamperIds.filter((id) => id !== camperId);
        player.carryingCamperId = camperId;
      } else if (!camper.carriedByPlayerId && !player.carryingCamperId) {
        camper.followingPlayerId = client.sessionId;
        camper.state = "FOLLOWING";
        if (!player.followingCamperIds.includes(camperId)) {
          player.followingCamperIds.push(camperId);
        }
      }
    }
  }

  private handleDropCamper(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.carryingCamperId) return;

    const camper = this.state.campers.find((c) => c.id === player.carryingCamperId);
    if (camper) {
      camper.carriedByPlayerId = null;
      camper.followingPlayerId = client.sessionId;
      camper.state = "FOLLOWING";
      camper.position.x = player.position.x;
      camper.position.y = player.position.y;
      camper.position.z = player.position.z;
      if (!player.followingCamperIds.includes(camper.id)) {
        player.followingCamperIds.push(camper.id);
      }
    }
    player.carryingCamperId = null;
  }

  private handleToggleFlashlight(client: Client, data: { on: boolean }) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.flashlightOn = data.on;
    }
  }

  private handleFire(client: Client, data: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player || player.downed || !player.hasGun || !player.gunEquipped || player.carryingCamperId || player.ammo <= 0) return;

    player.ammo -= 1;
    this.lastNoise = { position: { ...player.position }, intensity: 1, at: Date.now() };

    const dirLength = Math.hypot(data.direction.x, data.direction.y, data.direction.z) || 1;
    const dx = data.direction.x / dirLength;
    const dy = data.direction.y / dirLength;
    const dz = data.direction.z / dirLength;

    const toMonster = {
      x: this.state.monster.position.x - data.origin.x,
      y: this.state.monster.position.y - data.origin.y,
      z: this.state.monster.position.z - data.origin.z,
    };

    const t = toMonster.x * dx + toMonster.y * dy + toMonster.z * dz;
    if (t > 0 && t < 80 && this.state.monster.state !== "DEAD") {
      const closest = {
        x: data.origin.x + dx * t,
        y: data.origin.y + dy * t,
        z: data.origin.z + dz * t,
      };

      const dist = Math.hypot(
        closest.x - this.state.monster.position.x,
        closest.y - this.state.monster.position.y,
        closest.z - this.state.monster.position.z,
      );

      if (dist < 1.35) {
        this.state.monster.health -= 1;
        this.monsterStunUntil = Date.now() + 900;
        this.state.monster.state = this.state.monster.health <= 0 ? "DEAD" : "STUNNED";
        this.state.monster.targetPlayerId = client.sessionId;
      }
    }
  }

  private handleReload(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.hasGun || player.reserveAmmo <= 0 || player.ammo >= 7) return;

    const needed = 7 - player.ammo;
    const moved = Math.min(needed, player.reserveAmmo);
    player.ammo += moved;
    player.reserveAmmo -= moved;
  }

  private handleRevive(client: Client, data: { targetPlayerId: string }) {
    const player = this.state.players.get(client.sessionId);
    const target = this.state.players.get(data.targetPlayerId);
    if (!player || !target || player.downed || !target.downed) return;

    target.downed = false;
  }

  private handleRadio(client: Client, data: { kind: string }) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.lastNoise = { position: { ...player.position }, intensity: 0.35, at: Date.now() };
    }
  }

  private update() {
    if (this.state.phase !== "ACTIVE") return;

    const now = Date.now();
    const elapsed = (now - this.roundStartedAt) / 1000;
    this.state.roundElapsed = elapsed;

    // Update camper positions and safe status
    for (const camper of this.state.campers) {
      if (camper.safe) continue;

      if (camper.carriedByPlayerId) {
        const carrier = this.state.players.get(camper.carriedByPlayerId);
        if (carrier) {
          camper.position.x = carrier.position.x;
          camper.position.y = carrier.position.y + 0.7;
          camper.position.z = carrier.position.z;
        }
      } else if (camper.followingPlayerId) {
        const leader = this.state.players.get(camper.followingPlayerId);
        if (leader && !leader.downed) {
          const dx = leader.position.x - camper.position.x;
          const dz = leader.position.z - camper.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 1.7) {
            const speed = Math.min(4.8, Math.max(1.4, dist * 1.4));
            const dt = 1 / 60;
            camper.position.x += (dx / dist) * speed * dt;
            camper.position.z += (dz / dist) * speed * dt;
          }
        }
      }

      // Check if camper reached bus
      if (camper.found && Math.hypot(camper.position.x - BUS_CENTER.x, camper.position.z - BUS_CENTER.z) < 5.4) {
        camper.safe = true;
        camper.state = "SAFE";
        camper.followingPlayerId = null;
        camper.carriedByPlayerId = null;
        this.state.campersSafe += 1;
      }
    }

    // Check round completion
    if (this.state.campers.length > 0 && this.state.campers.every((c) => c.safe)) {
      this.state.phase = "COMPLETE";
      setTimeout(() => this.createRound(), 9000);
      return;
    }

    // Monster AI
    if (this.state.monster.state !== "DEAD") {
      if (now < this.monsterStunUntil) {
        this.state.monster.state = "STUNNED";
      } else {
        const living = Array.from(this.state.players.values()).filter((p) => !p.downed);

        if (elapsed < 35) {
          this.state.monster.state = "DORMANT";
        } else if (this.lastNoise && now - this.lastNoise.at < 4500) {
          const dist = Math.hypot(
            this.state.monster.position.x - this.lastNoise.position.x,
            this.state.monster.position.z - this.lastNoise.position.z,
          );
          if (dist < 32 * this.lastNoise.intensity + 8) {
            this.state.monster.state = "INVESTIGATE";
            const dx = this.lastNoise.position.x - this.state.monster.position.x;
            const dz = this.lastNoise.position.z - this.state.monster.position.z;
            const d = Math.hypot(dx, dz) || 1;
            this.state.monster.position.x += (dx / d) * MONSTER_BASE_SPEED * 1.15 * (1 / 60);
            this.state.monster.position.z += (dz / d) * MONSTER_BASE_SPEED * 1.15 * (1 / 60);
            this.state.monster.rotationY = Math.atan2(dx, dz);
          }
        } else if (living.length > 0) {
          let target = living[0];
          let targetScore = Infinity;
          for (const candidate of living) {
            let score = Math.hypot(
              this.state.monster.position.x - candidate.position.x,
              this.state.monster.position.z - candidate.position.z,
            );
            if (candidate.flashlightOn) score *= 0.74;
            if (candidate.sprinting) score *= 0.72;
            if (candidate.carryingCamperId) score *= 0.78;
            if (score < targetScore) {
              target = candidate;
              targetScore = score;
            }
          }

          const actualDistance = Math.hypot(
            this.state.monster.position.x - target.position.x,
            this.state.monster.position.z - target.position.z,
          );

          if (actualDistance < 20) {
            this.state.monster.targetPlayerId = target.id;
            this.state.monster.state = actualDistance < 12 ? "CHASE" : "STALK";
            const dx = target.position.x - this.state.monster.position.x;
            const dz = target.position.z - this.state.monster.position.z;
            const d = Math.hypot(dx, dz) || 1;
            const speed = this.state.monster.state === "CHASE" ? MONSTER_CHASE_SPEED : MONSTER_BASE_SPEED;
            this.state.monster.position.x += (dx / d) * speed * (1 / 60);
            this.state.monster.position.z += (dz / d) * speed * (1 / 60);
            this.state.monster.rotationY = Math.atan2(dx, dz);

            if (actualDistance < 1.6) {
              target.downed = true;
              target.sprinting = false;
              this.state.monster.state = "RETREAT";
              this.state.monster.position.x -= (dx / d) * 7;
              this.state.monster.position.z -= (dz / d) * 7;
            }
          } else {
            this.state.monster.targetPlayerId = null;
            this.state.monster.state = "ROAM";
            this.monsterRoamAngle += (1 / 60) * 0.18;
            const roamX = Math.sin(this.monsterRoamAngle) * 30;
            const roamZ = Math.cos(this.monsterRoamAngle * 0.8) * 30;
            const dx = roamX - this.state.monster.position.x;
            const dz = roamZ - this.state.monster.position.z;
            const d = Math.hypot(dx, dz) || 1;
            this.state.monster.position.x += (dx / d) * MONSTER_BASE_SPEED * 0.72 * (1 / 60);
            this.state.monster.position.z += (dz / d) * MONSTER_BASE_SPEED * 0.72 * (1 / 60);
            this.state.monster.rotationY = Math.atan2(dx, dz);
          }
        } else {
          this.state.monster.state = "ROAM";
        }
      }
    }

    // Clamp monster position
    this.state.monster.position.x = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.state.monster.position.x));
    this.state.monster.position.z = Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, this.state.monster.position.z));

    // Check failure
    if (Array.from(this.state.players.values()).every((p) => p.downed)) {
      this.state.phase = "FAILED";
      setTimeout(() => this.createRound(), 9000);
    }
  }
}
