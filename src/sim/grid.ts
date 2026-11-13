// A tile grid of solid and open cells: the map a bunker floor is built on. Pure TypeScript.
// Positions are in pixels; tiles are `tile` px square. Anything outside the grid counts as solid.
export class Grid {
  readonly solid: Uint8Array;

  constructor(readonly cols: number, readonly rows: number, readonly tile: number) {
    this.solid = new Uint8Array(cols * rows).fill(1);
  }

  get w(): number {
    return this.cols * this.tile;
  }

  get h(): number {
    return this.rows * this.tile;
  }

  isSolid(c: number, r: number): boolean {
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows || this.solid[r * this.cols + c] === 1;
  }

  set(c: number, r: number, solid: boolean): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    this.solid[r * this.cols + c] = solid ? 1 : 0;
  }

  solidAt(x: number, y: number): boolean {
    return this.isSolid(Math.floor(x / this.tile), Math.floor(y / this.tile));
  }

  col(x: number): number {
    return Math.floor(x / this.tile);
  }

  row(y: number): number {
    return Math.floor(y / this.tile);
  }

  cx(c: number): number {
    return (c + 0.5) * this.tile;
  }

  cy(r: number): number {
    return (r + 0.5) * this.tile;
  }

  /** True when no solid tile lies between the two points (a supercover-free DDA walk over tiles). */
  clear(x0: number, y0: number, x1: number, y1: number): boolean {
    const t = this.tile;
    let c = Math.floor(x0 / t);
    let r = Math.floor(y0 / t);
    const c1 = Math.floor(x1 / t);
    const r1 = Math.floor(y1 / t);
    if (this.isSolid(c, r)) return false;
    if (c === c1 && r === r1) return true;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1;
    const sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(t / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(t / dy) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? (c + 1) * t - x0 : x0 - c * t) / Math.abs(dx) : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? (r + 1) * t - y0 : y0 - r * t) / Math.abs(dy) : Infinity;
    for (let guard = this.cols + this.rows + 4; guard > 0 && (c !== c1 || r !== r1); guard--) {
      if (tmx < tmy) {
        tmx += tdx;
        c += sx;
      } else {
        tmy += tdy;
        r += sy;
      }
      if (this.isSolid(c, r)) return false;
    }
    return true;
  }

  /** Distance along a ray to the first solid tile, up to `max`. */
  rayLength(x0: number, y0: number, angle: number, max: number): number {
    const x1 = x0 + Math.cos(angle) * max;
    const y1 = y0 + Math.sin(angle) * max;
    if (this.clear(x0, y0, x1, y1)) return max;
    let lo = 0;
    let hi = max;
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      if (this.clear(x0, y0, x0 + Math.cos(angle) * mid, y0 + Math.sin(angle) * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
}
