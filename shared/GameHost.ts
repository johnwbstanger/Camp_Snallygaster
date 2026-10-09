import type { CamperState, RoundAward, RoundResults, ClientMessage, DoorState, PlayerPose, PlayerState, ServerMessage, SharedRoundState } from "./protocol.js";
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

export const BUS_POSITION = { x: 0, z: 31 };
const BUS_BOARD_RADIUS = 10;
const BUS_START_RADIUS = 9;
const EXTRACTION_SECONDS = 12;
const MONSTER_COOLDOWN_SECONDS = 9;

type PlayerStats = { deaths: number; noise: number; throws: number; lootValue: number; campersDropped: number; secrets: number };

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
  private stats = new Map<string, PlayerStats>();
  private monsterCooldown = 0;

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
    this.dropFollowers(clientId);
    this.round.downed = this.round.downed.filter((id) => id !== clientId);
    if (this.hostId === clientId) this.hostId = this.players.keys().next().value ?? "";
    if (this.players.size > 0) this.broadcastRoster();
  }

  handle(clientId: string, message: ClientMessage) {
    if (!this.players.has(clientId)) return;

    if (message.type === "start") {
      if (this.hostId !== clientId) return this.sendTo(clientId, { type: "error", message: "Only the host can start" });
      if (this.round.phase !== "LOBBY") return;
      this.round = createRoundState("ACTIVE");
      this.resetStats();
      this.monsterCooldown = 0;
      this.broadcast({ type: "start" });
      this.broadcastRound();
      return;
    }

    if (message.type === "reset") {
      if (this.hostId !== clientId) return this.sendTo(clientId, { type: "error", message: "Only the host can return to the lobby" });
      if (this.round.phase !== "WON" && this.round.phase !== "LOST") return;
      this.resetToLobby();
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
    this.stats.set(id, emptyStats());
    return player;
  }

  private handleInteract(playerId: string, targetId?: string) {
    const player = this.players.get(playerId);
    if (!player || this.round.downed.includes(playerId)) return;

    if (targetId === "bus:extract") {
      if (distance2D(player.pose, BUS_POSITION) <= BUS_START_RADIUS) this.beginExtraction();
      return;
    }

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

  private beginExtraction() {
    const round = this.round;
    if (round.extraction.active || round.phase !== "ACTIVE") return;
    round.extraction = { active: true, remaining: EXTRACTION_SECONDS };
    if (!round.monster.awake && this.monsterCooldown <= 0) {
      round.monster.awake = true;
      round.monster.x = MONSTER_HOME.x; round.monster.y = MONSTER_HOME.y; round.monster.z = MONSTER_HOME.z;
    }
  }

  private dropFollowers(playerId: string) {
    for (const camper of this.round.campers) {
      if (camper.state === "FOLLOWING" && camper.followingPlayerId === playerId) {
        camper.followingPlayerId = null;
        camper.state = "HIDDEN";
        const stats = this.stats.get(playerId);
        if (stats) stats.campersDropped += 1;
      }
    }
  }

  private alivePlayers() {
    return [...this.players.values()].filter((player) => !this.round.downed.includes(player.id));
  }

  private updateRound(dt: number) {
    const round = this.round;
    round.elapsed += dt;
    if (this.monsterCooldown > 0) this.monsterCooldown = Math.max(0, this.monsterCooldown - dt);
    for (const camper of round.campers) {
      if (camper.state !== "FOLLOWING" || !camper.followingPlayerId) continue;
      const player = this.players.get(camper.followingPlayerId);
      if (!player || round.downed.includes(player.id)) { camper.state = "HIDDEN"; camper.followingPlayerId = null; continue; }

      const followers = round.campers.filter((candidate) => candidate.state === "FOLLOWING" && candidate.followingPlayerId === player.id);
      const index = followers.findIndex((candidate) => candidate.id === camper.id);
      const angle = Math.PI + (index - (followers.length - 1) / 2) * 0.42;
      moveToward(
        camper.position,
        player.pose.x + Math.sin(angle) * (2 + Math.floor(index / 3) * 0.7),
        player.pose.z + Math.cos(angle) * (2 + Math.floor(index / 3) * 0.7),
        3.4 * dt,
      );

      if (distance2D(player.pose, BUS_POSITION) < 5.2) {
        camper.state = "SAFE";
        camper.followingPlayerId = null;
        const safeIndex = round.campers.filter((candidate) => candidate.state === "SAFE").length;
        camper.position = { x: -3 + safeIndex * 0.75, y: 0.8, z: 34 };
      }
    }

    round.campersFound = round.campers.filter((camper) => camper.state !== "HIDDEN").length;
    round.campersSafe = round.campers.filter((camper) => camper.state === "SAFE").length;

    if (round.campersSafe === round.campers.length && !round.extraction.active) this.beginExtraction();

    if (round.monster.awake && this.players.size > 0) {
      const target = this.nearestVisiblePlayer();
      if (!target) {
        this.disengageMonster();
      } else {
        const definition = getMonsterDefinition(round.monster.kind);
        const distance = distance2D(target.pose, round.monster);
        const speed = definition.baseSpeed + round.campersFound * definition.speedPerCamper;
        moveToward(round.monster, target.pose.x, target.pose.z, speed * dt);
        if (distance < definition.catchDistance) this.downPlayer(target);
      }
    }

    if (round.phase === "ACTIVE" && this.alivePlayers().length === 0 && this.players.size > 0) {
      this.finishRound(false);
    } else if (round.extraction.active) {
      round.extraction.remaining = Math.max(0, round.extraction.remaining - dt);
      if (round.extraction.remaining <= 0) this.finishRound(true);
    }
    this.broadcastRound();
  }

  private downPlayer(player: PlayerState) {
    const round = this.round;
    if (round.downed.includes(player.id)) return;
    round.downed.push(player.id);
    const stats = this.stats.get(player.id);
    if (stats) stats.deaths += 1;
    this.dropFollowers(player.id);
    this.disengageMonster();
    this.monsterCooldown = MONSTER_COOLDOWN_SECONDS;
  }

  private finishRound(departed: boolean) {
    const round = this.round;
    round.extraction = { active: false, remaining: 0 };
    const aboard = departed
      ? this.alivePlayers().filter((player) => distance2D(player.pose, BUS_POSITION) <= BUS_BOARD_RADIUS)
      : [];
    if (departed) {
      for (const camper of round.campers) {
        if (camper.state !== "FOLLOWING" || !camper.followingPlayerId) continue;
        if (aboard.some((player) => player.id === camper.followingPlayerId)) {
          camper.state = "SAFE";
          camper.followingPlayerId = null;
        } else {
          this.dropFollowers(camper.followingPlayerId);
        }
      }
    }
    round.campersSafe = round.campers.filter((camper) => camper.state === "SAFE").length;
    round.results = this.buildResults(aboard.map((player) => player.id), departed && aboard.length > 0);
    round.phase = round.results.outcome === "EXTRACTED" ? "WON" : "LOST";
    this.disengageMonster();
  }

  private buildResults(aboardIds: string[], extracted: boolean): RoundResults {
    const round = this.round;
    const stats = [...this.stats.entries()].filter(([id]) => this.players.has(id));
    const lootValue = stats.filter(([id]) => aboardIds.includes(id)).reduce((sum, [, value]) => sum + value.lootValue, 0);
    return {
      outcome: extracted ? "EXTRACTED" : "WIPED",
      playersSaved: aboardIds.length,
      playersTotal: this.players.size,
      campersSaved: round.campersSafe,
      campersLost: round.campers.length - round.campersSafe,
      lootValue,
      secrets: stats.reduce((sum, [, value]) => sum + value.secrets, 0),
      deaths: round.downed.length,
      awards: this.buildAwards(aboardIds),
    };
  }

  private buildAwards(aboardIds: string[]): RoundAward[] {
    const awards: RoundAward[] = [];
    const taken = new Set<string>();
    const nameOf = (id: string) => this.players.get(id)?.name ?? "Counselor";
    const best = (pick: (stats: PlayerStats, id: string) => number, minimum: number) => {
      let winner: string | null = null;
      let top = minimum - 1;
      for (const [id, value] of this.stats) {
        if (!this.players.has(id) || taken.has(id)) continue;
        const score = pick(value, id);
        if (score > top) { top = score; winner = id; }
      }
      return winner ? { id: winner, score: top } : null;
    };
    const give = (title: string, picked: { id: string; score: number } | null, detail: (score: number) => string) => {
      if (!picked) return;
      taken.add(picked.id);
      awards.push({ title, playerName: nameOf(picked.id), detail: detail(picked.score) });
    };
    give("MOST LIKELY TO ABANDON A CHILD", best((value) => value.campersDropped, 1), (n) => `left ${n} camper${n === 1 ? "" : "s"} behind`);
    const richDead = best((value, id) => (this.round.downed.includes(id) ? value.lootValue : 0), 1);
    give(richDead ? `DIED WITH $${richDead.score} OF LOOT` : "", richDead, () => "should have dropped it");
    give("LOUDEST COUNSELOR", best((value) => value.noise, 1), (n) => `${Math.round(n)} decibels of regret`);
    give("PROFESSIONAL ROCK THROWER", best((value) => value.throws, 1), (n) => `${n} throw${n === 1 ? "" : "s"}`);
    give("GREEDIEST GREMLIN", best((value) => value.lootValue, 1), (n) => `$${n} of loot`);
    const fallback = ["QUIETEST CHAOS", "BUDDY SYSTEM ENTHUSIAST", "SUSPICIOUSLY CALM", "CAMP SPIRIT AWARD", "PROBABLY FINE"];
    let index = 0;
    for (const player of this.players.values()) {
      if (taken.has(player.id)) continue;
      const survived = aboardIds.includes(player.id);
      awards.push({ title: this.round.downed.includes(player.id) ? "PROFESSIONAL BEAR SNACK" : survived ? fallback[index++ % fallback.length] : "STAYED FOR THE LAKE", playerName: player.name, detail: survived ? "made it home" : "did not make it home" });
    }
    return awards;
  }

  private resetStats() {
    for (const id of this.players.keys()) this.stats.set(id, emptyStats());
  }

  private resetToLobby() {
    this.round = createRoundState("LOBBY");
    this.resetStats();
    this.monsterCooldown = 0;
    let slot = 0;
    for (const player of this.players.values()) {
      const angle = (slot++ / MAX_PLAYERS) * Math.PI * 2;
      player.pose = { x: Math.sin(angle) * 3.2, y: 1.4, z: 25.5 + Math.cos(angle) * 3.2, yaw: 0 };
    }
    this.broadcast({ type: "lobby" });
    this.broadcastRoster();
    this.broadcastRound();
  }

  private nearestVisiblePlayer() {
    let target: PlayerState | null = null;
    let best = Infinity;
    for (const player of this.players.values()) {
      if (this.round.downed.includes(player.id)) continue;
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
    elapsed: 0,
    extraction: { active: false, remaining: 0 },
    downed: [],
    results: null,
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

function emptyStats(): PlayerStats {
  return { deaths: 0, noise: 0, throws: 0, lootValue: 0, campersDropped: 0, secrets: 0 };
}
