import { findPath } from "../shared/campNav.js";
import { hasCampLineOfSight } from "../shared/campVision.js";
import { MonsterBrain, type BrainContext, type MonsterState } from "../shared/monsterAI.js";
import type { DoorState } from "../shared/protocol.js";

const doorIds = ["door:dining", "door:cabin-a", "door:cabin-b", "door:bath-house", "door:arts-crafts", "door:director", "door:cabin-c", "door:cabin-d", "door:infirmary", "door:maintenance"];
const closed: DoorState[] = doorIds.map((id) => ({ id, open: false }));
const open: DoorState[] = doorIds.map((id) => ({ id, open: true }));
const rng = () => 0.42;
const ctx = (players: BrainContext["players"], doors = closed): BrainContext => ({ players, doors, pressure: 0, random: rng });
const fail = (message: string): never => { throw new Error(`MONSTER AI: ${message}`); };

// Navigation routes around buildings and never through closed walls/doors.
const around = findPath({ x: -23, z: 12 }, { x: -23, z: -4 }, closed, false);
if (around === null) fail("no route around cabin A");
if (around && around.length < 2) fail("route walked straight through a cabin wall");
const outside = findPath({ x: -23, z: 12 }, { x: -23, z: 3 }, closed, false);
if (outside && outside.some((p) => p.x > -28 && p.x < -18 && p.z > -0.75 && p.z < 6.75)) fail("path entered a closed-door building");
if (findPath({ x: -23, z: 10.5 }, { x: -23, z: 3 }, closed, true) === null) fail("door-capable monster cannot path through a door");
if (findPath({ x: -23, z: 10.5 }, { x: -23, z: 3 }, open, false) === null) fail("open door should be passable");

// Full state-machine walk for a feline (hears well).
const brain = new MonsterBrain("wampus");
const seen = new Set<MonsterState>();
const step = (seconds: number, players: BrainContext["players"] = [], doors = closed) => {
  let attack: string | null = null;
  for (let t = 0; t < seconds; t += 0.1) {
    const events = brain.update(0.1, ctx(players, doors));
    seen.add(brain.state);
    if (events.attack) attack = events.attack;
  }
  return attack;
};
if (brain.state !== "IDLE") fail("brain should start idle");
step(60);
if (brain.state === "IDLE") fail("brain never woke from grace period");
brain.reset("wampus");
if (brain.awake) fail("reset should sleep the brain");
brain.wakeAt({ x: 0, z: 0 }, closed);
step(0.2);
if (brain.state !== "INVESTIGATE") fail("wakeAt should investigate");
step(30);

// Thrown-rock noise: monster ~20 m away investigates the noise location.
brain.reset("wampus"); step(45); brain.x = -10; brain.z = 0; // reach ROAM, then place in open ground
if (!brain.hear({ x: 20, z: 0, loudness: 40, material: "rock", source: "impact" }, closed)) fail("loud noise within range was not heard");
if (brain.state !== "HEAR") fail("hearing did not enter HEAR");
step(1);
if (brain.state !== "INVESTIGATE") fail("HEAR did not become INVESTIGATE");
const before = Math.hypot(brain.x - 20, brain.z - 0);
step(2);
if (Math.hypot(brain.x - 20, brain.z - 0) >= before) fail("monster did not move toward the noise");
brain.reset("wampus"); brain.x = -10; brain.z = 0;
if (brain.hear({ x: 200, z: 0, loudness: 20, material: "rock", source: "impact" }, closed)) fail("far quiet noise should be inaudible");

// Sight: visible player -> SUSPICIOUS -> SPOT -> CHASE -> ATTACK.
const hunted = new MonsterBrain("rake");
hunted.reset("rake"); hunted.x = 0; hunted.z = 0; hunted.state = "ROAM"; hunted.yaw = Math.PI;
const prey = [{ id: "p1", x: 0, z: -12, crouch: false, sprint: false, flashlight: true }];
const trail: MonsterState[] = [];
let attacked: string | null = null;
for (let t = 0; t < 20 && !attacked; t += 0.1) {
  const events = hunted.update(0.1, ctx(prey, open));
  if (trail[trail.length - 1] !== hunted.state) trail.push(hunted.state);
  if (events.attack) attacked = events.attack;
}
for (const required of ["SUSPICIOUS", "SPOT", "CHASE", "ATTACK", "COOLDOWN"] as MonsterState[]) {
  if (!trail.includes(required)) fail(`state ${required} never reached (${trail.join(">")})`);
}
if (attacked !== "p1") fail("attack did not hit the chased player");

// Losing sight behind a wall sends the monster searching, not teleporting through it.
const chaser = new MonsterBrain("snallygaster");
chaser.x = -23; chaser.z = 12; chaser.state = "CHASE"; chaser.targetId = "p1";
const hidden = [{ id: "p1", x: -23, z: 3, crouch: true, sprint: false, flashlight: false }];
if (hasCampLineOfSight(chaser, hidden[0], closed)) fail("test setup: player should be hidden");
for (let t = 0; t < 6; t += 0.1) chaser.update(0.1, ctx(hidden));
if (chaser.state === "CHASE" || chaser.state === "ATTACK") fail("monster kept chasing through a closed building");
if (Math.hypot(chaser.x + 23, chaser.z - 3) < 4) fail("monster passed through the cabin wall");

// Brute opens doors; winged does not.
const brute = new MonsterBrain("bigfoot");
brute.x = -23; brute.z = 12; brute.wakeAt({ x: -23, z: 3 }, closed);
let opened: string[] = [];
for (let t = 0; t < 10 && !opened.length; t += 0.1) opened = brute.update(0.1, ctx([])).openDoors;
if (!opened.includes("door:cabin-a")) fail("brute did not open the closed cabin door");

console.log("MONSTER AI CONTRACT PASS: nav around walls, noise investigate, sight->spot->chase->attack->cooldown, lose-sight search, brute door opening");
