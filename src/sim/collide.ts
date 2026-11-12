import { PILLARS, X0, X1, Y0, Y1 } from '../data/arena';
import { clamp, resolveCircleRect } from './math';

/** Keep a circle inside the room and out of the pillars. */
export function collide(pos: { x: number; y: number }, r: number): void {
  pos.x = clamp(pos.x, X0 + r, X1 - r);
  pos.y = clamp(pos.y, Y0 + r, Y1 - r);
  for (const rect of PILLARS) resolveCircleRect(pos, r, rect);
}
