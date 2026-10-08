import type { ClientMessage, PlayerPose, PlayerState, ServerMessage, SharedRoundState } from "../../shared/protocol";

export type RoomInfo = {
  roomCode: string;
  playerId: string;
  hostId: string;
  maxPlayers: number;
  players: PlayerState[];
};

const CURRENT_RENDER_SERVER = "https://camp-snallygaster-rebuild.onrender.com";
const ARCHIVED_WORKING_RENDER_SERVER = "https://camp-snallygaster.onrender.com";
const CONNECT_TIMEOUT_MS = 20000;

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private pendingWelcome: { resolve: (room: RoomInfo) => void; reject: (error: Error) => void; timer: number } | null = null;
  private roomInfo: RoomInfo | null = null;
  private onRosterCallback: ((room: RoomInfo) => void) | null = null;
  private onSnapshotCallback: ((players: PlayerState[]) => void) | null = null;
  private onRoundCallback: ((state: SharedRoundState) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onErrorCallback: ((message: string) => void) | null = null;

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  get currentRoom() {
    return this.roomInfo;
  }

  async connect() {
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.closeSocketOnly();
    this.connectPromise = this.connectToFirstAvailable().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  async createCamp(name: string) {
    await this.connect();
    return this.awaitWelcome({ type: "create", name: cleanName(name) });
  }

  async joinCamp(roomCode: string, name: string) {
    await this.connect();
    return this.awaitWelcome({ type: "join", roomCode: roomCode.trim().toUpperCase(), name: cleanName(name) });
  }

  startCamp() { this.send({ type: "start" }); }
  interact(targetId?: string) { this.send(targetId ? { type: "interact", targetId } : { type: "interact" }); }
  sendPose(pose: PlayerPose) { this.send({ type: "move", pose }); }

  onRoster(callback: (room: RoomInfo) => void) { this.onRosterCallback = callback; }
  onSnapshot(callback: (players: PlayerState[]) => void) { this.onSnapshotCallback = callback; }
  onRound(callback: (state: SharedRoundState) => void) { this.onRoundCallback = callback; }
  onStart(callback: () => void) { this.onStartCallback = callback; }
  onError(callback: (message: string) => void) { this.onErrorCallback = callback; }

  close() {
    if (this.pendingWelcome) window.clearTimeout(this.pendingWelcome.timer);
    this.pendingWelcome = null;
    this.roomInfo = null;
    this.closeSocketOnly();
  }

  private async connectToFirstAvailable() {
    const endpoints = this.endpointCandidates();
    const failures: string[] = [];
    for (const endpoint of endpoints) {
      try {
        const socket = await this.openSocket(endpoint);
        this.socket = socket;
        this.bindSocket(socket);
        return;
      } catch (error) {
        failures.push(`${endpoint}: ${error instanceof Error ? error.message : "connection failed"}`);
      }
    }
    throw new Error(`Could not reach a multiplayer server. ${failures.join(" | ")}`);
  }

  private openSocket(endpoint: string) {
    return new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        socket.removeEventListener("open", onOpen);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
        if (error) {
          try { socket.close(); } catch {}
          reject(error);
        } else {
          resolve(socket);
        }
      };
      const onOpen = () => finish();
      const onError = () => finish(new Error("socket error"));
      const onClose = () => finish(new Error("socket closed before opening"));
      const timer = window.setTimeout(() => finish(new Error("connection timed out")), CONNECT_TIMEOUT_MS);
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
      socket.addEventListener("close", onClose, { once: true });
    });
  }

  private awaitWelcome(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Multiplayer connection is not open"));
    }
    if (this.pendingWelcome) return Promise.reject(new Error("A room request is already pending"));

    return new Promise<RoomInfo>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingWelcome = null;
        reject(new Error("Camp request timed out before the server returned a room code"));
      }, 20000);
      this.pendingWelcome = { resolve, reject, timer };
      this.send(message);
    });
  }

  private bindSocket(socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }

      if (message.type === "welcome") {
        const room: RoomInfo = {
          roomCode: message.roomCode,
          playerId: message.playerId,
          hostId: message.hostId,
          maxPlayers: message.maxPlayers,
          players: message.players,
        };
        this.roomInfo = room;
        if (this.pendingWelcome) {
          window.clearTimeout(this.pendingWelcome.timer);
          this.pendingWelcome.resolve(room);
          this.pendingWelcome = null;
        }
        this.onRosterCallback?.(room);
        return;
      }

      if (message.type === "roster") {
        if (!this.roomInfo) return;
        this.roomInfo = {
          ...this.roomInfo,
          roomCode: message.roomCode,
          hostId: message.hostId,
          maxPlayers: message.maxPlayers,
          players: message.players,
        };
        this.onRosterCallback?.(this.roomInfo);
        return;
      }

      if (message.type === "snapshot") {
        this.onSnapshotCallback?.(message.players);
        return;
      }

      if (message.type === "round") {
        this.onRoundCallback?.(message.state);
        return;
      }

      if (message.type === "start") {
        this.onStartCallback?.();
        return;
      }

      if (message.type === "error") {
        this.onErrorCallback?.(message.message);
        if (this.pendingWelcome) {
          window.clearTimeout(this.pendingWelcome.timer);
          this.pendingWelcome.reject(new Error(message.message));
          this.pendingWelcome = null;
        }
      }
    });

    socket.addEventListener("close", () => {
      if (this.pendingWelcome) {
        window.clearTimeout(this.pendingWelcome.timer);
        this.pendingWelcome.reject(new Error("Multiplayer server disconnected"));
        this.pendingWelcome = null;
      }
      if (this.socket === socket) this.socket = null;
      this.onErrorCallback?.("Multiplayer server disconnected");
    });
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private endpointCandidates() {
    const configured = String(import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");
    if (configured) return [toWebSocket(configured)];

    if (import.meta.env.DEV) {
      return [`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001/ws`];
    }

    if (location.hostname.endsWith("github.io")) {
      return [
        toWebSocket(CURRENT_RENDER_SERVER),
        toWebSocket(ARCHIVED_WORKING_RENDER_SERVER),
      ];
    }

    return [
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
      toWebSocket(CURRENT_RENDER_SERVER),
      toWebSocket(ARCHIVED_WORKING_RENDER_SERVER),
    ];
  }

  private closeSocketOnly() {
    if (this.socket) {
      try { this.socket.close(); } catch {}
    }
    this.socket = null;
  }
}

function toWebSocket(base: string) {
  const wsBase = base.replace(/\/$/, "").replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${wsBase}/ws`;
}

function cleanName(name: string) {
  return String(name || "Counselor").trim().slice(0, 18) || "Counselor";
}
