// Pathfinding for the bunker floors: a breadth-first distance field out from the player's tile.
// Every enemy that cannot see the player asks it which way to step. Pure TypeScript.
import type { Grid } from './grid';

const NEAR = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;
const UNSEEN = 65535;

export class FlowField {
  private readonly dist: Uint16Array;
  private readonly queue: Int32Array;
  private goalC = -1;
  private goalR = -1;

  constructor(private readonly grid: Grid) {
    this.dist = new Uint16Array(grid.cols * grid.rows).fill(UNSEEN);
    this.queue = new Int32Array(grid.cols * grid.rows);
  }

  /** Rebuild the field out from a point. Cheap enough to do several times a second. */
  update(x: number, y: number): void {
    const g = this.grid;
    let c = g.col(x);
    let r = g.row(y);
    if (g.isSolid(c, r)) {
      // The goal stands in a wall (a dash through a corner): use the nearest open neighbour.
      let found = false;
      for (const [dc, dr] of NEAR) {
        if (!g.isSolid(c + dc, r + dr)) {
          c += dc;
          r += dr;
          found = true;
          break;
        }
      }
      if (!found) return;
    }
    if (c === this.goalC && r === this.goalR) return;
    this.goalC = c;
    this.goalR = r;
    const { cols, rows } = g;
    this.dist.fill(UNSEEN);
    let head = 0;
    let tail = 0;
    this.dist[r * cols + c] = 0;
    this.queue[tail++] = r * cols + c;
    while (head < tail) {
      const i = this.queue[head++];
      const ci = i % cols;
      const ri = (i - ci) / cols;
      const d = this.dist[i] + 1;
      for (const [dc, dr] of NEAR) {
        const nc = ci + dc;
        const nr = ri + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || g.isSolid(nc, nr)) continue;
        // No cutting a corner: a diagonal step needs both orthogonal tiles open.
        if (dc !== 0 && dr !== 0 && (g.isSolid(ci + dc, ri) || g.isSolid(ci, ri + dr))) continue;
        const ni = nr * cols + nc;
        if (this.dist[ni] <= d) continue;
        this.dist[ni] = d;
        this.queue[tail++] = ni;
      }
    }
  }

  /** Steps to the goal from a point, or -1 when it cannot get there. */
  distanceAt(x: number, y: number): number {
    const g = this.grid;
    const c = g.col(x);
    const r = g.row(y);
    if (g.isSolid(c, r)) return -1;
    const d = this.dist[r * g.cols + c];
    return d === UNSEEN ? -1 : d;
  }

  /** Unit vector toward the centre of the best neighbouring tile; null when there is no way through. */
  dirAt(x: number, y: number): { x: number; y: number } | null {
    const g = this.grid;
    const c = g.col(x);
    const r = g.row(y);
    if (g.isSolid(c, r)) return null;
    const here = this.dist[r * g.cols + c];
    if (here === UNSEEN) return null;
    if (here === 0) return { x: 0, y: 0 };
    let best = here;
    let bc = c;
    let br = r;
    for (const [dc, dr] of NEAR) {
      const nc = c + dc;
      const nr = r + dr;
      if (g.isSolid(nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (g.isSolid(c + dc, r) || g.isSolid(c, r + dr))) continue;
      const d = this.dist[nr * g.cols + nc];
      if (d < best) {
        best = d;
        bc = nc;
        br = nr;
      }
    }
    if (bc === c && br === r) return null;
    const tx = g.cx(bc) - x;
    const ty = g.cy(br) - y;
    const len = Math.hypot(tx, ty) || 1;
    return { x: tx / len, y: ty / len };
  }
}
