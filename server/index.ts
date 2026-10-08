import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, PlayerPose, PlayerState, ServerMessage } from "../shared/protocol.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

type ClientMeta = { roomCode: string | null; playerId: string | null };
type Room = { code: string; hostId: string; players: Map<string, PlayerState>; sockets: Map<string, WebSocket>; started: boolean };

const rooms = new Map<string, Room>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();

app.disable("x-powered-by");
app.get("/healthz", (_req, res) => res.json({ ok: true, service: "camp-snallygaster-rebuild" }));
app.get("/api/status", (_req, res) => res.json({ ok: true, rooms: rooms.size, clients: wss.clients.size }));

if (NODE_ENV === "production") {
  const dist = path.join(__dirname, "..", "dist", "client");
  app.use(express.static(dist, { index: "index.html", maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

wss.on("connection", (socket) => {
  clientMeta.set(socket, { roomCode: null, playerId: null });

  socket.on("message", (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      return send(socket, { type: "error", message: "Invalid message" });
    }

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
      const code = normalizeRoomCode(message.roomCode);
      const room = rooms.get(code);
      if (!room) return send(socket, { type: "error", message: "Camp code not found" });
      if (room.started) return send(socket, { type: "error", message: "That camp has already started" });
      if (room.players.size >= 8) return send(socket, { type: "error", message: "That camp is full" });
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
      room.started = true;
      broadcast(room, { type: "start" });
      return;
    }

    if (message.type === "move") {
      const player = room.players.get(meta.playerId);
      if (!player) return;
      player.pose = sanitizePose(message.pose);
      broadcast(room, { type: "snapshot", players: [...room.players.values()] }, socket);
      return;
    }

    if (message.type === "ping") send(socket, { type: "pong", at: message.at });
  });

  socket.on("close", () => leaveCurrentRoom(socket));
  socket.on("error", () => leaveCurrentRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Camp Snallygaster rebuild listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint ws://0.0.0.0:${PORT}/ws`);
});

function createRoom(): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  const room: Room = { code, hostId: "", players: new Map(), sockets: new Map(), started: false };
  rooms.set(code, room);
  return room;
}

function addPlayer(room: Room, socket: WebSocket, rawName: string) {
  const id = crypto.randomUUID();
  const name = String(rawName || "Counselor").trim().slice(0, 18) || "Counselor";
  const offset = room.players.size * 1.4;
  const player: PlayerState = { id, name, pose: { x: offset, y: 1.4, z: 27, yaw: Math.PI } };
  room.players.set(id, player);
  room.sockets.set(id, socket);
  clientMeta.set(socket, { roomCode: room.code, playerId: id });
  return player;
}

function leaveCurrentRoom(socket: WebSocket) {
  const meta = clientMeta.get(socket);
  if (!meta?.roomCode || !meta.playerId) return;
  const room = rooms.get(meta.roomCode);
  if (!room) return;
  room.players.delete(meta.playerId);
  room.sockets.delete(meta.playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
  } else {
    if (room.hostId === meta.playerId) room.hostId = room.players.keys().next().value ?? "";
    broadcastRoster(room);
  }
  clientMeta.set(socket, { roomCode: null, playerId: null });
}

function welcome(room: Room, playerId: string, socket: WebSocket) {
  send(socket, { type: "welcome", playerId, roomCode: room.code, hostId: room.hostId, players: [...room.players.values()] });
}

function broadcastRoster(room: Room) {
  broadcast(room, { type: "roster", roomCode: room.code, hostId: room.hostId, players: [...room.players.values()] });
}

function broadcast(room: Room, message: ServerMessage, except?: WebSocket) {
  for (const socket of room.sockets.values()) {
    if (socket === except || socket.readyState !== WebSocket.OPEN) continue;
    send(socket, message);
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

function generateRoomCode() {
  const words = ["PINE", "LAKE", "TRAIL", "OWL", "MOSS", "FIRE", "CAMP", "BEAR"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(10 + Math.random() * 90)}`;
}

function normalizeRoomCode(code: string) {
  return String(code || "").trim().toUpperCase();
}
