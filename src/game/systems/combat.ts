import { TUNING as T } from '../../data/tuning';
import { PALETTE } from '../../data/palette';
import { drawBar } from '../../fx/mobArt';
import { runState } from '../runState';
import type { Mob, Source } from '../types';
import type { Ctx } from '../ctx';

/** Damage, kills and their effects. */
export class CombatSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  damageMob(m: Mob, dmg: number, ang: number, source: Source, hx: number, hy: number, cutAngle = ang): void {
    if (m.dead) return;
    const J = T.juice;
    const isRobot = m.kind === 'robot';
    const heavy = source === 'sword';
    m.hp -= dmg;
    m.flash = 0.07;
    runState.hitMarker = 1;
    this.g.nums.spawn(m.x, m.y - m.radius - 6, String(dmg), heavy ? 'blade' : 'gun');

    const kb = heavy ? T.sword.knockback * (isRobot ? 0.3 : 1) : isRobot ? T.robot.gunKnockback : T.scav.gunKnockback;
    m.vx += Math.cos(ang) * kb;
    m.vy += Math.sin(ang) * kb;

    if (isRobot) {
      this.g.particles.burst(hx, hy, ang + Math.PI, 1.7, heavy ? 18 : 5, 160, 540, {
        life: 0.3, w: 12, h: 1.8, color: PALETTE.spark, add: true, drag: 3, align: true,
      });
      this.g.glows.at(hx, hy, PALETTE.spark, heavy ? 1.8 : 0.9, 0.3, 0.09, 0.8);
      this.g.sfx.hit('metal', heavy);
      drawBar(m);
    } else {
      this.g.particles.burst(hx, hy, ang, heavy ? 1.3 : 0.9, heavy ? 12 : 5, 90, 400, {
        life: 0.5, w: 3.5, h: 3.5, color: 0xc2261d, drag: 4,
        decal: { color: 0x7a120f, alpha: 0.5, scale: 0.34 },
      });
      this.g.sfx.hit('flesh', heavy);
    }

    if (heavy) {
      this.w.addHitStop(J.hitStopSwordHit);
      this.w.trauma = Math.min(1, this.w.trauma + J.swordHitTrauma);
      this.w.zoomPunch = Math.min(0.06, this.w.zoomPunch + J.swordZoomPunch);
      if (isRobot) {
        m.stagger = T.sword.staggerRobot;
        m.phase = 'move';
        m.phaseTime = 0;
      }
    }

