import type { CamperState, ClientMessage, DoorState, PlayerPose, PlayerState, ServerMessage, SharedRoundState } from "./protocol.js";
import { hasCampLineOfSight, MONSTER_HOME } from "./campVision.js";
import { chooseRandomMonster, getMonsterDefinition } from "./monsterLibrary.js";

export const MAX_PLAYERS = 15;

type DoorDefinition = { id: string; x: number; z: number };

const CAMPERS: ReadonlyArray<readonly [string, number, number, number]> = [
  ["Ben", -21, 0.8, 8], ["Maya", -11, 0.8, -10], ["Jamie", 13, 0.8, 9],
  ["Katie", 20, 0.8, -17], ["Nate", -19, 0.8, -18], ["Jess", -4, 0.8, 21], ["Luke", 25, 0.8, 16],
];

const DOORS: ReadonlyArray<DoorDefinition> = [
  { id: "door:dining", x: 0, z: -22.5 },
  { id: "door:cabin-a", x: -23, z: 6.75 },
  { id: "door:cabin-b", x: 23, z: 6.75 },
  { id: "door:bath-house", x: -27, z: -19.5 },
  { id: "door:arts-crafts", x: 27, z: -19.5 },
  { id: "door:director", x: 0, z: 15.5 },
  { id: "door:cabin-c", x: -45, z: 16.75 },
  { id: "door:cabin-d", x: 45, z: 16.75 },
  { id: "door:infirmary", x: -43, z: -36 },
  { id: "door:maintenance", x: 43, z: -36 },
];

const ROOM_WORDS = ["PINE", "LAKE", "MOSS", "FIRE", "CAMP", "BEAR", "OWL", "TENT"];

export function generateRoomCode() {
  return `${ROOM_WORDS[Math.floor(Math.random() * ROOM_WORDS.length)]}${Math.floor(100 + Math.random() * 900)}`;
}

export function normalizeRoomCode(code: string) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type HostSend = (clientId: string, message: ServerMessage) => void;

/**
 * Transport-agnostic authoritative room. Runs inside the Node server or inside the
 * hosting player's browser (peer-to-peer), so both modes share exactly one rule set.
 */
export class GameHost {
  readonly players = new Map<string, PlayerState>();
  hostId = "";
  round: SharedRoundState = createRoundState("LOBBY");
  private poseDirty = false;

  constructor(readonly code: string, private readonly sendTo: HostSend) {}

  get size() { return this.players.size; }

  join(clientId: string, rawName: string, asHost: boolean): string | null {
    if (this.players.has(clientId)) return null;
    if (!asHost) {
      if (this.round.phase !== "LOBBY") return "That camp has already started";
      if (this.players.size >= MAX_PLAYERS) return `That camp is full (${MAX_PLAYERS}/${MAX_PLAYERS})`;
    }
    const player = this.addPlayer(clientId, rawName);
    if (asHost) this.hostId = player.id;
    this.sendTo(clientId, {
      type: "welcome",
      playerId: clientId,
      roomCode: this.code,
      hostId: this.hostId,
      maxPlayers: MAX_PLAYERS,
      players: [...this.players.values()],
    });
    this.broadcastRoster();
    return null;
  }

  leave(clientId: string) {
    if (!this.players.delete(clientId)) return;
    for (const camper of this.round.campers) {
      if (camper.followingPlayerId === clientId) {
        camper.followingPlayerId = null;
        camper.state = "HIDDEN";
      }
    }
    if (this.hostId === clientId) this.hostId = this.players.keys().next().value ?? "";
    if (this.players.size > 0) this.broadcastRoster();
  }

  handle(clientId: string, message: ClientMessage) {
    if (!this.players.has(clientId)) return;

    if (message.type === "start") {
      if (this.hostId !== clientId) return this.sendTo(clientId, { type: "error", message: "Only the host can start" });
      if (this.round.phase !== "LOBBY") return;
      this.round = createRoundState("ACTIVE");
      this.broadcast({ type: "start" });
      this.broadcastRound();
      return;
    }

    if (message.type === "move") {
      const player = this.players.get(clientId);
      if (!player) return;
      player.pose = sanitizePose(message.pose);
      this.poseDirty = true;
      return;
    }

    if (message.type === "interact") {
      if (this.round.phase !== "ACTIVE") return;
      this.handleInteract(clientId, message.targetId);
      this.broadcastRound();
      return;
    }

    if (message.type === "ping") this.sendTo(clientId, { type: "pong", at: message.at });
  }

  tick(dt: number) {
    if (this.round.phase === "ACTIVE") this.updateRound(dt);
    if (this.poseDirty) {
      this.poseDirty = false;
      this.broadcast({ type: "snapshot", players: [...this.players.values()] });
    }
  }

  private addPlayer(id: string, rawName: string) {
    const name = String(rawName || "Counselor").trim().slice(0, 18) || "Counselor";
    const slot = this.players.size;
    const angle = (slot / MAX_PLAYERS) * Math.PI * 2;
    const radius = 3.2;
    const player: PlayerState = {
      id,
      name,
      pose: { x: Math.sin(angle) * radius, y: 1.4, z: 25.5 + Math.cos(angle) * radius, yaw: 0 },
    };
    this.players.set(id, player);
    return player;
  }

