import fs from "node:fs/promises";
import { hasCampLineOfSight, MONSTER_HOME } from "../shared/campVision.ts";
import type { DoorState } from "../shared/protocol.ts";

const serverSource = await fs.readFile(new URL("../shared/GameHost.ts", import.meta.url), "utf8");
const objectiveSource = await fs.readFile(new URL("../src/game/ObjectiveSystem.ts", import.meta.url), "utf8");

if (serverSource.includes("monster.awake ||=")) {
  throw new Error("Sticky monster-awake regression: server still forces chase forever after rescue");
}
for (const fragment of ["hasCampLineOfSight", "nearestVisiblePlayer", "disengageMonster", "monster.awake = false"]) {
  if (!serverSource.includes(fragment)) throw new Error(`Server chase contract missing: ${fragment}`);
}
if (!objectiveSource.includes("hasCampLineOfSight") || !objectiveSource.includes("this.monsterAwake = false")) {
  throw new Error("Solo chase does not disengage on lost line of sight");
}

const doorIds = [
  "door:dining", "door:cabin-a", "door:cabin-b", "door:bath-house", "door:arts-crafts",
  "door:director", "door:cabin-c", "door:cabin-d", "door:infirmary", "door:maintenance",
];
const closedDoors: DoorState[] = doorIds.map((id) => ({ id, open: false }));
const cabinAOpen = closedDoors.map((door) => door.id === "door:cabin-a" ? { ...door, open: true } : door);

// Straight through Cabin A's front doorway: an open door must permit vision.
const outsideCabinA = { x: -23, z: 10.5 };
const insideCabinA = { x: -23, z: 3 };
if (!hasCampLineOfSight(outsideCabinA, insideCabinA, cabinAOpen)) {
  throw new Error("Open cabin doorway incorrectly blocks Snallygaster line of sight");
}
if (hasCampLineOfSight(outsideCabinA, insideCabinA, closedDoors)) {
  throw new Error("Closed cabin doorway incorrectly allows Snallygaster line of sight");
}

// A wall should block sight even if the front door is open.
const throughSideWall = { x: -16, z: 3 };
if (hasCampLineOfSight(throughSideWall, insideCabinA, cabinAOpen)) {
  throw new Error("Cabin side wall incorrectly allows Snallygaster line of sight");
}

if (MONSTER_HOME.x !== -32 || MONSTER_HOME.z !== -29) {
  throw new Error("Monster home position changed unexpectedly");
}

console.log("SNALLYGASTER CONTRACT PASS: open doorway visible, closed doorway/walls break chase, disengage paths present");
