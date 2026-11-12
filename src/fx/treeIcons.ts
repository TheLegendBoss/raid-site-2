// Vector glyphs for tree nodes. Drawn once per node into a Graphics centred
// on (0, 0), roughly 48px across. Line art only, one tint per node.
import Phaser from 'phaser';
import type { IconId } from '../data/tree';

type G = Phaser.GameObjects.Graphics;

function pts(list: number[][]): Phaser.Math.Vector2[] {
  return list.map(([x, y]) => new Phaser.Math.Vector2(x, y));
}

function loop(g: G, list: number[][]): void {
  g.fillPoints(pts(list), true);
  g.strokePoints(pts(list), true);
}

export function drawIcon(g: G, icon: IconId, color: number, alpha = 1): void {
  g.lineStyle(2.4, color, alpha);
  g.fillStyle(color, 0.2 * alpha);
  switch (icon) {
    case 'core':
      g.strokeCircle(0, 0, 20);
      g.strokeCircle(0, 0, 9);
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i + Math.PI / 4;
        g.lineBetween(Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a) * 24, Math.sin(a) * 24);
      }
      g.fillCircle(0, 0, 4);
      break;
    case 'hull':
      loop(g, [[0, -22], [18, -14], [18, 6], [0, 22], [-18, 6], [-18, -14]]);
      g.lineBetween(0, -22, 0, 22);
      g.lineBetween(-18, -4, 18, -4);
      break;
    case 'shield':
      loop(g, [[0, -23], [20, -14], [16, 10], [0, 23], [-16, 10], [-20, -14]]);
      g.strokeCircle(0, -1, 8);
      break;
    case 'regen':
      g.beginPath();
      g.arc(0, 0, 17, -2.6, 1.9);
      g.strokePath();
      g.fillTriangle(10, 15, 22, 10, 17, 22);
      g.lineBetween(0, -7, 0, 7);
      g.lineBetween(-7, 0, 7, 0);
      break;
    case 'boots':
      loop(g, [[-14, -20], [4, -20], [4, 2], [20, 8], [20, 20], [-14, 20]]);
      g.lineBetween(-14, 10, 20, 10);
      break;
    case 'dash':
      for (let i = 0; i < 3; i++) {
        const o = i * 11 - 11;
        g.lineBetween(-20 + o, -16, -6 + o, 0);
        g.lineBetween(-6 + o, 0, -20 + o, 16);
      }
      g.lineBetween(-12, 0, 22, 0);
      break;
    case 'mag':
      loop(g, [[-9, -22], [9, -22], [9, 22], [-9, 22]]);
      for (let i = -3; i <= 3; i++) g.lineBetween(-5, i * 6, 5, i * 6);
      break;
    case 'bolt':
      loop(g, [[4, -23], [-12, 3], [-1, 3], [-5, 23], [13, -5], [1, -5]]);
      break;
    case 'reload':
      g.beginPath();
      g.arc(0, 0, 17, 0.4, 5.6);
      g.strokePath();
      g.fillTriangle(15, -9, 25, 2, 8, 3);
      g.strokeRect(-5, -6, 10, 14);
      break;
    case 'reserve':
      for (let i = -1; i <= 1; i++) {
        loop(g, [[i * 14 - 5, -4], [i * 14 + 5, -4], [i * 14 + 5, 20], [i * 14 - 5, 20]]);
        g.fillTriangle(i * 14 - 5, -4, i * 14 + 5, -4, i * 14, -17);
      }
      break;
    case 'blade':
      g.lineBetween(-16, 18, 20, -18);
      g.lineBetween(-9, 20, 20, -9);
      g.lineBetween(-20, 8, -8, 20);
      g.lineBetween(-22, 22, -14, 14);
      break;
    case 'reach':
      g.lineBetween(-22, 16, 14, -10);
      g.lineBetween(-22, 20, 18, -6);
      g.lineBetween(14, -22, 24, -4);
      g.lineBetween(8, -24, 24, -12);
      break;
    case 'siphon':
      g.strokeCircle(0, 4, 14);
      g.lineBetween(0, -22, 0, -8);
      g.fillTriangle(-6, -14, 6, -14, 0, -6);
      g.lineBetween(-6, 4, 6, 4);
      g.lineBetween(0, -2, 0, 10);
      break;
    case 'crate':
      loop(g, [[-20, -10], [0, -20], [20, -10], [20, 14], [0, 24], [-20, 14]]);
      g.lineBetween(-20, -10, 0, 0);
      g.lineBetween(20, -10, 0, 0);
      g.lineBetween(0, 0, 0, 24);
      break;
    case 'magnet':
      g.beginPath();
      g.arc(0, -2, 16, Math.PI, 0);
      g.strokePath();
      g.lineBetween(-16, -2, -16, 16);
      g.lineBetween(16, -2, 16, 16);
      g.strokeRect(-22, 16, 12, 6);
      g.strokeRect(10, 16, 12, 6);
      break;
    case 'intel':
      loop(g, [[-18, -20], [10, -20], [18, -12], [18, 22], [-18, 22]]);
      for (let i = 0; i < 4; i++) g.lineBetween(-10, -9 + i * 7, 10, -9 + i * 7);
      break;
    case 'lens':
      g.strokeCircle(0, 0, 18);
      g.strokeCircle(0, 0, 7);
      g.lineBetween(0, -24, 0, -12);
      g.lineBetween(0, 12, 0, 24);
      g.lineBetween(-24, 0, -12, 0);
      g.lineBetween(12, 0, 24, 0);
      break;
  }
}
