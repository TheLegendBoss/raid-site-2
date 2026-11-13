// Hazards on a bunker floor: explosive barrels (shot, cut or blasted open; they chain) and acid pools
// (hurt and slow whoever wades in). Pure props come from the generator (`floor.props`); this system
// owns the live state. Barrels are drawn once into one Graphics and redrawn only when one goes up.
import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import { segmentHitsCircle } from '../../sim/math';
import type { Ctx } from '../ctx';

interface Barrel {
  x: number;
  y: number;
  r: number;
  hp: number;
  fuse: number; // < 0 = not lit; otherwise seconds until it goes
}

interface Pool {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HazardSystem {
  private barrels: Barrel[] = [];
  private pools: Pool[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private dirty = true;
  private acidTick = 0;
  private bubbleT = 0;

  constructor(private readonly g: Ctx) {
    this.gfx = g.scene.add.graphics().setDepth(-5);
    const floor = g.w.floor;
    if (!floor) return;
    for (const p of floor.props) {
      if (p.type === 'barrel') this.barrels.push({ x: p.x, y: p.y, r: p.w / 2, hp: T.hazards.barrelHp, fuse: -1 });
      else this.pools.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    }
  }

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  /** A shot or a cut lands on barrels along a segment. Returns true if a barrel stopped it. */
  hitSegment(x0: number, y0: number, x1: number, y1: number, dmg: number): boolean {
    for (const b of this.barrels) {
      if (b.hp <= 0) continue;
      if (segmentHitsCircle(x0, y0, x1, y1, b.x, b.y, b.r)) {
        this.damage(b, dmg);
        return true;
      }
    }
    return false;
  }

  /** The blade sweeps an arc: any barrel inside it is struck. */
  hitArc(theta: number, reach: number, tol: number, dmg: number): void {
    for (const b of this.barrels) {
      if (b.hp <= 0) continue;
      const dx = b.x - this.w.px;
      const dy = b.y - this.w.py;
      const d = Math.hypot(dx, dy);
      if (d > reach + b.r) continue;
      let da = Math.atan2(dy, dx) - theta;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) <= tol + Math.asin(Math.min(1, b.r / Math.max(d, 1)))) this.damage(b, dmg);
    }
  }

  private damage(b: Barrel, dmg: number): void {
    if (b.hp <= 0) return;
    b.hp -= dmg;
    this.g.sfx.hit('metal', false);
    this.g.particles.burst(b.x, b.y, 0, Math.PI * 2, 4, 60, 220, { life: 0.2, w: 8, h: 1.6, color: PALETTE.spark, add: true, drag: 3, align: true });
    if (b.hp <= 0) b.fuse = 0.04;
  }

