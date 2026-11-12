// Arena bounds and the room layouts: pillars, the pipes enemies pour out of, the entry and exit pads.
import type { Rect } from '../sim/math';
import { TUNING as T } from './tuning';

export const W = T.world.w;
export const H = T.world.h;
export const WALL = T.world.wall;
export const X0 = WALL;
export const Y0 = WALL;
export const X1 = W - WALL;
export const Y1 = H - WALL;

export type LayoutId = 'crossroads' | 'colonnade' | 'catwalk' | 'reactor' | 'sanctum';

export interface Pipe {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export interface PadDef {
  id: 'entry' | 'exit';
  x: number;
  y: number;
  label: string;
}

/** One room shape: where the cover is, where enemies come from, where the pads are. */
export interface Layout {
  id: LayoutId;
  name: string;
  pillars: Rect[];
  pipes: Pipe[];
  entry: { x: number; y: number };
  exit: { x: number; y: number };
  /** Where a boss walks in. */
  boss: { x: number; y: number };
  /** The sewer channel across the middle (crossroads only). */
  channel: boolean;
}

const left = (y: number): Pipe => ({ x: X0, y, dx: 1, dy: 0 });
const right = (y: number): Pipe => ({ x: X1, y, dx: -1, dy: 0 });
const top = (x: number): Pipe => ({ x, y: Y0, dx: 0, dy: 1 });
const bottom = (x: number): Pipe => ({ x, y: Y1, dx: 0, dy: -1 });
const pillar = (x: number, y: number, w = 90, h = 90): Rect => ({ x, y, w, h });

export const LAYOUTS: Record<LayoutId, Layout> = {
  crossroads: {
    id: 'crossroads', name: 'Crossroads', channel: true,
    pillars: [pillar(520, 320, 110, 110), pillar(1370, 320, 110, 110), pillar(520, 870, 110, 110), pillar(1370, 870, 110, 110),
      pillar(900, 520, 200, 34), pillar(900, 746, 200, 34)],
    pipes: [left(330), left(970), right(650), top(1000), bottom(1000)],
    entry: { x: X0 + 330, y: Y0 + 330 }, exit: { x: X1 - 330, y: Y1 - 330 }, boss: { x: 1000, y: 650 },
  },
  colonnade: {
    id: 'colonnade', name: 'Colonnade', channel: false,
    pillars: [pillar(560, 330), pillar(955, 330), pillar(1360, 330), pillar(560, 880), pillar(955, 880), pillar(1360, 880),
      pillar(940, 590, 120, 120)],
    pipes: [top(700), top(1300), bottom(700), bottom(1300), left(650), right(650)],
    entry: { x: X0 + 330, y: Y1 - 330 }, exit: { x: X1 - 330, y: Y0 + 330 }, boss: { x: 1000, y: 650 },
  },
  catwalk: {
    id: 'catwalk', name: 'Catwalk', channel: false,
    pillars: [pillar(300, 430, 560, 30), pillar(1140, 430, 560, 30), pillar(300, 840, 560, 30), pillar(1140, 840, 560, 30)],
    pipes: [left(250), left(1050), right(250), right(1050), top(1000), bottom(1000)],
    entry: { x: 250, y: 650 }, exit: { x: 1750, y: 650 }, boss: { x: 1000, y: 650 },
  },
  reactor: {
    id: 'reactor', name: 'Reactor Hall', channel: false,
    pillars: [pillar(860, 500, 280, 300), pillar(480, 230), pillar(1430, 230), pillar(480, 980), pillar(1430, 980)],
    pipes: [left(330), left(970), right(330), right(970), top(1000), bottom(1000)],
    entry: { x: 250, y: 650 }, exit: { x: 1750, y: 650 }, boss: { x: 1000, y: 380 },
  },
  sanctum: {
    id: 'sanctum', name: "Warden's Sanctum", channel: false,
    pillars: [pillar(560, 380, 100, 100), pillar(1340, 380, 100, 100), pillar(560, 820, 100, 100), pillar(1340, 820, 100, 100)],
    pipes: [left(330), left(970), right(330), right(970), top(1000), bottom(1000)],
    entry: { x: 250, y: 650 }, exit: { x: 1750, y: 650 }, boss: { x: 1000, y: 380 },
  },
};

/** Layouts a normal room can use (the sanctum is the boss room's). */
export const ROOM_LAYOUTS: readonly LayoutId[] = ['crossroads', 'colonnade', 'catwalk', 'reactor'];

// The room in play. These are live, mutable singletons: applyLayout() rewrites them in place so the
// systems that imported them keep working. Call it before the scene builds its art and systems.
export const PILLARS: Rect[] = [];
export const PIPES: Pipe[] = [];
export const EXTRACTS: PadDef[] = [
  { id: 'entry', x: 0, y: 0, label: 'ENTRY' },
  { id: 'exit', x: 0, y: 0, label: 'EXIT' },
];
export const SPAWN = { x: 0, y: 0 };
export const ARENA = { layout: LAYOUTS.crossroads };

export function applyLayout(id: LayoutId): Layout {
  const l = LAYOUTS[id];
  ARENA.layout = l;
  PILLARS.splice(0, PILLARS.length, ...l.pillars);
  PIPES.splice(0, PIPES.length, ...l.pipes);
  EXTRACTS[0].x = l.entry.x;
  EXTRACTS[0].y = l.entry.y;
  EXTRACTS[1].x = l.exit.x;
  EXTRACTS[1].y = l.exit.y;
  SPAWN.x = l.entry.x;
  SPAWN.y = l.entry.y;
  return l;
}

applyLayout('crossroads');
