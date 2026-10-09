import { CAMP_BUILDINGS } from "./campVision.js";

export type DialogueContext =
  | "hidden" | "found" | "idle" | "monster" | "dark" | "bus" | "loot" | "rescuedOther" | "teammateDeath" | "scream" | "freeze" | "hideAgain" | "safe";

export type CamperPersonality = {
  name: string;
  trait: "tactician" | "anxious" | "sarcastic" | "sporty" | "conspiracist" | "brave" | "foodie" | "polite" | "poet" | "gremlin";
  jumpy: number;
  coward: number;
  lines: Partial<Record<DialogueContext, string[]>>;
};

export const GENERIC_LINES: Record<DialogueContext, string[]> = {
  hidden: ["Shh. Shhh. You found me. Ugh.", "Is it gone? Don't lie.", "I wasn't hiding. I was resting aggressively.", "Counselors? Finally."],
  found: ["Oh thank goodness. I mean. Hey.", "Please tell me you have snacks.", "I genuinely thought you guys were adults.", "Okay. Okay okay okay. I'm coming."],
  idle: ["Please don't tell my mom about this.", "Are we there yet? Is there a there?", "My shoe is wet. Why is my shoe wet.", "Everything's fine. Everything's fine!", "I'm not scared. This is my normal face."],
  monster: ["Something is RIGHT THERE.", "Do not look at it. Do NOT look at it.", "It's following us!", "Run run run run run!"],
  dark: ["It's really dark out. Like, really.", "Can we get a flashlight? Any flashlight?", "The trees look different at night.", "That wasn't a squirrel. Squirrels don't do that."],
  bus: ["The bus! Look, the bus!", "I can see the bus. I love that bus.", "Home. Take me home."],
  loot: ["Why are you carrying a taxidermy squirrel?", "That is NOT worth dying over. ...How much is it?", "You can't just pick up random stuff!", "Ooh. Shiny."],
  rescuedOther: ["You found another one? Nice. I was beginning to feel special.", "Hi other kid. Same nightmare?", "Strength in numbers, right? Right?"],
  teammateDeath: ["Did one of you just... get eaten?", "That counselor was nice. They had snacks.", "Okay that's it. I'm telling Mr. Jenkins."],
  scream: ["AAAAAAAAAH!", "NOPE NOPE NOPE!", "HELP!!", "MOOOOOM!"],
  freeze: ["...", "Don't. Move.", "I'm a tree. I'm a very quiet tree."],
  hideAgain: ["Nope. I'm out. Bye!", "Not doing this. Tell my mom I love her.", "I'M GOING BACK TO MY HIDING SPOT."],
  safe: ["Bus! Safe! Blanket!", "I'm never going outside again.", "That was the worst camp ever. 10/10 would regret."],
};

