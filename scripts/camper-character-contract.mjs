import fs from "node:fs/promises";

const objective = await fs.readFile(new URL("../src/game/ObjectiveSystem.ts", import.meta.url), "utf8");

if (objective.includes('assetLibrary.attach("camper')) {
  throw new Error("Camper renderer must not load naked Quaternius base-body assets");
}
if (objective.includes('"camperMale"') || objective.includes('"camperFemale"')) {
  throw new Error("ObjectiveSystem must not route campers to base-body character keys");
}
if (!objective.includes("const CAMPER_RENDER_SCALE = 0.82")) {
  throw new Error("Camper scale contract changed; expected child/young-teen render scale 0.82");
}
const campers = await fs.readFile(new URL("../src/game/campers.ts", import.meta.url), "utf8");
for (const marker of ["buildCamper(", "poseCamper(", "disposeCamper("]) {
  if (!objective.includes(marker)) throw new Error(`ObjectiveSystem must use procedural camper module: missing ${marker}`);
}
for (const clothingMarker of ["shirt", "shorts", "pack", "socks", "shoes", "neckerchief"]) {
  if (!campers.includes(clothingMarker)) throw new Error(`Clothed camper module missing ${clothingMarker}`);
}
const ids = [...campers.matchAll(/id: "(camper-\d+)"/g)].map((m) => m[1]);
if (ids.length !== 7 || new Set(ids).size !== 7) throw new Error("Camper roster must have 7 unique camper-N ids matching the server");
if (/WebSocket|send\(/.test(campers)) throw new Error("campers.ts must stay render-only; sync only camper id/state");

console.log("CAMPER CHARACTER CONTRACT PASS: no naked base-body override, clothed camp fallback active, child scale preserved");
