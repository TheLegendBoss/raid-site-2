// Floor generation: a bunker floor is a tile map of rooms joined by corridors, built from a seed.
// Rooms sit one per cell of a coarse grid, joined by a random backbone from the lift to the exit
// plus side branches and a few loops. Each room gets a shape (cover, chokepoints, hazards), then its
// enemies are placed asleep. Pure TypeScript: nothing here draws or touches the scene.
import { MOBS, type MobKind } from '../data/mobs';
import { TUNING as T } from '../data/tuning';
import { Grid } from './grid';
import { Rng } from './math';
import { composeBudget } from './waves';

export type RoomKind = 'start' | 'combat' | 'cache' | 'exit' | 'boss';
export type Template = 'open' | 'pillars' | 'crates' | 'split' | 'ring' | 'aisles' | 'acid' | 'sanctum';

export interface DRoom {
  id: number;
  /** Rectangle in tiles. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: RoomKind;
  template: Template;
  links: number[];
  /** Rooms away from the lift. */
  dist: number;
  /** Where corridors meet the room, in px. */
  doors: { x: number; y: number }[];
  /** Centre in px. */
  cx: number;
  cy: number;
}

export interface Spawn {
  kind: MobKind;
  x: number;
  y: number;
  room: number;
  group: number;
}

export interface Prop {
  type: 'barrel' | 'acid';
  /** px rectangle; a barrel is centred on x, y with w = h = its diameter. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Floor {
  seed: number;
  grid: Grid;
  rooms: DRoom[];
  start: { x: number; y: number };
  exit: { x: number; y: number };
  boss: { x: number; y: number } | null;
  spawns: Spawn[];
  props: Prop[];
  caches: { x: number; y: number; room: number }[];
}

export interface FloorParams {
  seed: number;
  /** Run depth of this floor's first room. */
  depth: number;
  final: boolean;
  rooms: readonly [number, number];
  budgetMul: number;
  bias: Partial<Record<MobKind, number>>;
}

interface Cell {
  c: number;
  r: number;
}

export function generateFloor(p: FloorParams): Floor {
  for (let attempt = 0; attempt < 30; attempt++) {
    const f = tryGenerate(p, new Rng((p.seed + attempt * 7919) >>> 0));
    if (f) return f;
  }
  throw new Error('floor generation failed');
}

