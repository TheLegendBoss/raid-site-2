// Enemy behaviours, one method per kind of brain. The spawner and the loop are in mobs.ts; numbers are
// in src/data/mobs.ts (MOBS, MOB_AI). Telegraphs are pushed into `lasers`, which mobs.ts draws.
import Phaser from 'phaser';
import { MOB_AI } from '../../data/mobs';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import { lineClear, lineClearWide, rayLength } from '../../sim/collide';
import { angleDiff, clamp } from '../../sim/math';
import type { Ctx } from '../ctx';
import { setBanner } from '../runState';
import type { Mob } from '../types';

export interface Laser {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  k: number;
  c: number;
}

export interface Brain {
  m: Mob;
  dt: number;
  dist: number;
  toPlayer: number;
  ux: number;
  uy: number;
  /** Where to walk to reach the player: straight at them, or along the pathfinding flow. */
  hx: number;
  hy: number;
  /** A clear way to the player. */
  sees: boolean;
  lasers: Laser[];
}

const rand = (a: number, b: number): number => Phaser.Math.FloatBetween(a, b);

export class MobAI {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  private los(m: Mob): boolean {
    return lineClear(m.x, m.y, this.w.px, this.w.py);
  }

  /** Push away from neighbours so swarms spread instead of stacking. */
  private separation(m: Mob): { sx: number; sy: number } {
    let sx = 0;
    let sy = 0;
    const sep = 24;
    for (const o of this.w.mobs) {
      if (o === m || o.dead) continue;
      const ox = m.x - o.x;
      const oy = m.y - o.y;
      const od = Math.hypot(ox, oy);
      if (od > 0 && od < sep) {
        const f = (sep - od) / sep;
        sx += (ox / od) * f * 180;
        sy += (oy / od) * f * 180;
      }
    }
    return { sx, sy };
  }

  private hurt(m: Mob, dmg: number, from: number): void {
    this.g.playerSys.hurtPlayer(Math.round(dmg * m.dmgMul), from);
  }

  /** Dispatch one enemy's brain for this frame. */
  update(b: Brain): void {
    const { m } = b;
    switch (m.def.behaviour) {
      case 'swarm': return this.swarm(b);
      case 'leaper': return this.leaper(b);
      case 'bomber': return this.bomber(b);
      case 'brute': return this.brute(b);
      case 'warden': return this.warden(b);
      default: return this.ranged(b);
    }
  }

  // ---- melee ------------------------------------------------------------------------------

