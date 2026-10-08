import type { DoorState } from "./protocol.js";

export type SightPoint = { x: number; z: number };

type BuildingSightSpec = {
  doorId: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  doorWidth: number;
};

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

export const MONSTER_HOME = { x: -32, y: 0, z: -29 } as const;

export const CAMP_BUILDINGS: readonly BuildingSightSpec[] = [
  { doorId: "door:dining", x: 0, z: -28, width: 21, depth: 11, doorWidth: 2.0 },
  { doorId: "door:cabin-a", x: -23, z: 3, width: 10, depth: 7.5, doorWidth: 1.72 },
  { doorId: "door:cabin-b", x: 23, z: 3, width: 10, depth: 7.5, doorWidth: 1.72 },
  { doorId: "door:bath-house", x: -27, z: -23, width: 9, depth: 7, doorWidth: 1.72 },
  { doorId: "door:arts-crafts", x: 27, z: -23, width: 10, depth: 7, doorWidth: 1.72 },
  { doorId: "door:director", x: 0, z: 12, width: 9, depth: 7, doorWidth: 1.72 },
  { doorId: "door:cabin-c", x: -45, z: 13, width: 10, depth: 7.5, doorWidth: 1.72 },
  { doorId: "door:cabin-d", x: 45, z: 13, width: 10, depth: 7.5, doorWidth: 1.72 },
  { doorId: "door:infirmary", x: -43, z: -40, width: 11, depth: 8, doorWidth: 1.72 },
  { doorId: "door:maintenance", x: 43, z: -40, width: 12, depth: 8, doorWidth: 1.72 },
];

const WALL_HALF_THICKNESS = 0.18;

function wallRects(building: BuildingSightSpec, doorOpen: boolean): Rect[] {
  const halfW = building.width / 2;
  const halfD = building.depth / 2;
  const frontSegment = (building.width - building.doorWidth) / 2;
  const frontOffset = building.doorWidth / 2 + frontSegment / 2;
  const frontZ = building.z + halfD;

  const rects: Rect[] = [
    {
      minX: building.x - halfW,
      maxX: building.x + halfW,
      minZ: building.z - halfD - WALL_HALF_THICKNESS,
      maxZ: building.z - halfD + WALL_HALF_THICKNESS,
    },
    {
      minX: building.x - halfW - WALL_HALF_THICKNESS,
      maxX: building.x - halfW + WALL_HALF_THICKNESS,
      minZ: building.z - halfD,
      maxZ: building.z + halfD,
    },
    {
      minX: building.x + halfW - WALL_HALF_THICKNESS,
      maxX: building.x + halfW + WALL_HALF_THICKNESS,
      minZ: building.z - halfD,
      maxZ: building.z + halfD,
    },
    {
      minX: building.x - frontOffset - frontSegment / 2,
      maxX: building.x - frontOffset + frontSegment / 2,
      minZ: frontZ - WALL_HALF_THICKNESS,
      maxZ: frontZ + WALL_HALF_THICKNESS,
    },
    {
      minX: building.x + frontOffset - frontSegment / 2,
      maxX: building.x + frontOffset + frontSegment / 2,
      minZ: frontZ - WALL_HALF_THICKNESS,
      maxZ: frontZ + WALL_HALF_THICKNESS,
    },
  ];

  if (!doorOpen) {
    rects.push({
      minX: building.x - building.doorWidth / 2,
      maxX: building.x + building.doorWidth / 2,
      minZ: frontZ - WALL_HALF_THICKNESS,
      maxZ: frontZ + WALL_HALF_THICKNESS,
    });
  }
  return rects;
}

function segmentIntersectsRect(start: SightPoint, end: SightPoint, rect: Rect) {
  let tMin = 0;
  let tMax = 1;
  const axes: Array<[number, number, number, number]> = [
    [start.x, end.x - start.x, rect.minX, rect.maxX],
    [start.z, end.z - start.z, rect.minZ, rect.maxZ],
  ];

  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
      continue;
    }
    let a = (min - origin) / delta;
    let b = (max - origin) / delta;
    if (a > b) [a, b] = [b, a];
    tMin = Math.max(tMin, a);
    tMax = Math.min(tMax, b);
    if (tMin > tMax) return false;
  }
  return tMax >= 0 && tMin <= 1;
}

export function hasCampLineOfSight(
  start: SightPoint,
  end: SightPoint,
  doors: readonly DoorState[],
) {
  const doorOpen = new Map(doors.map((door) => [door.id, door.open]));
  for (const building of CAMP_BUILDINGS) {
    const open = doorOpen.get(building.doorId) ?? false;
    for (const rect of wallRects(building, open)) {
      if (segmentIntersectsRect(start, end, rect)) return false;
    }
  }
  return true;
}
