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
for (const clothingMarker of ["shirtColors", "shortsColors", "packColors", "socks", "shoes", "neckerchief"]) {
  if (!objective.includes(clothingMarker)) throw new Error(`Clothed camper fallback missing ${clothingMarker}`);
}

console.log("CAMPER CHARACTER CONTRACT PASS: no naked base-body override, clothed camp fallback active, child scale preserved");
