import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { CamperState, ClientMessage, PlayerPose, PlayerState, ServerMessage, SharedRoundState } from "../shared/protocol.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const MAX_PLAYERS = 15;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

type ClientMeta = { roomCode: string | null; playerId: string | null };
type Room = {
  code: string;
  hostId: string;
  players: Map<string, PlayerState>;
  sockets: Map<string, WebSocket>;
  round: SharedRoundState;
};

const rooms = new Map<string, Room>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();

const CAMPERS: ReadonlyArray<readonly [string, number, number, number]> = [
  ["Ben", -21, 0.8, 8], ["Maya", -11, 0.8, -10], ["Jamie", 13, 0.8, 9],
  ["Katie", 20, 0.8, -17], ["Nate", -19, 0.8, -18], ["Jess", -4, 0.8, 21], ["Luke", 25, 0.8, 16],
];

app.disable("x-powered-by");
app.get("/healthz", (_req, res) => res.json({ ok: true, service: "camp-snallygaster-rebuild", maxPlayers: MAX_PLAYERS }));
app.get("/api/status", (_req, res) => res.json({ ok: true, rooms: rooms.size, clients: wss.clients.size, maxPlayers: MAX_PLAYERS }));

if (NODE_ENV === "production") {
  const dist = path.join(__dirname, "..", "dist", "client");
  const assets = path.join(dist, "assets");
  app.use("/assets", express.static(assets, { maxAge: "1y", immutable: true }));
  app.use(express.static(dist, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (path.basename(filePath) === "index.html") res.setHeader("Cache-Control", "no-store, max-age=0");
    },
  }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path.join(dist, "index.html"));
  });
}

wss.on("connection", (socket) => {
  clientMeta.set(socket, { roomCode: null, playerId: null });

  socket.on("message", (raw) => {
    let message: ClientMessage;
    try { message = JSON.parse(raw.toString()) as ClientMessage; }
    catch { return send(socket, { type: "error", message: "Invalid message" }); }

    if (message.type === "create") {
      leaveCurrentRoom(socket);
      const room = createRoom();
      const player = addPlayer(room, socket, message.name);
      room.hostId = player.id;
      welcome(room, player.id, socket);
      broadcastRoster(room);
      return;
    }

    if (message.type === "join") {
      leaveCurrentRoom(socket);
      const room = rooms.get(normalizeRoomCode(message.roomCode));
      if (!room) return send(socket, { type: "error", message: "Camp code not found" });
      if (room.round.phase !== "LOBBY") return send(socket, { type: "error", message: "That camp has already started" });
      if (room.players.size >= MAX_PLAYERS) return send(socket, { type: "error", message: `That camp is full (${MAX_PLAYERS}/${MAX_PLAYERS})` });
      const player = addPlayer(room, socket, message.name);
      welcome(room, player.id, socket);
      broadcastRoster(room);
      return;
    }

    const meta = clientMeta.get(socket);
    if (!meta?.roomCode || !meta.playerId) return;
    const room = rooms.get(meta.roomCode);
    if (!room) return;

    if (message.type === "start") {
      if (room.hostId !== meta.playerId) return send(socket, { type: "error", message: "Only the host can start" });
      if (room.round.phase !== "LOBBY") return;
      room.round = createRoundState("ACTIVE");
      broadcast(room, { type: "start" });
      broadcastRound(room);
      return;
    }

    if (message.type === "move") {
      const player = room.players.get(meta.playerId);
      if (!player) return;
      player.pose = sanitizePose(message.pose);
      broadcast(room, { type: "snapshot", players: [...room.players.values()] }, socket);
      return;
    }

    if (message.type === "interact") {
      if (room.round.phase !== "ACTIVE") return;
      handleInteract(room, meta.playerId);
      broadcastRound(room);
      return;
    }

    if (message.type === "ping") send(socket, { type: "pong", at: message.at });
  });

  socket.on("close", () => leaveCurrentRoom(socket));
  socket.on("error", () => leaveCurrentRoom(socket));
});

const tick = setInterval(() => {
  for (const room of rooms.values()) if (room.round.phase === "ACTIVE") updateRound(room, 0.1);
}, 100);
tick.unref();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Camp Snallygaster listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint ws://0.0.0.0:${PORT}/ws; max players ${MAX_PLAYERS}`);
});

function createRoom(): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  const room: Room = { code, hostId: "", players: new Map(), sockets: new Map(), round: createRoundState("LOBBY") };
  rooms.set(code, room);
  return room;
}

function createRoundState(phase: SharedRoundState["phase"]): SharedRoundState {
  return {
    phase,
    campers: CAMPERS.map(([name, x, y, z], index): CamperState => ({
      id: `camper-${index + 1}`,
      name,
      state: "HIDDEN",
      followingPlayerId: null,
      position: { x, y, z },
    })),
    monster: { x: -32, y: 0, z: -29, awake: false },
    campersSafe: 0,
    campersFound: 0,
  };
}