function tryGenerate(p: FloorParams, rng: Rng): Floor | null {
  const D = T.dungeon;
  const grid = new Grid(D.cols, D.rows, D.tile);
  const cw = Math.floor(D.cols / D.cellCols);
  const ch = Math.floor(D.rows / D.cellRows);
  const key = (c: Cell): number => c.r * D.cellCols + c.c;

  // ---- which cells hold rooms: a backbone from the lift (left) to the exit (right), then branches
  const startCell: Cell = { c: 0, r: rng.int(0, D.cellRows - 1) };
  const exitCell: Cell = { c: D.cellCols - 1, r: rng.int(0, D.cellRows - 1) };
  const path: Cell[] = [startCell];
  const used = new Set<number>([key(startCell)]);
  let cur = startCell;
  while (cur.c !== exitCell.c || cur.r !== exitCell.r) {
    const opts: { cell: Cell; w: number }[] = [];
    if (cur.c < exitCell.c) opts.push({ cell: { c: cur.c + 1, r: cur.r }, w: 4 });
    for (const dr of [-1, 1]) {
      const n = { c: cur.c, r: cur.r + dr };
      if (n.r < 0 || n.r >= D.cellRows || used.has(key(n))) continue;
      if (cur.c === exitCell.c && Math.sign(exitCell.r - cur.r) !== dr) continue; // last column: only toward the exit
      opts.push({ cell: n, w: 0.5 });
    }
    if (opts.length === 0) return null;
    let roll = rng.next() * opts.reduce((a, o) => a + o.w, 0);
    let pick = opts[opts.length - 1].cell;
    for (const o of opts) {
      roll -= o.w;
      if (roll <= 0) {
        pick = o.cell;
        break;
      }
    }
    path.push(pick);
    used.add(key(pick));
    cur = pick;
  }
  const edges: [Cell, Cell][] = [];
  for (let i = 1; i < path.length; i++) edges.push([path[i - 1], path[i]]);
  const chosen = [...path];
  const want = Math.min(D.cellCols * D.cellRows, Math.max(path.length, rng.int(p.rooms[0], p.rooms[1])));
  const nbrs = (c: Cell): Cell[] =>
    [{ c: c.c + 1, r: c.r }, { c: c.c - 1, r: c.r }, { c: c.c, r: c.r + 1 }, { c: c.c, r: c.r - 1 }]
      .filter((n) => n.c >= 0 && n.r >= 0 && n.c < D.cellCols && n.r < D.cellRows);
  while (chosen.length < want) {
    const open: [Cell, Cell][] = [];
    for (const c of chosen) for (const n of nbrs(c)) if (!used.has(key(n))) open.push([c, n]);
    if (open.length === 0) break;
    const [from, to] = rng.pick(open);
    chosen.push(to);
    used.add(key(to));
    edges.push([from, to]);
  }
  // Loops: extra corridors between chosen neighbours that are not joined yet.
  const edgeKey = (a: Cell, b: Cell): string => `${Math.min(key(a), key(b))}:${Math.max(key(a), key(b))}`;
  const joined = new Set(edges.map(([a, b]) => edgeKey(a, b)));
  const loopCands: [Cell, Cell][] = [];
  for (const a of chosen) for (const b of nbrs(a)) if (used.has(key(b)) && key(a) < key(b) && !joined.has(edgeKey(a, b))) loopCands.push([a, b]);
  rng.shuffle(loopCands);
  for (const e of loopCands.slice(0, D.extraLoops)) edges.push(e);

  // ---- rooms
  const rooms: DRoom[] = [];
  const roomAt = new Map<number, DRoom>();
  for (const cell of chosen) {
    const isStart = key(cell) === key(startCell);
    const isExit = key(cell) === key(exitCell);
    let w: number;
    let h: number;
    if (isStart) {
      w = rng.int(9, 11);
      h = rng.int(8, 10);
    } else if (isExit && p.final) {
      w = cw - 4;
      h = ch - 4;
    } else {
      w = rng.int(9, cw - 4);
      h = rng.int(8, ch - 4);
    }
    const x = cell.c * cw + 2 + rng.int(0, cw - 4 - w);
    const y = cell.r * ch + 2 + rng.int(0, ch - 4 - h);
    const room: DRoom = {
      id: rooms.length, x, y, w, h,
      kind: isStart ? 'start' : isExit ? (p.final ? 'boss' : 'exit') : 'combat',
      template: 'open', links: [], dist: 0, doors: [],
      cx: (x + w / 2) * D.tile, cy: (y + h / 2) * D.tile,
    };
    rooms.push(room);
    roomAt.set(key(cell), room);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid.set(xx, yy, false);
  }
  const carve = (x0: number, y0: number, x1: number, y1: number): void => {
    for (let yy = Math.min(y0, y1); yy <= Math.max(y0, y1); yy++) {
      for (let xx = Math.min(x0, x1); xx <= Math.max(x0, x1); xx++) grid.set(xx, yy, false);
    }
  };
  const half = Math.floor(D.corridor / 2);
  for (const [a, b] of edges) {
    const ra = roomAt.get(key(a))!;
    const rb = roomAt.get(key(b))!;
    ra.links.push(rb.id);
    rb.links.push(ra.id);
    const ax = ra.x + Math.floor(ra.w / 2);
    const ay = ra.y + Math.floor(ra.h / 2);
    const bx = rb.x + Math.floor(rb.w / 2);
    const by = rb.y + Math.floor(rb.h / 2);
    if (rng.chance(0.5)) {
      carve(ax, ay - half, bx, ay + half);
      carve(bx - half, ay, bx + half, by);
    } else {
      carve(ax - half, ay, ax + half, by);
      carve(ax, by - half, bx, by + half);
    }
  }

  // ---- distances, roles
  const start = rooms.find((r) => r.kind === 'start')!;
  const queue = [start];
  const seen = new Set<number>([start.id]);
  while (queue.length) {
    const r = queue.shift()!;
    for (const id of r.links) {
      if (seen.has(id)) continue;
      seen.add(id);
      rooms[id].dist = r.dist + 1;
      queue.push(rooms[id]);
    }
  }
  if (seen.size !== rooms.length) return null;
  for (const r of rooms) if (r.kind === 'combat' && r.links.length === 1) r.kind = 'cache';

  // ---- doors: where a corridor meets a room's edge
  for (const r of rooms) r.doors = findDoors(grid, r);

  // ---- shapes and props
  const props: Prop[] = [];
  for (const r of rooms) {
    r.template = shapeRoom(grid, r, rng, props);
    if (r.kind !== 'start') scatterBarrels(grid, r, rng, props);
  }

  // ---- pads and the boss
  const exitRoom = rooms.find((r) => r.kind === 'exit' || r.kind === 'boss')!;
  const padOf = (r: DRoom, atEnd: boolean): { x: number; y: number } =>
    atEnd ? { x: (r.x + r.w - 3.5) * D.tile, y: r.cy } : { x: r.cx, y: r.cy };
  const startPad = { x: (start.x + 2.5) * D.tile, y: start.cy };
  const exitPad = padOf(exitRoom, exitRoom.kind === 'boss');
  const boss = exitRoom.kind === 'boss' ? { x: exitRoom.cx - 2 * D.tile, y: exitRoom.cy } : null;

  // Everything must still connect after the templates have had their say.
  const reach = floodFrom(grid, grid.col(startPad.x), grid.row(startPad.y));
  for (const r of rooms) {
    if (!reach.has(grid.row(r.cy) * grid.cols + grid.col(r.cx)) && !reach.has(grid.row(r.cy) * grid.cols + grid.col(r.cx) + 1)) {
      // The room centre may be a pillar: any reachable tile of the room will do.
      let ok = false;
      for (let yy = r.y; yy < r.y + r.h && !ok; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (reach.has(yy * grid.cols + xx)) { ok = true; break; }
      if (!ok) return null;
    }
  }
  if (!reach.has(grid.row(exitPad.y) * grid.cols + grid.col(exitPad.x))) return null;

  // ---- enemies, asleep
  const spawns: Spawn[] = [];
  const caches: { x: number; y: number; room: number }[] = [];
  let group = 0;
  for (const r of rooms) {
    if (r.kind === 'start') continue;
    const open = openTiles(grid, r, props, reach).filter((t) => Math.hypot(grid.cx(t.c) - startPad.x, grid.cy(t.r) - startPad.y) > 7 * D.tile);
    if (open.length === 0) continue;
    const roomDepth = p.depth + Math.floor(r.dist / 2);
    const area = open.length;
    const areaFactor = Math.min(D.areaMax, Math.max(D.areaMin, area / D.areaTiles));
    let budget = (D.budgetBase + D.budgetPerDepth * roomDepth) * areaFactor * D.overfill * p.budgetMul;
    if (r.kind === 'cache') budget *= D.cacheBonus;
    if (r.kind === 'boss') budget *= 0.5;
    const entries = composeBudget(Math.round(budget), roomDepth, p.bias, rng);
    // Prefer tiles with elbow room so a pack is not born inside a wall seam.
    const roomy = open.filter((t) => [-1, 0, 1].every((dr) => [-1, 0, 1].every((dc) => !grid.isSolid(t.c + dc, t.r + dr))));
    const pool = roomy.length >= 6 ? roomy : open;
    for (const e of entries) {
      const size = e.kind === 'scav' ? rng.int(4, 7) : rng.int(1, 2);
      let left = e.count;
      while (left > 0) {
        const n = Math.min(left, size);
        const anchor = rng.pick(pool);
        const ax = grid.cx(anchor.c);
        const ay = grid.cy(anchor.r);
        for (let i = 0; i < n; i++) {
          let x = ax;
          let y = ay;
          for (let tries = 0; tries < 8; tries++) {
            const a = rng.range(0, Math.PI * 2);
            const d = rng.range(0, 24 + n * 9);
            const tx = ax + Math.cos(a) * d;
            const ty = ay + Math.sin(a) * d;
            if (!grid.solidAt(tx - 16, ty - 16) && !grid.solidAt(tx + 16, ty - 16) && !grid.solidAt(tx - 16, ty + 16) && !grid.solidAt(tx + 16, ty + 16)) {
              x = tx;
              y = ty;
              break;
            }
          }
          spawns.push({ kind: e.kind, x, y, room: r.id, group });
        }
        group++;
        left -= n;
      }
    }
    if (r.kind === 'cache') {
      const t = rng.pick(pool);
      caches.push({ x: grid.cx(t.c), y: grid.cy(t.r), room: r.id });
    }
  }
  // A floor never starts with more than the cap: trim scavengers (the cheap swarm) from the back.
  for (let i = spawns.length - 1; i >= 0 && spawns.length > D.mobCap; i--) {
    if (spawns[i].kind === 'scav') spawns.splice(i, 1);
  }
  if (boss) spawns.push({ kind: 'warden', x: boss.x, y: boss.y, room: exitRoom.id, group: group++ });

  return { seed: p.seed, grid, rooms, start: startPad, exit: exitPad, boss, spawns, props, caches };
}

// ---------------------------------------------------------------------------------------------------

function findDoors(grid: Grid, r: DRoom): { x: number; y: number }[] {
  const t = grid.tile;
  const out: { x: number; y: number }[] = [];
  const run = (cells: { c: number; r: number }[], inside: { dc: number; dr: number }): void => {
    let cur: { c: number; r: number }[] = [];
    const flush = (): void => {
      if (cur.length === 0) return;
      const mid = cur[Math.floor(cur.length / 2)];
      out.push({ x: (mid.c + 0.5 - inside.dc * 0.0) * t, y: (mid.r + 0.5) * t });
      cur = [];
    };
    for (const c of cells) {
      if (!grid.isSolid(c.c, c.r)) cur.push(c);
      else flush();
    }
    flush();
  };
  const top: { c: number; r: number }[] = [];
  const bottom: { c: number; r: number }[] = [];
  for (let x = r.x; x < r.x + r.w; x++) {
    top.push({ c: x, r: r.y - 1 });
    bottom.push({ c: x, r: r.y + r.h });
  }
  const left: { c: number; r: number }[] = [];
  const right: { c: number; r: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++) {
    left.push({ c: r.x - 1, r: y });
    right.push({ c: r.x + r.w, r: y });
  }
  run(top, { dc: 0, dr: 1 });
  run(bottom, { dc: 0, dr: -1 });
  run(left, { dc: 1, dr: 0 });
  run(right, { dc: -1, dr: 0 });
  return out;
}

/** The room tile just inside a door. */
function insideOf(grid: Grid, r: DRoom, d: { x: number; y: number }): { c: number; r: number } {
  const c = Math.min(r.x + r.w - 1, Math.max(r.x, grid.col(d.x)));
  const rr = Math.min(r.y + r.h - 1, Math.max(r.y, grid.row(d.y)));
  return { c, r: rr };
}

/** Tiles obstacles must stay off: the approach to every door. */
function keepClear(grid: Grid, r: DRoom, extra: { c: number; r: number; rad: number }[] = []): Set<number> {
  const keep = new Set<number>();
  const mark = (c0: number, r0: number, rad: number): void => {
    for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) keep.add((r0 + dr) * grid.cols + (c0 + dc));
  };
  for (const d of r.doors) {
    const i = insideOf(grid, r, d);
    mark(i.c, i.r, 2);
  }
  for (const e of extra) mark(e.c, e.r, e.rad);
  return keep;
}

