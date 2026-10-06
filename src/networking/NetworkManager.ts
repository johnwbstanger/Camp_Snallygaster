import { Client } from "colyseus.js";
import type { GameRoomState } from "../../shared/GameRoomState";

export class NetworkManager {
  private client: Client | null = null;
  private room: any = null;
  private onStateChange: ((state: GameRoomState) => void) | null = null;
  private onMessage: ((type: string, data: any) => void) | null = null;

  constructor(
    private wsUrl: string,
  ) {}

  async connect(): Promise<boolean> {
    try {
      const proto = this.wsUrl.startsWith("wss") ? "wss" : "ws";
      const endpoint = import.meta.env.DEV
        ? `${proto}://${location.hostname}:3001`
        : this.wsUrl;

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
      this.room = await this.client.create("game");
      this.setupRoomListeners();
      this.send("JOIN", { name: playerName });
      return this.room.roomId;
    } catch (error) {
      console.error("Failed to create room:", error);
      return null;
    }
  }

  async joinRoom(roomId: string, playerName: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      this.room = await this.client.joinById(roomId);
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

  leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }
}
