import Phaser from 'phaser';
import { PIPES } from '../../data/arena';
import { MOBS, type MobKind } from '../../data/mobs';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import { drawBar, drawMob } from '../../fx/mobArt';
import { collide, lineClear, lineClearWide } from '../../sim/collide';
import type { Spawn as FloorSpawn } from '../../sim/dungeon';
import { clamp } from '../../sim/math';
import type { Ctx } from '../ctx';
import { addIntel, waveIntel } from '../profile';
import { pushFeed, setBanner } from '../runState';
import type { Mob } from '../types';
import { MobAI, type Laser } from './mobAI';

/** Spawner, waves and the per-frame loop over enemies. Behaviours are in mobAI.ts. */
export class MobSystem {
  private readonly ai: MobAI;
  private alarmCd = 0;
  private flowT = 0;

  constructor(private readonly g: Ctx) {
    this.ai = new MobAI(g);
  }

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  queueSpawn(kind: MobKind, delay: number, pipeIndex?: number): void {
    if (PIPES.length === 0) return;
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

  /** A Warden's call for help: the adds appear around it, in the open, not out of a pipe. */
  queueSummon(from: Mob, kind: MobKind, delay: number): void {
    let x = from.x;
    let y = from.y;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 90 + Math.random() * 140;
      const tx = from.x + Math.cos(a) * d;
      const ty = from.y + Math.sin(a) * d;
      if (lineClear(from.x, from.y, tx, ty)) {
        x = tx;
        y = ty;
        break;
      }
    }
    this.w.spawnQueue.push({ kind, x, y, t: delay, summoned: true });
  }

