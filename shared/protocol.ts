import type { HidingPose } from "./hidingSpots";

export type PlayerPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
};

export type PlayerState = {
  id: string;
  name: string;
  pose: PlayerPose;
};

export type CamperPhase = "HIDDEN" | "FOLLOWING" | "BOARDING" | "BOARDED";

export type CamperState = {
  id: string;
  name: string;
  state: CamperPhase;
  followingPlayerId: string | null;
  position: { x: number; y: number; z: number };
  hidingSpotId: string;
  hidingPose: HidingPose;
};

export type DoorState = {
  id: string;
  open: boolean;
};

export type SharedRoundState = {
  phase: "LOBBY" | "ACTIVE" | "WON" | "LOST";
  campers: CamperState[];
  doors: DoorState[];
  monster: { x: number; y: number; z: number; awake: boolean };
  campersSafe: number;
  campersFound: number;
};

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; name: string; roomCode: string }
  | { type: "start" }
  | { type: "move"; pose: PlayerPose }
  | { type: "interact"; targetId?: string }
  | { type: "ping"; at: number };

export type ServerMessage =
  | { type: "welcome"; playerId: string; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "roster"; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "snapshot"; players: PlayerState[] }
  | { type: "round"; state: SharedRoundState }
  | { type: "start" }
  | { type: "pong"; at: number }
  | { type: "error"; message: string };
