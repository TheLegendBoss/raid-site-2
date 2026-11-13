// Fog of war for the minimap: tiles in the player's sight (or the whole room they stand in) are marked
// seen. Pure bookkeeping, it only writes `runState.map`. The HUD draws from it.
import { TUNING as T } from '../../data/tuning';
import type { Ctx } from '../ctx';
import { runState, type MapState } from '../runState';

export class ExploreSystem {
  private map: MapState | null = null;
  private lastCell = -1;
  private foeT = 0;

  constructor(private readonly g: Ctx) {
    const floor = g.w.floor;
    if (!floor) {
      runState.map = null;
      return;
    }
    const grid = floor.grid;
    const solid = new Uint8Array(grid.cols * grid.rows);
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) solid[r * grid.cols + c] = grid.isSolid(c, r) ? 1 : 0;
    this.map = {
      cols: grid.cols, rows: grid.rows, tile: grid.tile, solid, seen: new Uint8Array(solid.length), fresh: [],
      px: 0, py: 0,
      pads: [
        { x: floor.start.x, y: floor.start.y, kind: 'lift' },
        { x: floor.exit.x, y: floor.exit.y, kind: 'exit' },
      ],
      foes: [],
    };
    runState.map = this.map;
    this.reveal(true);
  }

  private mark(c: number, r: number): void {
    const m = this.map!;
    if (c < 0 || r < 0 || c >= m.cols || r >= m.rows) return;
    const i = r * m.cols + c;
    if (m.seen[i]) return;
    m.seen[i] = 1;
    m.fresh.push(i);
  }

  private reveal(force = false): void {
    const m = this.map;
    const floor = this.g.w.floor;
    if (!m || !floor) return;
    const grid = floor.grid;
    const pc = grid.col(this.g.w.px);
    const pr = grid.row(this.g.w.py);
    const cell = pr * m.cols + pc;
    if (!force && cell === this.lastCell) return;
    this.lastCell = cell;
    const R = T.dungeon.revealRadius;
    // Floor tiles the player can see, then the walls that face them.
    for (let pass = 0; pass < 2; pass++) {
      for (let r = pr - R; r <= pr + R; r++) {
        for (let c = pc - R; c <= pc + R; c++) {
          if ((c - pc) ** 2 + (r - pr) ** 2 > R * R) continue;
          if (c < 0 || r < 0 || c >= m.cols || r >= m.rows || m.seen[r * m.cols + c]) continue;
          if (pass === 0) {
            if (!grid.isSolid(c, r) && grid.clear(this.g.w.px, this.g.w.py, grid.cx(c), grid.cy(r))) this.mark(c, r);
          } else if (grid.isSolid(c, r) && this.nearOpen(c, r)) this.mark(c, r);
        }
      }
    }
    // Standing in a room shows all of it, walls included.
    for (const room of floor.rooms) {
      if (pc >= room.x && pc < room.x + room.w && pr >= room.y && pr < room.y + room.h) {
        for (let r = room.y - 1; r <= room.y + room.h; r++) for (let c = room.x - 1; c <= room.x + room.w; c++) this.mark(c, r);
      }
    }
  }

  /** A solid tile counts as seen when it borders a floor tile that has been seen (its lit face). */
  private nearOpen(c: number, r: number): boolean {
    const m = this.map!;
    const at = (cc: number, rr: number): boolean => cc >= 0 && rr >= 0 && cc < m.cols && rr < m.rows && !m.solid[rr * m.cols + cc] && m.seen[rr * m.cols + cc] === 1;
    return at(c - 1, r) || at(c + 1, r) || at(c, r - 1) || at(c, r + 1);
  }

  update(dt: number): void {
    const m = this.map;
    if (!m) return;
    const w = this.g.w;
    m.px = w.px;
    m.py = w.py;
    this.reveal();
    this.foeT -= dt;
    if (this.foeT <= 0) {
      this.foeT = 0.1;
      m.foes.length = 0;
      for (const mob of w.mobs) {
        if (mob.dead || !mob.alert) continue;
        const i = Math.floor(mob.y / m.tile) * m.cols + Math.floor(mob.x / m.tile);
        if (m.seen[i]) m.foes.push(mob.x, mob.y);
      }
    }
  }
}
