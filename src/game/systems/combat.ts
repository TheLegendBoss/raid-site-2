import { MOB_AI } from '../../data/mobs';
import { TUNING as T } from '../../data/tuning';
import { profile } from '../profile';
import { PALETTE } from '../../data/palette';
import { drawBar } from '../../fx/mobArt';
import { runState, setBanner } from '../runState';
import { armourFactor } from '../../sim/weapon';
import type { Bullet, Mob, Source } from '../types';
import type { Ctx } from '../ctx';

/** Damage, kills and their effects. */
export class CombatSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  private lastFxShot = -1;
  private killImpact = 0.5;

  damageMob(m: Mob, dmg: number, ang: number, source: Source, hx: number, hy: number, cutAngle = ang, bullet?: Bullet): void {
    if (m.dead) return;
    const J = T.juice;
    const IM = T.impact;
    const def = m.def;
    const heavy = source === 'sword';
    const impact = bullet ? bullet.impact : 0.5;
    // Armour: a round below the target's armour is mostly turned away (Helldivers 2 style).
    let resisted = false;
    if (bullet && !heavy) {
      const f = armourFactor(bullet.ap, def.armour, T.armour.table);
      if (f < 1) {
        dmg = Math.max(1, Math.round(dmg * f));
        resisted = true;
      }
    }
    m.hp -= dmg;
    m.flash = 0.07;
    runState.hitMarker = 1;
    this.g.nums.spawn(m.x, m.y - m.radius - 6, String(dmg), heavy ? 'blade' : resisted ? 'resist' : 'gun');
    // Pellets share one trigger pull: feedback fires once per shot, not once per pellet.
    const firstOfShot = !bullet || bullet.shot !== this.lastFxShot;
    if (bullet) this.lastFxShot = bullet.shot;
    this.killImpact = impact;

    const kbScale = heavy ? 1 : 1 - IM.knock / 2 + IM.knock * impact;
    const kb = (heavy ? profile.stats.blade.knockback * def.bladeKnockback : def.gunKnockback) * kbScale;
    m.vx += Math.cos(ang) * kb;
    m.vy += Math.sin(ang) * kb;

    if (def.metal || resisted) {
      if (resisted) {
        // Turned away: a fan of sparks thrown back off the plating, and a ping.
        this.g.particles.burst(hx, hy, ang + Math.PI + (Math.random() - 0.5) * 0.8, 1.1, IM.resistSparks, 220, 620, {
          life: 0.28, w: 14, h: 1.6, color: PALETTE.white, add: true, drag: 3, align: true,
        });
        this.g.glows.at(hx, hy, PALETTE.white, 0.8, 0.25, 0.07, 0.8);
        if (firstOfShot) this.g.sfx.ricochet(impact);
      } else {
        const n = heavy ? 18 : Math.round(3 + impact * IM.sparks);
        this.g.particles.burst(hx, hy, ang + Math.PI, 1.7, n, 160, 540 + impact * 120, {
          life: 0.3, w: 12 + impact * 3, h: 1.8, color: PALETTE.spark, add: true, drag: 3, align: true,
        });
        this.g.glows.at(hx, hy, PALETTE.spark, heavy ? 1.8 : 0.6 + impact * 0.6, 0.3, 0.09, 0.8);
        this.g.sfx.hit('metal', heavy);
        if (!heavy && impact >= IM.heavyAt && firstOfShot) this.g.sfx.heavyHit(impact);
      }
    } else {
      this.g.particles.burst(hx, hy, ang, heavy ? 1.3 : 0.9, heavy ? 12 : 5, 90, 400, {
        life: 0.5, w: 3.5, h: 3.5, color: def.id === 'spitter' ? 0x6fa82f : 0xc2261d, drag: 4,
        decal: { color: 0x7a120f, alpha: 0.5, scale: 0.34 },
      });
      this.g.sfx.hit('flesh', heavy);
    }
    if (m.bar) drawBar(m);

    if (!heavy && impact >= IM.heavyAt && firstOfShot && !resisted) {
      this.w.addHitStop(IM.hitStop * impact);
      this.w.trauma = Math.min(1, this.w.trauma + IM.hitTrauma * impact);
    }
    if (!heavy && bullet && def.stagger && !resisted && m.stagImmune <= 0) {
      // Stagger builds across hits; when the meter fills the enemy stumbles and its attack winds down.
      m.stagMeter += bullet.stagger;
      if (m.stagMeter >= def.stagger.at) {
        m.stagMeter = 0;
        m.stagger = def.stagger.time;
        m.stagImmune = def.stagger.time + def.stagger.immune;
        m.phase = 'move';
        m.phaseTime = 0;
        this.g.ring(m.x, m.y, PALETTE.spark, 0.22, 2.4);
      }
    }

    if (heavy) {
      this.w.addHitStop(J.hitStopSwordHit);
      this.w.trauma = Math.min(1, this.w.trauma + J.swordHitTrauma);
      this.w.zoomPunch = Math.min(0.06, this.w.zoomPunch + J.swordZoomPunch);
      if (def.stagger) {
        m.stagger = profile.stats.blade.stagger;
        m.phase = 'move';
        m.phaseTime = 0;
      }
    }

    if (m.hp <= 0) this.killMob(m, ang, source, cutAngle);
  }

  killMob(m: Mob, ang: number, source: Source, cutAngle: number): void {
    const J = T.juice;
    const byPlayer = m.hp <= 0; // a bloater that detonates itself leaves with hp to spare
    m.dead = true;
    m.gfx.destroy();
    m.bar?.destroy();

    if (byPlayer) {
      if (this.w.comboTimer > 0) runState.combo += 1;
      else runState.combo = 1;
      this.w.comboTimer = J.comboWindow;
      runState.killMarker = 1;
    }

    if (m.def.behaviour === 'bomber') this.bomberBlast(m);
    if (m.kind === 'warden') {
      this.killWarden(m, ang);
      return;
    }

    if (m.def.metal) {
      this.explodeRobot(m, ang);
    } else {
      const big = source === 'sword';
      const sz = Math.max(1, m.radius / 12); // bigger bodies shed more
      const col = m.def.color;
      const blood = m.kind === 'spitter' ? 0x6fa82f : 0xc2261d;
      const decal = m.kind === 'spitter' ? 0x2f5412 : 0x8a1a14;
      // Shatter into line segments.
      this.g.particles.burst(m.x, m.y, ang, big ? 1.2 : 2.2, Math.round((big ? 8 : 7) * sz), 120, big ? 560 : 360, {
        life: 0.7, w: 13 * Math.min(sz, 1.8), h: 2.4, color: col, drag: 3, spin: 10,
        decal: { color: decal, alpha: 0.5, scale: 0.3 * sz },
      });
      this.g.particles.burst(m.x, m.y, ang, big ? 1.5 : 2.6, Math.round((big ? 28 : 12) * sz), 90, big ? 520 : 340, {
        life: 0.6, w: 4, h: 4, color: blood, drag: 4,
        decal: { color: 0x6a0f0b, alpha: 0.55, scale: 0.42 * sz },
      });
      if (big) {
        // Bisect: two halves peel away perpendicular to the cut.
        for (const side of [-1, 1]) {
          const tan = cutAngle + (side * Math.PI) / 2;
          this.g.particles.burst(m.x, m.y, tan, 0.7, 5, 200, 520, {
            life: 0.75, w: 12, h: 2.8, color: col, drag: 3.2, spin: 12,
            decal: { color: decal, alpha: 0.55, scale: 0.4 },
          });
          this.g.particles.burst(m.x, m.y, tan, 0.5, 8, 160, 480, {
            life: 0.55, w: 5, h: 5, color: blood, drag: 3.6,
            decal: { color: 0x6a0f0b, alpha: 0.6, scale: 0.5 },
          });
        }
        // The cut itself, a bright line through the body.
        this.g.particles.emit({
          x: m.x, y: m.y, vx: 0, vy: 0, life: 0.11, w: 84 * Math.min(sz, 1.6), h: 3, rot: cutAngle,
          color: PALETTE.white, add: true,
        });
        this.g.glows.at(m.x, m.y, 0xff8a7a, 2.2 * sz, 0.5, 0.16, 0.85);
        this.g.ring(m.x, m.y, col, 0.35);
        this.w.addHitStop(J.hitStopSwordKill);
        this.w.trauma = Math.min(1, this.w.trauma + J.swordKillTrauma);
        if (byPlayer) this.refundOnKill();
      } else {
        this.w.addHitStop(J.hitStopGunKill + T.impact.killStop * this.killImpact);
        this.w.trauma = Math.min(1, this.w.trauma + 0.03 + T.impact.killTrauma * this.killImpact);
        this.g.sfx.kill(0.8);
      }
    }
    if (byPlayer) this.dropFor(m);
  }

  /** Loot by the enemy's table. */
  private dropFor(m: Mob): void {
    const L = m.def.loot;
    for (let i = 0; i < L.drops; i++) {
      if (L.chance >= 1 || this.g.rng.next() < L.chance) this.g.lootSys.dropLoot(m.x, m.y, L.minRarity);
    }
  }

  /** A bloater going up: hurts the player in range, shoves everything near. */
  private bomberBlast(m: Mob): void {
    const A = MOB_AI.bomber;
    const col = m.def.color;
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, 22, 120, 560, {
      life: 0.4, w: 13, h: 1.8, color: col, add: true, drag: 2.6, align: true,
    });
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, 12, 60, 300, {
      life: 0.7, w: 5, h: 5, color: 0xc2261d, drag: 3.4, decal: { color: 0x6a0f0b, alpha: 0.55, scale: 0.8 },
    });
    this.g.glows.at(m.x, m.y, col, 3.2, 0.5, 0.3, 0.8);
    this.g.ring(m.x, m.y, col, 0.35, A.blastRadius / 14);
    this.g.sfx.explosion();
    this.w.trauma = Math.min(1, this.w.trauma + 0.28);
    const dx = this.w.px - m.x;
    const dy = this.w.py - m.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < A.blastRadius + T.player.radius) {
      const k = 1 - 0.5 * Math.min(1, d / A.blastRadius);
      this.g.playerSys.hurtPlayer(Math.round(A.blastDamage * m.dmgMul * k), Math.atan2(-dy, -dx));
      this.w.pvx += (dx / d) * A.blastKnock * k;
      this.w.pvy += (dy / d) * A.blastKnock * k;
    }
    for (const o of this.w.mobs) {
      if (o.dead || o === m) continue;
      const od = Math.hypot(o.x - m.x, o.y - m.y);
      if (od < A.blastRadius) {
        const a = Math.atan2(o.y - m.y, o.x - m.x);
        o.vx += Math.cos(a) * 300 * (1 - od / A.blastRadius);
        o.vy += Math.sin(a) * 300 * (1 - od / A.blastRadius);
      }
    }
  }

  private killWarden(m: Mob, ang: number): void {
    this.w.bossDown = true;
    this.g.mobSys.collapseAdds(m);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4 + ang;
      this.g.scene.time.delayedCall(i * 140, () => {
        const ox = m.x + Math.cos(a) * 34;
        const oy = m.y + Math.sin(a) * 34;
        this.g.particles.burst(ox, oy, 0, Math.PI * 2, 24, 140, 700, {
          life: 0.5, w: 14, h: 1.8, color: PALETTE.spark, add: true, drag: 2.6, align: true,
        });
        this.g.glows.at(ox, oy, PALETTE.ember, 5, 0.9, 0.4, 0.8);
        this.g.ring(ox, oy, PALETTE.ember, 0.5, 8);
        this.g.sfx.explosion();
        this.w.trauma = Math.min(1, this.w.trauma + 0.35);
      });
    }
    this.explodeRobot(m, ang);
    this.g.ring(m.x, m.y, PALETTE.white, 0.9, 16);
    this.w.addHitStop(0.22);
    this.w.trauma = 1;
    setBanner('WARDEN DOWN', 2.4);
    this.dropFor(m);
    // The bunker's own prize, on top of the Warden's table.
    const rarity = Math.max(m.def.loot.minRarity, this.w.bossRarity);
    for (let i = 0; i < T.run.clearBonusItems; i++) this.g.lootSys.dropLoot(m.x, m.y, rarity);
  }

  explodeRobot(m: Mob, ang: number): void {
    const J = T.juice;
    const sz = Math.max(0.7, m.radius / 21);
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, Math.round(30 * sz), 140, 720, {
      life: 0.45, w: 14, h: 1.8, color: PALETTE.spark, add: true, drag: 2.6, align: true,
    });
    this.g.particles.burst(m.x, m.y, ang, 2.4, 10, 100, 460, {
      life: 0.9, w: 16, h: 3, color: PALETTE.robot, drag: 2.4, spin: 9,
      decal: { color: 0x2b1038, alpha: 0.6, scale: 0.4 },
    });
    this.g.particles.burst(m.x, m.y, 0, Math.PI * 2, 8, 40, 200, {
      life: 0.7, w: 6, h: 6, color: 0x222222, drag: 3, decal: { color: 0x000000, alpha: 0.5, scale: 1.7 * sz },
    });
    this.g.glows.at(m.x, m.y, PALETTE.white, 4.2 * sz, 0.4, 0.34, 0.95);
    this.g.glows.at(m.x, m.y, PALETTE.robot, 6.4 * sz, 1.2, 0.5, 0.6);
    this.g.ring(m.x, m.y, PALETTE.robot, 0.45, 7 * sz);
    this.g.scene.cameras.main.flash(80, 210, 170, 255, false);
    this.g.sfx.explosion();
    this.w.addHitStop(J.hitStopRobotDeath);
    this.w.trauma = Math.min(1, this.w.trauma + J.robotDeathTrauma);
    this.w.zoomPunch = Math.min(0.07, this.w.zoomPunch + J.robotDeathZoomPunch);
    // Blast shoves nearby enemies.
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
    const mult = profile.stats.bladeRefund;
    const ammo = Math.round(S.reserveRefund * mult);
    runState.reserve = Math.min(runState.maxReserve, runState.reserve + ammo);
    this.g.nums.spawn(this.w.px, this.w.py - 30, `+${ammo}`, 'refund');
    runState.shield = Math.min(runState.maxShield, runState.shield + S.shieldRefund * mult);
    runState.refundFlash = 1;
    this.g.sfx.kill(1 + Math.min(runState.combo, 9) * 0.07);
    this.g.ring(this.w.px, this.w.py, PALETTE.ammo, 0.28, 3.2);
  }
}
