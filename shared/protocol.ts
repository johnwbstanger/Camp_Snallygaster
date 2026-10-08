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

export type ClientMessage =
  | { type: "create"; name: string }
  | { type: "join"; name: string; roomCode: string }
  | { type: "start" }
  | { type: "move"; pose: PlayerPose }
  | { type: "ping"; at: number };

export type ServerMessage =
  | { type: "welcome"; playerId: string; roomCode: string; hostId: string; players: PlayerState[] }
  | { type: "roster"; roomCode: string; hostId: string; players: PlayerState[] }
  | { type: "snapshot"; players: PlayerState[] }
  | { type: "start" }
  | { type: "pong"; at: number }
  | { type: "error"; message: string };
