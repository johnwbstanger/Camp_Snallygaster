import type { DoorState } from "./protocol.js";
import { CAMP_BUILDINGS, wallRects, type Rect } from "./campVision.js";

export type NavPoint = { x: number; z: number };

const CELL = 0.8;
const HALF = 72;
const SIZE = Math.ceil((HALF * 2) / CELL);
const INFLATE = 0.28;

type DoorLeaf = { doorId: string; cells: number[]; center: NavPoint };

let staticBlocked: Uint8Array | null = null;
let doorLeaves: DoorLeaf[] = [];

function toCell(value: number) { return Math.max(0, Math.min(SIZE - 1, Math.floor((value + HALF) / CELL))); }
function cellCenter(index: number): NavPoint { return { x: (index % SIZE) * CELL - HALF + CELL / 2, z: Math.floor(index / SIZE) * CELL - HALF + CELL / 2 }; }

function paint(grid: Uint8Array | null, rect: Rect) {
  const cells: number[] = [];
  for (let cz = toCell(rect.minZ - INFLATE) - 1; cz <= toCell(rect.maxZ + INFLATE) + 1; cz += 1) {
    for (let cx = toCell(rect.minX - INFLATE) - 1; cx <= toCell(rect.maxX + INFLATE) + 1; cx += 1) {
      if (cx < 0 || cz < 0 || cx >= SIZE || cz >= SIZE) continue;
      const index = cz * SIZE + cx;
      const center = cellCenter(index);
      if (center.x < rect.minX - INFLATE || center.x > rect.maxX + INFLATE || center.z < rect.minZ - INFLATE || center.z > rect.maxZ + INFLATE) continue;
      if (grid) grid[index] = 1;
      cells.push(index);
    }
  }
  return cells;
}

function ensureGrid() {
  if (staticBlocked) return staticBlocked;
  const grid = new Uint8Array(SIZE * SIZE);
  doorLeaves = [];
  for (const building of CAMP_BUILDINGS) {
    for (const rect of wallRects(building, true)) paint(grid, rect);
    const closed = wallRects(building, false);
    const leaf = closed[closed.length - 1];
    const cells = paint(null, leaf).filter((index) => !grid[index]);
    doorLeaves.push({ doorId: building.doorId, cells, center: { x: building.x, z: building.z + building.depth / 2 } });
  }
  staticBlocked = grid;
  return grid;
}

export function doorPosition(doorId: string): NavPoint | null {
  ensureGrid();
  return doorLeaves.find((leaf) => leaf.doorId === doorId)?.center ?? null;
}

export function closedDoorsNear(point: NavPoint, radius: number, doors: readonly DoorState[]) {
  ensureGrid();
  const open = new Map(doors.map((door) => [door.id, door.open]));
  return doorLeaves.filter((leaf) => !open.get(leaf.doorId) && Math.hypot(leaf.center.x - point.x, leaf.center.z - point.z) <= radius).map((leaf) => leaf.doorId);
}

/** Grid A* around camp buildings. Closed doors block unless `canOpenDoors`. Returns waypoints or null. */
export function findPath(from: NavPoint, to: NavPoint, doors: readonly DoorState[], canOpenDoors: boolean): NavPoint[] | null {
  const base = ensureGrid();
  const blocked = new Uint8Array(base);
  const open = new Map(doors.map((door) => [door.id, door.open]));
  const doorCost = new Map<number, number>();
  for (const leaf of doorLeaves) {
    if (open.get(leaf.doorId)) continue;
    for (const index of leaf.cells) {
      if (canOpenDoors) doorCost.set(index, 5); else blocked[index] = 1;
    }
  }

  const start = toCell(from.z) * SIZE + toCell(from.x);
  let goal = toCell(to.z) * SIZE + toCell(to.x);
  blocked[start] = 0;
  if (blocked[goal]) goal = nearestFree(blocked, goal) ?? goal;
  if (blocked[goal]) return null;

  const g = new Float32Array(SIZE * SIZE).fill(Infinity);
  const parent = new Int32Array(SIZE * SIZE).fill(-1);
  const closed = new Uint8Array(SIZE * SIZE);
  const heap: Array<[number, number]> = [];
  const push = (f: number, i: number) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const gx = goal % SIZE, gz = Math.floor(goal / SIZE);
  const h = (i: number) => Math.hypot((i % SIZE) - gx, Math.floor(i / SIZE) - gz);
  g[start] = 0;
  push(h(start), start);
  let expanded = 0;
  let bestCell = start;
  let bestH = h(start);
  while (heap.length && expanded < 40000) {
    const [, current] = pop();
    if (closed[current]) continue;
    closed[current] = 1;
    expanded += 1;
    if (current === goal) { bestCell = goal; break; }
    const hc = h(current);
    if (hc < bestH) { bestH = hc; bestCell = current; }
    const cx = current % SIZE, cz = Math.floor(current / SIZE);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE) continue;
        const next = nz * SIZE + nx;
        if (blocked[next] || closed[next]) continue;
        if (dx && dz && (blocked[cz * SIZE + nx] || blocked[nz * SIZE + cx])) continue;
        const cost = g[current] + (dx && dz ? 1.414 : 1) + (doorCost.get(next) ?? 0);
        if (cost < g[next]) { g[next] = cost; parent[next] = current; push(cost + h(next), next); }
      }
    }
  }
  const reached = parent[goal] !== -1 || goal === start;
  const endCell = reached ? goal : bestCell;
  if (!reached && bestCell === start) return null;
  const cells: number[] = [];
  for (let c = endCell; c !== -1; c = parent[c]) cells.push(c);
  cells.reverse();
  const points = cells.map(cellCenter);
  const simplified: NavPoint[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i > 0 && i < points.length - 1) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      if (Math.abs((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) < 1e-6) continue;
    }
    simplified.push(points[i]);
  }
  if (simplified.length && reached) simplified[simplified.length - 1] = { x: to.x, z: to.z };
  return simplified.slice(1);
}

function nearestFree(blocked: Uint8Array, index: number) {
  const cx = index % SIZE, cz = Math.floor(index / SIZE);
  for (let r = 1; r < 8; r += 1) {
    for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= SIZE || nz >= SIZE) continue;
      if (!blocked[nz * SIZE + nx]) return nz * SIZE + nx;
    }
  }
  return null;
}
