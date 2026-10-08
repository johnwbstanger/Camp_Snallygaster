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

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const timer = setTimeout(() => reject(new Error("production WebSocket timed out")), 4000);
    socket.once("open", () => {
      clearTimeout(timer);
      socket.close();
      resolve();
    });
    socket.once("error", reject);
  });

  console.log(`PRODUCTION SMOKE PASS: index + ${assetPaths.length} compiled assets + /ws loaded successfully`);
} finally {
  server.kill("SIGTERM");
}
