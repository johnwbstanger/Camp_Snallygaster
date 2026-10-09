import { GameHost, MAX_PLAYERS, normalizeRoomCode } from "../shared/GameHost.js";
import type { ServerMessage } from "../shared/protocol.js";

const inbox = new Map<string, ServerMessage[]>();
const host = new GameHost("PINE214", (id, message) => {
  if (!inbox.has(id)) inbox.set(id, []);
  inbox.get(id)!.push(message);
});

if (normalizeRoomCode("pine-214 ") !== "PINE214") throw new Error("room code normalisation changed");
if (host.join("p0", "Host", true) !== null) throw new Error("host failed to create room");
for (let i = 1; i < MAX_PLAYERS; i += 1) {
  if (host.join(`p${i}`, `C${i}`, false) !== null) throw new Error(`player ${i} rejected too early`);
}
if (!String(host.join("p15", "Extra", false)).includes("15/15")) throw new Error("16th player was not rejected with capacity detail");

host.handle("p1", { type: "start" });
if (host.round.phase !== "LOBBY") throw new Error("non-host started the round");
host.handle("p0", { type: "start" });
if (host.round.phase !== "ACTIVE") throw new Error("host could not start the round");
if (!String(host.join("late", "Late", false)).includes("started")) throw new Error("late join was not rejected");

host.handle("p0", { type: "move", pose: { x: -21, y: 1.4, z: 8, yaw: 0 } });
host.handle("p0", { type: "interact" });
const camper = host.round.campers[0];
if (camper.state !== "FOLLOWING" || camper.followingPlayerId !== "p0") throw new Error("rescue did not register");
if (!host.round.monster.awake) throw new Error("monster did not wake on rescue");

host.tick(0.1);
const snapshot = [...(inbox.get("p3") ?? [])].reverse().find((m) => m.type === "snapshot");
if (!snapshot || snapshot.type !== "snapshot" || snapshot.players.length !== MAX_PLAYERS) throw new Error("snapshot was not broadcast to every player");

host.leave("p0");
if (host.hostId === "p0" || host.hostId === "") throw new Error("host migration failed");
if (camper.state !== "HIDDEN") throw new Error("camper was not released when its rescuer left");

console.log("GAMEHOST CONTRACT PASS: shared authoritative room logic (15 cap, host-only start, rescue, snapshots, host migration)");
