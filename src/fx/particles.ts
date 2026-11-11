// Lightweight pooled particles. Tinted 4x4 'px' images, one ring buffer.
// Sparks add light (ADD blend); blood and shards can leave floor decals.
import Phaser from 'phaser';

export interface DecalSpec {
  color: number;
  alpha: number;
  scale: number;
}

export interface EmitOpts {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  w: number; // px length
  h: number; // px thickness
  color: number;
  alpha?: number;
  add?: boolean; // additive blend (light)
  drag?: number; // exponential velocity decay per second
  spin?: number; // radians per second
  rot?: number; // initial rotation; defaults to the velocity direction
  align?: boolean; // keep rotated to face velocity (streaks)
  shrink?: boolean; // scale down over life instead of only fading
  decal?: DecalSpec; // stamped to the floor when the particle ends
}

interface P {
  img: Phaser.GameObjects.Image;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  w: number;
  h: number;
  alpha: number;
  drag: number;
  spin: number;
  rot: number;
  align: boolean;
  shrink: boolean;
  decal?: DecalSpec;
}

export class Particles {
  private pool: P[] = [];
  private cursor = 0;

  constructor(
    scene: Phaser.Scene,
    private floor: Phaser.GameObjects.RenderTexture,
    size = 700,
    depth = 20,
  ) {
    for (let i = 0; i < size; i++) {
      const img = scene.add.image(0, 0, 'px').setVisible(false).setDepth(depth);
      this.pool.push({
        img,
        active: false,
        x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1,
        w: 1, h: 1, alpha: 1, drag: 0, spin: 0, rot: 0,
        align: false, shrink: false,
      });
    }
  }

  emit(o: EmitOpts): void {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.active = true;
    p.x = o.x;
    p.y = o.y;
    p.vx = o.vx;
    p.vy = o.vy;
    p.age = 0;
    p.life = o.life;
    p.w = o.w;
    p.h = o.h;
    p.alpha = o.alpha ?? 1;
    p.drag = o.drag ?? 0;
    p.spin = o.spin ?? 0;
    p.rot = o.rot ?? Math.atan2(o.vy, o.vx);
    p.align = o.align ?? false;
    p.shrink = o.shrink ?? false;
    p.decal = o.decal;
    p.img
      .setVisible(true)
      .setTint(o.color)
      .setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setPosition(o.x, o.y)
      .setRotation(p.rot)
      .setAlpha(p.alpha)
      .setScale(o.w / 4, o.h / 4);
  }

  /** Convenience: a burst of streaks in a cone. */
  burst(
    x: number,
    y: number,
    angle: number,
    cone: number,
    count: number,
    speedMin: number,
    speedMax: number,
    o: Omit<EmitOpts, 'x' | 'y' | 'vx' | 'vy'>,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * cone;
      const s = Phaser.Math.FloatBetween(speedMin, speedMax);
      const scale = 0.65 + Math.random() * 0.7;
      this.emit({
        ...o,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        w: o.w * scale,
        spin: o.spin ? o.spin * (Math.random() * 2 - 1) : 0,
      });
    }
  }

  update(dt: number): void {
    let stamped = false;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.img.setVisible(false);
        if (p.decal) {
          this.floor.stamp('dot', undefined, p.x, p.y, {
            tint: p.decal.color,
            alpha: p.decal.alpha,
            scale: p.decal.scale,
            angle: Phaser.Math.RadToDeg(p.rot),
          });
          stamped = true;
        }
        continue;
      }
      if (p.drag > 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.align && (p.vx !== 0 || p.vy !== 0)) p.rot = Math.atan2(p.vy, p.vx);
      const t = p.age / p.life;
      const fade = 1 - t;
      p.img.setPosition(p.x, p.y).setRotation(p.rot).setAlpha(p.alpha * fade);
      if (p.shrink) p.img.setScale((p.w / 4) * fade, (p.h / 4) * fade);
    }
    if (stamped) this.floor.render();
  }
}
