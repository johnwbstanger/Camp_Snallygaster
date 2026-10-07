import { Client } from "colyseus.js";
import type { GameRoomState } from "../../shared/GameRoomState";

export class NetworkManager {
  private client: Client | null = null;
  private room: any = null;
  private roomCode: string | null = null;
  private onStateChange: ((state: GameRoomState) => void) | null = null;
  private onMessage: ((type: string, data: any) => void) | null = null;

  constructor(
    private wsUrl: string,
  ) {}

  async connect(): Promise<boolean> {
    try {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const endpoint = import.meta.env.DEV
        ? `${proto}://${location.hostname}:3001`
        : `${proto}://${location.host}`;

      this.client = new Client(endpoint);
      return true;
    } catch (error) {
      console.error("Failed to connect:", error);
      return false;
    }
  }

  async createRoom(playerName: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const response = await fetch("/api/rooms/create", { method: "POST" });
      if (!response.ok) throw new Error(`Room creation failed: ${response.status}`);
      const { roomId, roomCode } = await response.json();
      this.roomCode = roomCode;
      this.room = await this.client.joinById(roomId);
      this.setupRoomListeners();
      this.send("JOIN", { name: playerName });
      return this.room.roomId;
    } catch (error) {
      console.error("Failed to create room:", error);
      return null;
    }
  }

  async joinRoom(roomCode: string, playerName: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error(`Camp directory failed: ${response.status}`);
      const rooms = await response.json();
      const match = rooms.find(
        (room: any) => room.metadata?.roomCode?.toUpperCase() === roomCode.toUpperCase(),
      );
      if (!match) return false;

      this.roomCode = match.metadata.roomCode;
      this.room = await this.client.joinById(match.roomId);
      this.setupRoomListeners();
      this.send("JOIN", { name: playerName });
      return true;
    } catch (error) {
      console.error("Failed to join room:", error);
      return false;
    }
  }

  private setupRoomListeners() {
    if (!this.room) return;

    this.room.onStateChange.once((_state: any) => {
      console.log("Connected to room", this.room.roomId);
    });

    this.room.onStateChange((_state: any) => {
      if (this.onStateChange) {
        this.onStateChange(_state);
      }
    });

    this.room.onMessage("*", (type: string, data: any) => {
      if (this.onMessage) {
        this.onMessage(type, data);
      }
    });
  }

  send(type: string, data: any = {}) {
    if (this.room) {
      this.room.send(type, data);
    }
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
    return this.roomCode;
  }

  getSessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}
