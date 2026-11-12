import { TUNING as T } from '../../data/tuning';
import { profile } from '../profile';
import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';

import { pushFeed, runState, setBanner } from '../runState';
import { collide } from '../../sim/collide';
import type { Ctx } from '../ctx';

/** Movement, dash, hurt and death. */
export class PlayerSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  updatePlayer(dt: number): void {
    const P = T.player;
    const k = this.g.keys;
    const K = Phaser.Input.Keyboard;
    let ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const moving = ix !== 0 || iy !== 0;
    if (moving) {
      const l = Math.hypot(ix, iy);
      ix /= l;
      iy /= l;
    }

    this.w.dashCd = Math.max(0, this.w.dashCd - dt);
    const dashPressed = K.JustDown(k.SHIFT) || K.JustDown(k.SPACE);
    if (this.w.dashT > 0) {
      if (dashPressed) runState.dashDeny = 1; // already dashing, and the cooldown is running
      this.w.dashT -= dt;
      this.w.pvx = this.w.dashX * P.dashSpeed;
      this.w.pvy = this.w.dashY * P.dashSpeed;
      for (let i = 0; i < 2; i++) {
        this.g.particles.emit({
          x: this.w.px + (Math.random() - 0.5) * 10,
          y: this.w.py + (Math.random() - 0.5) * 10,
          vx: 0, vy: 0, life: 0.22, w: 22, h: 22,
          color: PALETTE.player, alpha: 0.35, add: true, shrink: true,
        });
      }
    } else {
      if (dashPressed) {
        if (this.w.dashCd <= 0 && this.w.sw.state !== 'swing') {
          this.w.dashT = P.dashTime;
          this.w.dashCd = profile.stats.dashCooldown;
          this.w.dashX = moving ? ix : Math.cos(this.w.aim);
          this.w.dashY = moving ? iy : Math.sin(this.w.aim);
          this.g.sfx.dash();
          this.w.trauma = Math.min(1, this.w.trauma + 0.1);
          this.w.kickX += this.w.dashX * 6;
          this.w.kickY += this.w.dashY * 6;
        } else {
          // Pressed too early: flash the cooldown box so the miss is readable.
          runState.dashDeny = 1;
          this.g.sfx.empty();
        }
      }
      const factor = this.w.sw.state === 'windup' || this.w.sw.state === 'swing' ? P.swingMoveFactor : 1;
      const tvx = ix * profile.stats.moveSpeed * factor;
      const tvy = iy * profile.stats.moveSpeed * factor;
      const dvx = tvx - this.w.pvx;
      const dvy = tvy - this.w.pvy;
      const len = Math.hypot(dvx, dvy);
      const step = (moving ? P.accel : P.friction) * dt;
      if (len <= step) {
        this.w.pvx = tvx;
        this.w.pvy = tvy;
      } else {
        this.w.pvx += (dvx / len) * step;
        this.w.pvy += (dvy / len) * step;
      }
    }

    const lk = Math.exp(-T.sword.lungeDecay * dt);
    this.w.lungeX *= lk;
    this.w.lungeY *= lk;

    const ox = this.w.px;
    const oy = this.w.py;
    this.w.px += (this.w.pvx + this.w.lungeX) * dt;
    this.w.py += (this.w.pvy + this.w.lungeY) * dt;
    const pos = { x: this.w.px, y: this.w.py };
    collide(pos, P.radius);
    this.w.px = pos.x;
    this.w.py = pos.y;
    this.w.stepDist += Math.hypot(this.w.px - ox, this.w.py - oy);
    if (this.w.stepDist >= P.stepDistance) {
      this.w.stepDist = 0;
      this.g.sfx.step();
      this.w.trauma = Math.min(1, this.w.trauma + 0.014);
    }

    // Shield regen.
    this.w.shieldCd -= dt;
    if (this.w.shieldCd <= 0 && runState.shield < runState.maxShield) {
      runState.shield = Math.min(runState.maxShield, runState.shield + profile.stats.shieldRegenRate * dt);
    }

