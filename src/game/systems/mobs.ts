import Phaser from 'phaser';
import { ARENA, PIPES } from '../../data/arena';
import { MOBS, type MobKind } from '../../data/mobs';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import { drawBar, drawMob } from '../../fx/mobArt';
import { collide } from '../../sim/collide';
import type { WaveEntry } from '../../sim/waves';
import type { Ctx } from '../ctx';
import { waveIntel } from '../profile';
import { pushFeed, setBanner } from '../runState';
import type { Mob } from '../types';
import { MobAI, type Laser } from './mobAI';

/** Spawner, waves and the per-frame loop over enemies. Behaviours are in mobAI.ts. */
export class MobSystem {
  private readonly ai: MobAI;

  constructor(private readonly g: Ctx) {
    this.ai = new MobAI(g);
  }

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

  queueSpawnAt(kind: MobKind, x: number, y: number, delay: number): void {
    this.w.spawnQueue.push({ kind, x, y, t: delay });
  }

  /** Pipes away from the player, so a swarm has to come to you. */
  private farPipes(n: number): number[] {
    return PIPES.map((p, i) => ({ i, d: Math.hypot(p.x - this.w.px, p.y - this.w.py) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, n)
      .map((o) => o.i);
  }

  queueSwarm(count: number): void {
    const far = this.farPipes(3);
    for (let i = 0; i < count; i++) this.queueSpawn('scav', i * T.waves.spawnStagger, far[i % far.length]);
  }

  private queueEntries(entries: readonly WaveEntry[]): void {
    const R = T.run;
    const far = this.farPipes(4);
    let slot = 0;
    for (const e of entries) {
      for (let i = 0; i < e.count; i++) {
        if (e.kind === 'warden') {
          this.queueSpawnAt(e.kind, ARENA.layout.boss.x, ARENA.layout.boss.y, 2);
        } else if (e.kind === 'scav') {
          this.queueSpawn('scav', R.firstSpawnDelay + (slot++) * T.waves.spawnStagger, far[i % far.length]);
        } else {
          this.queueSpawn(e.kind, R.firstSpawnDelay + 0.4 + (slot++) * R.spawnGap * 0.55, far[(slot + i) % far.length]);
        }
      }
    }
  }

  startWave(): void {
    const Wv = T.waves;
    const room = this.w.room;
    this.w.wave += 1;
    this.w.waveLive = true;
    if (room) {
      this.queueEntries(room.waves[this.w.wave - 1] ?? []);
      setBanner(room.final ? 'THE WARDEN' : `WAVE ${this.w.wave} / ${room.waves.length}`, 2);
      return;
    }
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
    const room = this.w.room;
    if (this.w.waveLive) {
      if (!alive) {
        this.w.waveLive = false;
        this.w.waveTimer = T.waves.intermission;
        const done = this.w.wave >= this.w.wavesToClear;
        setBanner(room && done ? (room.final ? 'WARDEN DOWN' : 'ROOM CLEARED') : 'WAVE CLEARED', 1.8);
        const intel = waveIntel(room ? room.index * T.run.waveIntelPerRoom + this.w.wave : this.w.wave);
        pushFeed(`+${intel} Intel`, PALETTE.robot);
      }
    } else if (!room || this.w.wave < room.waves.length) {
      this.w.waveTimer -= dt;
      if (this.w.waveTimer <= 0 && !alive) this.startWave();
    }
  }

  spawnMob(kind: MobKind, x: number, y: number): void {
    const def = MOBS[kind];
    const boss = kind === 'warden';
    const gfx = this.g.scene.add.graphics().setDepth(boss ? 12 : def.metal || def.bar ? 11 : 10);
    const hp = Math.round(def.hp * this.w.hpMul);
    const m: Mob = {
      kind, def, gfx, x, y, vx: 0, vy: 0, hp, maxHp: hp, radius: def.radius,
      speed: def.speed * (1 + (Math.random() * 2 - 1) * def.speedJitter),
      facing: Math.atan2(this.w.py - y, this.w.px - x), attackCd: 0.3, flash: 0, flashing: false,
      stagger: 0, stagMeter: 0, stagImmune: 0, wobble: Math.random() * 6, dead: false,
      phase: 'move', phaseTime: 0, shotsLeft: 0, shotTimer: 0,
      shotCd: def.ranged ? Phaser.Math.FloatBetween(0.8, 1.6) : Phaser.Math.FloatBetween(0.6, 1.6), aimAngle: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
      dmgMul: this.w.dmgMul, bossStage: 0, bossAtk: '', bossCd: 2, bossSpin: 0, hitDone: false,
    };
    if (def.bar) {
      m.bar = this.g.scene.add.graphics().setDepth(12);
      drawBar(m);
    }
    drawMob(m, false);
    gfx.setPosition(x, y).setRotation(m.facing);
    this.w.mobs.push(m);
    this.g.glows.at(x, y, def.color, def.glow, 0.3, 0.3, 0.7);
    if (boss) {
      this.g.ring(x, y, PALETTE.ember, 0.8, 8);
      this.w.trauma = Math.min(1, this.w.trauma + 0.4);
      this.g.sfx.explosion();
    }
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

  /** The Warden fell: whatever it had called collapses with it. */
  collapseAdds(except: Mob): void {
    for (const o of this.w.mobs) {
      if (o.dead || o === except) continue;
      o.dead = true;
      o.gfx.destroy();
      o.bar?.destroy();
      this.g.particles.burst(o.x, o.y, 0, Math.PI * 2, 8, 80, 340, {
        life: 0.5, w: 11, h: 2.2, color: o.def.color, drag: 3, spin: 10,
      });
      this.g.glows.at(o.x, o.y, o.def.color, 1.2, 0.3, 0.2, 0.7);
    }
    this.w.spawnQueue = [];
  }

  updateMobs(dt: number): void {
    this.w.mobs = this.w.mobs.filter((m) => !m.dead);
    const lasers: Laser[] = [];

    for (const m of this.w.mobs) {
      if (m.dead) continue;
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
      const st = m.def.stagger;
      if (m.stagger > 0) m.stagger -= dt;
      if (st && m.stagMeter > 0) m.stagMeter = Math.max(0, m.stagMeter - st.decay * dt);
      if (m.stagImmune > 0) m.stagImmune -= dt;

      const dx = this.w.px - m.x;
      const dy = this.w.py - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      const toPlayer = Math.atan2(dy, dx);

      // Knockback velocity.
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const kd = Math.exp(-9 * dt);
      m.vx *= kd;
      m.vy *= kd;

      this.ai.update({ m, dt, dist, toPlayer, ux: dx / dist, uy: dy / dist, lasers });
      if (m.dead) continue;

      collide(m, m.radius);
      m.gfx.setPosition(m.x, m.y).setRotation(m.facing);
      m.bar?.setPosition(m.x, m.y - m.radius - 12);
    }

    this.g.fxGfx.clear();
    for (const l of lasers) {
      this.g.fxGfx.lineStyle(1.5 + l.k * 2, l.c, 0.25 + l.k * 0.65);
      this.g.fxGfx.lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
  }
}

