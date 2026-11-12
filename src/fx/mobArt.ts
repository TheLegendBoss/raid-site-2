// Enemy vector art. Redrawn only when the hit-flash state flips.
import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { Mob } from '../game/types';
import { clamp } from '../sim/math';

/** Graphics path helpers want Vector2s; our polygons are plain {x, y}. */
export function poly(pts: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
}

export function drawMob(m: Mob, white: boolean): void {
  const g = m.gfx;
  g.clear();
  if (m.kind === 'scav') {
    const c = white ? PALETTE.white : PALETTE.hostile;
    g.fillStyle(c, white ? 0.9 : 0.22);
    g.lineStyle(2.2, c, 1);
    const pts = [
      { x: 15, y: 0 }, { x: -6, y: -10 }, { x: -2, y: -3 },
      { x: -11, y: 0 }, { x: -2, y: 3 }, { x: -6, y: 10 },
    ];
    g.fillPoints(poly(pts), true);
    g.strokePoints(poly(pts), true);
    g.fillStyle(c, 1);
    g.fillCircle(6, -3, 1.6);
    g.fillCircle(6, 3, 1.6);
  } else {
    const c = white ? PALETTE.white : PALETTE.robot;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      pts.push({ x: Math.cos(a) * 21, y: Math.sin(a) * 21 });
    }
    g.fillStyle(c, white ? 0.9 : 0.18);
    g.fillPoints(poly(pts), true);
    g.lineStyle(2.8, c, 1);
    g.strokePoints(poly(pts), true);
    g.lineStyle(1.5, c, 0.8);
    g.strokeCircle(0, 0, 10);
    g.fillStyle(c, 1);
    g.fillCircle(5, 0, 4);
    g.lineStyle(4, c, 1);
    g.lineBetween(14, 0, 31, 0);
  }
}

export function drawBar(m: Mob): void {
  if (!m.bar) return;
  const g = m.bar;
  const frac = clamp(m.hp / m.maxHp, 0, 1);
  g.clear();
  g.fillStyle(0x000000, 0.6);
  g.fillRect(-20, 0, 40, 5);
  g.fillStyle(PALETTE.robot, 1);
  g.fillRect(-19, 1, 38 * frac, 3);
}
