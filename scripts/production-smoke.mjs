import { spawn } from "node:child_process";
import WebSocket from "ws";

const port = 3301;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let healthy = false;
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) { healthy = true; break; }
    } catch {}
    await wait(250);
  }
  if (!healthy) throw new Error("production server never became healthy");

  const page = await fetch(`${base}/`);
  if (!page.ok) throw new Error(`production index returned ${page.status}`);
  const html = await page.text();
  if (/\/src\/(main\.ts|style\.css)/.test(html)) throw new Error("production HTML still references raw source files");

  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map((match) => match[1]);
  if (assetPaths.length === 0) throw new Error("production HTML contains no compiled Vite assets");
  for (const assetPath of assetPaths) {
    const url = new URL(assetPath, `${base}/`).toString();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`compiled asset failed to load: ${assetPath} (${response.status})`);
  }

  const welcome = await createRoom(`ws://127.0.0.1:${port}/ws`);
  if (!/^[A-Z0-9-]{4,12}$/.test(String(welcome.roomCode || ""))) {
    throw new Error(`production create did not return a usable room code: ${JSON.stringify(welcome)}`);
  }
  if (!welcome.playerId || !welcome.hostId || welcome.playerId !== welcome.hostId) {
    throw new Error(`production create did not make creator the host: ${JSON.stringify(welcome)}`);
  }
  if (welcome.maxPlayers !== 15) throw new Error(`expected 15-player capacity, got ${welcome.maxPlayers}`);

  console.log(`PRODUCTION SMOKE PASS: index + ${assetPaths.length} compiled assets + create-room welcome ${welcome.roomCode}`);
} finally {
  server.kill("SIGTERM");
}

function createRoom(endpoint) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("production create-room handshake timed out"));
    }, 5000);

    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "create", name: "Production Smoke" }));
    });
    socket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (message.type === "error") {
        clearTimeout(timer);
        socket.close();
        reject(new Error(`production create-room error: ${message.message}`));
      }
      if (message.type === "welcome") {
        clearTimeout(timer);
        socket.close();
        resolve(message);
      }
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