export const CAMPERS_ROSTER: readonly CamperPersonality[] = [
  { name: "Ben", trait: "tactician", jumpy: 0.2, coward: 0.05, lines: {
    hidden: ["I wasn't hiding. I was establishing a defensive perimeter."],
    found: ["Perimeter compromised. Fine. Lead on."],
    idle: ["Note to self: the lake is a flank. Avoid the lake."],
    monster: ["Contact! Twelve o'clock! It's a big one!"] } },
  { name: "Maya", trait: "anxious", jumpy: 0.9, coward: 0.35, lines: {
    hidden: ["I think I left my inhaler in the haunted cabin."],
    idle: ["Is that breathing? That's breathing. Is that me?", "I'm fine. I'm absolutely fine. Don't look at my hands."],
    monster: ["It's HERE it's HERE it's HERE"] } },
  { name: "Jamie", trait: "sarcastic", jumpy: 0.25, coward: 0.1, lines: {
    found: ["Oh, great. The rescue squad. We're saved."],
    idle: ["Sure. Walk toward the woods. Great plan. 10/10.", "I saw something in the trees. It looked divorced."],
    monster: ["Oh good. Another thing that wants me dead."] } },
  { name: "Katie", trait: "sporty", jumpy: 0.35, coward: 0.1, lines: {
    idle: ["Can we go home now? I have soccer Thursday.", "I can run faster than that thing. Probably. Maybe. Define faster."],
    bus: ["Hit the showers. And by showers I mean the bus."] } },
  { name: "Nate", trait: "conspiracist", jumpy: 0.4, coward: 0.2, lines: {
    hidden: ["Mr. Jenkins said never go into the maintenance shed, which obviously meant go into the maintenance shed."],
    idle: ["This is all connected. The raccoons. The lake. Craig.", "That thing has been following me for like twenty minutes. I named him Kevin."],
    monster: ["Kevin?! Kevin, is that you?!"] } },
  { name: "Jess", trait: "brave", jumpy: 0.1, coward: 0.02, lines: {
    found: ["About time. I had a plan. It wasn't a good plan, but it was a plan."],
    idle: ["Do you guys have a gun?", "I'm not scared. I'm... tactically nervous."],
    monster: ["Behind me! No wait, in front of me! Whichever!"] } },
  { name: "Luke", trait: "foodie", jumpy: 0.5, coward: 0.25, lines: {
    hidden: ["Something ate Tyler's Pop-Tart and Tyler is missing, so..."],
    idle: ["Is there a pantry? I'm just asking. For science.", "I'd trade my left shoe for a hot dog."],
    loot: ["Is that food? Please be food."] } },
  { name: "Trevor", trait: "gremlin", jumpy: 0.45, coward: 0.3, lines: {
    hidden: ["Something keeps knocking on Cabin 6. There isn't a Cabin 6. Don't ask me."],
    idle: ["Day 4 of being hunted: still no dessert.", "Can we skip dinner? I threw up already."] } },
  { name: "Dana", trait: "polite", jumpy: 0.55, coward: 0.3, lines: {
    found: ["Thank you so much. I'm sorry for the trouble."],
    idle: ["Sorry. Sorry. Sorry to the monster too, I guess.", "Please don't tell my mom about this. Or my grandma."],
    scream: ["EXCUSE ME!! EXCUSE ME!!"] } },
  { name: "Owen", trait: "gremlin", jumpy: 0.3, coward: 0.12, lines: {
    idle: ["Okay but what if we just... adopt it?", "Do you guys have a gun? Asking for a friend. The friend is me."],
    loot: ["I will carry that if it makes the bad thing go away."] } },
  { name: "Mina", trait: "poet", jumpy: 0.4, coward: 0.2, lines: {
    idle: ["The night is a big dark mouth and we're the snack.", "I'm writing this down. Don't talk to me."],
    dark: ["The darkness has a texture. It's like velvet. Sad velvet."] } },
  { name: "Priya", trait: "tactician", jumpy: 0.3, coward: 0.08, lines: {
    hidden: ["I have a map, a whistle, and a bad feeling."],
    idle: ["I counted the exits. There are not enough exits.", "The buddy system works great. My buddy vanished. So that's on the buddy."] } },
];

export type HideSpot = { x: number; z: number };

const OUTDOOR_HIDES: readonly HideSpot[] = [
  { x: -11, z: -10 }, { x: 13, z: 9 }, { x: 20, z: -17 }, { x: -19, z: -18 }, { x: -4, z: 21 }, { x: 25, z: 16 },
  { x: -34, z: 5 }, { x: 34, z: 6 }, { x: -8, z: 18 }, { x: 36, z: -10 }, { x: -38, z: -14 }, { x: 52, z: 6 },
  { x: -52, z: 6 }, { x: -3, z: -44 },
];

export function hideSpots(): HideSpot[] {
  const spots = [...OUTDOOR_HIDES];
  for (const b of CAMP_BUILDINGS) {
    spots.push({ x: b.x - b.width / 2 + 1.8, z: b.z - b.depth / 2 + 1.6 }, { x: b.x + b.width / 2 - 1.8, z: b.z - b.depth / 2 + 1.6 });
  }
  return spots;
}

export const CAMPER_COUNT = 7;

export function pickCampers(random: () => number = Math.random) {
  const roster = [...CAMPERS_ROSTER];
  const spots = hideSpots();
  const shuffle = <T,>(items: T[]) => { for (let i = items.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } return items; };
  shuffle(roster); shuffle(spots);
  return Array.from({ length: CAMPER_COUNT }, (_, index) => ({ personality: CAMPERS_ROSTER.indexOf(roster[index]), spot: spots[index] }));
}

export function pickLine(personalityIndex: number, context: DialogueContext, random: () => number = Math.random) {
  const personal = CAMPERS_ROSTER[personalityIndex]?.lines[context] ?? [];
  const pool = personal.length && random() < 0.6 ? personal : GENERIC_LINES[context];
  return pool[Math.floor(random() * pool.length)] ?? "...";
}
