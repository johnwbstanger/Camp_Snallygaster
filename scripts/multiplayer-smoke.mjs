import { spawn } from "node:child_process";
import WebSocket from "ws";

const port = 3201;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {}
    await wait(250);
  }
  throw new Error("server never became healthy");
}

function openClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => reject(new Error("websocket connection timed out")), 4000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function nextMessage(socket, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("message", handler);
      reject(new Error("expected websocket message timed out"));
    }, timeoutMs);
    const handler = (raw) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.off("message", handler);
      resolve(message);
    };
    socket.on("message", handler);
  });
}

function send(socket, message) {
  socket.send(JSON.stringify(message));
}

let host;
let guest;
try {
  await waitForHealth();
  host = await openClient();
  guest = await openClient();

  const hostWelcomePromise = nextMessage(host, (m) => m.type === "welcome");
  send(host, { type: "create", name: "Host Tester" });
  const hostWelcome = await hostWelcomePromise;
  if (!hostWelcome.roomCode || !hostWelcome.playerId) throw new Error("host room was not created correctly");

  const guestWelcomePromise = nextMessage(guest, (m) => m.type === "welcome");
  const hostRosterPromise = nextMessage(host, (m) => m.type === "roster" && m.players?.length === 2);
  send(guest, { type: "join", name: "Guest Tester", roomCode: hostWelcome.roomCode });
  const guestWelcome = await guestWelcomePromise;
  const hostRoster = await hostRosterPromise;

  if (guestWelcome.roomCode !== hostWelcome.roomCode) throw new Error("guest joined wrong room");
  if (hostRoster.players.length !== 2) throw new Error("two-player roster was not synchronized");

  const hostStartPromise = nextMessage(host, (m) => m.type === "start");
  const guestStartPromise = nextMessage(guest, (m) => m.type === "start");
  send(host, { type: "start" });
  await Promise.all([hostStartPromise, guestStartPromise]);

  const guestSnapshotPromise = nextMessage(guest, (m) => m.type === "snapshot" && m.players?.some((p) => p.id === hostWelcome.playerId && Math.abs(p.pose.x - 4.25) < 0.001));
  send(host, { type: "move", pose: { x: 4.25, y: 1.4, z: 8.5, yaw: 1.2 } });
  await guestSnapshotPromise;

  console.log(`MULTIPLAYER SMOKE PASS: ${hostWelcome.roomCode}, create/join/roster/start/movement verified`);
} finally {
  try { host?.close(); } catch {}
  try { guest?.close(); } catch {}
  server.kill("SIGTERM");
}
