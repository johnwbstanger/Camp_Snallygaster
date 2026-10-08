export type MonsterKind =
  | "snallygaster"
  | "wampus"
  | "swampcat"
  | "bigfoot"
  | "rake"
  | "werewolf";

export type MonsterArchetype = "winged" | "feline" | "brute" | "stalker" | "hunter";

export type MonsterDefinition = {
  id: MonsterKind;
  name: string;
  archetype: MonsterArchetype;
  tagline: string;
  baseSpeed: number;
  speedPerCamper: number;
  catchDistance: number;
  scale: number;
  bodyColor: number;
  accentColor: number;
  eyeColor: number;
};

export const MONSTER_LIBRARY: readonly MonsterDefinition[] = [
  {
    id: "snallygaster",
    name: "Snallygaster",
    archetype: "winged",
    tagline: "Something with wings is circling the camp.",
    baseSpeed: 1.55,
    speedPerCamper: 0.12,
    catchDistance: 1.15,
    scale: 1.08,
    bodyColor: 0x22372f,
    accentColor: 0x7b4c38,
    eyeColor: 0xb79cff,
  },
  {
    id: "wampus",
    name: "Wampus",
    archetype: "feline",
    tagline: "A heavy catlike shape is moving between the cabins.",
    baseSpeed: 1.78,
    speedPerCamper: 0.10,
    catchDistance: 1.18,
    scale: 0.98,
    bodyColor: 0x3e3429,
    accentColor: 0x9d6c3f,
    eyeColor: 0xffc45d,
  },
  {
    id: "swampcat",
    name: "Swampcat",
    archetype: "feline",
    tagline: "Wet pawprints lead out of the dark grass.",
    baseSpeed: 1.48,
    speedPerCamper: 0.14,
    catchDistance: 1.12,
    scale: 1.12,
    bodyColor: 0x30473a,
    accentColor: 0x74834c,
    eyeColor: 0x9cff7a,
  },
  {
    id: "bigfoot",
    name: "Bigfoot",
    archetype: "brute",
    tagline: "Branches are snapping much higher than they should be.",
    baseSpeed: 1.34,
    speedPerCamper: 0.08,
    catchDistance: 1.42,
    scale: 1.24,
    bodyColor: 0x3a2c23,
    accentColor: 0x73513b,
    eyeColor: 0xf0b36d,
  },
  {
    id: "rake",
    name: "The Rake",
    archetype: "stalker",
    tagline: "A pale shape is crawling just beyond the flashlight beam.",
    baseSpeed: 1.92,
    speedPerCamper: 0.11,
    catchDistance: 1.04,
    scale: 1.06,
    bodyColor: 0xb6b1a7,
    accentColor: 0x6f6b63,
    eyeColor: 0xf5efe3,
  },
  {
    id: "werewolf",
    name: "Werewolf",
    archetype: "hunter",
    tagline: "A howl rolls across the lake and the woods answer back.",
    baseSpeed: 1.68,
    speedPerCamper: 0.15,
    catchDistance: 1.22,
    scale: 1.14,
    bodyColor: 0x292d2c,
    accentColor: 0x59605b,
    eyeColor: 0xffd45e,
  },
] as const;

const MONSTER_BY_ID = new Map<MonsterKind, MonsterDefinition>(
  MONSTER_LIBRARY.map((definition) => [definition.id, definition]),
);

export function getMonsterDefinition(kind: MonsterKind): MonsterDefinition {
  return MONSTER_BY_ID.get(kind) ?? MONSTER_LIBRARY[0];
}

export function chooseRandomMonster(random: () => number = Math.random): MonsterDefinition {
  const sample = random();
  const value = Number.isFinite(sample) ? Math.max(0, Math.min(0.999999, sample)) : 0;
  return MONSTER_LIBRARY[Math.floor(value * MONSTER_LIBRARY.length)] ?? MONSTER_LIBRARY[0];
}
