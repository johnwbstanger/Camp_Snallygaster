import {
  MONSTER_LIBRARY,
  chooseRandomMonster,
  getMonsterDefinition,
} from "../shared/monsterLibrary.js";

const expected = ["snallygaster", "wampus", "swampcat", "bigfoot", "rake", "werewolf"];
const ids = MONSTER_LIBRARY.map((monster) => monster.id);

if (MONSTER_LIBRARY.length !== expected.length) {
  throw new Error(`expected ${expected.length} monsters, got ${MONSTER_LIBRARY.length}`);
}

if (new Set(ids).size !== ids.length) {
  throw new Error("monster ids must be unique");
}

for (const id of expected) {
  if (!ids.includes(id as any)) throw new Error(`missing monster ${id}`);
  const monster = getMonsterDefinition(id as any);
  if (!monster.name || monster.baseSpeed <= 0 || monster.catchDistance <= 0 || monster.speedPerCamper < 0) {
    throw new Error(`invalid monster definition for ${id}`);
  }
}

if (chooseRandomMonster(() => 0).id !== expected[0]) {
  throw new Error("randomizer lower bound does not select the first monster");
}

if (chooseRandomMonster(() => 0.999999).id !== expected[expected.length - 1]) {
  throw new Error("randomizer upper bound does not select the final monster");
}

const sampled = new Set<string>();
for (let i = 0; i < expected.length; i += 1) {
  sampled.add(chooseRandomMonster(() => (i + 0.25) / expected.length).id);
}
if (sampled.size !== expected.length) {
  throw new Error(`randomizer could only reach ${sampled.size}/${expected.length} monsters`);
}

console.log(`MONSTER LIBRARY PASS: ${MONSTER_LIBRARY.map((monster) => monster.name).join(", ")}`);
