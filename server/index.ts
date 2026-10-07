import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";
import { generateRoomCode } from "../shared/utils.js";

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

// REST API for room management
app.use(express.json());

app.post("/api/rooms/create", async (req, res) => {
  try {
    const roomCode = generateRoomCode();
    const room = await gameServer.create("game", {
      autoDispose: true,
    });
    await room.setMetadata({ roomCode });
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
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🏕️  Camp Snallygaster server listening`);
  console.log(`   HTTP: http://0.0.0.0:${PORT}`);
  console.log(`   WebSocket: ws://0.0.0.0:${PORT}/ws`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Force handgun spawn: ${process.env.FORCE_HANDGUN_SPAWN === "true"}\n`);
});