  /** A shot, a swing or a blast: sleepers in earshot stir. Walls muffle it. */
  hear(x: number, y: number, radius: number): void {
    if (!this.w.floor) return;
    for (const m of this.w.mobs) {
      if (m.alert || m.dead || m.wakeT > 0) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d >= radius) continue;
      if (d > 90 && !lineClear(m.x, m.y, x, y) && d * 1.6 >= radius) continue;
      m.wakeT = 0.08 + (d / radius) * 0.55 + Math.random() * 0.2;
    }
  }

  /** A room whose last enemy has just fallen is cleared: a small Intel reward and a word on screen. */
  noteKill(m: Mob): void {
    if (m.room < 0 || m.summoned || this.w.mobs.some((o) => !o.dead && o.room === m.room)) return;
    const depth = this.w.plan?.depth ?? 0;
    const room = this.w.floor?.rooms[m.room];
    if (!room || room.kind === 'boss') return;
    const n = addIntel(T.run.roomClearIntel + 2 * depth);
    pushFeed(`Room cleared  +${n} Intel`, PALETTE.robot);
  }

  /** An enemy comes up. Its neighbours hear it and follow a moment later. */
  wake(m: Mob, shout: boolean): void {
    if (m.alert || m.dead) return;
    const D = T.dungeon;
    m.alert = true;
    m.wakeT = 0;
    m.facing = Math.atan2(this.w.py - m.y, this.w.px - m.x);
    this.g.glows.at(m.x, m.y, m.def.color, 1.4, 0.3, 0.25, 0.6);
    if (this.alarmCd <= 0) {
      this.g.sfx.charge();
      this.alarmCd = 0.5;
    }
    if (!shout) return;
    for (const o of this.w.mobs) {
      if (o.alert || o.dead) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d >= D.shout) continue;
      const t = D.shoutDelay[0] + (D.shoutDelay[1] - D.shoutDelay[0]) * Math.random() * (0.4 + 0.6 * (d / D.shout));
      if (o.wakeT <= 0 || t < o.wakeT) o.wakeT = t;
    }
  }

  /** Place a floor's enemies, asleep. */
  spawnEncounters(spawns: readonly FloorSpawn[]): void {
    for (const s of spawns) this.spawnMob(s.kind, s.x, s.y, { dormant: true, room: s.room, group: s.group });
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
        this.spawnMob(s.kind, s.x, s.y, { summoned: s.summoned });
        this.w.spawnQueue.splice(i, 1);
      }
    }
    // A bunker floor has no waves: its enemies are placed when it is built.
    if (this.w.floor) return;
    const alive = this.w.mobs.some((m) => !m.dead) || this.w.spawnQueue.length > 0;
    const plan = this.w.plan;
    if (this.w.waveLive) {
      if (!alive) {
        this.w.waveLive = false;
        this.w.waveTimer = T.waves.intermission;
        setBanner('WAVE CLEARED', 1.8);
        const intel = waveIntel(this.w.wave);
        pushFeed(`+${intel} Intel`, PALETTE.robot);
      }
    } else if (!plan) {
      this.w.waveTimer -= dt;
      if (this.w.waveTimer <= 0 && !alive) this.startWave();
    }
  }

  spawnMob(kind: MobKind, x: number, y: number, opts: { dormant?: boolean; room?: number; group?: number; summoned?: boolean } = {}): void {
    const def = MOBS[kind];
    const boss = kind === 'warden';
    const gfx = this.g.scene.add.graphics().setDepth(boss ? 12 : def.metal || def.bar ? 11 : 10);
    const hp = Math.round(def.hp * this.w.hpMul);
    const m: Mob = {
      kind, def, gfx, x, y, vx: 0, vy: 0, hp, maxHp: hp, radius: def.radius,
      speed: def.speed * (1 + (Math.random() * 2 - 1) * def.speedJitter),
      facing: opts.dormant ? Math.random() * Math.PI * 2 : Math.atan2(this.w.py - y, this.w.px - x), attackCd: 0.3, flash: 0, flashing: false,
      stagger: 0, stagMeter: 0, stagImmune: 0, wobble: Math.random() * 6, dead: false,
      phase: 'move', phaseTime: 0, shotsLeft: 0, shotTimer: 0,
      shotCd: def.ranged ? Phaser.Math.FloatBetween(0.8, 1.6) : Phaser.Math.FloatBetween(0.6, 1.6), aimAngle: 0, coverX: 0, coverY: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
      dmgMul: this.w.dmgMul, bossStage: 0, bossAtk: '', bossCd: 2, bossSpin: 0, hitDone: false,
      alert: !opts.dormant, wakeT: 0, room: opts.room ?? -1, group: opts.group ?? -1, summoned: !!opts.summoned,
      flank: (Math.random() * 2 - 1) * (def.behaviour === 'swarm' || def.behaviour === 'leaper' ? 0.9 : 0.35), unseen: 0,
    };
    if (def.bar) {
      m.bar = this.g.scene.add.graphics().setDepth(12);
      drawBar(m);
    }
    drawMob(m, false);
    gfx.setPosition(x, y).setRotation(m.facing);
    this.w.mobs.push(m);
    if (!opts.dormant) this.g.glows.at(x, y, def.color, def.glow, 0.3, 0.3, 0.7);
    if (boss && !opts.dormant) {
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
      if (o.dead || o === except || !o.summoned) continue;
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
    const D = T.dungeon;
    this.alarmCd -= dt;
    const flow = this.g.flow;
    if (flow) {
      this.flowT -= dt;
      if (this.flowT <= 0) {
        this.flowT = D.flowEvery;
        flow.update(this.w.px, this.w.py);
      }
    }
    const view = this.g.scene.cameras.main.worldView;
    const pad = 140;

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

      const dx = this.w.px - m.x;
      const dy = this.w.py - m.y;
      const dist = Math.hypot(dx, dy) || 1;

      // Asleep: stands where it was put until it sees you, hears a fight, or a neighbour shouts.
      if (!m.alert) {
        if (m.wakeT > 0) {
          m.wakeT -= dt;
          if (m.wakeT <= 0) this.wake(m, true);
        } else if (dist < D.sight && lineClear(m.x, m.y, this.w.px, this.w.py)) {
          this.wake(m, true);
        }
        if (!m.alert) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          const kd0 = Math.exp(-9 * dt);
          m.vx *= kd0;
          m.vy *= kd0;
          collide(m, m.radius);
          this.show(m, view, pad);
          continue;
        }
      }

      const st = m.def.stagger;
      if (m.stagger > 0) m.stagger -= dt;
      if (st && m.stagMeter > 0) m.stagMeter = Math.max(0, m.stagMeter - st.decay * dt);
      if (m.stagImmune > 0) m.stagImmune -= dt;

      const toPlayer = Math.atan2(dy, dx);
      const ux = dx / dist;
      const uy = dy / dist;

      // Where to walk to reach the player: straight at them when there is a clear way, along the
      // flow field when walls are in the road, and fanned a little to one side so a pack spreads out.
      let hx = ux;
      let hy = uy;
      let sees = true;
      if (flow) {
        sees = dist < 64 || lineClearWide(m.x, m.y, this.w.px, this.w.py, Math.min(m.radius, 18));
        m.unseen = sees ? 0 : m.unseen + dt;
        if (!sees) {
          const d = flow.dirAt(m.x, m.y);
          if (d && (d.x !== 0 || d.y !== 0)) {
            hx = d.x;
            hy = d.y;
          }
        } else if (dist > 110) {
          const rot = m.flank * clamp((dist - 110) / 320, 0, 1);
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          hx = ux * c - uy * s;
          hy = ux * s + uy * c;
        }
      }

      // Knockback velocity.
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const kd = Math.exp(-9 * dt);
      m.vx *= kd;
      m.vy *= kd;

      this.ai.update({ m, dt, dist, toPlayer, ux, uy, hx, hy, sees, lasers });
      if (m.dead) continue;

      collide(m, m.radius);
      m.gfx.setPosition(m.x, m.y).setRotation(m.facing);
      m.bar?.setPosition(m.x, m.y - m.radius - 12);
      this.show(m, view, pad);
    }

    this.g.fxGfx.clear();
    for (const l of lasers) {
      this.g.fxGfx.lineStyle(1.5 + l.k * 2, l.c, 0.25 + l.k * 0.65);
      this.g.fxGfx.lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
  }

  /** Only what is on screen is drawn: a floor holds dozens of enemies. */
  private show(m: Mob, view: Phaser.Geom.Rectangle, pad: number): void {
    const on = m.x > view.x - pad && m.x < view.right + pad && m.y > view.y - pad && m.y < view.bottom + pad;
    m.gfx.setPosition(m.x, m.y);
    m.gfx.setVisible(on);
    m.bar?.setVisible(on);
  }
}
