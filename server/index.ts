import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT ?? 3001);
const NODE_ENV = process.env.NODE_ENV ?? "development";

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("game", GameRoom);

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "camp-snallygaster", environment: NODE_ENV });
});

app.get("/api/status", (_req, res) => {
  res.json({ ok: true, multiplayer: true });
});

const distPath = path.join(__dirname, "..", "dist", "client");
app.use(
  express.static(distPath, {
    index: "index.html",
    maxAge: NODE_ENV === "production" ? "1h" : 0,
  }),
);

app.use((req, res, next) => {
  if (req.method === "GET" && req.accepts("html")) {
    res.sendFile(path.join(distPath, "index.html"), (error) => {
      if (error) next(error);
    });
    return;
  }
  next();
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Camp Snallygaster listening on http://0.0.0.0:${PORT}`);
  console.log(`Multiplayer WebSocket endpoint: ws://0.0.0.0:${PORT}`);
});
