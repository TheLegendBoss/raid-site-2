// Enemy vector art. Redrawn only when the hit-flash state flips.
import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import type { Mob } from '../game/types';
import { clamp } from '../sim/math';

/** Graphics path helpers want Vector2s; our polygons are plain {x, y}. */
export function poly(pts: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
}

const ngon = (n: number, r: number, rot = 0): { x: number; y: number }[] =>
  Array.from({ length: n }, (_, i) => ({ x: Math.cos(rot + (Math.PI * 2 * i) / n) * r, y: Math.sin(rot + (Math.PI * 2 * i) / n) * r }));

/** Draw an enemy facing +x. Called once, and again only when the hit flash flips. */
export function drawMob(m: Mob, white: boolean): void {
  const g = m.gfx;
  g.clear();
  const c = white ? PALETTE.white : m.def.color;
  const fill = (a: number): void => void g.fillStyle(c, white ? 0.9 : a);
  const outline = (w: number, a = 1): void => void g.lineStyle(w, c, a);
  const shape = (pts: { x: number; y: number }[], a: number, w: number): void => {
    fill(a);
    g.fillPoints(poly(pts), true);
    outline(w);
    g.strokePoints(poly(pts), true);
  };

  switch (m.kind) {
    case 'scav': {
      shape([
        { x: 15, y: 0 }, { x: -6, y: -10 }, { x: -2, y: -3 },
        { x: -11, y: 0 }, { x: -2, y: 3 }, { x: -6, y: 10 },
      ], 0.22, 2.2);
      g.fillStyle(c, 1);
      g.fillCircle(6, -3, 1.6);
      g.fillCircle(6, 3, 1.6);
      break;
    }
    case 'leaper': {
      // A long dart on hind legs: thinner and sharper than a scavenger.
      shape([{ x: 19, y: 0 }, { x: 3, y: -6 }, { x: -13, y: -12 }, { x: -7, y: 0 }, { x: -13, y: 12 }, { x: 3, y: 6 }], 0.2, 2.2);
      outline(1.6, 0.8);
      g.lineBetween(-2, -4, -16, -10);
      g.lineBetween(-2, 4, -16, 10);
      g.fillStyle(c, 1);
      g.fillCircle(9, -2.2, 1.5);
      g.fillCircle(9, 2.2, 1.5);
      break;
    }
    case 'bomber': {
      // A swollen sac with a glowing core.
      fill(0.2);
      g.fillCircle(0, 0, 15);
      outline(2.4);
      g.strokeCircle(0, 0, 15);
      outline(1.5, 0.7);
      g.strokeCircle(0, 0, 8);
      fill(0.7);
      g.fillCircle(0, 0, 4.5);
      for (const p of ngon(5, 15, 0.4)) {
        g.fillStyle(c, 1);
        g.fillCircle(p.x * 1.05, p.y * 1.05, 2.2);
      }
      g.fillStyle(c, 1);
      g.fillCircle(12, -3, 1.4);
      g.fillCircle(12, 3, 1.4);
      break;
    }
    case 'spitter': {
      // A crescent body with a heavy sac behind and a split mouth in front.
      shape([{ x: 17, y: -4 }, { x: 8, y: -12 }, { x: -6, y: -11 }, { x: -13, y: 0 }, { x: -6, y: 11 }, { x: 8, y: 12 }, { x: 17, y: 4 }, { x: 9, y: 0 }], 0.2, 2.2);
      fill(0.55);
      g.fillCircle(-4, 0, 6);
      outline(1.4, 0.9);
      g.lineBetween(9, 0, 19, -2);
      g.lineBetween(9, 0, 19, 2);
      g.fillStyle(c, 1);
      g.fillCircle(4, -7, 1.5);
      g.fillCircle(4, 7, 1.5);
      break;
    }
    case 'brute': {
      // A slab of a thing: shoulder plates and a low head.
      shape(ngon(8, 26, Math.PI / 8), 0.2, 3.4);
      shape([{ x: 8, y: -26 }, { x: -12, y: -28 }, { x: -14, y: -16 }, { x: 8, y: -16 }], 0.5, 2);
      shape([{ x: 8, y: 26 }, { x: -12, y: 28 }, { x: -14, y: 16 }, { x: 8, y: 16 }], 0.5, 2);
      outline(1.6, 0.75);
      g.strokeCircle(-2, 0, 10);
      fill(1);
      g.fillRect(12, -4, 12, 8);
      g.fillCircle(2, 0, 4);
      break;
    }
    case 'robot': {
      const pts = ngon(6, 21);
      fill(0.18);
      g.fillPoints(poly(pts), true);
      outline(2.8);
      g.strokePoints(poly(pts), true);
      outline(1.5, 0.8);
      g.strokeCircle(0, 0, 10);
      g.fillStyle(c, 1);
      g.fillCircle(5, 0, 4);
      outline(4);
      g.lineBetween(14, 0, 31, 0);
      break;
    }
    case 'sniper': {
      // A slim diamond carrying a long rail.
      shape([{ x: 17, y: 0 }, { x: 0, y: -13 }, { x: -16, y: 0 }, { x: 0, y: 13 }], 0.16, 2.6);
      outline(1.4, 0.8);
      g.strokeCircle(-1, 0, 6);
      outline(3.2);
      g.lineBetween(12, 0, 44, 0);
      outline(1.6, 0.9);
      g.lineBetween(26, -4, 26, 4);
      g.fillStyle(c, 1);
      g.fillCircle(2, 0, 3);
      break;
    }
    case 'warden': {
      // The Warden: a heavy ring-frame with four gun ports and a hot core.
      shape(ngon(10, 40, Math.PI / 10), 0.14, 4);
      outline(2.2, 0.85);
      g.strokePoints(poly(ngon(10, 28, 0)), true);
      outline(1.6, 0.7);
      g.strokeCircle(0, 0, 17);
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i;
        outline(5);
        g.lineBetween(Math.cos(a) * 36, Math.sin(a) * 36, Math.cos(a) * 54, Math.sin(a) * 54);
      }
      g.fillStyle(white ? PALETTE.white : PALETTE.ember, 1);
      g.fillCircle(0, 0, 10);
      g.fillStyle(c, 1);
      g.fillCircle(0, 0, 4);
      break;
    }
  }
}

export function drawBar(m: Mob): void {
  if (!m.bar) return;
  const g = m.bar;
  const frac = clamp(m.hp / m.maxHp, 0, 1);
  const half = Math.max(20, Math.round(m.radius * 0.95));
  g.clear();
  g.fillStyle(0x000000, 0.6);
  g.fillRect(-half, 0, half * 2, 5);
  g.fillStyle(m.def.color, 1);
  g.fillRect(-half + 1, 1, (half * 2 - 2) * frac, 3);
}