  private handleInteract(playerId: string, targetId?: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    if (targetId?.startsWith("door:")) {
      const definition = DOORS.find((door) => door.id === targetId);
      const door = this.round.doors.find((candidate) => candidate.id === targetId);
      if (!definition || !door) return;
      if (distance2D(player.pose, definition) > 4.0) return;
      door.open = !door.open;
      if (!door.open && this.round.monster.awake && !this.nearestVisiblePlayer()) this.disengageMonster();
      return;
    }

    let nearest: CamperState | null = null;
    let nearestDistance = Infinity;
    for (const camper of this.round.campers) {
      if (camper.state !== "HIDDEN") continue;
      const distance = distance2D(player.pose, camper.position);
      if (distance < nearestDistance) { nearest = camper; nearestDistance = distance; }
    }
    if (nearest && nearestDistance <= 2.8) {
      nearest.state = "FOLLOWING";
      nearest.followingPlayerId = playerId;
      const monster = this.round.monster;
      monster.awake = true;
      monster.x = MONSTER_HOME.x; monster.y = MONSTER_HOME.y; monster.z = MONSTER_HOME.z;
      this.round.campersFound = this.round.campers.filter((camper) => camper.state !== "HIDDEN").length;
    }
  }

  private updateRound(dt: number) {
    const round = this.round;
    for (const camper of round.campers) {
      if (camper.state !== "FOLLOWING" || !camper.followingPlayerId) continue;
      const player = this.players.get(camper.followingPlayerId);
      if (!player) { camper.state = "HIDDEN"; camper.followingPlayerId = null; continue; }

      const followers = round.campers.filter((candidate) => candidate.state === "FOLLOWING" && candidate.followingPlayerId === player.id);
      const index = followers.findIndex((candidate) => candidate.id === camper.id);
      const angle = Math.PI + (index - (followers.length - 1) / 2) * 0.42;
      moveToward(
        camper.position,
        player.pose.x + Math.sin(angle) * (2 + Math.floor(index / 3) * 0.7),
        player.pose.z + Math.cos(angle) * (2 + Math.floor(index / 3) * 0.7),
        3.4 * dt,
      );

      if (distance2D(player.pose, { x: 0, z: 31 }) < 5.2) {
        camper.state = "SAFE";
        camper.followingPlayerId = null;
        const safeIndex = round.campers.filter((candidate) => candidate.state === "SAFE").length;
        camper.position = { x: -3 + safeIndex * 0.75, y: 0.8, z: 34 };
      }
    }

    round.campersFound = round.campers.filter((camper) => camper.state !== "HIDDEN").length;
    round.campersSafe = round.campers.filter((camper) => camper.state === "SAFE").length;

    if (round.campersSafe === round.campers.length) {
      round.phase = "WON";
      this.broadcastRound();
      return;
    }

    if (round.monster.awake && this.players.size > 0) {
      const target = this.nearestVisiblePlayer();
      if (!target) {
        this.disengageMonster();
      } else {
        const definition = getMonsterDefinition(round.monster.kind);
        const distance = distance2D(target.pose, round.monster);
        const speed = definition.baseSpeed + round.campersFound * definition.speedPerCamper;
        moveToward(round.monster, target.pose.x, target.pose.z, speed * dt);
        if (distance < definition.catchDistance) round.phase = "LOST";
      }
    }
    this.broadcastRound();
  }

  private nearestVisiblePlayer() {
    let target: PlayerState | null = null;
    let best = Infinity;
    for (const player of this.players.values()) {
      if (!hasCampLineOfSight(this.round.monster, player.pose, this.round.doors)) continue;
      const distance = distance2D(player.pose, this.round.monster);
      if (distance < best) { best = distance; target = player; }
    }
    return target;
  }

  private disengageMonster() {
    const monster = this.round.monster;
    monster.awake = false;
    monster.x = MONSTER_HOME.x; monster.y = MONSTER_HOME.y; monster.z = MONSTER_HOME.z;
  }

  private broadcastRoster() {
    this.broadcast({ type: "roster", roomCode: this.code, hostId: this.hostId, maxPlayers: MAX_PLAYERS, players: [...this.players.values()] });
  }

  private broadcastRound() { this.broadcast({ type: "round", state: this.round }); }

  private broadcast(message: ServerMessage) {
    for (const id of this.players.keys()) this.sendTo(id, message);
  }
}

export function createRoundState(phase: SharedRoundState["phase"]): SharedRoundState {
  const selected = chooseRandomMonster();
  return {
    phase,
    campers: CAMPERS.map(([name, x, y, z], index): CamperState => ({
      id: `camper-${index + 1}`, name, state: "HIDDEN", followingPlayerId: null, position: { x, y, z },
    })),
    doors: DOORS.map(({ id }): DoorState => ({ id, open: false })),
    monster: { kind: selected.id, x: MONSTER_HOME.x, y: MONSTER_HOME.y, z: MONSTER_HOME.z, awake: false },
    campersSafe: 0,
    campersFound: 0,
  };
}

export function sanitizePose(pose: PlayerPose): PlayerPose {
  const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;
  return {
    x: Math.max(-75, Math.min(75, finite(pose.x))),
    y: Math.max(-5, Math.min(20, finite(pose.y, 1.4))),
    z: Math.max(-75, Math.min(75, finite(pose.z))),
    yaw: finite(pose.yaw),
  };
}

function moveToward(position: { x: number; z: number }, targetX: number, targetZ: number, maxDistance: number) {
  const dx = targetX - position.x;
  const dz = targetZ - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.0001) return;
  const amount = Math.min(distance, maxDistance);
  position.x += (dx / distance) * amount;
  position.z += (dz / distance) * amount;
}

function distance2D(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
