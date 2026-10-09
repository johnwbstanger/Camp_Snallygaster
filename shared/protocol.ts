import type { MonsterKind } from "./monsterLibrary";

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

export type CamperState = {
  id: string;
  name: string;
  state: "HIDDEN" | "FOLLOWING" | "SAFE";
  followingPlayerId: string | null;
  position: { x: number; y: number; z: number };
};

export type DoorState = {
  id: string;
  open: boolean;
};

export type RoundAward = { title: string; playerName: string; detail: string };

export type RoundResults = {
  outcome: "EXTRACTED" | "WIPED";
  playersSaved: number;
  playersTotal: number;
  campersSaved: number;
  campersLost: number;
  lootValue: number;
  secrets: number;
  deaths: number;
  awards: RoundAward[];
};

export type ExtractionState = { active: boolean; remaining: number };

export type SharedRoundState = {
  phase: "LOBBY" | "ACTIVE" | "WON" | "LOST";
  elapsed: number;
  extraction: ExtractionState;
  downed: string[];
  results: RoundResults | null;
  campers: CamperState[];
  doors: DoorState[];
  monster: { kind: MonsterKind; x: number; y: number; z: number; awake: boolean };
  campersSafe: number;
  campersFound: number;
};

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; name: string; roomCode: string }
  | { type: "start" }
  | { type: "reset" }
  | { type: "move"; pose: PlayerPose }
  | { type: "interact"; targetId?: string }
  | { type: "ping"; at: number };

export type ServerMessage =
  | { type: "welcome"; playerId: string; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "roster"; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "snapshot"; players: PlayerState[] }
  | { type: "round"; state: SharedRoundState }
  | { type: "start" }
  | { type: "lobby" }
  | { type: "pong"; at: number }
  | { type: "error"; message: string };