  private explode(b: Barrel): void {
    const H = T.hazards;
    b.hp = 0;
    b.fuse = -2;
    this.dirty = true;
    const col = PALETTE.ember;
    this.g.particles.burst(b.x, b.y, 0, Math.PI * 2, 28, 140, 640, { life: 0.45, w: 14, h: 1.8, color: PALETTE.spark, add: true, drag: 2.6, align: true });
    this.g.particles.burst(b.x, b.y, 0, Math.PI * 2, 10, 40, 220, { life: 0.8, w: 6, h: 6, color: 0x222222, drag: 3, decal: { color: 0x000000, alpha: 0.55, scale: 1.9 } });
    this.g.glows.at(b.x, b.y, col, 5, 0.8, 0.4, 0.9);
    this.g.ring(b.x, b.y, col, 0.4, H.barrelRadius / 14);
    this.g.sfx.explosion();
    this.g.mobSys.hear(b.x, b.y, T.dungeon.hearBlast);
    this.w.trauma = Math.min(1, this.w.trauma + 0.3);
    this.w.addHitStop(0.05);

    const dx = this.w.px - b.x;
    const dy = this.w.py - b.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < H.barrelRadius + T.player.radius) {
      const k = 1 - 0.55 * Math.min(1, d / H.barrelRadius);
      this.g.playerSys.hurtPlayer(Math.round(H.barrelPlayerDamage * k), Math.atan2(-dy, -dx));
      this.w.pvx += (dx / d) * H.barrelKnock * k;
      this.w.pvy += (dy / d) * H.barrelKnock * k;
    }
    for (const m of this.w.mobs) {
      if (m.dead) continue;
      const md = Math.hypot(m.x - b.x, m.y - b.y);
      if (md > H.barrelRadius + m.radius) continue;
      const a = Math.atan2(m.y - b.y, m.x - b.x);
      const k = 1 - 0.55 * Math.min(1, md / H.barrelRadius);
      this.g.combat.damageMob(m, Math.round(H.barrelMobDamage * k), a, 'gun', m.x, m.y, a);
      m.vx += Math.cos(a) * H.barrelKnock * 0.7 * k;
      m.vy += Math.sin(a) * H.barrelKnock * 0.7 * k;
    }
    for (const o of this.barrels) {
      if (o === b || o.hp <= 0) continue;
      if (Math.hypot(o.x - b.x, o.y - b.y) < H.barrelRadius + o.r) {
        o.hp = 0;
        o.fuse = H.barrelChain;
      }
    }
  }

  private inAcid(x: number, y: number): boolean {
    for (const p of this.pools) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) return true;
    return false;
  }

  update(dt: number): void {
    const H = T.hazards;
    for (const b of this.barrels) {
      if (b.fuse >= 0) {
        b.fuse -= dt;
        if (b.fuse < 0) this.explode(b);
      }
    }
    if (this.dirty) this.draw();

    // Acid: the player is slowed and stung; enemies just melt a little.
    const wading = this.pools.length > 0 && this.inAcid(this.w.px, this.w.py);
    this.w.groundSlow = wading ? H.acidPlayerSlow : 1;
    if (wading && !this.w.dead) {
      this.acidTick -= dt;
      if (this.acidTick <= 0) {
        this.acidTick = H.acidPlayerTick;
        this.g.playerSys.hurtPlayer(H.acidPlayerDamage, Math.random() * Math.PI * 2);
      }
    } else this.acidTick = 0;
    if (this.pools.length > 0) {
      for (const m of this.w.mobs) {
        if (m.dead || !m.alert || !this.inAcid(m.x, m.y)) continue;
        m.acidT = (m.acidT ?? 0) + dt;
        if (m.acidT >= 0.5) {
          m.acidT = 0;
          this.g.combat.damageMob(m, Math.max(1, Math.round(H.acidMobDps * 0.5)), 0, 'gun', m.x, m.y, 0);
        }
      }
      // Bubbles, only near the player so the pool of particles is not spent on distant rooms.
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) {
        this.bubbleT = 0.12;
        for (const p of this.pools) {
          if (p.x + p.w < this.w.px - 700 || p.x > this.w.px + 700 || p.y + p.h < this.w.py - 450 || p.y > this.w.py + 450) continue;
          const x = p.x + Math.random() * p.w;
          const y = p.y + Math.random() * p.h;
          this.g.particles.emit({ x, y, vx: 0, vy: -18, life: 0.7, w: 4, h: 4, color: 0x2fd35f, add: true, drag: 1 });
        }
      }
    }
  }

  private draw(): void {
    this.dirty = false;
    const g = this.gfx;
    g.clear();
    for (const b of this.barrels) {
      if (b.hp <= 0 && b.fuse < -1) {
        // A scorch where it stood.
        g.fillStyle(0x000000, 0.45);
        g.fillCircle(b.x, b.y, b.r * 1.5);
        continue;
      }
      g.fillStyle(0x3a1d12, 1);
      g.fillCircle(b.x, b.y, b.r);
      g.lineStyle(2, PALETTE.ember, 0.9);
      g.strokeCircle(b.x, b.y, b.r);
      g.lineStyle(2, PALETTE.ember, 0.5);
      g.strokeCircle(b.x, b.y, b.r * 0.55);
      g.fillStyle(PALETTE.ember, 0.9);
      g.fillRect(b.x - 2, b.y - 7, 4, 9);
      g.fillRect(b.x - 2, b.y + 4, 4, 3);
    }
  }
}
