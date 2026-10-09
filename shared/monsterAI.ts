import { closedDoorsNear, findPath, type NavPoint } from "./campNav.js";
import { hasCampLineOfSight, MONSTER_HOME } from "./campVision.js";
import { getMonsterDefinition, type MonsterArchetype, type MonsterKind } from "./monsterLibrary.js";
import type { DoorState } from "./protocol.js";

export type MonsterState =
  | "IDLE" | "ROAM" | "HEAR" | "INVESTIGATE" | "SUSPICIOUS" | "SPOT" | "CHASE" | "ATTACK" | "SEARCH" | "COOLDOWN";

export type NoiseEvent = { x: number; z: number; loudness: number; material: string; source: string };

export type SensePlayer = { id: string; x: number; z: number; crouch: boolean; sprint: boolean; flashlight: boolean };

export type SenseProfile = {
  sightRange: number;
  fovDegrees: number;
  hearing: number;
  flashlightPull: number;
  openDoors: boolean;
  roamSpeed: number;
  investigateSpeed: number;
  chaseSpeed: number;
};

/** Each archetype senses the camp differently so friends learn what they're dealing with. */
export const SENSE_PROFILES: Record<MonsterArchetype, SenseProfile> = {
  winged: { sightRange: 42, fovDegrees: 150, hearing: 1.0, flashlightPull: 1.0, openDoors: false, roamSpeed: 4.6, investigateSpeed: 8.5, chaseSpeed: 13.5 },
  feline: { sightRange: 30, fovDegrees: 120, hearing: 1.45, flashlightPull: 0.8, openDoors: false, roamSpeed: 4.2, investigateSpeed: 9.5, chaseSpeed: 14.5 },
  brute: { sightRange: 24, fovDegrees: 100, hearing: 0.75, flashlightPull: 0.6, openDoors: true, roamSpeed: 3.6, investigateSpeed: 7.0, chaseSpeed: 11.5 },
  stalker: { sightRange: 46, fovDegrees: 110, hearing: 0.55, flashlightPull: 2.4, openDoors: false, roamSpeed: 5.2, investigateSpeed: 8.0, chaseSpeed: 16.0 },
  hunter: { sightRange: 34, fovDegrees: 130, hearing: 1.2, flashlightPull: 1.0, openDoors: true, roamSpeed: 4.8, investigateSpeed: 9.0, chaseSpeed: 14.0 },
};

export const ROAM_WAYPOINTS: readonly NavPoint[] = [
  { x: -32, z: -29 }, { x: 0, z: -14 }, { x: 14, z: 0 }, { x: -14, z: 2 }, { x: 0, z: 22 },
  { x: -30, z: 22 }, { x: 32, z: 22 }, { x: -48, z: -8 }, { x: 48, z: -8 }, { x: 0, z: -40 },
  { x: -40, z: -28 }, { x: 40, z: -28 }, { x: 25, z: 28 }, { x: -25, z: 28 }, { x: -55, z: 25 }, { x: 55, z: 25 },
];

export type BrainContext = {
  players: SensePlayer[];
  doors: readonly DoorState[];
  pressure: number;
  random: () => number;
};

export type BrainEvents = { attack: string | null; openDoors: string[]; spotted: boolean };

const GRACE_SECONDS = 40;
const CATCH_SCALE = 1.0;

export class MonsterBrain {
  state: MonsterState = "IDLE";
  x: number = MONSTER_HOME.x;
  z: number = MONSTER_HOME.z;
  yaw = 0;
  awareness = 0;
  targetId: string | null = null;
  private timer = GRACE_SECONDS;
  private path: NavPoint[] = [];
  private goal: NavPoint | null = null;
  private lastKnown: NavPoint | null = null;
  private lostSight = 0;
  private repath = 0;
  private searchPoints = 0;
  private pendingNoise: NoiseEvent | null = null;

  constructor(public kind: MonsterKind) {}

  get profile() { return SENSE_PROFILES[getMonsterDefinition(this.kind).archetype]; }
  get awake() { return this.state !== "IDLE"; }

  reset(kind: MonsterKind) {
    Object.assign(this, { kind, state: "IDLE" as MonsterState, x: MONSTER_HOME.x, z: MONSTER_HOME.z, awareness: 0, targetId: null, timer: GRACE_SECONDS, path: [], goal: null, lastKnown: null, lostSight: 0, repath: 0, searchPoints: 0, pendingNoise: null });
  }

  /** Called for noise events; the monster decides if it is meaningful given species and distance/walls. */
  hear(noise: NoiseEvent, doors: readonly DoorState[]) {
    this.lastDoors = doors;
    if (this.state === "COOLDOWN" || this.state === "ATTACK") return false;
    const distance = Math.hypot(noise.x - this.x, noise.z - this.z);
    const walled = !hasCampLineOfSight(this, noise, doors);
    const radius = noise.loudness * this.profile.hearing * (walled ? 0.55 : 1);
    if (distance > radius) return false;
    if (this.state === "CHASE" || this.state === "SPOT") return false;
    const current = this.pendingNoise;
    if (current && current.loudness * 0.9 > noise.loudness) return false;
    this.pendingNoise = noise;
    if (this.state !== "HEAR") { this.state = "HEAR"; this.timer = 0.5; this.path = []; }
    return true;
  }