    if (m.hp <= 0) this.killMob(m, ang, source, cutAngle);
  }

  killMob(m: Mob, ang: number, source: Source, cutAngle: number): void {
    const J = T.juice;
    m.dead = true;
    m.gfx.destroy();
    m.bar?.destroy();

    if (this.w.comboTimer > 0) runState.combo += 1;
    else runState.combo = 1;
    this.w.comboTimer = J.comboWindow;
    runState.killMarker = 1;

    if (m.kind === 'scav') {
      const big = source === 'sword';
      // Shatter into line segments.
      this.g.particles.burst(m.x, m.y, ang, big ? 1.2 : 2.2, big ? 8 : 7, 120, big ? 560 : 360, {
        life: 0.7, w: 13, h: 2.4, color: PALETTE.hostile, drag: 3, spin: 10,
        decal: { color: 0x8a1a14, alpha: 0.5, scale: 0.3 },
      });
      this.g.particles.burst(m.x, m.y, ang, big ? 1.5 : 2.6, big ? 28 : 12, 90, big ? 520 : 340, {
        life: 0.6, w: 4, h: 4, color: 0xc2261d, drag: 4,
        decal: { color: 0x6a0f0b, alpha: 0.55, scale: 0.42 },
      });
      if (big) {
        // Bisect: two halves peel away perpendicular to the cut.
        for (const side of [-1, 1]) {
          const tan = cutAngle + (side * Math.PI) / 2;
          this.g.particles.burst(m.x, m.y, tan, 0.7, 5, 200, 520, {
            life: 0.75, w: 12, h: 2.8, color: PALETTE.hostile, drag: 3.2, spin: 12,
            decal: { color: 0x8a1a14, alpha: 0.55, scale: 0.4 },
          });
          this.g.particles.burst(m.x, m.y, tan, 0.5, 8, 160, 480, {
            life: 0.55, w: 5, h: 5, color: 0xc2261d, drag: 3.6,
            decal: { color: 0x6a0f0b, alpha: 0.6, scale: 0.5 },
          });
        }
        // The cut itself, a bright line through the body.
        this.g.particles.emit({
          x: m.x, y: m.y, vx: 0, vy: 0, life: 0.11, w: 84, h: 3, rot: cutAngle,
          color: PALETTE.white, add: true,
        });
        this.g.glows.at(m.x, m.y, 0xff8a7a, 2.2, 0.5, 0.16, 0.85);
        this.g.ring(m.x, m.y, PALETTE.hostile, 0.35);
        this.w.addHitStop(J.hitStopSwordKill);
        this.w.trauma = Math.min(1, this.w.trauma + J.swordKillTrauma);
        this.refundOnKill();
      } else {
        this.w.addHitStop(J.hitStopGunKill);
        this.w.trauma = Math.min(1, this.w.trauma + 0.07);
        this.g.sfx.kill(0.8);
      }
      if (this.g.rng.next() < T.scav.lootChance) this.g.lootSys.dropLoot(m.x, m.y, 0);
    } else {
      this.explodeRobot(m, ang);
    }
  }

  explodeRobot(m: Mob, ang: number): void {
    const J = T.juice;
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, 30, 140, 720, {
      life: 0.45, w: 14, h: 1.8, color: PALETTE.spark, add: true, drag: 2.6, align: true,
    });
    this.g.particles.burst(m.x, m.y, ang, 2.4, 10, 100, 460, {
      life: 0.9, w: 16, h: 3, color: PALETTE.robot, drag: 2.4, spin: 9,
      decal: { color: 0x2b1038, alpha: 0.6, scale: 0.4 },
    });
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, 8, 40, 200, {
      life: 0.7, w: 6, h: 6, color: 0x222222, drag: 3, decal: { color: 0x000000, alpha: 0.5, scale: 1.7 },
    });
    this.g.glows.at(m.x, m.y, PALETTE.white, 4.2, 0.4, 0.34, 0.95);
    this.g.glows.at(m.x, m.y, PALETTE.robot, 6.4, 1.2, 0.5, 0.6);
    this.g.ring(m.x, m.y, PALETTE.robot, 0.45, 7);
    this.g.scene.cameras.main.flash(80, 210, 170, 255, false);
    this.g.sfx.explosion();
    this.w.addHitStop(J.hitStopRobotDeath);
    this.w.trauma = Math.min(1, this.w.trauma + J.robotDeathTrauma);
    this.w.zoomPunch = Math.min(0.07, this.w.zoomPunch + J.robotDeathZoomPunch);
    for (let i = 0; i < T.robot.lootDrops; i++) {
      this.g.lootSys.dropLoot(m.x, m.y, T.robot.lootMinRarity);
    }
    // Blast shoves nearby scavengers.
    for (const o of this.w.mobs) {
      if (o.dead || o === m) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < 150) {
        const a = Math.atan2(o.y - m.y, o.x - m.x);
        o.vx += Math.cos(a) * 380 * (1 - d / 150);
        o.vy += Math.sin(a) * 380 * (1 - d / 150);
      }
    }
  }

  refundOnKill(): void {
    const S = T.sword;
    runState.reserve = Math.min(runState.maxReserve, runState.reserve + S.reserveRefund);
    this.g.nums.spawn(this.w.px, this.w.py - 30, `+${S.reserveRefund}`, 'refund');
    runState.shield = Math.min(runState.maxShield, runState.shield + S.shieldRefund);
    runState.refundFlash = 1;
    this.g.sfx.kill(1 + Math.min(runState.combo, 9) * 0.07);
    this.g.ring(this.w.px, this.w.py, PALETTE.ammo, 0.28, 3.2);
  }
}
