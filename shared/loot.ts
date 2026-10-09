import { CAMP_BUILDINGS } from "./campVision.js";

export type LootKind = "useful" | "valuable" | "ridiculous";
export type LootShape = "box" | "cylinder" | "sphere" | "flat" | "long" | "mug" | "tape" | "squirrel";

export type LootDefinition = {
  name: string;
  kind: LootKind;
  value: number;
  weight: number;
  shape: LootShape;
  color: number;
  blurb: string;
};

export const LOOT_TABLE: readonly LootDefinition[] = [
  { name: "Flashlight", kind: "useful", value: 18, weight: 1, shape: "cylinder", color: 0xd9a441, blurb: "Slightly less dead than the last one." },
  { name: "Battery Pack", kind: "useful", value: 14, weight: 1, shape: "box", color: 0x3f7f4f, blurb: "Eight D cells. Somebody's emergency stash." },
  { name: "Walkie Radio", kind: "useful", value: 35, weight: 2, shape: "box", color: 0x2d3a3d, blurb: "Crackles with half a sentence." },
  { name: "First Aid Kit", kind: "useful", value: 30, weight: 2, shape: "box", color: 0xb23a32, blurb: "Mostly band-aids shaped like dinosaurs." },
  { name: "Brass Key Ring", kind: "useful", value: 20, weight: 1, shape: "flat", color: 0xc9a14a, blurb: "Labeled: SHED?? MAYBE." },
  { name: "Folded Camp Map", kind: "useful", value: 16, weight: 1, shape: "flat", color: 0xe0cf9c, blurb: "Cabin 6 is circled. In red. Twice." },
  { name: "Emergency Whistle", kind: "useful", value: 12, weight: 1, shape: "cylinder", color: 0xd8d2c0, blurb: "Do NOT blow this near a monster." },
  { name: "Glow Sticks", kind: "useful", value: 10, weight: 1, shape: "long", color: 0x7cf2b2, blurb: "Rave-grade neon. Perfect for a rave. Or a haunting." },
  { name: "Toolbox", kind: "useful", value: 40, weight: 5, shape: "box", color: 0xa4382e, blurb: "Heavy. Rattles. Contains one (1) sock." },
  { name: "Old Film Camera", kind: "valuable", value: 120, weight: 3, shape: "box", color: 0x3a3a3a, blurb: "Undeveloped film still inside." },
  { name: "Brass Pocket Watch", kind: "valuable", value: 95, weight: 1, shape: "cylinder", color: 0xd4b24f, blurb: "Stopped at 3:07. Every time." },
  { name: "Binoculars", kind: "valuable", value: 85, weight: 2, shape: "box", color: 0x2e3b2f, blurb: "Counselor Craig's. He wants them back." },
  { name: "Camp Memorabilia Plaque", kind: "valuable", value: 140, weight: 4, shape: "flat", color: 0x7a5232, blurb: "Founded 1952. Haunted since 1953." },
  { name: "Rare Trading Card", kind: "valuable", value: 160, weight: 1, shape: "flat", color: 0xe9c34d, blurb: "Holographic Raccoon Wizard. Mint." },
  { name: "Cursed Friendship Bracelet", kind: "ridiculous", value: 55, weight: 1, shape: "tape", color: 0xd04a9a, blurb: "It tightened when you looked away." },
  { name: "World's Okayest Counselor Mug", kind: "ridiculous", value: 45, weight: 1, shape: "mug", color: 0xf1ead2, blurb: "Accurate." },
  { name: "Forbidden Pudding Cup", kind: "ridiculous", value: 70, weight: 1, shape: "cylinder", color: 0xd8b56e, blurb: "Expired in 1991. Still jiggles." },
  { name: "Taxidermy Squirrel", kind: "ridiculous", value: 110, weight: 3, shape: "squirrel", color: 0x7a6247, blurb: "Eyes follow you. That's rude." },
  { name: "Broken Walkman", kind: "ridiculous", value: 38, weight: 1, shape: "box", color: 0x6f6f78, blurb: "Plays one song, backwards." },
  { name: "Unidentified Cassette", kind: "ridiculous", value: 65, weight: 1, shape: "tape", color: 0x1e1e22, blurb: "Label reads: DO NOT PLAY (love, Dad)." },
  { name: "Eight-Pound Flashlight", kind: "ridiculous", value: 60, weight: 8, shape: "long", color: 0x4a6a8f, blurb: "Brightness: yes. Wrist: no." },
  { name: "1978 Bowling Trophy", kind: "ridiculous", value: 90, weight: 5, shape: "cylinder", color: 0xd9b84a, blurb: "Camp Snallygaster Pin Pals, 2nd place." },
  { name: "Suspiciously Wet Bible", kind: "ridiculous", value: 50, weight: 2, shape: "box", color: 0x2d2318, blurb: "Nobody has been near water." },
  { name: "Giant Novelty Spoon", kind: "ridiculous", value: 42, weight: 4, shape: "long", color: 0xb9bcc2, blurb: "It's just a spoon. A big one." },
];

export type LootSpawn = { x: number; z: number };

const OUTDOOR_SPAWNS: readonly LootSpawn[] = [
  { x: -14, z: 14 }, { x: 14, z: 16 }, { x: -8, z: 24 }, { x: 10, z: 26 }, { x: -32, z: 12 }, { x: 32, z: 10 },
  { x: -20, z: -12 }, { x: 20, z: -12 }, { x: -36, z: -12 }, { x: 36, z: -12 }, { x: 0, z: -12 }, { x: -52, z: 2 },
  { x: 52, z: 2 }, { x: -52, z: -22 }, { x: 52, z: -22 }, { x: 0, z: 6 },
];

export function lootSpawnPoints(): LootSpawn[] {
  const points: LootSpawn[] = [...OUTDOOR_SPAWNS];
  for (const building of CAMP_BUILDINGS) {
    const rx = building.width / 2 - 1.6;
    const rz = building.depth / 2 - 1.6;
    points.push({ x: building.x - rx * 0.55, z: building.z - rz * 0.4 }, { x: building.x + rx * 0.55, z: building.z - rz * 0.6 }, { x: building.x, z: building.z + rz * 0.1 });
  }
  return points;
}

export const LOOT_COUNT = 22;
export const LOOT_CARRY_LIMIT = 3;

export function pickLoot(random: () => number = Math.random) {
  const spawns = lootSpawnPoints();
  for (let i = spawns.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
  }
  const items: Array<{ definition: LootDefinition; spawn: LootSpawn }> = [];
  const pool = [...LOOT_TABLE];
  for (let i = 0; i < Math.min(LOOT_COUNT, spawns.length); i += 1) {
    const definition = pool[Math.floor(random() * pool.length)];
    items.push({ definition, spawn: spawns[i] });
  }
  return items;
}

/** Walk-speed multiplier for a carried weight; heavy loot hurts but never pins you in place. */
export function weightSpeedFactor(weight: number) {
  return Math.max(0.55, 1 - weight * 0.028);
}