  wakeAt(point: NavPoint, doors: readonly DoorState[]) {
    this.lastDoors = doors;
    if (this.state === "COOLDOWN" || this.state === "CHASE" || this.state === "SPOT" || this.state === "ATTACK") return;
    this.state = "INVESTIGATE";
    this.goTo(point, "INVESTIGATE");
  }

  update(dt: number, ctx: BrainContext): BrainEvents {
    const events: BrainEvents = { attack: null, openDoors: [], spotted: false };
    if (this.state === "IDLE") {
      this.timer -= dt * (1 + ctx.pressure * 2);
      if (this.timer <= 0) this.pickRoam(ctx);
      return events;
    }
    const def = getMonsterDefinition(this.kind);
    const profile = this.profile;
    const sensed = this.state === "COOLDOWN" || this.state === "ATTACK" ? null : this.sense(dt, ctx);
    const pressureBoost = 1 + ctx.pressure * 0.25;

    switch (this.state) {
      case "ROAM":
        if (sensed) break;
        if (this.followPath(dt, profile.roamSpeed * pressureBoost, ctx, events)) {
          this.timer = 1.5 + ctx.random() * 2.5;
          this.state = "SEARCH";
          this.searchPoints = 0;
          this.goal = null;
        }
        break;
      case "HEAR":
        this.timer -= dt;
        if (this.pendingNoise) this.yaw = Math.atan2(this.pendingNoise.x - this.x, this.pendingNoise.z - this.z);
        if (this.timer <= 0 && this.pendingNoise) {
          const point = { x: this.pendingNoise.x, z: this.pendingNoise.z };
          this.pendingNoise = null;
          this.goTo(point, "INVESTIGATE");
        } else if (this.timer <= 0) this.pickRoam(ctx);
        break;
      case "INVESTIGATE":
        if (this.followPath(dt, profile.investigateSpeed * pressureBoost, ctx, events) || !this.goal) {
          this.state = "SEARCH"; this.timer = 6; this.searchPoints = 0; this.goal = null;
        }
        break;
      case "SUSPICIOUS":
        this.timer -= dt;
        if (this.lastKnown) this.yaw = Math.atan2(this.lastKnown.x - this.x, this.lastKnown.z - this.z);
        if (this.awareness >= 1) { this.state = "SPOT"; this.timer = 0.7; events.spotted = true; }
        else if (this.awareness <= 0.05 || this.timer <= -4) {
          if (this.lastKnown) this.goTo(this.lastKnown, "INVESTIGATE"); else this.pickRoam(ctx);
        }
        break;
      case "SPOT":
        this.timer -= dt;
        if (this.timer <= 0) { this.state = "CHASE"; this.lostSight = 0; this.repath = 0; }
        break;
      case "CHASE": {
        const target = ctx.players.find((p) => p.id === this.targetId);
        if (!target) { this.toSearch(); break; }
        const visible = this.canSee(target, ctx, 1.4);
        if (visible) { this.lostSight = 0; this.lastKnown = { x: target.x, z: target.z }; } else this.lostSight += dt;
        if (this.lostSight > 3.2) { this.toSearch(); break; }
        this.repath -= dt;
        const goal = this.lastKnown ?? target;
        if (this.repath <= 0 || !this.path.length) { this.goTo(goal, "CHASE"); this.repath = 0.4; }
        const speed = Math.min(20, (profile.chaseSpeed + ctx.pressure * 3) * (def.scale > 1.2 ? 0.95 : 1));
        this.followPath(dt, speed, ctx, events);
        if (Math.hypot(target.x - this.x, target.z - this.z) <= def.catchDistance * CATCH_SCALE + 0.6) { this.state = "ATTACK"; this.timer = 0.35; }
        break;
      }
      case "ATTACK": {
        this.timer -= dt;
        const target = ctx.players.find((p) => p.id === this.targetId);
        if (this.timer <= 0) {
          if (target && Math.hypot(target.x - this.x, target.z - this.z) <= def.catchDistance * 2.2 + 0.6) {
            events.attack = target.id;
            this.state = "COOLDOWN"; this.timer = 9; this.awareness = 0; this.targetId = null;
            this.pickWaypointFar(ctx);
          } else { this.state = "CHASE"; this.repath = 0; }
        }
        break;
      }
      case "SEARCH":
        this.timer -= dt;
        if (sensed) break;
        if (this.lastKnown && !this.goal) { this.goTo(this.lastKnown, "SEARCH"); this.lastKnown = null; }
        if (this.goal && this.path.length) { this.followPath(dt, profile.roamSpeed * 1.3, ctx, events); break; }
        this.goal = null;
        this.yaw += dt * 1.6;
        if (this.timer <= 0) {
          if (this.searchPoints < 2) {
            this.searchPoints += 1; this.timer = 3;
            this.goTo({ x: this.x + (ctx.random() - 0.5) * 16, z: this.z + (ctx.random() - 0.5) * 16 }, "SEARCH");
          } else this.pickRoam(ctx);
        }
        break;
      case "COOLDOWN":
        this.timer -= dt;
        this.followPath(dt, profile.roamSpeed * 1.5, ctx, events);
        if (this.timer <= 0) this.pickRoam(ctx);
        break;
    }
    return events;
  }

