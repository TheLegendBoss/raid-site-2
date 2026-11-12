// Static arena art, drawn once.
import Phaser from 'phaser';
import { EXTRACTS, PILLARS, PIPES, W, H, X0, X1, Y0, Y1 } from '../data/arena';
import { PALETTE } from '../data/palette';
import { TUNING as T } from '../data/tuning';

export function drawFloor(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(-30);
  g.fillStyle(0x070d0f, 1);
  g.fillRect(0, 0, W, H);
  for (let x = 0; x <= W; x += 100) {
    g.lineStyle(1, x % 500 === 0 ? PALETTE.floorLineBright : PALETTE.floorLine, 1);
    g.lineBetween(x, 0, x, H);
  }
  for (let y = 0; y <= H; y += 100) {
    g.lineStyle(1, y % 500 === 0 ? PALETTE.floorLineBright : PALETTE.floorLine, 1);
    g.lineBetween(0, y, W, y);
  }

  // Sewer channel across the middle.
  g.fillStyle(0x08181b, 1);
  g.fillRect(X0, 610, X1 - X0, 80);
  g.lineStyle(2, PALETTE.structureDim, 0.9);
  g.lineBetween(X0, 610, X1, 610);
  g.lineBetween(X0, 690, X1, 690);
  g.lineStyle(1, PALETTE.structureDim, 0.45);
  for (let x = X0 + 10; x < X1 - 30; x += 64) g.lineBetween(x, 650, x + 26, 650);

  // Pipe mouths.
  for (const p of PIPES) {
    g.fillStyle(0x020506, 1);
    g.fillCircle(p.x, p.y, 38);
    g.lineStyle(3, PALETTE.structure, 0.8);
    g.strokeCircle(p.x, p.y, 38);
    g.lineStyle(1.5, PALETTE.structureDim, 0.9);
    g.strokeCircle(p.x, p.y, 26);
    g.lineBetween(p.x + p.dx * 40, p.y + p.dy * 40, p.x + p.dx * 90, p.y + p.dy * 90);
  }

  // Extract pads: a ring, a cross-hatched deck and the chevrons of a lift shaft.
  for (const e of EXTRACTS) {
    const r = T.extract.padRadius;
    g.fillStyle(0x04100f, 1);
    g.fillCircle(e.x, e.y, r);
    g.lineStyle(1, PALETTE.structureDim, 0.7);
    for (let k = -r; k <= r; k += 14) g.lineBetween(e.x + k, e.y - Math.sqrt(r * r - k * k), e.x + k, e.y + Math.sqrt(r * r - k * k));
    g.lineStyle(3, PALETTE.structure, 0.9);
    g.strokeCircle(e.x, e.y, r);
    g.lineStyle(1.5, PALETTE.structureDim, 0.9);
    g.strokeCircle(e.x, e.y, r - 10);
    g.lineStyle(3, PALETTE.structure, 0.8);
    for (let i = -1; i <= 1; i++) {
      const cy = e.y + i * 16;
      g.lineBetween(e.x - 14, cy + 7, e.x, cy - 5);
      g.lineBetween(e.x, cy - 5, e.x + 14, cy + 7);
    }
  }

  // Outside the walls.
  g.fillStyle(0x020405, 1);
  g.fillRect(0, 0, W, Y0);
  g.fillRect(0, Y1, W, H - Y1);
  g.fillRect(0, 0, X0, H);
  g.fillRect(X1, 0, W - X1, H);
  g.lineStyle(6, PALETTE.structure, 0.9);
  g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  g.lineStyle(1, PALETTE.structureDim, 0.8);
  for (let i = 0; i < W; i += 40) {
    g.lineBetween(i, Y0 - 4, i - 24, 4);
    g.lineBetween(i, Y1 + 4, i - 24, H - 4);
  }

  // Pillars.
  for (const r of PILLARS) {
    g.fillStyle(0x0b1719, 1);
    g.fillRect(r.x, r.y, r.w, r.h);
    g.lineStyle(3, PALETTE.structure, 0.95);
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.lineStyle(1, PALETTE.structureDim, 0.7);
    g.lineBetween(r.x, r.y, r.x + r.w, r.y + r.h);
    g.lineBetween(r.x + r.w, r.y, r.x, r.y + r.h);
  }
}
