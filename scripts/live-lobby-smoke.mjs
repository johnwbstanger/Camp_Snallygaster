import WebSocket from "ws";

const bases = String(process.env.LIVE_SERVER_URLS || "https://camp-snallygaster-rebuild.onrender.com,https://camp-snallygaster.onrender.com,https://camp-snallygaster-extraction--willstanger.replit.app")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const candidates = [];
for (const base of bases) {
  const wsBase = base.replace(/\/$/, "").replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  candidates.push(`${wsBase}/ws`, `${wsBase}/`);
}

const failures = [];
let success = null;
for (const endpoint of candidates) {
  try {
    const welcome = await createRoom(endpoint, 45000);
    if (!welcome.roomCode || !welcome.playerId || welcome.playerId !== welcome.hostId || welcome.maxPlayers !== 15) {
      throw new Error(`invalid welcome ${JSON.stringify(welcome)}`);
    }
    success = { endpoint, roomCode: welcome.roomCode };
    break;
  } catch (error) {
    failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (!success) throw new Error(`LIVE LOBBY SMOKE FAILED: ${failures.join(" | ")}`);
console.log(`LIVE LOBBY SMOKE PASS: ${success.endpoint} created room ${success.roomCode}`);

function createRoom(endpoint, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("timed out waiting for create-room welcome")), timeoutMs);
    socket.once("open", () => socket.send(JSON.stringify({ type: "create", name: "Live Lobby Smoke" })));
    socket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { return; }
      if (message.type === "error") finish(new Error(message.message || "server returned error"));
      if (message.type === "welcome") finish(null, message);
    });
    socket.once("error", (error) => finish(error));
    socket.once("close", () => {
      if (!settled) finish(new Error("socket closed before welcome"));
    });
  });
}
