import * as CANNON from "cannon-es";

export type HorizontalPoint = { x: number; z: number };

type Rect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label: string;
};

type Cabin = {
  x: number;
  z: number;
  width: number;
  depth: number;
  doorWidth: number;
  label: string;
};

// This is intentionally independent of Cannon's contact solver. Cannon remains
// the physical simulation, while this map is a deterministic anti-tunnelling
// guard for horizontal player movement. The values mirror World.ts and preserve
// the front doorway opening on each building.
const CABINS: Cabin[] = [
  { label: "DINING HALL", x: 0, z: -28, width: 21, depth: 11, doorWidth: 2.0 },
  { label: "CABIN A", x: -23, z: 3, width: 10, depth: 7.5, doorWidth: 1.72 },
  { label: "CABIN B", x: 23, z: 3, width: 10, depth: 7.5, doorWidth: 1.72 },
  { label: "BATH HOUSE", x: -27, z: -23, width: 9, depth: 7, doorWidth: 1.72 },
  { label: "ARTS & CRAFTS", x: 27, z: -23, width: 10, depth: 7, doorWidth: 1.72 },
  { label: "DIRECTOR", x: 0, z: 12, width: 9, depth: 7, doorWidth: 1.72 },
  { label: "CABIN C", x: -45, z: 13, width: 10, depth: 7.5, doorWidth: 1.72 },
  { label: "CABIN D", x: 45, z: 13, width: 10, depth: 7.5, doorWidth: 1.72 },
  { label: "INFIRMARY", x: -43, z: -40, width: 11, depth: 8, doorWidth: 1.72 },
  { label: "MAINTENANCE", x: 43, z: -40, width: 12, depth: 8, doorWidth: 1.72 },
];

const WALL_HALF_THICKNESS = 0.31;
const EPSILON = 0.012;
const DEFAULT_PLAYER_RADIUS = 0.38;

function buildCabinRects(cabin: Cabin): Rect[] {
  const { x, z, width, depth, doorWidth, label } = cabin;
  const halfW = width / 2;
  const halfD = depth / 2;
  const frontSegment = (width - doorWidth) / 2;
  const frontOffset = doorWidth / 2 + frontSegment / 2;

  return [
    {
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD - WALL_HALF_THICKNESS,
      maxZ: z - halfD + WALL_HALF_THICKNESS,
      label: `${label}:back`,
    },
    {
      minX: x - halfW - WALL_HALF_THICKNESS,
      maxX: x - halfW + WALL_HALF_THICKNESS,
      minZ: z - halfD,
      maxZ: z + halfD,
      label: `${label}:left`,
    },
    {
      minX: x + halfW - WALL_HALF_THICKNESS,
      maxX: x + halfW + WALL_HALF_THICKNESS,
      minZ: z - halfD,
      maxZ: z + halfD,
      label: `${label}:right`,
    },
    {
      minX: x - frontOffset - frontSegment / 2,
      maxX: x - frontOffset + frontSegment / 2,
      minZ: z + halfD - WALL_HALF_THICKNESS,
      maxZ: z + halfD + WALL_HALF_THICKNESS,
      label: `${label}:front-left`,
    },
    {
      minX: x + frontOffset - frontSegment / 2,
      maxX: x + frontOffset + frontSegment / 2,
      minZ: z + halfD - WALL_HALF_THICKNESS,
      maxZ: z + halfD + WALL_HALF_THICKNESS,
      label: `${label}:front-right`,
    },
  ];
}

const STATIC_RECTS: Rect[] = [
  ...CABINS.flatMap(buildCabinRects),
  { minX: -4.35, maxX: 4.55, minZ: 29.4, maxZ: 32.6, label: "bus" },
  { minX: -39.0, maxX: -36.0, minZ: -36.9, maxZ: -35.0, label: "crate-west" },
  { minX: 37.0, maxX: 40.0, minZ: -36.9, maxZ: -35.0, label: "crate-east" },
  { minX: 27.0, maxX: 30.0, minZ: -28.9, maxZ: -27.0, label: "crate-maint" },
  { minX: 51.8, maxX: 54.2, minZ: -6.7, maxZ: -1.3, label: "canoe-east" },
  { minX: -54.2, maxX: -51.8, minZ: -6.7, maxZ: -1.3, label: "canoe-west" },
];

function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

export function resolveCampHorizontalMovement(
  start: HorizontalPoint,
  end: HorizontalPoint,
  radius: number,
): HorizontalPoint {
  let x = end.x;
  let z = start.z;
  const dx = end.x - start.x;

  if (Math.abs(dx) > 1e-8) {
    for (const rect of STATIC_RECTS) {
      const minX = rect.minX - radius;
      const maxX = rect.maxX + radius;
      const minZ = rect.minZ - radius;
      const maxZ = rect.maxZ + radius;
      if (!inRange(z, minZ, maxZ)) continue;

      if (dx > 0 && start.x <= minX && end.x > minX) {
        x = Math.min(x, minX - EPSILON);
      } else if (dx < 0 && start.x >= maxX && end.x < maxX) {
        x = Math.max(x, maxX + EPSILON);
      }
    }
  }

  z = end.z;
  const dz = end.z - start.z;
  if (Math.abs(dz) > 1e-8) {
    for (const rect of STATIC_RECTS) {
      const minX = rect.minX - radius;
      const maxX = rect.maxX + radius;
      const minZ = rect.minZ - radius;
      const maxZ = rect.maxZ + radius;
      if (!inRange(x, minX, maxX)) continue;

      if (dz > 0 && start.z <= minZ && end.z > minZ) {
        z = Math.min(z, minZ - EPSILON);
      } else if (dz < 0 && start.z >= maxZ && end.z < maxZ) {
        z = Math.max(z, maxZ + EPSILON);
      }
    }
  }

  return { x, z };
}

/**
 * Installs a second collision authority on the Cannon world. The player is
 * identified by the explicit "player" material already assigned by Game.ts.
 * This runs after every physics step and clips any swept horizontal crossing
 * against camp solids. It is deliberately defensive: Cannon still handles
 * contacts, slopes, props and gravity, while this catches high-speed tunnelling.
 */
export function installCampCollisionGuard(
  physics: CANNON.World,
  radius = DEFAULT_PLAYER_RADIUS,
) {
  let previous: HorizontalPoint | null = null;

  physics.addEventListener("postStep", () => {
    const player = physics.bodies.find((body) => body.material?.name === "player");
    if (!player) return;

    const current = { x: player.position.x, z: player.position.z };
    if (!previous) {
      previous = current;
      return;
    }

    const resolved = resolveCampHorizontalMovement(previous, current, radius);
    const correctedX = Math.abs(resolved.x - current.x) > 1e-7;
    const correctedZ = Math.abs(resolved.z - current.z) > 1e-7;

    if (correctedX) {
      player.position.x = resolved.x;
      player.velocity.x = 0;
    }
    if (correctedZ) {
      player.position.z = resolved.z;
      player.velocity.z = 0;
    }

    previous = { x: player.position.x, z: player.position.z };
  });
}

export function campCollisionRectCount() {
  return STATIC_RECTS.length;
}
