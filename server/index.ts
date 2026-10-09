import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { GameHost, MAX_PLAYERS, generateRoomCode, normalizeRoomCode } from "../shared/GameHost.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

type ClientMeta = { roomCode: string | null; playerId: string | null };
type Room = { host: GameHost; sockets: Map<string, WebSocket> };

const rooms = new Map<string, Room>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();

app.disable("x-powered-by");
app.use((_req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); next(); });
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
      const id = crypto.randomUUID();
      attach(socket, room, id);
      room.host.join(id, message.name, true);
      return;
    }

    if (message.type === "join") {
      leaveCurrentRoom(socket);
      const room = rooms.get(normalizeRoomCode(message.roomCode));
      if (!room) return send(socket, { type: "error", message: "Camp code not found" });
      const id = crypto.randomUUID();
      attach(socket, room, id);
      const error = room.host.join(id, message.name, false);
      if (error) {
        detach(socket);
        send(socket, { type: "error", message: error });
      }
      return;
    }

    const meta = clientMeta.get(socket);
    if (!meta?.roomCode || !meta.playerId) return;
    rooms.get(meta.roomCode)?.host.handle(meta.playerId, message);
  });

  socket.on("close", () => leaveCurrentRoom(socket));
  socket.on("error", () => leaveCurrentRoom(socket));
});

const tick = setInterval(() => { for (const room of rooms.values()) room.host.tick(0.1); }, 100);
tick.unref();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Camp Snallygaster listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint ws://0.0.0.0:${PORT}/ws; max players ${MAX_PLAYERS}`);
});

function createRoom(): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  const sockets = new Map<string, WebSocket>();
  const host = new GameHost(code, (clientId, message) => {
    const socket = sockets.get(clientId);
    if (socket) send(socket, message);
  });
  const room: Room = { host, sockets };
  rooms.set(code, room);
  return room;
}

function attach(socket: WebSocket, room: Room, playerId: string) {
  room.sockets.set(playerId, socket);
  clientMeta.set(socket, { roomCode: room.host.code, playerId });
}

function detach(socket: WebSocket) {
  const meta = clientMeta.get(socket);
  if (meta?.roomCode && meta.playerId) rooms.get(meta.roomCode)?.sockets.delete(meta.playerId);
  clientMeta.set(socket, { roomCode: null, playerId: null });
}

function leaveCurrentRoom(socket: WebSocket) {
  const meta = clientMeta.get(socket);
  if (!meta?.roomCode || !meta.playerId) return;
  const room = rooms.get(meta.roomCode);
  if (room) {
    room.host.leave(meta.playerId);
    room.sockets.delete(meta.playerId);
    if (room.host.size === 0) rooms.delete(meta.roomCode);
  }
  clientMeta.set(socket, { roomCode: null, playerId: null });
}

function send(socket: WebSocket, message: ServerMessage) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}