  private toSearch() {
    this.state = "SEARCH"; this.timer = 7; this.searchPoints = 0; this.targetId = null; this.awareness = 0.3;
    if (this.lastKnown) this.goTo(this.lastKnown, "SEARCH");
  }

  private canSee(player: SensePlayer, ctx: BrainContext, rangeScale = 1) {
    const dx = player.x - this.x, dz = player.z - this.z;
    const distance = Math.hypot(dx, dz);
    let range = this.profile.sightRange * rangeScale * (player.crouch ? 0.55 : 1) * (1 + ctx.pressure * 0.4);
    if (player.flashlight) range *= 1 + 0.5 * this.profile.flashlightPull;
    if (distance > range) return false;
    if (distance > 7) {
      const facing = Math.atan2(dx, dz);
      let diff = Math.abs(facing - this.yaw) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > (this.profile.fovDegrees * Math.PI) / 360 && this.state !== "CHASE") return false;
    }
    return hasCampLineOfSight(this, player, ctx.doors);
  }

  /** Builds awareness from sight; returns true when sensing changed the state. */
  private sense(dt: number, ctx: BrainContext) {
    let best: SensePlayer | null = null;
    let bestScore = 0;
    for (const player of ctx.players) {
      if (!this.canSee(player, ctx)) continue;
      const distance = Math.max(2, Math.hypot(player.x - this.x, player.z - this.z));
      const score = (this.profile.sightRange / distance) * (player.sprint ? 1.4 : 1) * (player.flashlight ? 1 + this.profile.flashlightPull : 1);
      if (score > bestScore) { bestScore = score; best = player; }
    }
    if (best) {
      this.targetId = best.id;
      this.lastKnown = { x: best.x, z: best.z };
      this.awareness = Math.min(1.2, this.awareness + dt * Math.min(2.2, 0.25 + bestScore * 0.32));
      if (this.state === "CHASE" || this.state === "SPOT") return false;
      if (this.awareness >= 1) { this.state = "SPOT"; this.timer = 0.7; this.path = []; return true; }
      if (this.awareness >= 0.3 && this.state !== "SUSPICIOUS") { this.state = "SUSPICIOUS"; this.timer = 0; this.path = []; return true; }
      return this.state === "SUSPICIOUS";
    }
    this.awareness = Math.max(0, this.awareness - dt * 0.18);
    return false;
  }

  private goTo(point: NavPoint, state: MonsterState) {
    this.goal = point;
    this.state = state;
    const path = findPath(this, point, this.lastDoors, this.profile.openDoors);
    this.path = path ?? [];
  }

  private lastDoors: readonly DoorState[] = [];

  private pickRoam(ctx: BrainContext) {
    const pool = ROAM_WAYPOINTS.filter((p) => Math.hypot(p.x - this.x, p.z - this.z) > 12);
    const point = pool[Math.floor(ctx.random() * pool.length)] ?? ROAM_WAYPOINTS[0];
    this.lastDoors = ctx.doors;
    this.state = "ROAM";
    this.goTo(point, "ROAM");
  }

  private pickWaypointFar(ctx: BrainContext) {
    const point = [...ROAM_WAYPOINTS].sort((a, b) => Math.hypot(b.x - this.x, b.z - this.z) - Math.hypot(a.x - this.x, a.z - this.z))[0];
    this.lastDoors = ctx.doors;
    this.goTo(point, "COOLDOWN");
  }

  private followPath(dt: number, speed: number, ctx: BrainContext, events: BrainEvents) {
    this.lastDoors = ctx.doors;
    if (!this.path.length) return !this.goal || Math.hypot(this.goal.x - this.x, this.goal.z - this.z) < 1.2;
    let budget = speed * dt;
    while (budget > 0 && this.path.length) {
      const next = this.path[0];
      const dx = next.x - this.x, dz = next.z - this.z;
      const distance = Math.hypot(dx, dz);
      this.yaw = Math.atan2(dx, dz);
      if (distance <= budget) { this.x = next.x; this.z = next.z; budget -= distance; this.path.shift(); }
      else { this.x += (dx / distance) * budget; this.z += (dz / distance) * budget; budget = 0; }
    }
    if (this.profile.openDoors) events.openDoors.push(...closedDoorsNear(this, 2.6, ctx.doors));
    return this.path.length === 0;
  }
}
