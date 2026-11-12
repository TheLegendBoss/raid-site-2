// Pooled floating damage numbers.
import type Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import type { DmgNum, NumClass } from '../game/types';

export class DamageNumbers {
  private pool: DmgNum[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.build();
  }

  private build(): void {
    const N = T.numbers;
    const spec: Record<NumClass, { size: number; color: number }> = {
      gun: { size: N.gunSize, color: PALETTE.spark },
      blade: { size: N.bladeSize, color: PALETTE.white },
      hurt: { size: N.hurtSize, color: PALETTE.hostile },
      shield: { size: N.shieldSize, color: PALETTE.shield },
      resist: { size: N.resistSize, color: PALETTE.textDim },
      refund: { size: N.refundSize, color: PALETTE.ammo },
    };
    for (const cls of Object.keys(spec) as NumClass[]) {
      const { size, color } = spec[cls];
      for (let i = 0; i < N.pool[cls]; i++) {
        const txt = this.scene.add
          .text(0, 0, '', {
            fontFamily: FONT,
            fontStyle: 'bold',
            fontSize: `${size}px`,
            color: hex(color),
            stroke: '#000000',
            strokeThickness: Math.max(3, Math.round(size / 6)),
          })
          .setOrigin(0.5)
          .setDepth(30)
          .setVisible(false);
        this.pool.push({ txt, cls, active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1 });
      }
    }
  }

  spawn(x: number, y: number, text: string, cls: NumClass): void {
    const N = T.numbers;
    let slot: DmgNum | undefined;
    let oldest: DmgNum | undefined;
    for (const n of this.pool) {
      if (n.cls !== cls) continue;
      if (!n.active) {
        slot = n;
        break;
      }
      if (!oldest || n.age > oldest.age) oldest = n;
    }
    const n = slot ?? oldest;
    if (!n) return;
    n.active = true;
    n.age = 0;
    n.life = cls === 'blade' ? N.bladeLife : N.life;
    n.x = x + (Math.random() * 2 - 1) * N.jitter;
    n.y = y;
    n.vx = (Math.random() * 2 - 1) * N.sideways;
    n.vy = -N.rise * (0.8 + Math.random() * 0.4);
    n.txt.setText(text).setVisible(true).setPosition(n.x, n.y).setAlpha(1).setScale(1 + N.popScale);
  }

  update(dt: number): void {
    const N = T.numbers;
    const k = Math.exp(-N.drag * dt);
    for (const n of this.pool) {
      if (!n.active) continue;
      n.age += dt;
      if (n.age >= n.life) {
        n.active = false;
        n.txt.setVisible(false);
        continue;
      }
      n.vx *= k;
      n.vy *= k;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      const fadeStart = n.life * 0.55;
      const alpha = n.age < fadeStart ? 1 : 1 - (n.age - fadeStart) / (n.life - fadeStart);
      const pop = Math.max(0, 1 - n.age / N.popTime);
      n.txt.setPosition(n.x, n.y).setAlpha(alpha).setScale(1 + N.popScale * pop);
    }
  }

  reset(): void {
    for (const n of this.pool) {
      n.active = false;
      n.txt.setVisible(false);
    }
  }
}
