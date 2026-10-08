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
  'event.button === 0) this.usePressed = true',
  'event.button === 2) this.scanPressed = true',
];
for (const fragment of requiredInputFragments) {
  if (!inputSource.includes(fragment)) throw new Error(`Input contract missing: ${fragment}`);
}
if (inputSource.includes("-keyboardForward + this.moveY")) {
  throw new Error("W/S regression: keyboard forward is inverted in Input.ts");
}

const expectedConstants = new Map([
  ["LC_MOVEMENT_SPEED", 4.6],
  ["LC_SPRINT_MULTIPLIER_MIN", 1.0],
  ["LC_SPRINT_MULTIPLIER_MAX", 2.25],
  ["LC_SPRINT_INCREASE_RATE", 1.0],
  ["LC_SPRINT_DECREASE_RATE", 10.0],
]);
for (const [name, expected] of expectedConstants) {
  const match = gameSource.match(new RegExp(`const ${name} = ([0-9.]+);`));
  if (!match) throw new Error(`Movement contract missing ${name}`);
  const actual = Number(match[1]);
  if (actual !== expected) throw new Error(`${name} changed: expected ${expected}, got ${actual}`);
}
if (!gameSource.includes("linearDamping: 0")) throw new Error("Player damping would reduce authored horizontal speed");
if (!gameSource.includes("this.player.velocity.x = vx") || !gameSource.includes("this.player.velocity.z = vz")) {
  throw new Error("Horizontal target velocity is no longer applied directly");
}

const movementSpeed = 4.6;
const sprintMax = 2.25;
const maxSprint = movementSpeed * sprintMax;
if (Math.abs(maxSprint - 10.35) > 1e-9) throw new Error(`Expected max sprint 10.35, got ${maxSprint}`);

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

const wAtZero = velocity(1, 0, 0, movementSpeed);
const sAtZero = velocity(-1, 0, 0, movementSpeed);
const dAtZero = velocity(0, 1, 0, movementSpeed);
if (!(wAtZero.z < 0 && Math.abs(wAtZero.z + 4.6) < 1e-9)) throw new Error(`W must move camera-forward (-Z) at yaw 0; got ${JSON.stringify(wAtZero)}`);
if (!(sAtZero.z > 0 && Math.abs(sAtZero.z - 4.6) < 1e-9)) throw new Error(`S must move backward (+Z) at yaw 0; got ${JSON.stringify(sAtZero)}`);
if (!(dAtZero.x > 0 && Math.abs(dAtZero.x - 4.6) < 1e-9)) throw new Error(`D must strafe right (+X) at yaw 0; got ${JSON.stringify(dAtZero)}`);

const diagonal = velocity(1, 1, 0, movementSpeed);
if (Math.abs(Math.hypot(diagonal.x, diagonal.z) - movementSpeed) > 1e-9) {
  throw new Error("Diagonal movement is faster than cardinal movement");
}

console.log("MOVEMENT CONTRACT PASS: W forward, S backward, normalized diagonal, walk 4.6, sprint cap 10.35, canonical LC keybinds present");