function addPlayer(room: Room, socket: WebSocket, rawName: string) {
  const id = crypto.randomUUID();
  const name = String(rawName || "Counselor").trim().slice(0, 18) || "Counselor";
  const slot = room.players.size;
  const angle = (slot / MAX_PLAYERS) * Math.PI * 2;
  const radius = 3.2;
  const player: PlayerState = {
    id,
    name,
    pose: {
      x: Math.sin(angle) * radius,
      y: 1.4,
      z: 27 + Math.cos(angle) * radius,
      yaw: angle + Math.PI,
    },
  };
  room.players.set(id, player);
  room.sockets.set(id, socket);
  clientMeta.set(socket, { roomCode: room.code, playerId: id });
  return player;
}

function handleInteract(room: Room, playerId: string) {
  const player = room.players.get(playerId);
  if (!player) return;
  let nearest: CamperState | null = null;
  let nearestDistance = Infinity;
  for (const camper of room.round.campers) {
    if (camper.state !== "HIDDEN") continue;
    const distance = distance2D(player.pose, camper.position);
    if (distance < nearestDistance) { nearest = camper; nearestDistance = distance; }
  }
  if (nearest && nearestDistance <= 2.8) {
    nearest.state = "FOLLOWING";
    nearest.followingPlayerId = playerId;
    room.round.monster.awake = true;
    room.round.campersFound = room.round.campers.filter((camper) => camper.state !== "HIDDEN").length;
  }
}

function updateRound(room: Room, dt: number) {
  for (const camper of room.round.campers) {
    if (camper.state !== "FOLLOWING" || !camper.followingPlayerId) continue;
    const player = room.players.get(camper.followingPlayerId);
    if (!player) { camper.state = "HIDDEN"; camper.followingPlayerId = null; continue; }

    const followers = room.round.campers.filter((candidate) => candidate.state === "FOLLOWING" && candidate.followingPlayerId === player.id);
    const index = followers.findIndex((candidate) => candidate.id === camper.id);
    const angle = Math.PI + (index - (followers.length - 1) / 2) * 0.42;
    moveToward(
      camper.position,
      player.pose.x + Math.sin(angle) * (2 + Math.floor(index / 3) * 0.7),
      player.pose.z + Math.cos(angle) * (2 + Math.floor(index / 3) * 0.7),
      3.4 * dt,
    );

    if (distance2D(player.pose, { x: 0, z: 31 }) < 5.2) {
      camper.state = "SAFE";
      camper.followingPlayerId = null;
      const safeIndex = room.round.campers.filter((candidate) => candidate.state === "SAFE").length;
      camper.position = { x: -3 + safeIndex * 0.75, y: 0.8, z: 34 };
    }
  }

  room.round.campersFound = room.round.campers.filter((camper) => camper.state !== "HIDDEN").length;
  room.round.campersSafe = room.round.campers.filter((camper) => camper.state === "SAFE").length;
  room.round.monster.awake ||= room.round.campersFound > 0;

  if (room.round.campersSafe === room.round.campers.length) {
    room.round.phase = "WON";
    broadcastRound(room);
    return;
  }

  if (room.round.monster.awake && room.players.size > 0) {
    let target: PlayerState | null = null;
    let bestDistance = Infinity;
    for (const player of room.players.values()) {
      const distance = distance2D(player.pose, room.round.monster);
      if (distance < bestDistance) { bestDistance = distance; target = player; }
    }
    if (target) {
      moveToward(room.round.monster, target.pose.x, target.pose.z, (1.55 + room.round.campersFound * 0.12) * dt);
      if (bestDistance < 1.15) room.round.phase = "LOST";
    }
  }
  broadcastRound(room);
}

function leaveCurrentRoom(socket: WebSocket) {
  const meta = clientMeta.get(socket);
  if (!meta?.roomCode || !meta.playerId) return;
  const room = rooms.get(meta.roomCode);
  if (!room) return;

  room.players.delete(meta.playerId);
  room.sockets.delete(meta.playerId);
  for (const camper of room.round.campers) {
    if (camper.followingPlayerId === meta.playerId) {
      camper.followingPlayerId = null;
      camper.state = "HIDDEN";
    }
  }

  if (room.players.size === 0) rooms.delete(room.code);
  else {
    if (room.hostId === meta.playerId) room.hostId = room.players.keys().next().value ?? "";
    broadcastRoster(room);
  }
  clientMeta.set(socket, { roomCode: null, playerId: null });
}

function welcome(room: Room, playerId: string, socket: WebSocket) {
  send(socket, {
    type: "welcome",
    playerId,
    roomCode: room.code,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()],
  });
}

function broadcastRoster(room: Room) {
  broadcast(room, {
    type: "roster",
    roomCode: room.code,
    hostId: room.hostId,
    maxPlayers: MAX_PLAYERS,
    players: [...room.players.values()],
  });
}

function broadcastRound(room: Room) {
  broadcast(room, { type: "round", state: room.round });
}

function broadcast(room: Room, message: ServerMessage, except?: WebSocket) {
  for (const socket of room.sockets.values()) {
    if (socket !== except && socket.readyState === WebSocket.OPEN) send(socket, message);
  }
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sanitizePose(pose: PlayerPose): PlayerPose {
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

function generateRoomCode() {
  const words = ["PINE", "LAKE", "TRAIL", "OWL", "MOSS", "FIRE", "CAMP", "BEAR"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(10 + Math.random() * 90)}`;
}

function normalizeRoomCode(code: string) {
  return String(code || "").trim().toUpperCase();
}