  /** Close in and hit. Shared by scavengers, the stalker's approach and the brute's walk. */
  private meleeStep(b: Brain, speedMul = 1): void {
    const { m, dt, dist, toPlayer, ux, uy, hx, hy } = b;
    const c = m.def.contact!;
    m.wobble += dt * 7;
    m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 14 * dt);
    if (m.stagger <= 0) {
      const sp = m.speed * speedMul * (m.def.behaviour === 'swarm' ? 0.9 + 0.2 * Math.sin(m.wobble) : 1);
      const { sx, sy } = this.separation(m);
      if (dist > c.range * 0.7) {
        m.x += (hx * sp + sx) * dt;
        m.y += (hy * sp + sy) * dt;
      } else {
        m.x += sx * dt;
        m.y += sy * dt;
      }
    }
    m.attackCd -= dt;
    if (dist < c.range && m.attackCd <= 0 && m.stagger <= 0) {
      m.attackCd = c.cooldown;
      m.vx += ux * 200;
      m.vy += uy * 200;
      this.hurt(m, c.damage, toPlayer + Math.PI);
    }
  }

  private swarm(b: Brain): void {
    this.meleeStep(b);
  }

  /** Stalker: closes in, crouches, then lunges in a straight line. */
  private leaper(b: Brain): void {
    const { m, dt, dist, toPlayer } = b;
    const A = MOB_AI.leaper;
    if (m.phase === 'move' || m.phase === 'burst') {
      m.phase = 'move';
      this.meleeStep(b);
      m.shotCd -= dt;
      if (m.shotCd <= 0 && dist > A.triggerMin && dist < A.triggerMax && m.stagger <= 0) {
        m.phase = 'windup';
        m.phaseTime = A.windup;
        m.aimAngle = toPlayer;
        m.hitDone = false;
      }
    } else if (m.phase === 'windup') {
      m.phaseTime -= dt;
      if (m.phaseTime > 0.12) m.aimAngle += angleDiff(toPlayer, m.aimAngle) * Math.min(1, 9 * dt);
      m.facing = m.aimAngle;
      m.gfx.setScale(1 + 0.18 * (1 - clamp(m.phaseTime / A.windup, 0, 1)), 1 - 0.18 * (1 - clamp(m.phaseTime / A.windup, 0, 1)));
      b.lasers.push({
        x1: m.x, y1: m.y, x2: m.x + Math.cos(m.aimAngle) * 170, y2: m.y + Math.sin(m.aimAngle) * 170,
        k: 1 - clamp(m.phaseTime / A.windup, 0, 1), c: PALETTE.hostile,
      });
      if (m.phaseTime <= 0) {
        m.phase = 'charge';
        m.phaseTime = A.leapTime;
        m.gfx.setScale(1);
        this.g.glows.at(m.x, m.y, PALETTE.hostile, 1.2, 0.4, 0.12, 0.7);
      }
    } else if (m.phase === 'charge') {
      m.phaseTime -= dt;
      m.x += Math.cos(m.aimAngle) * A.leapSpeed * dt;
      m.y += Math.sin(m.aimAngle) * A.leapSpeed * dt;
      if (!m.hitDone && dist < m.def.contact!.range + 6) {
        m.hitDone = true;
        this.hurt(m, m.def.contact!.damage, m.aimAngle + Math.PI);
        m.vx -= Math.cos(m.aimAngle) * 120;
        m.vy -= Math.sin(m.aimAngle) * 120;
      }
      if (m.phaseTime <= 0) {
        m.phase = 'recover';
        m.phaseTime = A.recover;
      }
    } else {
      m.phaseTime -= dt;
      if (m.phaseTime <= 0) {
        m.phase = 'move';
        m.shotCd = rand(A.cooldownMin, A.cooldownMax);
      }
    }
  }

  /** Bloater: walks up and detonates (or you pop it first; it blasts either way). */
  private bomber(b: Brain): void {
    const { m, dt, dist, toPlayer, hx, hy } = b;
    const A = MOB_AI.bomber;
    m.wobble += dt * 6;
    m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 10 * dt);
    if (m.phase === 'windup') {
      m.phaseTime -= dt;
      const k = 1 - clamp(m.phaseTime / A.fuse, 0, 1);
      m.gfx.setScale(1 + 0.45 * k + 0.06 * Math.sin(m.wobble * 5));
      if (m.phaseTime <= 0) {
        m.gfx.setScale(1);
        this.g.combat.killMob(m, toPlayer, 'gun', toPlayer); // hp stays above zero: no loot for a self-detonation
      }
      return;
    }
    if (m.stagger <= 0) {
      const { sx, sy } = this.separation(m);
      const sp = m.speed * (0.9 + 0.2 * Math.sin(m.wobble));
      m.x += (hx * sp + sx) * dt;
      m.y += (hy * sp + sy) * dt;
    }
    if (dist < A.primeRange && b.sees) {
      m.phase = 'windup';
      m.phaseTime = A.fuse;
      this.g.sfx.charge();
    }
  }

  /** Brute: a slow walk, then a telegraphed charge it cannot steer. */
  private brute(b: Brain): void {
    const { m, dt, dist, toPlayer } = b;
    const A = MOB_AI.brute;
    if (m.stagger > 0) {
      m.phase = 'move';
      m.gfx.setScale(1);
      return;
    }
    if (m.phase === 'move' || m.phase === 'burst') {
      m.phase = 'move';
      this.meleeStep(b);
      m.shotCd -= dt;
      if (m.shotCd <= 0 && dist < A.triggerRange && this.los(m)) {
        m.phase = 'windup';
        m.phaseTime = A.windup;
        m.aimAngle = toPlayer;
        m.hitDone = false;
        this.g.sfx.charge();
      }
    } else if (m.phase === 'windup') {
      m.phaseTime -= dt;
      if (m.phaseTime > 0.25) m.aimAngle += angleDiff(toPlayer, m.aimAngle) * Math.min(1, 6 * dt);
      m.facing = m.aimAngle;
      const k = 1 - clamp(m.phaseTime / A.windup, 0, 1);
      m.gfx.setScale(1 + 0.08 * k);
      const len = A.chargeSpeed * A.chargeTime;
      b.lasers.push({
        x1: m.x, y1: m.y, x2: m.x + Math.cos(m.aimAngle) * len, y2: m.y + Math.sin(m.aimAngle) * len,
        k, c: PALETTE.ember,
      });
      if (m.phaseTime <= 0) {
        m.phase = 'charge';
        m.phaseTime = A.chargeTime;
        m.gfx.setScale(1);
        this.g.glows.at(m.x, m.y, PALETTE.ember, 2, 0.5, 0.2, 0.7);
      }
    } else if (m.phase === 'charge') {
      m.phaseTime -= dt;
      m.facing = m.aimAngle;
      m.x += Math.cos(m.aimAngle) * A.chargeSpeed * dt;
      m.y += Math.sin(m.aimAngle) * A.chargeSpeed * dt;
      this.g.particles.emit({
        x: m.x - Math.cos(m.aimAngle) * 20, y: m.y - Math.sin(m.aimAngle) * 20, vx: 0, vy: 0,
        life: 0.25, w: 26, h: 3, rot: m.aimAngle, color: PALETTE.ember, add: true, alpha: 0.5,
      });
      if (!m.hitDone && dist < m.radius + T.player.radius + 6) {
        m.hitDone = true;
        this.hurt(m, m.def.contact!.damage + 6, m.aimAngle + Math.PI);
        this.w.pvx += Math.cos(m.aimAngle) * A.hitKnock;
        this.w.pvy += Math.sin(m.aimAngle) * A.hitKnock;
        this.w.trauma = Math.min(1, this.w.trauma + 0.3);
      }
      if (m.phaseTime <= 0 || m.hitDone) {
        m.phase = 'recover';
        m.phaseTime = A.recover;
      }
    } else {
      m.phaseTime -= dt;
      if (m.phaseTime <= 0) {
        m.phase = 'move';
        m.shotCd = rand(A.cooldownMin, A.cooldownMax);
      }
    }
  }

  // ---- ranged -----------------------------------------------------------------------------

  /** Sentries, marksmen and spitters: keep a preferred range, telegraph, then shoot. */
  private ranged(b: Brain): void {
    const { m, dt, dist, toPlayer, ux, uy, hx, hy } = b;
    const R = m.def.ranged!;
    const los = this.los(m);
    if (m.stagger > 0) {
      m.phase = 'move';
      m.gfx.setScale(1);
      return;
    }

    if (m.phase === 'cover') {
      // Ducking out of sight to a spot picked after the last burst, then peeking back out.
      m.phaseTime -= dt;
      const cx = m.coverX - m.x;
      const cy = m.coverY - m.y;
      const cd = Math.hypot(cx, cy);
      m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 6 * dt);
      if (cd > MOB_AI.cover.arrive) {
        m.x += (cx / cd) * m.speed * MOB_AI.cover.speedMul * dt;
        m.y += (cy / cd) * m.speed * MOB_AI.cover.speedMul * dt;
      }
      if (m.phaseTime <= 0 || (cd <= MOB_AI.cover.arrive && los)) {
        m.phase = 'move';
        m.shotCd = rand(0.2, 0.6);
      }
      return;
    }

    if (m.phase === 'move') {
      m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 8 * dt);
      let vx = 0;
      let vy = 0;
      if (dist > R.preferredMax || !los) {
        vx = hx;
        vy = hy;
      } else if (dist < R.preferredMin) {
        vx = -ux;
        vy = -uy;
      } else {
        vx = -uy * m.strafe;
        vy = ux * m.strafe;
        if (Math.random() < 0.4 * dt) m.strafe = -m.strafe;
      }
      m.x += vx * m.speed * dt;
      m.y += vy * m.speed * dt;
      m.shotCd -= dt;
      if (m.shotCd <= 0 && los && dist < R.range) {
        m.phase = 'telegraph';
        m.phaseTime = R.telegraph;
        m.aimAngle = toPlayer;
        this.g.sfx.charge();
      }
    } else if (m.phase === 'telegraph') {
      m.phaseTime -= dt;
      if (!los) {
        m.phase = 'move';
        m.shotCd = 0.5;
        m.gfx.setScale(1);
        return;
      }
      // Track the player until the last moment, then commit.
      if (m.phaseTime > R.lockTime) m.aimAngle += angleDiff(toPlayer, m.aimAngle) * Math.min(1, 7 * dt);
      m.facing = m.aimAngle;
      const k = 1 - clamp(m.phaseTime / R.telegraph, 0, 1);
      if (R.laser) {
        const len = rayLength(m.x + Math.cos(m.aimAngle) * 30, m.y + Math.sin(m.aimAngle) * 30, m.aimAngle, 1000);
        b.lasers.push({
          x1: m.x + Math.cos(m.aimAngle) * 30, y1: m.y + Math.sin(m.aimAngle) * 30,
          x2: m.x + Math.cos(m.aimAngle) * len, y2: m.y + Math.sin(m.aimAngle) * len, k, c: PALETTE.robot,
        });
      } else {
        m.gfx.setScale(1 + 0.3 * k);
      }
      if (m.phaseTime <= 0) {
        m.gfx.setScale(1);
        m.phase = 'burst';
        m.shotsLeft = R.burstCount;
        m.shotTimer = 0;
      }
    } else {
      m.shotTimer -= dt;
      if (m.shotTimer <= 0) {
        const col = m.def.color;
        if (R.fan > 0) {
          // A fan of slow blobs, all at once.
          for (let i = 0; i < R.burstCount; i++) {
            const a = m.aimAngle + (i - (R.burstCount - 1) / 2) * R.fan;
            this.fire(m, a, R.bulletSpeed, R.bulletDamage, R.bulletLife, col, R.bulletW, R.bulletH);
          }
          m.shotsLeft = 0;
        } else {
          const a = m.aimAngle + (Math.random() - 0.5) * 0.04;
          this.fire(m, a, R.bulletSpeed, R.bulletDamage, R.bulletLife, col, R.bulletW, R.bulletH);
          m.shotsLeft -= 1;
        }
        const a0 = m.aimAngle;
        m.vx -= Math.cos(a0) * R.recoil;
        m.vy -= Math.sin(a0) * R.recoil;
        this.g.sfx.robotShot();
        m.shotTimer = R.burstGap;
        if (m.shotsLeft <= 0) {
          m.phase = 'move';
          m.shotCd = rand(R.cooldownMin, R.cooldownMax);
          if (this.w.floor && dist > MOB_AI.cover.minDist && Math.random() < MOB_AI.cover.chance && this.findCover(m)) {
            m.phase = 'cover';
            m.phaseTime = rand(MOB_AI.cover.time[0], MOB_AI.cover.time[1]);
          }
        }
      }
    }
  }

  /** Looks for a nearby spot the player cannot see that the shooter can walk to; sets coverX/Y. */
  private findCover(m: Mob): boolean {
    const C = MOB_AI.cover;
    const start = Math.random() * Math.PI * 2;
    for (const d of C.probe) {
      for (let i = 0; i < 12; i++) {
        const a = start + (i / 12) * Math.PI * 2;
        const x = m.x + Math.cos(a) * d;
        const y = m.y + Math.sin(a) * d;
        if (lineClear(x, y, this.w.px, this.w.py)) continue;
        if (!lineClearWide(m.x, m.y, x, y, m.radius)) continue;
        m.coverX = x;
        m.coverY = y;
        return true;
      }
    }
    return false;
  }

  private fire(m: Mob, a: number, speed: number, dmg: number, life: number, color: number, bw: number, bh: number): void {
    const off = m.radius + 13;
    const mx = m.x + Math.cos(a) * off;
    const my = m.y + Math.sin(a) * off;
    this.g.gunSys.fireBullet(mx, my, a, speed, Math.round(dmg * m.dmgMul), false, life, color, bw, bh);
    this.g.glows.at(mx, my, color, 1.4, 0.6, 0.09, 0.9);
  }

  // ---- the Warden -------------------------------------------------------------------------

  private warden(b: Brain): void {
    const { m, dt, dist, toPlayer, ux, uy, hx, hy } = b;
    const A = MOB_AI.warden;
    const frac = m.hp / m.maxHp;
    const stage = frac > A.stageHp[0] ? 0 : frac > A.stageHp[1] ? 1 : 2;
    if (stage !== m.bossStage) {
      m.bossStage = stage;
      setBanner(stage === 1 ? 'THE WARDEN CALLS FOR HELP' : 'THE WARDEN IS ENRAGED', 2);
      this.g.ring(m.x, m.y, PALETTE.ember, 0.6, 9);
      this.g.glows.at(m.x, m.y, PALETTE.ember, 6, 1, 0.5, 0.7);
      this.w.trauma = Math.min(1, this.w.trauma + 0.5);
      this.g.sfx.explosion();
      m.phase = 'move';
      m.bossCd = 1.2;
    }
    m.wobble += dt * 2;

    if (m.phase === 'move') {
      m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 5 * dt);
      let vx = 0;
      let vy = 0;
      if (dist > A.preferredMax) {
        vx = hx;
        vy = hy;
      } else if (dist < A.preferredMin) {
        vx = -ux;
        vy = -uy;
      } else {
        vx = -uy * m.strafe;
        vy = ux * m.strafe;
        if (Math.random() < 0.25 * dt) m.strafe = -m.strafe;
      }
      const sp = m.speed * A.stageSpeed[stage];
      m.x += vx * sp * dt;
      m.y += vy * sp * dt;
      m.bossCd -= dt;
      if (m.bossCd <= 0) this.wardenPick(m, stage, toPlayer);
      return;
    }

    m.phaseTime -= dt;
    m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 3 * dt);
    if (m.phase === 'telegraph') {
      const k = 1 - clamp(m.phaseTime / m.shotTimer, 0, 1);
      m.gfx.setScale(1 + 0.12 * k);
      if (m.bossAtk === 'fan') {
        if (m.phaseTime > 0.18) m.aimAngle += angleDiff(toPlayer, m.aimAngle) * Math.min(1, 6 * dt);
        const n = A.fan.count[stage];
        for (let i = 0; i < n; i++) {
          const a = m.aimAngle + (i - (n - 1) / 2) * (A.fan.arc / (n - 1));
          b.lasers.push({
            x1: m.x + Math.cos(a) * 50, y1: m.y + Math.sin(a) * 50,
            x2: m.x + Math.cos(a) * rayLength(m.x, m.y, a, 1100), y2: m.y + Math.sin(a) * rayLength(m.x, m.y, a, 1100), k: k * 0.7, c: PALETTE.ember,
          });
        }
      }
      if (m.phaseTime <= 0) {
        m.gfx.setScale(1);
        this.wardenFire(m, stage);
      }
    } else if (m.phase === 'burst') {
      // Only the sweep lingers: a stream that turns.
      m.shotTimer -= dt;
      m.bossSpin += A.sweep.spin * dt * (m.strafe > 0 ? 1 : -1);
      if (m.shotTimer <= 0) {
        m.shotTimer = A.sweep.gap;
        const arms = stage === 2 ? 3 : 2;
        for (let i = 0; i < arms; i++) {
          const a = m.bossSpin + (i * Math.PI * 2) / arms;
          this.fire(m, a, A.sweep.speed, A.sweep.damage, 3, PALETTE.ember, A.bulletW, A.bulletH);
        }
      }
      if (m.phaseTime <= 0) this.wardenRest(m, stage);
    } else if (m.phase === 'recover') {
      // A second ring, then rest.
      if (m.bossAtk === 'ring2' && m.phaseTime <= 0) {
        this.ring(m, stage, 0.5);
        this.wardenRest(m, stage);
      } else if (m.bossAtk !== 'ring2' && m.phaseTime <= 0) {
        this.wardenRest(m, stage);
      }
    }
  }

  private wardenRest(m: Mob, stage: number): void {
    m.phase = 'move';
    m.bossAtk = '';
    m.bossCd = MOB_AI.warden.cooldown[stage] * rand(0.85, 1.15);
  }

  private wardenPick(m: Mob, stage: number, toPlayer: number): void {
    const A = MOB_AI.warden;
    const pool = stage === 0 ? ['fan', 'ring'] : stage === 1 ? ['fan', 'ring', 'sweep', 'summon'] : ['fan', 'ring', 'sweep', 'summon', 'ring'];
    // Do not repeat the last attack back to back.
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === m.bossAtk) pick = pool[(pool.indexOf(pick) + 1) % pool.length];
    m.bossAtk = pick;
    m.phase = 'telegraph';
    m.aimAngle = toPlayer;
    const tele = pick === 'fan' ? A.fan.telegraph : pick === 'ring' ? A.ring.telegraph : pick === 'sweep' ? 0.7 : A.summon.telegraph;
    m.phaseTime = tele;
    m.shotTimer = tele; // reused here as the telegraph length
    m.strafe = Math.random() < 0.5 ? 1 : -1;
    m.bossSpin = toPlayer;
    this.g.sfx.charge();
    if (pick === 'ring' || pick === 'summon') this.g.ring(m.x, m.y, PALETTE.ember, tele, 4);
  }

  private wardenFire(m: Mob, stage: number): void {
    const A = MOB_AI.warden;
    switch (m.bossAtk) {
      case 'fan': {
        const n = A.fan.count[stage];
        for (let i = 0; i < n; i++) {
          const a = m.aimAngle + (i - (n - 1) / 2) * (A.fan.arc / (n - 1));
          this.fire(m, a, A.fan.speed, A.fan.damage, 2.4, PALETTE.ember, A.bulletW + 6, A.bulletH);
        }
        this.g.sfx.robotShot();
        this.wardenRest(m, stage);
        break;
      }
      case 'ring':
        this.ring(m, stage, 0);
        if (A.ring.second[stage]) {
          m.bossAtk = 'ring2';
          m.phase = 'recover';
          m.phaseTime = A.ring.secondDelay;
        } else {
          this.wardenRest(m, stage);
        }
        break;
      case 'sweep':
        m.phase = 'burst';
        m.phaseTime = A.sweep.duration;
        m.shotTimer = 0;
        break;
      case 'summon': {
        const n = A.summon.count[stage];
        for (let i = 0; i < n; i++) this.g.mobSys.queueSummon(m, stage === 2 && i % 3 === 2 ? 'bomber' : 'scav', 0.2 + i * 0.25);
        this.g.sfx.explosion();
        this.wardenRest(m, stage);
        break;
      }
      default:
        this.wardenRest(m, stage);
    }
  }

  /** A full ring of bullets; `phase` offsets the second ring so it fills the gaps of the first. */
  private ring(m: Mob, stage: number, phase: number): void {
    const A = MOB_AI.warden.ring;
    const n = A.count[stage];
    const off = phase * ((Math.PI * 2) / n);
    for (let i = 0; i < n; i++) {
      const a = off + (i * Math.PI * 2) / n;
      this.fire(m, a, A.speed, A.damage, 3.2, PALETTE.ember, MOB_AI.warden.bulletW, MOB_AI.warden.bulletH);
    }
    this.g.ring(m.x, m.y, PALETTE.ember, 0.4, 6);
    this.g.sfx.robotShot();
  }
}