type Snap = { idx: number; v: number }[];
const snapshot = (grid: Grid, r: DRoom): Snap => {
  const out: Snap = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) out.push({ idx: y * grid.cols + x, v: grid.solid[y * grid.cols + x] });
  return out;
};
const restore = (grid: Grid, s: Snap): void => {
  for (const e of s) grid.solid[e.idx] = e.v;
};

/** Every open tile of the room can be reached from every other (no sealed pockets, no blocked doors). */
function roomConnected(grid: Grid, r: DRoom): boolean {
  let first = -1;
  let total = 0;
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (grid.isSolid(x, y)) continue;
      total++;
      if (first < 0) first = y * grid.cols + x;
    }
  }
  if (first < 0) return false;
  const seen = new Set<number>([first]);
  const stack = [first];
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % grid.cols;
    const rr = (i - c) / grid.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = rr + dr;
      if (nc < r.x || nr < r.y || nc >= r.x + r.w || nr >= r.y + r.h || grid.isSolid(nc, nr)) continue;
      const ni = nr * grid.cols + nc;
      if (seen.has(ni)) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  if (seen.size !== total) return false;
  // And every door still opens onto the room.
  return r.doors.every((d) => {
    const i = insideOf(grid, r, d);
    return seen.has(i.r * grid.cols + i.c);
  });
}

