import { TUNING as T } from '../../data/tuning';
import { profile } from '../profile';
import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { runState } from '../runState';
import { rollDamage } from '../../sim/damage';
import { DEG, angleDiff, clamp } from '../../sim/math';
import type { Ctx } from '../ctx';

/** Arc blade: windup, swing, hits. */
export class BladeSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  updateSword(dt: number): void {
    const S = T.sword;
    const sw = this.w.sw;
    const ptr = this.g.scene.input.activePointer;
    const rmb = ptr.isDown && ptr.rightButtonDown();
    const pressed = (rmb && !this.w.rmbWas) || Phaser.Input.Keyboard.JustDown(this.g.keys.F);
    this.w.rmbWas = rmb;
    this.w.swordCd = Math.max(0, this.w.swordCd - dt);

    if (pressed && sw.state !== 'idle') {
      // Mid-swing the cooldown is already running, so an extra press is an early press.
      runState.bladeDeny = 1;
      this.g.sfx.empty();
    }

    this.g.rig.setBladeOut(sw.state !== 'idle');
    if (sw.state === 'idle') {
      this.g.bladeGfx.clear();
      this.g.bladeGlow.setVisible(false);
      if (pressed) {
        if (this.w.swordCd > 0) {
          runState.bladeDeny = 1;
          this.g.sfx.empty();
          return;
        }
        sw.state = 'windup';
        sw.t = 0;
        sw.dir = sw.dir === 1 ? -1 : 1;
        this.w.swordCd = profile.stats.bladeCooldown;
        this.g.sfx.windup();
      }
      return;
    }

    sw.t += dt;
    if (sw.state === 'windup') {
      if (sw.t >= S.windup) {
        sw.state = 'swing';
        sw.t = 0;
        sw.angle = this.w.aim;
        sw.hit.clear();
        this.w.lungeX = Math.cos(this.w.aim) * S.lungeSpeed;
        this.w.lungeY = Math.sin(this.w.aim) * S.lungeSpeed;
        this.g.sfx.swing();
        this.w.trauma = Math.min(1, this.w.trauma + 0.1);
        this.w.kickX += Math.cos(this.w.aim) * 7;
        this.w.kickY += Math.sin(this.w.aim) * 7;
      } else {
        this.drawBlade(this.w.aim - sw.dir * (S.arcHalfAngle + 24) * DEG, 0.5, 0);
        return;
      }
    }

    if (sw.state === 'swing') {
      const p = clamp(sw.t / S.swing, 0, 1);
      const eased = 1 - (1 - p) * (1 - p);
      const start = sw.angle - sw.dir * S.arcHalfAngle * DEG;
      const end = sw.angle + sw.dir * S.arcHalfAngle * DEG;
      const theta = start + (end - start) * eased;
      this.drawBlade(theta, 1, sw.dir);
      this.bladeHits(theta);
      if (sw.t >= S.swing) {
        sw.state = 'recover';
        sw.t = 0;
      }
      return;
    }

    // recover
    const fade = 1 - clamp(sw.t / S.recover, 0, 1);
    this.drawBlade(sw.angle + sw.dir * S.arcHalfAngle * DEG, fade * 0.7, 0);
    if (sw.t >= S.recover) {
      sw.state = 'idle';
      sw.t = 0;
    }
  }

  drawBlade(theta: number, alpha: number, trailDir: number): void {
    const reach = profile.stats.bladeReach;
    const g = this.g.bladeGfx;
    g.clear();
    const ox = this.w.px;
    const oy = this.w.py;
    // Motion-blur trail: ghost blades trailing behind the real one.
    if (trailDir !== 0) {
      for (let i = 7; i >= 1; i--) {
        const a = theta - trailDir * i * 8 * DEG;
        const t = 1 - i / 8;
        g.lineStyle(5 - i * 0.4, 0x7fe8ff, t * 0.55 * alpha);
        g.lineBetween(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26, ox + Math.cos(a) * reach, oy + Math.sin(a) * reach);
      }
    }
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    g.lineStyle(9, 0x7fe8ff, 0.3 * alpha);
    g.lineBetween(ox + cs * 22, oy + sn * 22, ox + cs * reach, oy + sn * reach);
    g.lineStyle(4, 0xffffff, alpha);
    g.lineBetween(ox + cs * 22, oy + sn * 22, ox + cs * reach, oy + sn * reach);
    this.g.bladeGlow
      .setVisible(true)
      .setPosition(ox + cs * reach * 0.8, oy + sn * reach * 0.8)
      .setScale(0.9)
      .setAlpha(0.55 * alpha);
  }

  bladeHits(theta: number): void {
    const S = T.sword;
    const reach = profile.stats.bladeReach;
    for (const m of this.w.mobs) {
      if (m.dead || this.w.sw.hit.has(m)) continue;
      const dx = m.x - this.w.px;
      const dy = m.y - this.w.py;
      const d = Math.hypot(dx, dy);
      if (d > reach + m.radius) continue;
      const ang = Math.atan2(dy, dx);
      const tol = S.hitTolerance * DEG + Math.asin(Math.min(1, m.radius / Math.max(d, 1)));
      if (Math.abs(angleDiff(ang, theta)) > tol) continue;
      this.w.sw.hit.add(m);
      this.g.combat.damageMob(m, rollDamage(this.g.rng, profile.stats.bladeDamage, S.damageVariance), ang, 'sword', m.x - Math.cos(ang) * m.radius * 0.5, m.y - Math.sin(ang) * m.radius * 0.5, theta);
    }
    // The blade also cuts incoming fire out of the air.
    for (const b of this.w.bullets) {
      if (!b.active || b.friendly) continue;
      const dx = b.x - this.w.px;
      const dy = b.y - this.w.py;
      const d = Math.hypot(dx, dy);
      if (d > reach + 8) continue;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), theta)) > S.hitTolerance * DEG + 0.2) continue;
      b.active = false;
      b.img.setVisible(false);
      this.g.particles.burst(b.x, b.y, theta, 2, 8, 140, 440, {
        life: 0.25, w: 10, h: 1.8, color: PALETTE.robot, add: true, drag: 3, align: true,
      });
      this.g.glows.at(b.x, b.y, PALETTE.robot, 1, 0.3, 0.08, 0.7);
      this.g.sfx.hit('metal', false);
      this.w.trauma = Math.min(1, this.w.trauma + 0.05);
    }
  }
}
