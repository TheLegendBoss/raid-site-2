// Static art for a generated bunker floor, drawn once into a RenderTexture: floor plates, room
// outlines, walls and cover with lit edges, doorways, acid pools. Moving things (barrels, pads,
// fog) belong to their own systems.
import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { Floor } from '../sim/dungeon';

const hash = (c: number, r: number): number => {
  let h = (c * 374761393 + r * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function drawDungeon(scene: Phaser.Scene, floor: Floor): Phaser.GameObjects.RenderTexture {
  const grid = floor.grid;
  const t = grid.tile;
  const g = scene.make.graphics({}, false);

  g.fillStyle(0x020405, 1);
  g.fillRect(0, 0, grid.w, grid.h);

  // Room tint by kind, so the lift, the caches and the Warden's room read at a glance.
  const tint = new Map<number, number>();
  for (const r of floor.rooms) {
    const col = r.kind === 'start' ? 0x0e2a2a : r.kind === 'boss' ? 0x2a1010 : r.kind === 'cache' ? 0x2a2208 : r.kind === 'exit' ? 0x0e1c2a : 0;
    if (!col) continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tint.set(y * grid.cols + x, col);
  }

  // Floor plates.
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.isSolid(c, r)) continue;
      const k = hash(c, r);
      const base = tint.get(r * grid.cols + c);
      g.fillStyle(base ?? (k < 0.5 ? 0x09130f + 0x000203 : 0x0a1517), 1);
      g.fillRect(c * t, r * t, t, t);
      if (k > 0.86) {
        g.fillStyle(0xffffff, 0.015);
        g.fillRect(c * t + 4, r * t + 4, t - 8, t - 8);
      }
    }
  }
  g.lineStyle(1, PALETTE.floorLine, 0.55);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.isSolid(c, r)) continue;
      g.strokeRect(c * t + 0.5, r * t + 0.5, t - 1, t - 1);
    }
  }

  // Acid pools: a sunken basin; the live bubbling is the hazard system's.
  for (const p of floor.props) {
    if (p.type !== 'acid') continue;
    g.fillStyle(0x0b2a12, 1);
    g.fillRect(p.x, p.y, p.w, p.h);
    g.lineStyle(2, 0x2fd35f, 0.55);
    g.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    g.lineStyle(1, 0x2fd35f, 0.18);
    for (let x = p.x + 14; x < p.x + p.w; x += 22) g.lineBetween(x, p.y + 4, x - 10, p.y + p.h - 4);
  }

  // Room outlines: a thin inset line, like panel seams in the deck.
  for (const r of floor.rooms) {
    g.lineStyle(1, PALETTE.structureDim, 0.35);
    g.strokeRect(r.x * t + 6, r.y * t + 6, r.w * t - 12, r.h * t - 12);
  }

  // Walls and cover: lit where they face the floor.
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isSolid(c, r)) continue;
      const open = [!grid.isSolid(c, r - 1), !grid.isSolid(c + 1, r), !grid.isSolid(c, r + 1), !grid.isSolid(c - 1, r)];
      const diag = !grid.isSolid(c - 1, r - 1) || !grid.isSolid(c + 1, r - 1) || !grid.isSolid(c - 1, r + 1) || !grid.isSolid(c + 1, r + 1);
      if (!open.some(Boolean) && !diag) continue; // deep rock keeps the black
      const x = c * t;
      const y = r * t;
      g.fillStyle(open.some(Boolean) ? 0x0d1b1e : 0x060d0f, 1);
      g.fillRect(x, y, t, t);
    }
  }
  g.lineStyle(3, PALETTE.structure, 0.85);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!grid.isSolid(c, r)) continue;
      const x = c * t;
      const y = r * t;
      if (!grid.isSolid(c, r - 1)) g.lineBetween(x, y + 1.5, x + t, y + 1.5);
      if (!grid.isSolid(c, r + 1)) g.lineBetween(x, y + t - 1.5, x + t, y + t - 1.5);
      if (!grid.isSolid(c - 1, r)) g.lineBetween(x + 1.5, y, x + 1.5, y + t);
      if (!grid.isSolid(c + 1, r)) g.lineBetween(x + t - 1.5, y, x + t - 1.5, y + t);
    }
  }
  // Hatching on cover blocks (a lone block or short wall inside a room), to tell it from the outer walls.
  g.lineStyle(1, PALETTE.structureDim, 0.5);
  for (let r = 1; r < grid.rows - 1; r++) {
    for (let c = 1; c < grid.cols - 1; c++) {
      if (!grid.isSolid(c, r)) continue;
      const ring = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([dc, dr]) => !grid.isSolid(c + dc, r + dr)).length;
      if (ring >= 2) g.lineBetween(c * t + 6, r * t + t - 6, c * t + t - 6, r * t + 6);
    }
  }

  // Doorways: a threshold across each corridor mouth.
  g.lineStyle(2, PALETTE.structure, 0.5);
  for (const room of floor.rooms) {
    for (const d of room.doors) {
      const inRoom = d.x > room.x * t && d.x < (room.x + room.w) * t;
      const vertical = inRoom; // door above/below the room: the threshold runs horizontally
      const half = t * 1.5;
      if (vertical) g.lineBetween(d.x - half, d.y + (d.y < room.cy ? t / 2 : -t / 2), d.x + half, d.y + (d.y < room.cy ? t / 2 : -t / 2));
      else g.lineBetween(d.x + (d.x < room.cx ? t / 2 : -t / 2), d.y - half, d.x + (d.x < room.cx ? t / 2 : -t / 2), d.y + half);
    }
  }

  const rt = scene.add.renderTexture(0, 0, grid.w, grid.h).setOrigin(0, 0).setDepth(-30);
  rt.draw(g);
  rt.render();
  g.destroy();
  return rt;
}