function floodFrom(grid: Grid, c0: number, r0: number): Set<number> {
  const seen = new Set<number>();
  if (grid.isSolid(c0, r0)) return seen;
  const stack = [r0 * grid.cols + c0];
  seen.add(stack[0]);
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % grid.cols;
    const r = (i - c) / grid.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (grid.isSolid(c + dc, r + dr)) continue;
      const ni = (r + dr) * grid.cols + (c + dc);
      if (seen.has(ni)) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  return seen;
}

function openTiles(grid: Grid, r: DRoom, props: Prop[], reach: Set<number>): { c: number; r: number }[] {
  const t = grid.tile;
  const out: { c: number; r: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (grid.isSolid(x, y) || !reach.has(y * grid.cols + x)) continue;
      const px = (x + 0.5) * t;
      const py = (y + 0.5) * t;
      if (props.some((q) => q.type === 'acid' && px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.h)) continue;
      out.push({ c: x, r: y });
    }
  }
  return out;
}

const WEIGHTS: Record<Template, number> = { open: 0.7, pillars: 3, crates: 3, split: 2, ring: 2, aisles: 2, acid: 2.6, sanctum: 0 };

function shapeRoom(grid: Grid, r: DRoom, rng: Rng, props: Prop[]): Template {
  const t = grid.tile;
  let template: Template;
  const extra: { c: number; r: number; rad: number }[] = [];
  if (r.kind === 'start') {
    template = rng.chance(0.5) ? 'crates' : 'open';
    extra.push({ c: r.x + 2, r: Math.floor(r.y + r.h / 2), rad: 3 });
  } else if (r.kind === 'boss') {
    template = 'sanctum';
    extra.push({ c: Math.floor(r.x + r.w / 2), r: Math.floor(r.y + r.h / 2), rad: 4 }, { c: r.x + r.w - 4, r: Math.floor(r.y + r.h / 2), rad: 3 });
  } else if (r.kind === 'exit') {
    template = rng.pick<Template>(['ring', 'pillars', 'crates']);
    extra.push({ c: r.x + r.w - 4, r: Math.floor(r.y + r.h / 2), rad: 3 });
  } else if (r.kind === 'cache') {
    template = rng.pick<Template>(['crates', 'aisles', 'pillars']);
  } else {
    const fits = (k: Template): boolean => {
      if (k === 'split') return r.w >= 11 || r.h >= 10;
      if (k === 'ring') return r.w >= 12 && r.h >= 10;
      if (k === 'aisles') return r.w >= 13 || r.h >= 12;
      if (k === 'acid') return r.w >= 9 && r.h >= 8;
      return true;
    };
    const opts = (Object.keys(WEIGHTS) as Template[]).filter((k) => WEIGHTS[k] > 0 && fits(k));
    let roll = rng.next() * opts.reduce((a, k) => a + WEIGHTS[k], 0);
    template = opts[opts.length - 1];
    for (const k of opts) {
      roll -= WEIGHTS[k];
      if (roll <= 0) {
        template = k;
        break;
      }
    }
  }
  const keep = keepClear(grid, r, extra);
  const free = (c: number, rr: number): boolean => c >= r.x + 2 && rr >= r.y + 2 && c < r.x + r.w - 2 && rr < r.y + r.h - 2 && !keep.has(rr * grid.cols + c);
  const block = (c: number, rr: number, w: number, h: number): void => {
    for (let y = rr; y < rr + h; y++) for (let x = c; x < c + w; x++) if (free(x, y)) grid.set(x, y, true);
  };
  const snap = snapshot(grid, r);
  const propMark = props.length;
  const horizontal = r.w >= r.h;

  switch (template) {
    case 'pillars':
      for (let y = r.y + 2; y < r.y + r.h - 3; y += 4) for (let x = r.x + 2; x < r.x + r.w - 3; x += 4) block(x, y, 2, 2);
      break;
    case 'crates': {
      const n = Math.max(2, Math.round((r.w * r.h) / 26));
      for (let i = 0; i < n; i++) {
        const w = rng.chance(0.4) ? 2 : 1;
        const h = w === 2 ? 1 : rng.chance(0.4) ? 2 : 1;
        block(r.x + 2 + rng.int(0, r.w - 5), r.y + 2 + rng.int(0, r.h - 5), w, h);
      }
      break;
    }
    case 'split': {
      if (horizontal) {
        const x = r.x + Math.floor(r.w / 2);
        const gaps = [r.y + 2 + rng.int(0, Math.max(0, r.h - 7)), 0];
        gaps[1] = Math.min(r.y + r.h - 4, gaps[0] + Math.floor(r.h / 2));
        for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
          if (gaps.some((g) => y >= g && y < g + 3)) continue;
          for (let k = 0; k < 2; k++) if (!keep.has(y * grid.cols + x + k)) grid.set(x + k, y, true);
        }
      } else {
        const y = r.y + Math.floor(r.h / 2);
        const gaps = [r.x + 2 + rng.int(0, Math.max(0, r.w - 7)), 0];
        gaps[1] = Math.min(r.x + r.w - 4, gaps[0] + Math.floor(r.w / 2));
        for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
          if (gaps.some((g) => x >= g && x < g + 3)) continue;
          for (let k = 0; k < 2; k++) if (!keep.has((y + k) * grid.cols + x)) grid.set(x, y + k, true);
        }
      }
      break;
    }
    case 'ring': {
      const bw = Math.max(3, Math.floor(r.w / 3));
      const bh = Math.max(3, Math.floor(r.h / 3));
      block(r.x + Math.floor((r.w - bw) / 2), r.y + Math.floor((r.h - bh) / 2), bw, bh);
      break;
    }
    case 'aisles': {
      if (horizontal) {
        let flip = false;
        for (let x = r.x + 3; x < r.x + r.w - 3; x += 4) {
          const gapAt = flip ? r.y + r.h - 6 : r.y + 3;
          for (let y = r.y + 2; y < r.y + r.h - 2; y++) if (!(y >= gapAt && y < gapAt + 3)) block(x, y, 1, 1);
          flip = !flip;
        }
      } else {
        let flip = false;
        for (let y = r.y + 3; y < r.y + r.h - 3; y += 4) {
          const gapAt = flip ? r.x + r.w - 6 : r.x + 3;
          for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (!(x >= gapAt && x < gapAt + 3)) block(x, y, 1, 1);
          flip = !flip;
        }
      }
      break;
    }
    case 'acid': {
      const pw = Math.max(3, Math.floor(r.w * 0.45));
      const ph = Math.max(3, Math.floor(r.h * 0.4));
      const pc = r.x + Math.floor((r.w - pw) / 2);
      const pr = r.y + Math.floor((r.h - ph) / 2);
      props.push({ type: 'acid', x: pc * t, y: pr * t, w: pw * t, h: ph * t });
      // A few crates on the walkway.
      for (let i = 0; i < 3; i++) block(r.x + 2 + rng.int(0, r.w - 5), r.y + 2 + rng.int(0, r.h - 5), 1, 1);
      break;
    }
    case 'sanctum': {
      const cx = r.x + Math.floor(r.w / 2);
      const cy = r.y + Math.floor(r.h / 2);
      for (const [dx, dy] of [[-6, -5], [5, -5], [-6, 4], [5, 4], [-1, -7], [-1, 6]]) block(cx + dx, cy + dy, 2, 2);
      break;
    }
    default:
      break;
  }
  if (!roomConnected(grid, r)) {
    restore(grid, snap);
    props.length = propMark;
    // The shape did not hold up: fall back to a few crates, which never block a room.
    for (let i = 0; i < 3; i++) {
      const c = r.x + 2 + rng.int(0, r.w - 5);
      const rr = r.y + 2 + rng.int(0, r.h - 5);
      if (free(c, rr)) grid.set(c, rr, true);
    }
    if (!roomConnected(grid, r)) {
      restore(grid, snap);
      return 'open';
    }
    return 'crates';
  }
  return template;
}