    // Flash on hurt.
    if (this.w.playerFlash > 0) {
      this.w.playerFlash -= dt;
      if (!this.w.playerFlashing) {
        this.w.playerFlashing = true;
        this.g.rig.setFlash(true);
      }
    } else if (this.w.playerFlashing) {
      this.w.playerFlashing = false;
      this.g.rig.setFlash(false);
    }

    this.g.rig.setDashing(this.w.dashT > 0);
    this.g.rig.update(dt, Math.hypot(this.w.px - ox, this.w.py - oy), Math.hypot(this.w.pvx, this.w.pvy) / profile.stats.moveSpeed);
    this.g.rig.setPose(this.w.px, this.w.py, this.w.aim);
    this.g.shieldGfx
      .setPosition(this.w.px, this.w.py)
      .setAlpha(0.12 + 0.4 * (runState.shield / runState.maxShield) + this.w.playerFlash * 3);
  }

  hurtPlayer(dmg: number, fromAngle: number): void {
    if (this.w.dashT > 0 || this.w.dead) return;
    const s = runState;
    this.w.shieldCd = profile.stats.shieldRegenDelay;
    const hadShield = s.shield > 0;
    const soak = Math.min(s.shield, dmg);
    s.shield -= soak;
    s.hp -= dmg - soak;
    s.damageFlash = 1;
    this.w.playerFlash = 0.09;
    this.w.trauma = Math.min(1, this.w.trauma + T.juice.playerHurtTrauma);
    this.w.pvx += Math.cos(fromAngle) * 90;
    this.w.pvy += Math.sin(fromAngle) * 90;
    this.g.sfx.hurt();
    if (soak > 0) this.g.nums.spawn(this.w.px - 8, this.w.py - 26, `-${Math.round(soak)}`, 'shield');
    if (dmg - soak > 0) this.g.nums.spawn(this.w.px + 8, this.w.py - 40, `-${Math.round(dmg - soak)}`, 'hurt');
    if (hadShield && s.shield <= 0) {
      this.g.particles.burst(this.w.px, this.w.py, 0, Math.PI * 2, 18, 120, 420, {
        life: 0.35, w: 10, h: 2, color: PALETTE.shield, add: true, drag: 3, align: true,
      });
      this.g.glows.at(this.w.px, this.w.py, PALETTE.shield, 2.4, 0.4, 0.28, 0.8);
    } else {
      this.g.particles.burst(this.w.px, this.w.py, fromAngle, 1.6, 6, 80, 260, {
        life: 0.35, w: 7, h: 1.8, color: s.shield > 0 ? PALETTE.shield : PALETTE.player, add: true, drag: 4, align: true,
      });
    }
    if (s.hp <= 0) this.die();
  }

  die(): void {
    this.w.dead = true;
    this.w.deadTimer = 1.9;
    const lost = runState.carried.length;
    runState.carried = [];
    setBanner('CLONE LOST', 1.9);
    pushFeed(lost > 0 ? `Cargo lost: ${lost} item${lost > 1 ? 's' : ''}` : 'Clone lost', PALETTE.hostile);
    this.g.rig.setVisible(false);
    this.g.shieldGfx.setVisible(false);
    this.g.bladeGfx.clear();
    this.g.bladeGlow.setVisible(false);
    this.g.particles.burst(this.w.px, this.w.py, 0, Math.PI * 2, 34, 80, 520, {
      life: 0.8, w: 14, h: 2.4, color: PALETTE.player, drag: 2.6, spin: 9,
      decal: { color: 0x1b5a2b, alpha: 0.5, scale: 0.4 },
    });
    this.g.glows.at(this.w.px, this.w.py, PALETTE.player, 3.4, 0.5, 0.4, 0.9);
    this.g.sfx.explosion();
    this.w.addHitStop(0.13);
    this.w.trauma = 1;
  }
}
