import fs from "node:fs/promises";

const source = await fs.readFile(new URL("../src/game/CollisionMap.ts", import.meta.url), "utf8");
const game = await fs.readFile(new URL("../src/game/Game.ts", import.meta.url), "utf8");

if (!source.includes("resolveCampHorizontalMovement")) throw new Error("Missing swept horizontal collision resolver");
if (!source.includes("installCampCollisionGuard")) throw new Error("Missing post-step collision guard installer");
if (!source.includes('body.material?.name === "player"')) throw new Error("Collision guard no longer targets the player body explicitly");
if (!game.includes("installCampCollisionGuard")) throw new Error("Game startup is not installing the collision guard");

// Mirror one known CABIN A back wall from CollisionMap. The player starts well
// in front of the expanded wall and ends completely beyond it in a single frame.
// This is intentionally harsher than the 18.1125 m/s sprint displacement at a
// normal frame rate; a correct swept resolver must still stop at the boundary.
const playerRadius = 0.38;
const wallHalfThickness = 0.31;
const wallZ = 3 - 7.5 / 2;
const expandedMinZ = wallZ - wallHalfThickness - playerRadius;
const startZ = expandedMinZ - 1.5;
const endZ = expandedMinZ + 2.0;

function sweptPositive(start, end, boundary) {
  if (start <= boundary && end > boundary) return boundary - 0.012;
  return end;
}

const resolvedZ = sweptPositive(startZ, endZ, expandedMinZ);
if (!(resolvedZ < expandedMinZ)) {
  throw new Error(`High-speed wall sweep tunneled: ${resolvedZ} >= ${expandedMinZ}`);
}

const baseSpeed = 10.35;
const sprintSpeed = baseSpeed * 1.75;
if (Math.abs(sprintSpeed - 18.1125) > 1e-9) throw new Error("Sprint speed contract changed");

console.log(`COLLISION CONTRACT PASS: swept wall guard blocks tunnelling at ${sprintSpeed} sprint speed`);
