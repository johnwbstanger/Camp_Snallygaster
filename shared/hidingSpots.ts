export type HidingPose = "crouch" | "sit" | "hide";

export type HidingSpot = {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  pose: HidingPose;
};

// These positions correspond to real playable set pieces in World.ts. The server
// chooses a different subset every round so campers are not standing in open fields.
export const HIDING_SPOTS: readonly HidingSpot[] = [
  { id: "dining-table-west", label: "under the west dining table", position: { x: -5.7, y: 0.16, z: -28.4 }, pose: "crouch" },
  { id: "dining-table-center", label: "under the center dining table", position: { x: 0, y: 0.16, z: -28.4 }, pose: "crouch" },
  { id: "dining-table-east", label: "under the east dining table", position: { x: 5.7, y: 0.16, z: -28.4 }, pose: "crouch" },
  { id: "cabin-a-bunk-front", label: "under a bunk in Cabin A", position: { x: -26.9, y: 0.16, z: 4.4 }, pose: "hide" },
  { id: "cabin-a-bunk-back", label: "behind a bunk in Cabin A", position: { x: -19.1, y: 0.16, z: 1.6 }, pose: "hide" },
  { id: "cabin-b-bunk-front", label: "under a bunk in Cabin B", position: { x: 19.1, y: 0.16, z: 4.4 }, pose: "hide" },
  { id: "cabin-b-bunk-back", label: "behind a bunk in Cabin B", position: { x: 26.9, y: 0.16, z: 1.6 }, pose: "hide" },
  { id: "cabin-c-bunk", label: "under a bunk in Cabin C", position: { x: -48.8, y: 0.16, z: 14.4 }, pose: "hide" },
  { id: "cabin-d-bunk", label: "under a bunk in Cabin D", position: { x: 48.8, y: 0.16, z: 14.4 }, pose: "hide" },
  { id: "director-counter", label: "behind the director's counter", position: { x: 1.4, y: 0.16, z: 9.4 }, pose: "crouch" },
  { id: "arts-counter", label: "behind the arts counter", position: { x: 28.5, y: 0.16, z: -25.8 }, pose: "crouch" },
  { id: "infirmary-counter", label: "behind the infirmary counter", position: { x: -41.4, y: 0.16, z: -43.2 }, pose: "crouch" },
  { id: "maintenance-counter", label: "behind the maintenance counter", position: { x: 44.6, y: 0.16, z: -43.2 }, pose: "crouch" },
  { id: "picnic-table-north", label: "under a picnic table", position: { x: -5.5, y: 0.14, z: -17.5 }, pose: "crouch" },
  { id: "picnic-table-south", label: "under a picnic table", position: { x: 5.5, y: 0.14, z: -17.5 }, pose: "crouch" },
  { id: "canoe-rack-east", label: "inside the east canoe rack", position: { x: 53, y: 0.55, z: -4 }, pose: "sit" },
  { id: "canoe-rack-west", label: "inside the west canoe rack", position: { x: -53, y: 0.55, z: -4 }, pose: "sit" },
  { id: "maintenance-crates", label: "behind the maintenance crates", position: { x: 38.4, y: 0.16, z: -34.4 }, pose: "crouch" },
  { id: "infirmary-crates", label: "behind the infirmary crates", position: { x: -37.6, y: 0.16, z: -34.4 }, pose: "crouch" },
  { id: "north-pines", label: "beneath the north pines", position: { x: -18, y: 0.12, z: 49 }, pose: "hide" },
  { id: "east-pines", label: "beneath the east pines", position: { x: 55, y: 0.12, z: 20 }, pose: "hide" },
  { id: "west-pines", label: "beneath the west pines", position: { x: -55, y: 0.12, z: 20 }, pose: "hide" },
];

export function chooseHidingSpots(count: number, random: () => number = Math.random): HidingSpot[] {
  const pool = [...HIDING_SPOTS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
