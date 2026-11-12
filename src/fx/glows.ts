// Pooled additive glow flashes: cheap light.
import Phaser from 'phaser';
import type { Glow } from '../game/types';

const POOL = 48;

export class Glows {
  private pool: Glow[] = [];

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        img: scene.add.image(0, 0, 'glow').setDepth(25).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
        active: false, t: 0, life: 1, s0: 1, s1: 1, a0: 1,
      });
    }
  }

  at(x: number, y: number, color: number, s0: number, s1: number, life: number, a0: number): void {
    const g = this.pool.find((o) => !o.active);
    if (!g) return;
    g.active = true;
    g.t = 0;
    g.life = life;
    g.s0 = s0;
    g.s1 = s1;
    g.a0 = a0;
    g.img.setVisible(true).setTint(color).setPosition(x, y).setScale(s0).setAlpha(a0);
  }

  update(dt: number): void {
    for (const g of this.pool) {
      if (!g.active) continue;
      g.t += dt;
      if (g.t >= g.life) {
        g.active = false;
        g.img.setVisible(false);
        continue;
      }
      const k = g.t / g.life;
      g.img.setScale(g.s0 + (g.s1 - g.s0) * k).setAlpha(g.a0 * Math.pow(1 - k, 1.5));
    }
  }
}
