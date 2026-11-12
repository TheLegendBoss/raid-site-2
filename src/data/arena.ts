// The feel-test arena: bounds, pillars and the pipes enemies pour out of.
import type { Rect } from '../sim/math';
import { TUNING as T } from './tuning';

export const W = T.world.w;
export const H = T.world.h;
export const WALL = T.world.wall;
export const X0 = WALL;
export const Y0 = WALL;
export const X1 = W - WALL;
export const Y1 = H - WALL;

export const PILLARS: Rect[] = [
  { x: 520, y: 320, w: 110, h: 110 },
  { x: 1370, y: 320, w: 110, h: 110 },
  { x: 520, y: 870, w: 110, h: 110 },
  { x: 1370, y: 870, w: 110, h: 110 },
  { x: 900, y: 520, w: 200, h: 34 },
  { x: 900, y: 746, w: 200, h: 34 },
];

/** Extract points: the floor's entry (where you arrive) and its exit (opens once the floor is beaten). */
export const EXTRACTS = [
  { id: 'entry', x: X0 + 330, y: Y0 + 330, label: 'ENTRY' },
  { id: 'exit', x: X1 - 330, y: Y1 - 330, label: 'EXIT' },
] as const;
export const SPAWN = { x: EXTRACTS[0].x, y: EXTRACTS[0].y };

// Where things pour out of the walls.
export const PIPES = [
  { x: X0, y: 330, dx: 1, dy: 0 },
  { x: X0, y: 970, dx: 1, dy: 0 },
  { x: X1, y: 650, dx: -1, dy: 0 },
  { x: 1000, y: Y0, dx: 0, dy: 1 },
  { x: 1000, y: Y1, dx: 0, dy: -1 },
];
