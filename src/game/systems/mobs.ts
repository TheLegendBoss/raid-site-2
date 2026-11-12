import { TUNING as T } from '../../data/tuning';
import Phaser from 'phaser';
import { PALETTE } from '../../data/palette';
import { PILLARS, PIPES } from '../../data/arena';
import { drawBar, drawMob } from '../../fx/mobArt';
import { pushFeed, setBanner } from '../runState';
import { waveIntel } from '../profile';
import { collide } from '../../sim/collide';
import { angleDiff, clamp, segmentIntersectsRect } from '../../sim/math';
import type { Mob, MobKind } from '../types';
import type { Ctx } from '../ctx';

/** Spawner, waves and enemy behaviour. */
export class MobSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  queueSpawn(kind: MobKind, delay: number, pipeIndex?: number): void {
    const pipe = PIPES[pipeIndex ?? Math.floor(Math.random() * PIPES.length)];
    this.w.spawnQueue.push({
      kind,
      x: pipe.x + pipe.dx * 46 + (Math.random() - 0.5) * 44,
      y: pipe.y + pipe.dy * 46 + (Math.random() - 0.5) * 44,
      t: delay,
    });
  }

  queueSwarm(count: number): void {
    // Prefer pipes away from the player so they have to come to you.
    const far = PIPES.map((p, i) => ({ i, d: Math.hypot(p.x - this.w.px, p.y - this.w.py) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    for (let i = 0; i < count; i++) {
      this.queueSpawn('scav', i * T.waves.spawnStagger, far[i % far.length].i);
    }
  }

  startWave(): void {
    const Wv = T.waves;
    this.w.wave += 1;
    this.w.waveLive = true;
    this.queueSwarm(Wv.scavBase + Wv.scavPerWave * (this.w.wave - 1));
    if (this.w.wave >= Wv.robotFromWave) {
      const robots = Math.min(Wv.robotCap, 1 + Math.floor((this.w.wave - Wv.robotFromWave) / Wv.robotEvery));
      for (let i = 0; i < robots; i++) this.queueSpawn('robot', 1.4 + i * 1.1);
    }
    setBanner(`WAVE ${this.w.wave}`, 2);
  }

  updateSpawner(dt: number): void {
    for (let i = this.w.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.w.spawnQueue[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.spawnMob(s.kind, s.x, s.y);
        this.w.spawnQueue.splice(i, 1);
      }
    }
    const alive = this.w.mobs.some((m) => !m.dead) || this.w.spawnQueue.length > 0;
    if (this.w.waveLive) {
      if (!alive) {
        this.w.waveLive = false;
        this.w.waveTimer = T.waves.intermission;
        setBanner('WAVE CLEARED', 1.8);
        const intel = waveIntel(this.w.wave);
        pushFeed(`+${intel} Intel`, PALETTE.robot);
      }
    } else {
      this.w.waveTimer -= dt;
      if (this.w.waveTimer <= 0 && !alive) this.startWave();
    }
  }

  spawnMob(kind: MobKind, x: number, y: number): void {
    const robot = kind === 'robot';
    const cfg = robot ? T.robot : T.scav;
    const gfx = this.g.scene.add.graphics().setDepth(robot ? 11 : 10);
    const m: Mob = {
      kind, gfx, x, y, vx: 0, vy: 0, hp: cfg.hp, maxHp: cfg.hp, radius: cfg.radius,
      speed: cfg.speed * (robot ? 1 : 1 + (Math.random() * 2 - 1) * T.scav.speedJitter),
      facing: Math.atan2(this.w.py - y, this.w.px - x), attackCd: 0.3, flash: 0, flashing: false,
      stagger: 0, wobble: Math.random() * 6, dead: false,
      phase: 'move', phaseTime: 0, shotsLeft: 0, shotTimer: 0,
      shotCd: robot ? Phaser.Math.FloatBetween(0.8, 1.6) : 0, aimAngle: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
    };
    if (robot) {
      m.bar = this.g.scene.add.graphics().setDepth(12);
      drawBar(m);
    }
    drawMob(m, false);
    gfx.setPosition(x, y).setRotation(m.facing);
    this.w.mobs.push(m);
    this.g.glows.at(x, y, robot ? PALETTE.robot : PALETTE.hostile, robot ? 2.6 : 1.3, 0.3, 0.3, 0.7);
  }

  killAll(): void {
    for (const m of this.w.mobs) {
      if (m.dead) continue;
      m.dead = true;
      m.gfx.destroy();
      m.bar?.destroy();
    }
    this.w.spawnQueue = [];
  }

  updateMobs(dt: number): void {
    this.w.mobs = this.w.mobs.filter((m) => !m.dead);
    const T_S = T.scav;
    const lasers: { x1: number; y1: number; x2: number; y2: number; k: number }[] = [];

    for (const m of this.w.mobs) {
      // Hit flash toggles the drawn colour only when the state flips.
      if (m.flash > 0) {
        m.flash -= dt;
        if (!m.flashing) {
          m.flashing = true;
          drawMob(m, true);
        }
      } else if (m.flashing) {
        m.flashing = false;
        drawMob(m, false);
      }
      if (m.stagger > 0) m.stagger -= dt;

      const dx = this.w.px - m.x;
      const dy = this.w.py - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const toPlayer = Math.atan2(dy, dx);
      const ux = dx / dist;
      const uy = dy / dist;

      // Knockback velocity.
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const kd = Math.exp(-T_S.knockbackDecay * dt);
      m.vx *= kd;
      m.vy *= kd;

      if (m.kind === 'scav') {
        m.wobble += dt * 7;
        m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 14 * dt);
        if (m.stagger <= 0) {
          const sp = m.speed * (0.9 + 0.2 * Math.sin(m.wobble));
          let sx = 0;
          let sy = 0;
          for (const o of this.w.mobs) {
            if (o === m || o.dead) continue;
            const ox = m.x - o.x;
            const oy = m.y - o.y;
            const od = Math.hypot(ox, oy);
            if (od > 0 && od < T_S.separation) {
              const f = (T_S.separation - od) / T_S.separation;
              sx += (ox / od) * f * 180;
              sy += (oy / od) * f * 180;
            }
          }
          if (dist > T_S.contactRange * 0.7) {
            m.x += (ux * sp + sx) * dt;
            m.y += (uy * sp + sy) * dt;
          } else {
            m.x += sx * dt;
            m.y += sy * dt;
          }
        }
        m.attackCd -= dt;
        if (dist < T_S.contactRange && m.attackCd <= 0 && m.stagger <= 0) {
          m.attackCd = T_S.attackCooldown;
          m.vx += ux * 200;
          m.vy += uy * 200;
          this.g.playerSys.hurtPlayer(T_S.contactDamage, toPlayer + Math.PI);
        }
      } else {
        this.updateRobot(m, dt, dist, toPlayer, ux, uy, lasers);
      }

      collide(m, m.radius);
      m.gfx.setPosition(m.x, m.y).setRotation(m.facing);
      m.bar?.setPosition(m.x, m.y - m.radius - 12);
    }

    this.g.fxGfx.clear();
    for (const l of lasers) {
      this.g.fxGfx.lineStyle(1.5 + l.k * 2, PALETTE.robot, 0.25 + l.k * 0.65);
      this.g.fxGfx.lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
  }

  updateRobot(
    m: Mob, dt: number, dist: number, toPlayer: number, ux: number, uy: number,
    lasers: { x1: number; y1: number; x2: number; y2: number; k: number }[],
  ): void {
    const R = T.robot;
    const los = !PILLARS.some((r) => segmentIntersectsRect(m.x, m.y, this.w.px, this.w.py, r));

    if (m.stagger > 0) {
      m.phase = 'move';
      return;
    }

    if (m.phase === 'move') {
      m.facing += angleDiff(toPlayer, m.facing) * Math.min(1, 8 * dt);
      let vx = 0;
      let vy = 0;
      if (dist > R.preferredMax || !los) {
        vx = ux;
        vy = uy;
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
      if (m.shotCd <= 0 && los && dist < 640) {
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
        return;
      }
      // Track the player until the last moment, then commit.
      if (m.phaseTime > 0.16) m.aimAngle += angleDiff(toPlayer, m.aimAngle) * Math.min(1, 7 * dt);
      m.facing = m.aimAngle;
      const k = 1 - clamp(m.phaseTime / R.telegraph, 0, 1);
      const len = 900;
      lasers.push({
        x1: m.x + Math.cos(m.aimAngle) * 30, y1: m.y + Math.sin(m.aimAngle) * 30,
        x2: m.x + Math.cos(m.aimAngle) * len, y2: m.y + Math.sin(m.aimAngle) * len, k,
      });
      if (m.phaseTime <= 0) {
        m.phase = 'burst';
        m.shotsLeft = R.burstCount;
        m.shotTimer = 0;
      }
    } else {
      m.shotTimer -= dt;
      if (m.shotTimer <= 0) {
        const a = m.aimAngle + (Math.random() - 0.5) * 0.04;
        const mx = m.x + Math.cos(a) * 34;
        const my = m.y + Math.sin(a) * 34;
        this.g.gunSys.fireBullet(mx, my, a, R.bulletSpeed, R.bulletDamage, false, R.bulletLife, PALETTE.robot, 20, 5);
        this.g.glows.at(mx, my, PALETTE.robot, 1.4, 0.6, 0.09, 0.9);
        m.vx -= Math.cos(a) * 70;
        m.vy -= Math.sin(a) * 70;
        this.g.sfx.robotShot();
        m.shotsLeft -= 1;
        m.shotTimer = R.burstGap;
        if (m.shotsLeft <= 0) {
          m.phase = 'move';
          m.shotCd = Phaser.Math.FloatBetween(R.cooldownMin, R.cooldownMax);
        }
      }
    }
  }
}
