import type { ClientMessage, PlayerPose, PlayerState, ServerMessage, SharedRoundState } from "../../shared/protocol";

export type RoomInfo = {
  roomCode: string;
  playerId: string;
  hostId: string;
  players: PlayerState[];
};

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

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const endpoint = this.endpoint();
      const socket = new WebSocket(endpoint);
      this.socket = socket;
      const timeout = window.setTimeout(() => {
        try { socket.close(); } catch {}
        reject(new Error("Multiplayer server connection timed out"));
      }, 6000);

      socket.addEventListener("open", () => {
        window.clearTimeout(timeout);
        this.bindSocket(socket);
        resolve();
      }, { once: true });

      socket.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not reach multiplayer server"));
      }, { once: true });
    }).finally(() => {
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
  interact() { this.send({ type: "interact" }); }
  sendPose(pose: PlayerPose) { this.send({ type: "move", pose }); }

  onRoster(callback: (room: RoomInfo) => void) { this.onRosterCallback = callback; }
  onSnapshot(callback: (players: PlayerState[]) => void) { this.onSnapshotCallback = callback; }
  onRound(callback: (state: SharedRoundState) => void) { this.onRoundCallback = callback; }
  onStart(callback: () => void) { this.onStartCallback = callback; }
  onError(callback: (message: string) => void) { this.onErrorCallback = callback; }

  close() {
    this.pendingWelcome && window.clearTimeout(this.pendingWelcome.timer);
    this.pendingWelcome = null;
    this.roomInfo = null;
    this.socket?.close();
    this.socket = null;
  }

  private awaitWelcome(message: ClientMessage) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Multiplayer connection is not open"));
    }
    if (this.pendingWelcome) return Promise.reject(new Error("A room request is already pending"));

    return new Promise<RoomInfo>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingWelcome = null;
        reject(new Error("Camp request timed out"));
      }, 6000);
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
        this.roomInfo = { ...this.roomInfo, roomCode: message.roomCode, hostId: message.hostId, players: message.players };
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
      this.onErrorCallback?.("Multiplayer server disconnected");
    });
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private endpoint() {
    const configured = String(import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "");
    if (configured) {
      const base = configured.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
      return `${base}/ws`;
    }
    if (import.meta.env.DEV) {
      return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:3001/ws`;
    }
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  }
}

function cleanName(name: string) {
  return String(name || "Counselor").trim().slice(0, 18) || "Counselor";
}
