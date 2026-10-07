import { Client } from "colyseus.js";
import type { GameRoomState } from "../../shared/GameRoomState";

export class NetworkManager {
  private client: Client | null = null;
  private room: any = null;
  private roomCode: string | null = null;
  private endpoint = "";
  private onStateChange: ((state: GameRoomState) => void) | null = null;
  private onMessage: ((type: string, data: any) => void) | null = null;

  constructor(private configuredUrl = "") {}

  async connect(): Promise<boolean> {
    try {
      const configured = String(import.meta.env.VITE_SERVER_URL || this.configuredUrl || "").replace(/\/$/, "");
      const browserProtocol = location.protocol === "https:" ? "wss" : "ws";

      if (configured) {
        this.endpoint = configured.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
      } else if (import.meta.env.DEV) {
        this.endpoint = `${browserProtocol}://${location.hostname}:3001`;
      } else {
        this.endpoint = `${browserProtocol}://${location.host}`;
      }

      this.client = new Client(this.endpoint);
      return true;
    } catch (error) {
      console.error("Failed to initialize multiplayer client:", error);
      this.client = null;
      return false;
    }
  }

  async createRoom(playerName: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const roomCode = this.generateRoomCode();
      this.room = await this.client.create("game", { roomCode });
      this.roomCode = roomCode;
      this.setupRoomListeners();
      this.send("JOIN", { name: playerName });
      return this.room.roomId;
    } catch (error) {
      console.error("Failed to create camp:", error);
      return null;
    }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const wantedCode = roomCode.trim().toUpperCase();
      const rooms = await this.client.getAvailableRooms("game");
      const match = rooms.find(
        (room: any) =>
          String(room.metadata?.roomCode || "").toUpperCase() === wantedCode && !room.locked,
      );

      if (!match) return false;

      this.room = await this.client.joinById(match.roomId);
      this.roomCode = match.metadata?.roomCode ?? wantedCode;
      this.setupRoomListeners();
      this.send("JOIN", { name: playerName });
      return true;
    } catch (error) {
      console.error("Failed to join camp:", error);
      return false;
    }
  }

  private generateRoomCode() {
    const words = ["PINE", "LAKE", "TRAIL", "CAMP", "BEAR", "OWL", "MOSS", "FIRE"];
    const word = words[Math.floor(Math.random() * words.length)];
    const number = Math.floor(10 + Math.random() * 90);
    return `${word}-${number}`;
  }

  private setupRoomListeners() {
    if (!this.room) return;

    this.room.onStateChange((state: GameRoomState) => {
      this.onStateChange?.(state);
    });

    this.room.onMessage("*", (type: string, data: any) => {
      this.onMessage?.(type, data);
    });
  }

  send(type: string, data: any = {}) {
    this.room?.send(type, data);
  }

  onRoomStateChange(callback: (state: GameRoomState) => void) {
    this.onStateChange = callback;
  }

  onRoomMessage(callback: (type: string, data: any) => void) {
    this.onMessage = callback;
  }

  getRoomId(): string | null {
    return this.room?.roomId ?? null;
  }

  getRoomCode(): string | null {
    return this.roomCode ?? this.room?.metadata?.roomCode ?? null;
  }

  getSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  leave() {
    if (this.room) {
      void this.room.leave();
      this.room = null;
    }
  }
}
