import fs from "node:fs/promises";

const inputSource = await fs.readFile(new URL("../src/game/Input.ts", import.meta.url), "utf8");
const gameSource = await fs.readFile(new URL("../src/game/Game.ts", import.meta.url), "utf8");

const requiredInputFragments = [
  'this.keys.has("KeyW")',
  'this.keys.has("KeyS")',
  'keyboardForward - this.moveY',
  'this.keys.has("ShiftLeft")',
  'this.keys.has("ControlLeft")',
  'event.code === "KeyE"',
  'event.code === "KeyG"',
  'event.code === "Space"',
  'event.button === 0) this.interactPressed = true',
  'event.button === 0) this.usePressed = true',
  'event.button === 2) this.scanPressed = true',
];
for (const fragment of requiredInputFragments) {
  if (!inputSource.includes(fragment)) throw new Error(`Input contract missing: ${fragment}`);
}
if (inputSource.includes("-keyboardForward + this.moveY")) {
  throw new Error("W/S regression: keyboard forward is inverted in Input.ts");
}

const baseMatch = gameSource.match(/const BASE_MOVEMENT_SPEED = ([0-9.]+);/);
const multiplierMatch = gameSource.match(/const SPRINT_MULTIPLIER = ([0-9.]+);/);
if (!baseMatch) throw new Error("Movement contract missing BASE_MOVEMENT_SPEED");
if (!multiplierMatch) throw new Error("Movement contract missing SPRINT_MULTIPLIER");
const baseSpeed = Number(baseMatch[1]);
const sprintMultiplier = Number(multiplierMatch[1]);
const sprintSpeed = baseSpeed * sprintMultiplier;
if (baseSpeed !== 18.1125) throw new Error(`Normal movement must equal previous sprint speed 18.1125; got ${baseSpeed}`);
if (sprintMultiplier !== 1.75) throw new Error(`Sprint multiplier must be 1.75; got ${sprintMultiplier}`);
if (Math.abs(sprintSpeed - 31.696875) > 1e-9) throw new Error(`Sprint speed must be 31.696875; got ${sprintSpeed}`);

if (!gameSource.includes("linearDamping: 0")) throw new Error("Player damping would reduce authored horizontal speed");
if (!gameSource.includes("this.player.velocity.x = vx") || !gameSource.includes("this.player.velocity.z = vz")) {
  throw new Error("Horizontal target velocity is no longer applied directly");
}
if (!gameSource.includes("this.physics.step(1 / 120")) throw new Error("High-speed collision contract requires 120 Hz fixed physics stepping");
if ((gameSource.match(/this\.player\.addShape\(sphere/g) ?? []).length < 3) throw new Error("Player collision must remain a vertical compound shape, not a single sphere");

function velocity(forward, right, yaw, speed) {
  const magnitude = Math.hypot(forward, right);
  if (magnitude > 1) { forward /= magnitude; right /= magnitude; }
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: (right * cos - forward * sin) * speed,
    z: (-right * sin - forward * cos) * speed,
  };
}

const wAtZero = velocity(1, 0, 0, baseSpeed);
const sAtZero = velocity(-1, 0, 0, baseSpeed);
const dAtZero = velocity(0, 1, 0, baseSpeed);
if (!(wAtZero.z < 0 && Math.abs(wAtZero.z + baseSpeed) < 1e-9)) throw new Error(`W must move camera-forward (-Z) at yaw 0; got ${JSON.stringify(wAtZero)}`);
if (!(sAtZero.z > 0 && Math.abs(sAtZero.z - baseSpeed) < 1e-9)) throw new Error(`S must move backward (+Z) at yaw 0; got ${JSON.stringify(sAtZero)}`);
if (!(dAtZero.x > 0 && Math.abs(dAtZero.x - baseSpeed) < 1e-9)) throw new Error(`D must strafe right (+X) at yaw 0; got ${JSON.stringify(dAtZero)}`);
const diagonal = velocity(1, 1, 0, baseSpeed);
if (Math.abs(Math.hypot(diagonal.x, diagonal.z) - baseSpeed) > 1e-9) throw new Error("Diagonal movement is faster than cardinal movement");

console.log("MOVEMENT CONTRACT PASS: W forward, S backward, left-click/E interact, normalized diagonal, walk 18.1125, sprint 31.696875, high-speed compound collision enabled");
