import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, LobbyRoom, RelayRoom } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws";
import { GameRoom } from "./rooms/GameRoom";
import { generateRoomCode } from "../shared/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pathname: "/ws",
  }),
});

// Register game room
gameServer.define("game", GameRoom);

// Lobby room for matchmaking
gameServer.define("lobby", LobbyRoom);

// REST API for room management
app.use(express.json());

app.post("/api/rooms/create", async (req, res) => {
  try {
    const roomCode = generateRoomCode();
    const room = await gameServer.create("game", {
      roomCode,
      autoDispose: true,
    });
    res.json({
      roomId: room.roomId,
      roomCode,
      joinToken: room.roomId,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await gameServer.matchmake.query({ name: "game" });
    const available = rooms.filter((room: any) => room.clients < 6 && !room.locked);
    res.json(available);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Serve client
const distPath = path.join(__dirname, "..", "dist", "client");
app.use(express.static(distPath));
app.use((_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Camp Snallygaster server listening on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Force handgun spawn: ${process.env.FORCE_HANDGUN_SPAWN === "true"}`);
});
