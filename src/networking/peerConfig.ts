import type { PeerOptions } from "peerjs";

/**
 * Public PeerJS broker is only used for WebRTC signalling (offer/answer exchange).
 * Gameplay and voice then flow directly between browsers. Override for self-hosting:
 *   localStorage["snally.peer"] = "host:port:path:secure"   (or ?peer=... in the URL)
 */
export function peerOptions(): PeerOptions {
  const params = new URLSearchParams(location.search);
  const override = params.get("peer") || safeStorage("snally.peer");
  const config: PeerOptions = { debug: 0 };
  if (override) {
    const [host, port, path, secure] = override.split(":");
    config.host = host;
    config.port = Number(port) || 9000;
    config.path = path || "/";
    config.secure = secure === "true";
  }
  return config;
}

export function safeStorage(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function configuredServerUrl(): string {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("server");
  const stored = safeStorage("snally.server");
  const built = String(import.meta.env.VITE_SERVER_URL || "");
  return (fromQuery || stored || built).replace(/\/$/, "");
}
