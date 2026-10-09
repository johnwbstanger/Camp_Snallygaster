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


// --- loot ---
const h3 = new GameHost("MOSS482", () => {});
h3.join("a", "Alice", true); h3.handle("a", { type: "start" });
if (h3.round.loot.length < 15) throw new Error("round spawned too little loot");
const first = h3.round.loot[0];
h3.handle("a", { type: "move", pose: { x: first.x + 20, y: 1.4, z: first.z, yaw: 0 } });
h3.handle("a", { type: "interact", targetId: first.id });
if (first.heldBy) throw new Error("picked up loot from across the map");
h3.handle("a", { type: "move", pose: { x: first.x, y: 1.4, z: first.z, yaw: 0 } });
h3.handle("a", { type: "interact", targetId: first.id });
if (first.heldBy !== "a") throw new Error("loot pickup failed");
for (const other of h3.round.loot.slice(1, 6)) { other.x = first.x; other.z = first.z; h3.handle("a", { type: "interact", targetId: other.id }); }
if (h3.round.loot.filter((item) => item.heldBy === "a").length !== 3) throw new Error("carry limit not enforced at 3");
h3.handle("a", { type: "drop" });
if (h3.round.loot.filter((item) => item.heldBy === "a").length !== 2) throw new Error("drop did not release one item");
const carriedValue = h3.round.loot.filter((item) => item.heldBy === "a").reduce((sum, item) => sum + item.value, 0);
h3.handle("a", { type: "move", pose: { x: 0, y: 1.4, z: 29, yaw: 0 } });
h3.tick(0.1);
if (h3.round.lootDelivered !== carriedValue) throw new Error("loot was not delivered at the bus");

// --- extraction, results, reset ---
const inbox2 = new Map<string, ServerMessage[]>();
const h2 = new GameHost("BEAR731", (id, m) => { if (!inbox2.has(id)) inbox2.set(id, []); inbox2.get(id)!.push(m); });
h2.join("a", "Alice", true); h2.join("b", "Bob", false);
h2.handle("a", { type: "start" });
h2.handle("a", { type: "move", pose: { x: -21, y: 1.4, z: 8, yaw: 0 } });
h2.handle("a", { type: "interact" });
h2.handle("a", { type: "move", pose: { x: 0, y: 1.4, z: 28, yaw: 0 } });
h2.handle("b", { type: "move", pose: { x: 60, y: 1.4, z: -60, yaw: 0 } });
h2.handle("b", { type: "interact", targetId: "bus:extract" });
if (h2.round.extraction.active) throw new Error("far player started the bus");
h2.handle("a", { type: "interact", targetId: "bus:extract" });
if (!h2.round.extraction.active) throw new Error("bus countdown did not start");
for (let i = 0; i < 140; i += 1) h2.tick(0.1);
if (h2.round.phase === "ACTIVE") throw new Error("round did not end after countdown");
const results = h2.round.results;
if (!results) throw new Error("no results produced");
if (results.playersSaved + results.deaths < 1 && results.outcome === "EXTRACTED") throw new Error("results inconsistent");
if (results.awards.length < 2) throw new Error("awards missing");
h2.handle("b", { type: "reset" });
if (h2.round.phase === "LOBBY") throw new Error("non-host reset the round");
h2.handle("a", { type: "reset" });
if (h2.round.phase !== "LOBBY" || h2.round.results) throw new Error("host could not reset to lobby");
if (!(inbox2.get("b") ?? []).some((m) => m.type === "lobby")) throw new Error("lobby message not broadcast");

console.log("GAMEHOST CONTRACT PASS: shared authoritative room logic (15 cap, host-only start, rescue, snapshots, host migration)");
