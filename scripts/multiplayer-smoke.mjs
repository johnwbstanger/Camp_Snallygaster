import { spawn } from "node:child_process";
import WebSocket from "ws";

const port = 3201;
const MAX_PLAYERS = 15;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) {
        const body = await response.json();
        if (body.maxPlayers !== MAX_PLAYERS) throw new Error(`healthz reported maxPlayers=${body.maxPlayers}`);
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("maxPlayers")) throw error;
    }
    await wait(200);
  }
  throw new Error("server never became healthy");
}

function openClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => reject(new Error("websocket connection timed out")), 5000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

function nextMessage(socket, predicate, timeoutMs = 6000) {
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

const clients = [];
let overflowClient;

try {
  await waitForHealth();

  const host = await openClient();
  clients.push(host);
  const hostWelcomePromise = nextMessage(host, (m) => m.type === "welcome");
  send(host, { type: "create", name: "Counselor 01" });
  const hostWelcome = await hostWelcomePromise;

  if (!hostWelcome.roomCode || !hostWelcome.playerId) throw new Error("host room was not created correctly");
  if (hostWelcome.maxPlayers !== MAX_PLAYERS) throw new Error(`host saw maxPlayers=${hostWelcome.maxPlayers}`);

  let finalRosterPromise = null;
  for (let index = 2; index <= MAX_PLAYERS; index += 1) {
    const guest = await openClient();
    clients.push(guest);

    if (index === MAX_PLAYERS) {
      finalRosterPromise = nextMessage(
        host,
        (m) => m.type === "roster" && m.players?.length === MAX_PLAYERS && m.maxPlayers === MAX_PLAYERS,
      );
    }

    const welcomePromise = nextMessage(guest, (m) => m.type === "welcome");
    send(guest, {
      type: "join",
      name: `Counselor ${String(index).padStart(2, "0")}`,
      roomCode: hostWelcome.roomCode,
    });
    const welcome = await welcomePromise;

    if (welcome.roomCode !== hostWelcome.roomCode) throw new Error(`client ${index} joined wrong room`);
    if (welcome.maxPlayers !== MAX_PLAYERS) throw new Error(`client ${index} saw wrong capacity`);
  }

  const finalRoster = await finalRosterPromise;
  if (finalRoster.players.length !== MAX_PLAYERS) throw new Error("15-player roster did not synchronize");

  const uniqueIds = new Set(finalRoster.players.map((player) => player.id));
  if (uniqueIds.size !== MAX_PLAYERS) throw new Error("15-player roster contains duplicate player IDs");

  const uniqueSpawnCells = new Set(
    finalRoster.players.map((player) => `${player.pose.x.toFixed(3)}:${player.pose.z.toFixed(3)}`),
  );
  if (uniqueSpawnCells.size !== MAX_PLAYERS) throw new Error("multiplayer players were assigned overlapping spawn positions");

  overflowClient = await openClient();
  const fullErrorPromise = nextMessage(
    overflowClient,
    (m) => m.type === "error" && String(m.message).toLowerCase().includes("full"),
  );
  send(overflowClient, { type: "join", name: "Counselor 16", roomCode: hostWelcome.roomCode });
  const fullError = await fullErrorPromise;
  if (!String(fullError.message).includes("15/15")) throw new Error("16th player was rejected without capacity detail");

  const observer = clients[1];
  const hostStartPromise = nextMessage(host, (m) => m.type === "start");
  const observerStartPromise = nextMessage(observer, (m) => m.type === "start");
  const initialRoundPromise = nextMessage(
    observer,
    (m) => m.type === "round" && m.state?.phase === "ACTIVE" && Array.isArray(m.state?.doors) && m.state.doors.length === 10,
  );
  send(host, { type: "start" });
  await Promise.all([hostStartPromise, observerStartPromise, initialRoundPromise]);

  const doorApproachPromise = nextMessage(
    observer,
    (m) => m.type === "snapshot" && m.players?.some(
      (p) => p.id === hostWelcome.playerId && Math.abs(p.pose.x) < 0.001 && Math.abs(p.pose.z + 22.5) < 0.001,
    ),
  );
  send(host, { type: "move", pose: { x: 0, y: 1.4, z: -22.5, yaw: Math.PI } });
  await doorApproachPromise;

  const doorOpenPromise = nextMessage(
    observer,
    (m) => m.type === "round" && m.state?.doors?.some((door) => door.id === "door:dining" && door.open === true),
  );
  send(host, { type: "interact", targetId: "door:dining" });
  await doorOpenPromise;

  const doorClosePromise = nextMessage(
    observer,
    (m) => m.type === "round" && m.state?.doors?.some((door) => door.id === "door:dining" && door.open === false),
  );
  send(host, { type: "interact", targetId: "door:dining" });
  await doorClosePromise;

  const observerSnapshotPromise = nextMessage(
    observer,
    (m) => m.type === "snapshot" && m.players?.length === MAX_PLAYERS && m.players.some(
      (p) => p.id === hostWelcome.playerId && Math.abs(p.pose.x + 21) < 0.001,
    ),
  );
  send(host, { type: "move", pose: { x: -21, y: 1.4, z: 8, yaw: 1.2 } });
  await observerSnapshotPromise;
  await wait(120);

  const sharedRescuePromise = nextMessage(
    observer,
    (m) =>
      m.type === "round" &&
      m.state?.campersFound === 1 &&
      m.state?.monster?.awake === true &&
      m.state?.campers?.some(
        (camper) => camper.id === "camper-1" && camper.state === "FOLLOWING" && camper.followingPlayerId === hostWelcome.playerId,
      ),
  );
  send(host, { type: "interact" });
  await sharedRescuePromise;

  console.log(
    `MULTIPLAYER SMOKE PASS: ${hostWelcome.roomCode}, ${MAX_PLAYERS}/${MAX_PLAYERS} clients, unique spawns, overflow rejection, shared doors, start, movement, rescue, and threat sync verified`,
  );
} finally {
  try { overflowClient?.close(); } catch {}
  for (const client of clients) {
    try { client.close(); } catch {}
  }
  server.kill("SIGTERM");
}