function scatterBarrels(grid: Grid, r: DRoom, rng: Rng, props: Prop[]): void {
  const t = grid.tile;
  if (r.kind === 'boss') return;
  const n = rng.int(0, r.w * r.h > 150 ? 4 : 2);
  const keep = keepClear(grid, r);
  const cands: { c: number; r: number }[] = [];
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
      if (grid.isSolid(x, y) || keep.has(y * grid.cols + x)) continue;
      // Against a wall or a block, like something left there.
      if (!(grid.isSolid(x - 1, y) || grid.isSolid(x + 1, y) || grid.isSolid(x, y - 1) || grid.isSolid(x, y + 1))) continue;
      const px = (x + 0.5) * t;
      const py = (y + 0.5) * t;
      if (props.some((q) => q.type === 'acid' && px > q.x - t && px < q.x + q.w + t && py > q.y - t && py < q.y + q.h + t)) continue;
      cands.push({ c: x, r: y });
    }
  }
  rng.shuffle(cands);
  for (const c of cands) {
    if (props.filter((q) => q.type === 'barrel' && Math.hypot(q.x - (c.c + 0.5) * t, q.y - (c.r + 0.5) * t) < 3 * t).length > 0) continue;
    if (n === 0 || props.filter((q) => q.type === 'barrel' && Math.abs(q.x - r.cx) < (r.w * t) / 2 && Math.abs(q.y - r.cy) < (r.h * t) / 2).length >= n) break;
    props.push({ type: 'barrel', x: (c.c + 0.5) * t, y: (c.r + 0.5) * t, w: 26, h: 26 });
  }
}

export const MOB_COST = (k: MobKind): number => MOBS[k].cost;
