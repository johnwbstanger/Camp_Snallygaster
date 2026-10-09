import type { ClientMessage, NoiseMessage, PlayerPose, PlayerState, PropTransform, ServerMessage, SharedRoundState } from "../../shared/protocol";

import { PeerClientTransport, PeerHostTransport, WebSocketTransport, type ClientTransport, type TransportHandlers } from "./transports";
import { configuredServerUrl } from "./peerConfig";

export type RoomInfo = {
  roomCode: string;
  playerId: string;
  hostId: string;
  maxPlayers: number;
  players: PlayerState[];
};

export class MultiplayerClient {
  private transport: ClientTransport | null = null;
  private connecting: Promise<void> | null = null;
  private pendingWelcome: { resolve: (room: RoomInfo) => void; reject: (error: Error) => void; timer: number } | null = null;
  private roomInfo: RoomInfo | null = null;
  private onRosterCallback: ((room: RoomInfo) => void) | null = null;
  private onSnapshotCallback: ((players: PlayerState[]) => void) | null = null;
  private onRoundCallback: ((state: SharedRoundState) => void) | null = null;
  private onStartCallback: (() => void) | null = null;
  private onLobbyCallback: (() => void) | null = null;
  private onNoiseCallback: ((noise: NoiseMessage & { by: string }) => void) | null = null;
  private onPropsCallback: ((by: string, props: PropTransform[]) => void) | null = null;
  private onErrorCallback: ((message: string) => void) | null = null;
  private heartbeat: number | null = null;

  get connected() { return Boolean(this.transport?.open); }
  get currentRoom() { return this.roomInfo; }
  get usesServer() { return Boolean(configuredServerUrl()); }

  async createCamp(name: string) {
    this.close();
    const handlers = this.handlers();
    const serverUrl = configuredServerUrl();
    if (serverUrl) {
      this.transport = await WebSocketTransport.connect(this.wsEndpoint(serverUrl), handlers);
      this.startHeartbeat();
    } else {
      this.transport = await PeerHostTransport.create(handlers);
    }
    return this.awaitWelcome({ type: "create", name: cleanName(name) });
  }

  async joinCamp(roomCode: string, name: string) {
    this.close();
    const code = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const handlers = this.handlers();
    const serverUrl = configuredServerUrl();
    if (serverUrl) {
      this.transport = await WebSocketTransport.connect(this.wsEndpoint(serverUrl), handlers);
      this.startHeartbeat();
    } else {
      this.transport = await PeerClientTransport.connect(code, handlers);
    }
    return this.awaitWelcome({ type: "join", roomCode: code, name: cleanName(name) });
  }

  startCamp() { this.send({ type: "start" }); }
  interact(targetId?: string) { this.send(targetId ? { type: "interact", targetId } : { type: "interact" }); }
  sendPose(pose: PlayerPose) { this.send({ type: "move", pose }); }

  onRoster(callback: (room: RoomInfo) => void) { this.onRosterCallback = callback; }
  onSnapshot(callback: (players: PlayerState[]) => void) { this.onSnapshotCallback = callback; }
  onRound(callback: (state: SharedRoundState) => void) { this.onRoundCallback = callback; }
  onStart(callback: () => void) { this.onStartCallback = callback; }
  onLobby(callback: () => void) { this.onLobbyCallback = callback; }
  dropLoot() { this.send({ type: "drop" }); }
  sendNoise(noise: NoiseMessage) { this.send({ type: "noise", ...noise }); }
  sendProps(props: PropTransform[]) { if (props.length) this.send({ type: "props", props }); }
  onNoise(callback: (noise: NoiseMessage & { by: string }) => void) { this.onNoiseCallback = callback; }
  onProps(callback: (by: string, props: PropTransform[]) => void) { this.onPropsCallback = callback; }
  resetToLobby() { this.send({ type: "reset" }); }
  onError(callback: (message: string) => void) { this.onErrorCallback = callback; }

  close() {
    this.stopHeartbeat();
    if (this.pendingWelcome) window.clearTimeout(this.pendingWelcome.timer);
    this.pendingWelcome = null;
    this.roomInfo = null;
    const transport = this.transport;
    this.transport = null;
    transport?.close();
  }

  private awaitWelcome(message: ClientMessage) {
    const transport = this.transport;
    if (!transport?.open) return Promise.reject(new Error("Multiplayer connection is not open"));
    if (this.pendingWelcome) return Promise.reject(new Error("A room request is already pending"));
    return new Promise<RoomInfo>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingWelcome = null;
        reject(new Error("Camp request timed out"));
      }, 20000);
      this.pendingWelcome = { resolve, reject, timer };
      transport.send(message);
    });
  }

  private handlers(): TransportHandlers {
    return {
      onMessage: (message) => this.receive(message),
      onClose: (reason) => {
        if (this.pendingWelcome) {
          window.clearTimeout(this.pendingWelcome.timer);
          this.pendingWelcome.reject(new Error(reason));
          this.pendingWelcome = null;
        }
        if (this.transport) {
          this.stopHeartbeat();
          this.transport = null;
          this.onErrorCallback?.(reason);
        }
      },
    };
  }

  private receive(message: ServerMessage) {
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
      this.roomInfo = { ...this.roomInfo, roomCode: message.roomCode, hostId: message.hostId, maxPlayers: message.maxPlayers, players: message.players };
      this.onRosterCallback?.(this.roomInfo);
      return;
    }
    if (message.type === "snapshot") { this.onSnapshotCallback?.(message.players); return; }
    if (message.type === "round") { this.onRoundCallback?.(message.state); return; }
    if (message.type === "start") { this.onStartCallback?.(); return; }
    if (message.type === "noise") { this.onNoiseCallback?.(message); return; }
    if (message.type === "props") { this.onPropsCallback?.(message.by, message.props); return; }
    if (message.type === "lobby") { this.onLobbyCallback?.(); return; }
    if (message.type === "error") {
      this.onErrorCallback?.(message.message);
      if (this.pendingWelcome) {
        window.clearTimeout(this.pendingWelcome.timer);
        this.pendingWelcome.reject(new Error(message.message));
        this.pendingWelcome = null;
      }
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = window.setInterval(() => this.send({ type: "ping", at: Date.now() }), 20000);
  }

  private stopHeartbeat() {
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private send(message: ClientMessage) { this.transport?.send(message); }

  private wsEndpoint(base: string) {
    return `${base.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/ws`;
  }
}

function cleanName(name: string) {
  return String(name || "Counselor").trim().slice(0, 18) || "Counselor";
}
