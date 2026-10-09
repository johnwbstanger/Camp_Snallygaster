import Peer, { type DataConnection } from "peerjs";
import type { ClientMessage, ServerMessage } from "../../shared/protocol";
import { GameHost, generateRoomCode, normalizeRoomCode } from "../../shared/GameHost";
import { peerOptions } from "./peerConfig";

export interface ClientTransport {
  send(message: ClientMessage): void;
  close(): void;
  readonly open: boolean;
}

export type TransportHandlers = {
  onMessage(message: ServerMessage): void;
  onClose(reason: string): void;
};

const randomId = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
const CONNECT_TIMEOUT_MS = 25000;

export const hostPeerId = (code: string) => `snally-${code}`;

/** Dedicated WebSocket transport to the optional Node server. */
export class WebSocketTransport implements ClientTransport {
  private constructor(private socket: WebSocket) {}

  static connect(url: string, handlers: TransportHandlers): Promise<WebSocketTransport> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const transport = new WebSocketTransport(socket);
      let settled = false;
      const timeout = window.setTimeout(() => fail(`Server at ${url} did not answer in 45s. It may be asleep or offline.`), 45000);
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        try { socket.close(); } catch {}
        reject(new Error(message));
      };
      socket.addEventListener("open", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(transport);
      }, { once: true });
      socket.addEventListener("error", () => fail(`Could not reach the multiplayer server at ${url}`), { once: true });
      socket.addEventListener("message", (event) => {
        try { handlers.onMessage(JSON.parse(String(event.data)) as ServerMessage); } catch {}
      });
      socket.addEventListener("close", () => handlers.onClose("Multiplayer server disconnected"));
    });
  }

  get open() { return this.socket.readyState === WebSocket.OPEN; }
  send(message: ClientMessage) { if (this.open) this.socket.send(JSON.stringify(message)); }
  close() { try { this.socket.close(); } catch {} }
}

/** Joiner side of a peer-to-peer room: one WebRTC data channel to the hosting browser. */
export class PeerClientTransport implements ClientTransport {
  private constructor(private peer: Peer, private conn: DataConnection) {}

  static connect(code: string, handlers: TransportHandlers): Promise<PeerClientTransport> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(`snallyg-${randomId()}`, peerOptions());
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        try { peer.destroy(); } catch {}
        reject(new Error(message));
      };
      const timeout = window.setTimeout(() => fail("Could not connect to that camp. Check the code and that the host is still online."), CONNECT_TIMEOUT_MS);

      peer.on("error", (error) => {
        const type = (error as { type?: string }).type;
        if (type === "peer-unavailable") fail("Camp code not found");
        else if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") fail("Could not reach the matchmaking broker. Check your connection.");
        else fail(`Connection error: ${type ?? error.message}`);
      });
      peer.on("open", () => {
        const conn = peer.connect(hostPeerId(code), { reliable: true, serialization: "json" });
        conn.on("open", () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          resolve(new PeerClientTransport(peer, conn));
        });
        conn.on("data", (data) => handlers.onMessage(data as ServerMessage));
        conn.on("close", () => handlers.onClose("The host left the camp"));
        conn.on("error", () => fail("Connection to the host failed"));
      });
    });
  }

  get open() { return this.conn.open; }
  send(message: ClientMessage) { if (this.conn.open) this.conn.send(message); }
  close() { try { this.conn.close(); } catch {} try { this.peer.destroy(); } catch {} }
}

/**
 * Hosting side of a peer-to-peer room. The host's browser runs the authoritative GameHost;
 * the host's own player talks to it through an in-memory loopback.
 */
export class PeerHostTransport implements ClientTransport {
  readonly code: string;
  private host: GameHost;
  private conns = new Map<string, DataConnection>();
  private timer: number;
  private localId: string;
  private closed = false;

  private constructor(private peer: Peer, code: string, private handlers: TransportHandlers) {
    this.code = code;
    this.localId = `snallyg-host-${code}`;
    this.host = new GameHost(code, (clientId, message) => {
      if (clientId === this.localId) queueMicrotask(() => this.handlers.onMessage(message));
      else this.conns.get(clientId)?.send(message);
    });
    this.timer = window.setInterval(() => this.host.tick(0.1), 100);

    peer.on("connection", (conn) => this.accept(conn));
  }

  static async create(handlers: TransportHandlers): Promise<PeerHostTransport> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateRoomCode();
      try {
        const peer = await openPeer(hostPeerId(code));
        return new PeerHostTransport(peer, code, handlers);
      } catch (error) {
        if ((error as { type?: string }).type === "unavailable-id") continue;
        throw new Error(describePeerError(error));
      }
    }
    throw new Error("Could not allocate a free camp code. Try again.");
  }

  get open() { return !this.closed; }

  send(message: ClientMessage) {
    if (message.type === "create") {
      this.host.join(this.localId, message.name, true);
      return;
    }
    this.host.handle(this.localId, message);
  }

  close() {
    this.closed = true;
    window.clearInterval(this.timer);
    for (const conn of this.conns.values()) { try { conn.close(); } catch {} }
    try { this.peer.destroy(); } catch {}
  }

  private accept(conn: DataConnection) {
    const id = conn.peer;
    conn.on("data", (data) => {
      const message = data as ClientMessage;
      if (message?.type === "join") {
        if (normalizeRoomCode(message.roomCode) !== this.code) return conn.send({ type: "error", message: "Camp code not found" } satisfies ServerMessage);
        this.conns.set(id, conn);
        const error = this.host.join(id, message.name, false);
        if (error) {
          conn.send({ type: "error", message: error } satisfies ServerMessage);
          this.conns.delete(id);
          window.setTimeout(() => conn.close(), 250);
        }
        return;
      }
      if (message?.type === "create") return;
      this.host.handle(id, message);
    });
    const drop = () => {
      if (this.conns.get(id) !== conn) return;
      this.conns.delete(id);
      this.host.leave(id);
    };
    conn.on("close", drop);
    conn.on("error", drop);
  }
}

function openPeer(id: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(id, peerOptions());
    const timeout = window.setTimeout(() => {
      try { peer.destroy(); } catch {}
      reject(Object.assign(new Error("Matchmaking broker did not answer"), { type: "network" }));
    }, CONNECT_TIMEOUT_MS);
    peer.once("open", () => { window.clearTimeout(timeout); resolve(peer); });
    peer.once("error", (error) => {
      window.clearTimeout(timeout);
      try { peer.destroy(); } catch {}
      reject(error);
    });
  });
}

function describePeerError(error: unknown) {
  const type = (error as { type?: string })?.type;
  if (type === "network" || type === "server-error" || type === "socket-error" || type === "socket-closed") {
    return "Could not reach the matchmaking broker (0.peerjs.com). Check your connection.";
  }
  return `Could not create camp: ${type ?? (error as Error)?.message ?? "unknown error"}`;
}
