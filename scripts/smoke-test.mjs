import { spawn } from "node:child_process";
import { Client } from "colyseus.js";

const port = 3101;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let healthy = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      healthy = response.ok;
      if (healthy) break;
    } catch {}
    await wait(250);
  }

  if (!healthy) throw new Error("server never became healthy");

  const client = new Client(`ws://127.0.0.1:${port}`);
  const roomCode = "TEST-42";
  const room = await client.create("game", { roomCode });
  room.send("JOIN", { name: "Smoke Tester" });
  await wait(400);

  const player = room.state.players.get(room.sessionId);
  if (!player || player.name !== "Smoke Tester") {
    throw new Error("room created but player state was not initialized");
  }

  if (room.metadata?.roomCode !== roomCode) {
    throw new Error("room code metadata was not created");
  }

  await room.leave();
  console.log("SMOKE TEST PASS: server healthy, room created, player joined, room code assigned");
} finally {
  server.kill("SIGTERM");
}
