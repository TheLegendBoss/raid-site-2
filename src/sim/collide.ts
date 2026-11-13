import { ARENA, PILLARS, X0, X1, Y0, Y1 } from '../data/arena';
import { clamp, resolveCircleRect, segmentIntersectsRect } from './math';

const scratch = { x: 0, y: 0, w: 0, h: 0 };

/** Keep a circle inside the room and out of the pillars (or, on a bunker floor, out of the wall tiles). */
export function collide(pos: { x: number; y: number }, r: number): void {
  const grid = ARENA.grid;
  if (grid) {
    const t = grid.tile;
    pos.x = clamp(pos.x, r, grid.w - r);
    pos.y = clamp(pos.y, r, grid.h - r);
    scratch.w = t;
    scratch.h = t;
    // Two passes: a push out of one tile can land in the next one.
    for (let pass = 0; pass < 2; pass++) {
      const c0 = Math.floor((pos.x - r) / t);
      const c1 = Math.floor((pos.x + r) / t);
      const r0 = Math.floor((pos.y - r) / t);
      const r1 = Math.floor((pos.y + r) / t);
      for (let rr = r0; rr <= r1; rr++) {
        for (let cc = c0; cc <= c1; cc++) {
          if (!grid.isSolid(cc, rr)) continue;
          scratch.x = cc * t;
          scratch.y = rr * t;
          resolveCircleRect(pos, r, scratch);
        }
      }
    }
    return;
  }
  pos.x = clamp(pos.x, X0 + r, X1 - r);
  pos.y = clamp(pos.y, Y0 + r, Y1 - r);
  for (const rect of PILLARS) resolveCircleRect(pos, r, rect);
}

/** True when nothing solid lies on the straight line between two points. */
export function lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
  const grid = ARENA.grid;
  if (grid) return grid.clear(x0, y0, x1, y1);
  return !PILLARS.some((r) => segmentIntersectsRect(x0, y0, x1, y1, r));
}

/** Like lineClear, but wide enough for something of radius `r` to walk: the centre line and two side lines. */
export function lineClearWide(x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  if (!lineClear(x0, y0, x1, y1)) return false;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  return lineClear(x0 + nx, y0 + ny, x1 + nx, y1 + ny) && lineClear(x0 - nx, y0 - ny, x1 - nx, y1 - ny);
}

/** How far a telegraph or shot can run from a point before a wall stops it, up to `max`. */
export function rayLength(x: number, y: number, angle: number, max: number): number {
  const grid = ARENA.grid;
  if (grid) return grid.rayLength(x, y, angle, max);
  const x1 = x + Math.cos(angle) * max;
  const y1 = y + Math.sin(angle) * max;
  if (!PILLARS.some((r) => segmentIntersectsRect(x, y, x1, y1, r))) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const mx = x + Math.cos(angle) * mid;
    const my = y + Math.sin(angle) * mid;
    if (PILLARS.some((r) => segmentIntersectsRect(x, y, mx, my, r))) hi = mid;
    else lo = mid;
  }
  return lo;
}
