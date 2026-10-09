import type { MonsterKind } from "./monsterLibrary";
import type { MonsterState } from "./monsterAI";

export type PlayerPose = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  flashlight?: boolean;
  crouch?: boolean;
  sprint?: boolean;
};

export type NoiseMessage = { x: number; z: number; loudness: number; material: string; source: string };
export type PropTransform = { id: string; p: [number, number, number]; q: [number, number, number, number] };

export type PlayerState = {
  id: string;
  name: string;
  pose: PlayerPose;
};

export type CamperMood = "HIDING" | "CALM" | "PANIC" | "FROZEN";

export type CamperState = {
  id: string;
  name: string;
  personality: number;
  mood: CamperMood;
  line: string;
  lineSeq: number;
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

export type LootState = {
  id: string;
  name: string;
  kind: "useful" | "valuable" | "ridiculous";
  shape: string;
  color: number;
  value: number;
  weight: number;
  blurb: string;
  x: number;
  y: number;
  z: number;
  heldBy: string | null;
  delivered: boolean;
};

export type ExtractionState = { active: boolean; remaining: number };

export type SharedRoundState = {
  phase: "LOBBY" | "ACTIVE" | "WON" | "LOST";
  elapsed: number;
  extraction: ExtractionState;
  loot: LootState[];
  lootDelivered: number;
  downed: string[];
  results: RoundResults | null;
  campers: CamperState[];
  doors: DoorState[];
  monster: { kind: MonsterKind; x: number; y: number; z: number; awake: boolean; state: MonsterState };
  campersSafe: number;
  campersFound: number;
};

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; name: string; roomCode: string }
  | { type: "start" }
  | { type: "reset" }
  | { type: "drop" }
  | { type: "move"; pose: PlayerPose }
  | ({ type: "noise" } & NoiseMessage)
  | { type: "props"; props: PropTransform[] }
  | { type: "interact"; targetId?: string }
  | { type: "ping"; at: number };

export type ServerMessage =
  | { type: "welcome"; playerId: string; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "roster"; roomCode: string; hostId: string; maxPlayers: number; players: PlayerState[] }
  | { type: "snapshot"; players: PlayerState[] }
  | { type: "round"; state: SharedRoundState }
  | { type: "start" }
  | { type: "lobby" }
  | ({ type: "noise"; by: string } & NoiseMessage)
  | { type: "props"; by: string; props: PropTransform[] }
  | { type: "pong"; at: number }
  | { type: "error"; message: string };