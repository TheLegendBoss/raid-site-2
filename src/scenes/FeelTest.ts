// The feel-test room: one arena, one carbine, one power blade, scavenger
// swarms and rogue robots. Everything here exists to answer one question:
// does being a clone super soldier feel heavy, fast and good for ten minutes?
import Phaser from 'phaser';
import { FONT, PALETTE, RARITY_COLORS, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { Sfx } from '../fx/audio';
import { Particles } from '../fx/particles';
import { pushFeed, resetVitals, runState, setBanner } from '../game/runState';
import { rollDamage } from '../sim/damage';
import { rollItem, type Item } from '../sim/loot';
import {
  DEG,
  Rng,
  angleDiff,
  clamp,
  resolveCircleRect,
  segmentHitsCircle,
  segmentIntersectsRect,
  type Rect,
} from '../sim/math';

const W = T.world.w;
const H = T.world.h;
const WALL = T.world.wall;
const X0 = WALL;
const Y0 = WALL;
const X1 = W - WALL;
const Y1 = H - WALL;

/** Graphics path helpers want Vector2s; our polygons are plain {x, y}. */
function poly(pts: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
}

const PILLARS: Rect[] = [
  { x: 520, y: 320, w: 110, h: 110 },
  { x: 1370, y: 320, w: 110, h: 110 },
  { x: 520, y: 870, w: 110, h: 110 },
  { x: 1370, y: 870, w: 110, h: 110 },
  { x: 900, y: 520, w: 200, h: 34 },
  { x: 900, y: 746, w: 200, h: 34 },
];

// Where things pour out of the walls.
const PIPES = [
  { x: X0, y: 330, dx: 1, dy: 0 },
  { x: X0, y: 970, dx: 1, dy: 0 },
  { x: X1, y: 650, dx: -1, dy: 0 },
  { x: 1000, y: Y0, dx: 0, dy: 1 },
  { x: 1000, y: Y1, dx: 0, dy: -1 },
];

type KeyName =
  | 'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  | 'SHIFT' | 'SPACE' | 'F' | 'X' | 'R' | 'K' | 'M' | 'T' | 'H' | 'ONE' | 'TWO';
type KeyMap = Record<KeyName, Phaser.Input.Keyboard.Key>;

type MobKind = 'scav' | 'robot';
type Phase = 'move' | 'telegraph' | 'burst';
type Source = 'gun' | 'sword';

interface Mob {
  kind: MobKind;
  gfx: Phaser.GameObjects.Graphics;
  bar?: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  facing: number;
  attackCd: number;
  flash: number;
  flashing: boolean;
  stagger: number;
  wobble: number;
  dead: boolean;
  // robots
  phase: Phase;
  phaseTime: number;
  shotsLeft: number;
  shotTimer: number;
  shotCd: number;
  aimAngle: number;
  strafe: number;
}

interface Bullet {
  img: Phaser.GameObjects.Image;
  active: boolean;
  friendly: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
}

interface Drop {
  item: Item;
  gfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  beam?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  phase: number;
  baseAlpha: number;
}

interface Glow {
  img: Phaser.GameObjects.Image;
  active: boolean;
  t: number;
  life: number;
  s0: number;
  s1: number;
  a0: number;
}

interface Spawn {
  kind: MobKind;
  x: number;
  y: number;
  t: number;
}

interface SwordState {
  state: 'idle' | 'windup' | 'swing' | 'recover';
  t: number;
  angle: number;
  dir: 1 | -1;
  hit: Set<Mob>;
}

type NumClass = 'gun' | 'blade' | 'hurt' | 'shield' | 'refund';

interface DmgNum {
  txt: Phaser.GameObjects.Text;
  cls: NumClass;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export class FeelTest extends Phaser.Scene {
  private sfx = new Sfx();
  private rng = new Rng((Date.now() ^ 0x9e3779b9) >>> 0);
  private keys!: KeyMap;
  private floor!: Phaser.GameObjects.RenderTexture;
  private particles!: Particles;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private shieldGfx!: Phaser.GameObjects.Graphics;
  private bladeGfx!: Phaser.GameObjects.Graphics;
  private bladeGlow!: Phaser.GameObjects.Image;
  private fxGfx!: Phaser.GameObjects.Graphics;

  private mobs: Mob[] = [];
  private bullets: Bullet[] = [];
  private drops: Drop[] = [];
  private glows: Glow[] = [];
  private spawnQueue: Spawn[] = [];

  // player
  private px = W / 2;
  private py = H / 2;
  private pvx = 0;
  private pvy = 0;
  private lungeX = 0;
  private lungeY = 0;
  private aim = 0;
  private mouseX = W / 2;
  private mouseY = H / 2;
  private fireCd = 0;
  private bloom = 0;
  private dashT = 0;
  private dashCd = 0;
  private dashX = 1;
  private dashY = 0;
  private stepDist = 0;
  private shieldCd = 0;
  private playerFlash = 0;
  private playerFlashing = false;
  private rmbWas = false;
  private sw: SwordState = { state: 'idle', t: 0, angle: 0, dir: 1, hit: new Set() };
  private comboTimer = 0;
  private swordCd = 0;
  private prevDashReady = 1;
  private prevBladeReady = 1;
  private dmgNums: DmgNum[] = [];

  // reload
  private reloadT = -1; // seconds into the current reload, -1 when idle
  private reloadTime: number = T.gun.reloadTime;
  private reloadMagIn = false;
  private reloadWasEmpty = false;

  // world
  private wave = 0;
  private waveLive = false;
  private waveTimer = 1.2;
  private dead = false;
  private deadTimer = 0;
  private hitStop = 0;

  // camera
  private camX = W / 2;
  private camY = H / 2;
  private trauma = 0;
  private kickX = 0;
  private kickY = 0;
  private zoomPunch = 0;

  constructor() {
    super('FeelTest');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor('none');
    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,F,X,R,K,M,T,H,ONE,TWO',
    ) as unknown as KeyMap;

    const unlock = (): void => this.sfx.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard!.on('keydown', unlock);

    this.drawFloor();
    this.floor = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(-10);
    this.particles = new Particles(this, this.floor);

    this.fxGfx = this.add.graphics().setDepth(16);

    this.playerGfx = this.add.graphics().setDepth(14);
    this.drawPlayer(false);
    this.shieldGfx = this.add.graphics().setDepth(13);
    this.shieldGfx.lineStyle(2, PALETTE.shield, 1);
    this.shieldGfx.strokeCircle(0, 0, T.player.radius + 8);

    this.bladeGfx = this.add.graphics().setDepth(15);
    this.bladeGlow = this.add
      .image(0, 0, 'glow')
      .setDepth(15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xbffcff)
      .setVisible(false);

    for (let i = 0; i < 220; i++) {
      this.bullets.push({
        img: this.add.image(0, 0, 'px').setDepth(17).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
        active: false, friendly: true, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0,
      });
    }
    for (let i = 0; i < 48; i++) {
      this.glows.push({
        img: this.add.image(0, 0, 'glow').setDepth(25).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
        active: false, t: 0, life: 1, s0: 1, s1: 1, a0: 1,
      });
    }

    this.createNumbers();
    this.resetWorld(true);
  }

  // ------------------------------------------------------------------
  // Static art
  // ------------------------------------------------------------------

  private drawFloor(): void {
    const g = this.add.graphics().setDepth(-30);
    g.fillStyle(0x070d0f, 1);
    g.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 100) {
      g.lineStyle(1, x % 500 === 0 ? PALETTE.floorLineBright : PALETTE.floorLine, 1);
      g.lineBetween(x, 0, x, H);
    }
    for (let y = 0; y <= H; y += 100) {
      g.lineStyle(1, y % 500 === 0 ? PALETTE.floorLineBright : PALETTE.floorLine, 1);
      g.lineBetween(0, y, W, y);
    }

    // Sewer channel across the middle.
    g.fillStyle(0x08181b, 1);
    g.fillRect(X0, 610, X1 - X0, 80);
    g.lineStyle(2, PALETTE.structureDim, 0.9);
    g.lineBetween(X0, 610, X1, 610);
    g.lineBetween(X0, 690, X1, 690);
    g.lineStyle(1, PALETTE.structureDim, 0.45);
    for (let x = X0 + 10; x < X1 - 30; x += 64) g.lineBetween(x, 650, x + 26, 650);

    // Pipe mouths.
    for (const p of PIPES) {
      g.fillStyle(0x020506, 1);
      g.fillCircle(p.x, p.y, 38);
      g.lineStyle(3, PALETTE.structure, 0.8);
      g.strokeCircle(p.x, p.y, 38);
      g.lineStyle(1.5, PALETTE.structureDim, 0.9);
      g.strokeCircle(p.x, p.y, 26);
      g.lineBetween(p.x + p.dx * 40, p.y + p.dy * 40, p.x + p.dx * 90, p.y + p.dy * 90);
    }

    // Outside the walls.
    g.fillStyle(0x020405, 1);
    g.fillRect(0, 0, W, Y0);
    g.fillRect(0, Y1, W, H - Y1);
    g.fillRect(0, 0, X0, H);
    g.fillRect(X1, 0, W - X1, H);
    g.lineStyle(6, PALETTE.structure, 0.9);
    g.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    g.lineStyle(1, PALETTE.structureDim, 0.8);
    for (let i = 0; i < W; i += 40) {
      g.lineBetween(i, Y0 - 4, i - 24, 4);
      g.lineBetween(i, Y1 + 4, i - 24, H - 4);
    }

    // Pillars.
    for (const r of PILLARS) {
      g.fillStyle(0x0b1719, 1);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(3, PALETTE.structure, 0.95);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.lineStyle(1, PALETTE.structureDim, 0.7);
      g.lineBetween(r.x, r.y, r.x + r.w, r.y + r.h);
      g.lineBetween(r.x + r.w, r.y, r.x, r.y + r.h);
    }
  }

  private drawPlayer(white: boolean): void {
    const g = this.playerGfx;
    const c = white ? PALETTE.white : PALETTE.player;
    g.clear();
    g.fillStyle(c, white ? 0.9 : 0.2);
    g.lineStyle(2.6, c, 1);
    g.fillCircle(0, 0, 13);
    g.strokeCircle(0, 0, 13);
    // pauldrons
    g.fillStyle(c, white ? 0.9 : 0.45);
    g.fillRect(-9, -19, 14, 7);
    g.fillRect(-9, 12, 14, 7);
    g.lineStyle(1.5, c, 1);
    g.strokeRect(-9, -19, 14, 7);
    g.strokeRect(-9, 12, 14, 7);
    // carbine
    g.lineStyle(4, c, 1);
    g.lineBetween(6, 6, 27, 6);
    g.lineStyle(2, c, 1);
    g.lineBetween(10, 0, 22, 0);
  }

  private drawMob(m: Mob, white: boolean): void {
    const g = m.gfx;
    g.clear();
    if (m.kind === 'scav') {
      const c = white ? PALETTE.white : PALETTE.hostile;
      g.fillStyle(c, white ? 0.9 : 0.22);
      g.lineStyle(2.2, c, 1);
      const pts = [
        { x: 15, y: 0 }, { x: -6, y: -10 }, { x: -2, y: -3 },
        { x: -11, y: 0 }, { x: -2, y: 3 }, { x: -6, y: 10 },
      ];
      g.fillPoints(poly(pts), true);
      g.strokePoints(poly(pts), true);
      g.fillStyle(c, 1);
      g.fillCircle(6, -3, 1.6);
      g.fillCircle(6, 3, 1.6);
    } else {
      const c = white ? PALETTE.white : PALETTE.robot;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        pts.push({ x: Math.cos(a) * 21, y: Math.sin(a) * 21 });
      }
      g.fillStyle(c, white ? 0.9 : 0.18);
      g.fillPoints(poly(pts), true);
      g.lineStyle(2.8, c, 1);
      g.strokePoints(poly(pts), true);
      g.lineStyle(1.5, c, 0.8);
      g.strokeCircle(0, 0, 10);
      g.fillStyle(c, 1);
      g.fillCircle(5, 0, 4);
      g.lineStyle(4, c, 1);
      g.lineBetween(14, 0, 31, 0);
    }
  }

  private drawBar(m: Mob): void {
    if (!m.bar) return;
    const g = m.bar;
    const frac = clamp(m.hp / m.maxHp, 0, 1);
    g.clear();
    g.fillStyle(0x000000, 0.6);
    g.fillRect(-20, 0, 40, 5);
    g.fillStyle(PALETTE.robot, 1);
    g.fillRect(-19, 1, 38 * frac, 3);
  }

  // ------------------------------------------------------------------
  // Loop
  // ------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.tickHud(dt);

    if (this.hitStop > 0) {
      // The freeze: nothing simulates, but the camera still jitters.
      this.hitStop -= dt;
      this.applyCamera(dt, true);
      return;
    }

    this.updateMouse();

    if (this.dead) {
      this.deadTimer -= dt;
      this.particles.update(dt);
      this.updateGlows(dt);
      this.updateNumbers(dt);
      this.applyCamera(dt, false);
      if (this.deadTimer <= 0) this.resetWorld(false);
      return;
    }

    this.handleDebugKeys();
    this.updatePlayer(dt);
    this.updateSword(dt);
    this.updateGun(dt);
    this.updateSpawner(dt);
    this.updateMobs(dt);
    this.updateBullets(dt);
    this.updateDrops(dt);
    this.particles.update(dt);
    this.updateGlows(dt);
    this.updateNumbers(dt);
    this.applyCamera(dt, false);
    this.syncState();
  }

  private tickHud(dt: number): void {
    const s = runState;
    s.damageFlash *= Math.exp(-4.5 * dt);
    s.hitMarker = Math.max(0, s.hitMarker - dt * 7);
    s.killMarker = Math.max(0, s.killMarker - dt * 3.5);
    s.refundFlash = Math.max(0, s.refundFlash - dt * 2.2);
    s.dryFlash = Math.max(0, s.dryFlash - dt * 4);
    s.dashPing = Math.max(0, s.dashPing - dt * 3);
    s.bladePing = Math.max(0, s.bladePing - dt * 3);
    s.dashDeny = Math.max(0, s.dashDeny - dt * 4);
    s.bladeDeny = Math.max(0, s.bladeDeny - dt * 4);
    s.bannerTime = Math.max(0, s.bannerTime - dt);
    for (const f of s.feed) f.age += dt;
    s.feed = s.feed.filter((f) => f.age < T.loot.feedSeconds);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) s.combo = 0;
    }
  }

  private syncState(): void {
    const s = runState;
    s.dashReady = this.dashCd <= 0 ? 1 : 1 - this.dashCd / T.player.dashCooldown;
    s.bladeReady = this.swordCd <= 0 ? 1 : 1 - this.swordCd / T.sword.cooldown;
    if (this.prevDashReady < 1 && s.dashReady >= 1) s.dashPing = 1;
    if (this.prevBladeReady < 1 && s.bladeReady >= 1) s.bladePing = 1;
    this.prevDashReady = s.dashReady;
    this.prevBladeReady = s.bladeReady;
    s.wave = this.wave;
    s.mobsAlive = this.mobs.filter((m) => !m.dead).length + this.spawnQueue.length;
    s.intermission = this.waveLive ? 0 : Math.max(0, this.waveTimer);
    s.aimSpread = T.gun.spread + this.bloom;
    s.muted = this.sfx.muted;
  }

  private updateMouse(): void {
    const ptr = this.input.activePointer;
    ptr.updateWorldPoint(this.cameras.main);
    this.mouseX = ptr.worldX;
    this.mouseY = ptr.worldY;
    this.aim = Math.atan2(this.mouseY - this.py, this.mouseX - this.px);
  }

  private handleDebugKeys(): void {
    const K = Phaser.Input.Keyboard;
    if (K.JustDown(this.keys.ONE)) this.queueSwarm(T.waves.swarmSize);
    if (K.JustDown(this.keys.TWO)) this.queueSpawn('robot', 0);
    if (K.JustDown(this.keys.K)) this.killAll();
    if (K.JustDown(this.keys.T)) this.resetWorld(false);
    if (K.JustDown(this.keys.H)) runState.showHelp = !runState.showHelp;
    if (K.JustDown(this.keys.M)) this.sfx.setMuted(!this.sfx.muted);
    if (K.JustDown(this.keys.X)) this.extract();
  }

  // ------------------------------------------------------------------
  // Player
  // ------------------------------------------------------------------

  private updatePlayer(dt: number): void {
    const P = T.player;
    const k = this.keys;
    const K = Phaser.Input.Keyboard;
    let ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const moving = ix !== 0 || iy !== 0;
    if (moving) {
      const l = Math.hypot(ix, iy);
      ix /= l;
      iy /= l;
    }

    this.dashCd = Math.max(0, this.dashCd - dt);
    const dashPressed = K.JustDown(k.SHIFT) || K.JustDown(k.SPACE);
    if (this.dashT > 0) {
      if (dashPressed) runState.dashDeny = 1; // already dashing, and the cooldown is running
      this.dashT -= dt;
      this.pvx = this.dashX * P.dashSpeed;
      this.pvy = this.dashY * P.dashSpeed;
      for (let i = 0; i < 2; i++) {
        this.particles.emit({
          x: this.px + (Math.random() - 0.5) * 10,
          y: this.py + (Math.random() - 0.5) * 10,
          vx: 0, vy: 0, life: 0.22, w: 22, h: 22,
          color: PALETTE.player, alpha: 0.35, add: true, shrink: true,
        });
      }
    } else {
      if (dashPressed) {
        if (this.dashCd <= 0 && this.sw.state !== 'swing') {
          this.dashT = P.dashTime;
          this.dashCd = P.dashCooldown;
          this.dashX = moving ? ix : Math.cos(this.aim);
          this.dashY = moving ? iy : Math.sin(this.aim);
          this.sfx.dash();
          this.trauma = Math.min(1, this.trauma + 0.1);
          this.kickX += this.dashX * 6;
          this.kickY += this.dashY * 6;
        } else {
          // Pressed too early: flash the cooldown box so the miss is readable.
          runState.dashDeny = 1;
          this.sfx.empty();
        }
      }
      const factor = this.sw.state === 'windup' || this.sw.state === 'swing' ? P.swingMoveFactor : 1;
      const tvx = ix * P.maxSpeed * factor;
      const tvy = iy * P.maxSpeed * factor;
      const dvx = tvx - this.pvx;
      const dvy = tvy - this.pvy;
      const len = Math.hypot(dvx, dvy);
      const step = (moving ? P.accel : P.friction) * dt;
      if (len <= step) {
        this.pvx = tvx;
        this.pvy = tvy;
      } else {
        this.pvx += (dvx / len) * step;
        this.pvy += (dvy / len) * step;
      }
    }

    const lk = Math.exp(-T.sword.lungeDecay * dt);
    this.lungeX *= lk;
    this.lungeY *= lk;

    const ox = this.px;
    const oy = this.py;
    this.px += (this.pvx + this.lungeX) * dt;
    this.py += (this.pvy + this.lungeY) * dt;
    const pos = { x: this.px, y: this.py };
    this.collide(pos, P.radius);
    this.px = pos.x;
    this.py = pos.y;
    this.stepDist += Math.hypot(this.px - ox, this.py - oy);
    if (this.stepDist >= P.stepDistance) {
      this.stepDist = 0;
      this.sfx.step();
      this.trauma = Math.min(1, this.trauma + 0.014);
    }

    // Shield regen.
    this.shieldCd -= dt;
    if (this.shieldCd <= 0 && runState.shield < runState.maxShield) {
      runState.shield = Math.min(runState.maxShield, runState.shield + P.shieldRegenRate * dt);
    }

    // Flash on hurt.
    if (this.playerFlash > 0) {
      this.playerFlash -= dt;
      if (!this.playerFlashing) {
        this.playerFlashing = true;
        this.drawPlayer(true);
      }
    } else if (this.playerFlashing) {
      this.playerFlashing = false;
      this.drawPlayer(false);
    }

    this.playerGfx.setPosition(this.px, this.py).setRotation(this.aim);
    this.shieldGfx
      .setPosition(this.px, this.py)
      .setAlpha(0.12 + 0.4 * (runState.shield / runState.maxShield) + this.playerFlash * 3);
  }

  /** Keep a circle inside the room and out of the pillars. */
  private collide(pos: { x: number; y: number }, r: number): void {
    pos.x = clamp(pos.x, X0 + r, X1 - r);
    pos.y = clamp(pos.y, Y0 + r, Y1 - r);
    for (const rect of PILLARS) resolveCircleRect(pos, r, rect);
  }

  private hurtPlayer(dmg: number, fromAngle: number): void {
    if (this.dashT > 0 || this.dead) return;
    const s = runState;
    this.shieldCd = T.player.shieldRegenDelay;
    const hadShield = s.shield > 0;
    const soak = Math.min(s.shield, dmg);
    s.shield -= soak;
    s.hp -= dmg - soak;
    s.damageFlash = 1;
    this.playerFlash = 0.09;
    this.trauma = Math.min(1, this.trauma + T.juice.playerHurtTrauma);
    this.pvx += Math.cos(fromAngle) * 90;
    this.pvy += Math.sin(fromAngle) * 90;
    this.sfx.hurt();
    if (soak > 0) this.spawnNumber(this.px - 8, this.py - 26, `-${Math.round(soak)}`, 'shield');
    if (dmg - soak > 0) this.spawnNumber(this.px + 8, this.py - 40, `-${Math.round(dmg - soak)}`, 'hurt');
    if (hadShield && s.shield <= 0) {
      this.particles.burst(this.px, this.py, 0, Math.PI * 2, 18, 120, 420, {
        life: 0.35, w: 10, h: 2, color: PALETTE.shield, add: true, drag: 3, align: true,
      });
      this.glowAt(this.px, this.py, PALETTE.shield, 2.4, 0.4, 0.28, 0.8);
    } else {
      this.particles.burst(this.px, this.py, fromAngle, 1.6, 6, 80, 260, {
        life: 0.35, w: 7, h: 1.8, color: s.shield > 0 ? PALETTE.shield : PALETTE.player, add: true, drag: 4, align: true,
      });
    }
    if (s.hp <= 0) this.die();
  }

  private die(): void {
    this.dead = true;
    this.deadTimer = 1.9;
    const lost = runState.carried.length;
    runState.carried = [];
    setBanner('CLONE LOST', 1.9);
    pushFeed(lost > 0 ? `Cargo lost: ${lost} item${lost > 1 ? 's' : ''}` : 'Clone lost', PALETTE.hostile);
    this.playerGfx.setVisible(false);
    this.shieldGfx.setVisible(false);
    this.bladeGfx.clear();
    this.bladeGlow.setVisible(false);
    this.particles.burst(this.px, this.py, 0, Math.PI * 2, 34, 80, 520, {
      life: 0.8, w: 14, h: 2.4, color: PALETTE.player, drag: 2.6, spin: 9,
      decal: { color: 0x1b5a2b, alpha: 0.5, scale: 0.4 },
    });
    this.glowAt(this.px, this.py, PALETTE.player, 3.4, 0.5, 0.4, 0.9);
    this.sfx.explosion();
    this.addHitStop(0.13);
    this.trauma = 1;
  }

  // ------------------------------------------------------------------
  // Carbine
  // ------------------------------------------------------------------

  private updateGun(dt: number): void {
    const G = T.gun;
    const ptr = this.input.activePointer;
    const s = runState;
    this.fireCd -= dt;
    this.bloom = Math.max(0, this.bloom - 14 * dt);
    s.reserve = Math.min(s.maxReserve, s.reserve + G.reserveRegenPerSec * dt);

    if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this.startReload();
    if (this.reloadT >= 0) this.tickReload(dt);

    const firing = ptr.isDown && ptr.leftButtonDown();
    if (!firing || this.fireCd > 0 || this.sw.state !== 'idle' || this.reloadT >= 0) return;
    if (s.mag < 1) {
      // Trigger on an empty mag: reload if there is anything to load, else dry click.
      if (s.reserve >= 1) {
        this.startReload();
      } else {
        this.fireCd = 0.2;
        s.dryFlash = 1;
        this.sfx.empty();
      }
      return;
    }

    s.mag -= 1;
    s.shotSeq += 1;
    this.fireCd = G.fireDelay;
    const cone = (G.spread + this.bloom) * DEG;
    const a = this.aim + (Math.random() - 0.5) * 2 * cone;
    const mx = this.px + Math.cos(this.aim) * G.muzzleOffset;
    const my = this.py + Math.sin(this.aim) * G.muzzleOffset;
    const dmg = rollDamage(this.rng, G.damage, G.damageVariance);
    this.fireBullet(mx, my, a, G.bulletSpeed, dmg, true, G.bulletLife, 0xe9fff6, 28, 2.6);
    this.bloom = Math.min(5.5, this.bloom + 0.9);
    if (s.mag < 1 && s.reserve >= 1) this.startReload();

    // Juice: flash, light, casing, recoil, kick, noise.
    this.particles.emit({
      x: mx, y: my, vx: 0, vy: 0, life: 0.045, w: 40, h: 6, rot: this.aim,
      color: PALETTE.muzzle, add: true,
    });
    this.glowAt(mx, my, PALETTE.muzzle, 1.5, 0.8, 0.075, 0.85);
    this.glowAt(this.px, this.py, PALETTE.muzzle, 4.2, 3.2, 0.09, 0.14);
    const eject = this.aim + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.particles.emit({
      x: this.px + Math.cos(this.aim) * 8, y: this.py + Math.sin(this.aim) * 8,
      vx: Math.cos(eject) * (140 + Math.random() * 90), vy: Math.sin(eject) * (140 + Math.random() * 90),
      life: 0.7, w: 6, h: 3, color: 0xffd36b, drag: 3.2, spin: 16, alpha: 0.9,
    });
    this.pvx -= Math.cos(this.aim) * G.recoilImpulse;
    this.pvy -= Math.sin(this.aim) * G.recoilImpulse;
    this.kickX -= Math.cos(this.aim) * G.cameraKick;
    this.kickY -= Math.sin(this.aim) * G.cameraKick;
    this.trauma = Math.min(1, this.trauma + G.shotTrauma);
    this.sfx.shoot();
  }

  private startReload(): void {
    const G = T.gun;
    const s = runState;
    if (this.reloadT >= 0 || s.mag >= s.magSize || s.reserve < 1) return;
    this.reloadWasEmpty = s.mag < 1;
    this.reloadTime = this.reloadWasEmpty ? G.reloadTimeEmpty : G.reloadTime;
    this.reloadT = 0;
    this.reloadMagIn = false;
    s.reload = 0;
    s.reloadEmpty = this.reloadWasEmpty;
    this.sfx.magOut();
    // The spent magazine drops to the floor beside the clone.
    const side = this.aim + Math.PI / 2;
    this.particles.emit({
      x: this.px + Math.cos(this.aim) * 10, y: this.py + Math.sin(this.aim) * 10,
      vx: Math.cos(side) * 70 + this.pvx * 0.3, vy: Math.sin(side) * 70 + this.pvy * 0.3,
      life: 0.9, w: 11, h: 5, rot: this.aim, color: 0x3a4a47, drag: 3.2, spin: 4,
      decal: { color: 0x1a2422, alpha: 0.7, scale: 0.28 },
    });
    this.kickX -= Math.cos(this.aim) * 2;
    this.kickY -= Math.sin(this.aim) * 2;
  }

  private tickReload(dt: number): void {
    const s = runState;
    this.reloadT += dt;
    const p = clamp(this.reloadT / this.reloadTime, 0, 1);
    s.reload = p;
    if (!this.reloadMagIn && p >= T.gun.magInAt) {
      this.reloadMagIn = true;
      this.sfx.magIn();
      this.trauma = Math.min(1, this.trauma + 0.03);
    }
    if (p >= 1) this.finishReload();
  }

  private finishReload(): void {
    const s = runState;
    const take = Math.min(s.magSize - s.mag, Math.floor(s.reserve));
    s.mag += take;
    s.reserve -= take;
    this.reloadT = -1;
    s.reload = -1;
    this.sfx.rack(this.reloadWasEmpty);
    this.glowAt(this.px, this.py, PALETTE.ammo, 1.6, 0.8, 0.12, 0.22);
    this.trauma = Math.min(1, this.trauma + 0.04);
  }

  private fireBullet(
    x: number, y: number, angle: number, speed: number, dmg: number,
    friendly: boolean, life: number, color: number, w: number, h: number,
  ): void {
    const b = this.bullets.find((o) => !o.active);
    if (!b) return;
    b.active = true;
    b.friendly = friendly;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.life = life;
    b.dmg = dmg;
    b.img.setVisible(true).setTint(color).setPosition(x, y).setRotation(angle).setScale(w / 4, h / 4);
  }

  private updateBullets(dt: number): void {
    for (const b of this.bullets) {
      if (!b.active) continue;
      const nx = b.x + b.vx * dt;
      const ny = b.y + b.vy * dt;
      b.life -= dt;
      let spent = b.life <= 0 || nx < X0 || nx > X1 || ny < Y0 || ny > Y1;

      if (!spent) {
        for (const r of PILLARS) {
          if (segmentIntersectsRect(b.x, b.y, nx, ny, r)) {
            spent = true;
            break;
          }
        }
        if (spent) this.wallSpark(nx, ny, Math.atan2(b.vy, b.vx), b.friendly ? PALETTE.spark : PALETTE.robot);
      }

      if (!spent && b.friendly) {
        const ang = Math.atan2(b.vy, b.vx);
        for (const m of this.mobs) {
          if (m.dead) continue;
          if (segmentHitsCircle(b.x, b.y, nx, ny, m.x, m.y, m.radius + 3)) {
            this.damageMob(m, b.dmg, ang, 'gun', nx, ny);
            spent = true;
            break;
          }
        }
      } else if (!spent) {
        if (this.dashT <= 0 && segmentHitsCircle(b.x, b.y, nx, ny, this.px, this.py, T.player.radius + 3)) {
          this.hurtPlayer(b.dmg, Math.atan2(b.vy, b.vx) + Math.PI);
          spent = true;
        }
      }

      if (spent) {
        b.active = false;
        b.img.setVisible(false);
      } else {
        b.x = nx;
        b.y = ny;
        b.img.setPosition(nx, ny);
      }
    }
  }

  private wallSpark(x: number, y: number, ang: number, color: number): void {
    this.particles.burst(x, y, ang + Math.PI, 1.5, 5, 120, 380, {
      life: 0.22, w: 9, h: 1.6, color, add: true, drag: 3, align: true,
    });
    this.glowAt(x, y, color, 0.7, 0.2, 0.06, 0.5);
  }

  // ------------------------------------------------------------------
  // Arc blade
  // ------------------------------------------------------------------

  private updateSword(dt: number): void {
    const S = T.sword;
    const sw = this.sw;
    const ptr = this.input.activePointer;
    const rmb = ptr.isDown && ptr.rightButtonDown();
    const pressed = (rmb && !this.rmbWas) || Phaser.Input.Keyboard.JustDown(this.keys.F);
    this.rmbWas = rmb;
    this.swordCd = Math.max(0, this.swordCd - dt);

    if (pressed && sw.state !== 'idle') {
      // Mid-swing the cooldown is already running, so an extra press is an early press.
      runState.bladeDeny = 1;
      this.sfx.empty();
    }

    if (sw.state === 'idle') {
      this.bladeGfx.clear();
      this.bladeGlow.setVisible(false);
      if (pressed) {
        if (this.swordCd > 0) {
          runState.bladeDeny = 1;
          this.sfx.empty();
          return;
        }
        sw.state = 'windup';
        sw.t = 0;
        sw.dir = sw.dir === 1 ? -1 : 1;
        this.swordCd = S.cooldown;
        this.sfx.windup();
      }
      return;
    }

    sw.t += dt;
    if (sw.state === 'windup') {
      if (sw.t >= S.windup) {
        sw.state = 'swing';
        sw.t = 0;
        sw.angle = this.aim;
        sw.hit.clear();
        this.lungeX = Math.cos(this.aim) * S.lungeSpeed;
        this.lungeY = Math.sin(this.aim) * S.lungeSpeed;
        this.sfx.swing();
        this.trauma = Math.min(1, this.trauma + 0.1);
        this.kickX += Math.cos(this.aim) * 7;
        this.kickY += Math.sin(this.aim) * 7;
      } else {
        this.drawBlade(this.aim - sw.dir * (S.arcHalfAngle + 24) * DEG, 0.5, 0);
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

  private drawBlade(theta: number, alpha: number, trailDir: number): void {
    const S = T.sword;
    const g = this.bladeGfx;
    g.clear();
    const ox = this.px;
    const oy = this.py;
    // Motion-blur trail: ghost blades trailing behind the real one.
    if (trailDir !== 0) {
      for (let i = 7; i >= 1; i--) {
        const a = theta - trailDir * i * 8 * DEG;
        const t = 1 - i / 8;
        g.lineStyle(5 - i * 0.4, 0x7fe8ff, t * 0.55 * alpha);
        g.lineBetween(ox + Math.cos(a) * 26, oy + Math.sin(a) * 26, ox + Math.cos(a) * S.reach, oy + Math.sin(a) * S.reach);
      }
    }
    const cs = Math.cos(theta);
    const sn = Math.sin(theta);
    g.lineStyle(9, 0x7fe8ff, 0.3 * alpha);
    g.lineBetween(ox + cs * 22, oy + sn * 22, ox + cs * S.reach, oy + sn * S.reach);
    g.lineStyle(4, 0xffffff, alpha);
    g.lineBetween(ox + cs * 22, oy + sn * 22, ox + cs * S.reach, oy + sn * S.reach);
    this.bladeGlow
      .setVisible(true)
      .setPosition(ox + cs * S.reach * 0.8, oy + sn * S.reach * 0.8)
      .setScale(0.9)
      .setAlpha(0.55 * alpha);
  }

  private bladeHits(theta: number): void {
    const S = T.sword;
    for (const m of this.mobs) {
      if (m.dead || this.sw.hit.has(m)) continue;
      const dx = m.x - this.px;
      const dy = m.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > S.reach + m.radius) continue;
      const ang = Math.atan2(dy, dx);
      const tol = S.hitTolerance * DEG + Math.asin(Math.min(1, m.radius / Math.max(d, 1)));
      if (Math.abs(angleDiff(ang, theta)) > tol) continue;
      this.sw.hit.add(m);
      this.damageMob(m, rollDamage(this.rng, S.damage, S.damageVariance), ang, 'sword', m.x - Math.cos(ang) * m.radius * 0.5, m.y - Math.sin(ang) * m.radius * 0.5, theta);
    }
    // The blade also cuts incoming fire out of the air.
    for (const b of this.bullets) {
      if (!b.active || b.friendly) continue;
      const dx = b.x - this.px;
      const dy = b.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d > S.reach + 8) continue;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), theta)) > S.hitTolerance * DEG + 0.2) continue;
      b.active = false;
      b.img.setVisible(false);
      this.particles.burst(b.x, b.y, theta, 2, 8, 140, 440, {
        life: 0.25, w: 10, h: 1.8, color: PALETTE.robot, add: true, drag: 3, align: true,
      });
      this.glowAt(b.x, b.y, PALETTE.robot, 1, 0.3, 0.08, 0.7);
      this.sfx.hit('metal', false);
      this.trauma = Math.min(1, this.trauma + 0.05);
    }
  }

  // ------------------------------------------------------------------
  // Damage and death
  // ------------------------------------------------------------------

  private damageMob(m: Mob, dmg: number, ang: number, source: Source, hx: number, hy: number, cutAngle = ang): void {
    if (m.dead) return;
    const J = T.juice;
    const isRobot = m.kind === 'robot';
    const heavy = source === 'sword';
    m.hp -= dmg;
    m.flash = 0.07;
    runState.hitMarker = 1;
    this.spawnNumber(m.x, m.y - m.radius - 6, String(dmg), heavy ? 'blade' : 'gun');

    const kb = heavy ? T.sword.knockback * (isRobot ? 0.3 : 1) : isRobot ? T.robot.gunKnockback : T.scav.gunKnockback;
    m.vx += Math.cos(ang) * kb;
    m.vy += Math.sin(ang) * kb;

    if (isRobot) {
      this.particles.burst(hx, hy, ang + Math.PI, 1.7, heavy ? 18 : 5, 160, 540, {
        life: 0.3, w: 12, h: 1.8, color: PALETTE.spark, add: true, drag: 3, align: true,
      });
      this.glowAt(hx, hy, PALETTE.spark, heavy ? 1.8 : 0.9, 0.3, 0.09, 0.8);
      this.sfx.hit('metal', heavy);
      this.drawBar(m);
    } else {
      this.particles.burst(hx, hy, ang, heavy ? 1.3 : 0.9, heavy ? 12 : 5, 90, 400, {
        life: 0.5, w: 3.5, h: 3.5, color: 0xc2261d, drag: 4,
        decal: { color: 0x7a120f, alpha: 0.5, scale: 0.34 },
      });
      this.sfx.hit('flesh', heavy);
    }

    if (heavy) {
      this.addHitStop(J.hitStopSwordHit);
      this.trauma = Math.min(1, this.trauma + J.swordHitTrauma);
      this.zoomPunch = Math.min(0.06, this.zoomPunch + J.swordZoomPunch);
      if (isRobot) {
        m.stagger = T.sword.staggerRobot;
        m.phase = 'move';
        m.phaseTime = 0;
      }
    }

    if (m.hp <= 0) this.killMob(m, ang, source, cutAngle);
  }

  private killMob(m: Mob, ang: number, source: Source, cutAngle: number): void {
    const J = T.juice;
    m.dead = true;
    m.gfx.destroy();
    m.bar?.destroy();

    if (this.comboTimer > 0) runState.combo += 1;
    else runState.combo = 1;
    this.comboTimer = J.comboWindow;
    runState.killMarker = 1;

    if (m.kind === 'scav') {
      const big = source === 'sword';
      // Shatter into line segments.
      this.particles.burst(m.x, m.y, ang, big ? 1.2 : 2.2, big ? 8 : 7, 120, big ? 560 : 360, {
        life: 0.7, w: 13, h: 2.4, color: PALETTE.hostile, drag: 3, spin: 10,
        decal: { color: 0x8a1a14, alpha: 0.5, scale: 0.3 },
      });
      this.particles.burst(m.x, m.y, ang, big ? 1.5 : 2.6, big ? 28 : 12, 90, big ? 520 : 340, {
        life: 0.6, w: 4, h: 4, color: 0xc2261d, drag: 4,
        decal: { color: 0x6a0f0b, alpha: 0.55, scale: 0.42 },
      });
      if (big) {
        // Bisect: two halves peel away perpendicular to the cut.
        for (const side of [-1, 1]) {
          const tan = cutAngle + (side * Math.PI) / 2;
          this.particles.burst(m.x, m.y, tan, 0.7, 5, 200, 520, {
            life: 0.75, w: 12, h: 2.8, color: PALETTE.hostile, drag: 3.2, spin: 12,
            decal: { color: 0x8a1a14, alpha: 0.55, scale: 0.4 },
          });
          this.particles.burst(m.x, m.y, tan, 0.5, 8, 160, 480, {
            life: 0.55, w: 5, h: 5, color: 0xc2261d, drag: 3.6,
            decal: { color: 0x6a0f0b, alpha: 0.6, scale: 0.5 },
          });
        }
        // The cut itself, a bright line through the body.
        this.particles.emit({
          x: m.x, y: m.y, vx: 0, vy: 0, life: 0.11, w: 84, h: 3, rot: cutAngle,
          color: PALETTE.white, add: true,
        });
        this.glowAt(m.x, m.y, 0xff8a7a, 2.2, 0.5, 0.16, 0.85);
        this.ring(m.x, m.y, PALETTE.hostile, 0.35);
        this.addHitStop(J.hitStopSwordKill);
        this.trauma = Math.min(1, this.trauma + J.swordKillTrauma);
        this.refundOnKill();
      } else {
        this.addHitStop(J.hitStopGunKill);
        this.trauma = Math.min(1, this.trauma + 0.07);
        this.sfx.kill(0.8);
      }
      if (this.rng.next() < T.scav.lootChance) this.dropLoot(m.x, m.y, 0);
    } else {
      this.explodeRobot(m, ang);
    }
  }

  private explodeRobot(m: Mob, ang: number): void {
    const J = T.juice;
    this.particles.burst(m.x, m.y, 0, Math.PI * 2, 30, 140, 720, {
      life: 0.45, w: 14, h: 1.8, color: PALETTE.spark, add: true, drag: 2.6, align: true,
    });
    this.particles.burst(m.x, m.y, ang, 2.4, 10, 100, 460, {
      life: 0.9, w: 16, h: 3, color: PALETTE.robot, drag: 2.4, spin: 9,
      decal: { color: 0x2b1038, alpha: 0.6, scale: 0.4 },
    });
    this.particles.burst(m.x, m.y, 0, Math.PI * 2, 8, 40, 200, {
      life: 0.7, w: 6, h: 6, color: 0x222222, drag: 3, decal: { color: 0x000000, alpha: 0.5, scale: 1.7 },
    });
    this.glowAt(m.x, m.y, PALETTE.white, 4.2, 0.4, 0.34, 0.95);
    this.glowAt(m.x, m.y, PALETTE.robot, 6.4, 1.2, 0.5, 0.6);
    this.ring(m.x, m.y, PALETTE.robot, 0.45, 7);
    this.cameras.main.flash(80, 210, 170, 255, false);
    this.sfx.explosion();
    this.addHitStop(J.hitStopRobotDeath);
    this.trauma = Math.min(1, this.trauma + J.robotDeathTrauma);
    this.zoomPunch = Math.min(0.07, this.zoomPunch + J.robotDeathZoomPunch);
    for (let i = 0; i < T.robot.lootDrops; i++) {
      this.dropLoot(m.x, m.y, T.robot.lootMinRarity);
    }
    // Blast shoves nearby scavengers.
    for (const o of this.mobs) {
      if (o.dead || o === m) continue;
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < 150) {
        const a = Math.atan2(o.y - m.y, o.x - m.x);
        o.vx += Math.cos(a) * 380 * (1 - d / 150);
        o.vy += Math.sin(a) * 380 * (1 - d / 150);
      }
    }
  }

  private refundOnKill(): void {
    const S = T.sword;
    runState.reserve = Math.min(runState.maxReserve, runState.reserve + S.reserveRefund);
    this.spawnNumber(this.px, this.py - 30, `+${S.reserveRefund}`, 'refund');
    runState.shield = Math.min(runState.maxShield, runState.shield + S.shieldRefund);
    runState.refundFlash = 1;
    this.sfx.kill(1 + Math.min(runState.combo, 9) * 0.07);
    this.ring(this.px, this.py, PALETTE.ammo, 0.28, 3.2);
  }

  private ring(x: number, y: number, color: number, life: number, to = 5): void {
    const c = this.add.circle(x, y, 14).setStrokeStyle(3, color, 1).setFillStyle(color, 0).setDepth(22);
    c.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: c, scale: to, alpha: 0, duration: life * 1000, ease: 'Cubic.easeOut',
      onComplete: () => c.destroy(),
    });
  }

  private addHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  // ------------------------------------------------------------------
  // Floating damage numbers
  // ------------------------------------------------------------------

  private createNumbers(): void {
    const N = T.numbers;
    const spec: Record<NumClass, { size: number; color: number }> = {
      gun: { size: N.gunSize, color: PALETTE.spark },
      blade: { size: N.bladeSize, color: PALETTE.white },
      hurt: { size: N.hurtSize, color: PALETTE.hostile },
      shield: { size: N.shieldSize, color: PALETTE.shield },
      refund: { size: N.refundSize, color: PALETTE.ammo },
    };
    for (const cls of Object.keys(spec) as NumClass[]) {
      const { size, color } = spec[cls];
      for (let i = 0; i < N.pool[cls]; i++) {
        const txt = this.add
          .text(0, 0, '', {
            fontFamily: FONT,
            fontStyle: 'bold',
            fontSize: `${size}px`,
            color: hex(color),
            stroke: '#000000',
            strokeThickness: Math.max(3, Math.round(size / 6)),
          })
          .setOrigin(0.5)
          .setDepth(30)
          .setVisible(false);
        this.dmgNums.push({ txt, cls, active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1 });
      }
    }
  }

  private spawnNumber(x: number, y: number, text: string, cls: NumClass): void {
    const N = T.numbers;
    let slot: DmgNum | undefined;
    let oldest: DmgNum | undefined;
    for (const n of this.dmgNums) {
      if (n.cls !== cls) continue;
      if (!n.active) {
        slot = n;
        break;
      }
      if (!oldest || n.age > oldest.age) oldest = n;
    }
    const n = slot ?? oldest;
    if (!n) return;
    n.active = true;
    n.age = 0;
    n.life = cls === 'blade' ? N.bladeLife : N.life;
    n.x = x + (Math.random() * 2 - 1) * N.jitter;
    n.y = y;
    n.vx = (Math.random() * 2 - 1) * N.sideways;
    n.vy = -N.rise * (0.8 + Math.random() * 0.4);
    n.txt.setText(text).setVisible(true).setPosition(n.x, n.y).setAlpha(1).setScale(1 + N.popScale);
  }

  private updateNumbers(dt: number): void {
    const N = T.numbers;
    const k = Math.exp(-N.drag * dt);
    for (const n of this.dmgNums) {
      if (!n.active) continue;
      n.age += dt;
      if (n.age >= n.life) {
        n.active = false;
        n.txt.setVisible(false);
        continue;
      }
      n.vx *= k;
      n.vy *= k;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      const fadeStart = n.life * 0.55;
      const alpha = n.age < fadeStart ? 1 : 1 - (n.age - fadeStart) / (n.life - fadeStart);
      const pop = Math.max(0, 1 - n.age / N.popTime);
      n.txt.setPosition(n.x, n.y).setAlpha(alpha).setScale(1 + N.popScale * pop);
    }
  }

  // ------------------------------------------------------------------
  // Glow flashes (cheap light)
  // ------------------------------------------------------------------

  private glowAt(x: number, y: number, color: number, s0: number, s1: number, life: number, a0: number): void {
    const g = this.glows.find((o) => !o.active);
    if (!g) return;
    g.active = true;
    g.t = 0;
    g.life = life;
    g.s0 = s0;
    g.s1 = s1;
    g.a0 = a0;
    g.img.setVisible(true).setTint(color).setPosition(x, y).setScale(s0).setAlpha(a0);
  }

  private updateGlows(dt: number): void {
    for (const g of this.glows) {
      if (!g.active) continue;
      g.t += dt;
      if (g.t >= g.life) {
        g.active = false;
        g.img.setVisible(false);
        continue;
      }
      const k = g.t / g.life;
      g.img.setScale(g.s0 + (g.s1 - g.s0) * k).setAlpha(g.a0 * Math.pow(1 - k, 1.5));
    }
  }

  // ------------------------------------------------------------------
  // Loot
  // ------------------------------------------------------------------

  private dropLoot(x: number, y: number, minRarity: number): void {
    const item = rollItem(this.rng, minRarity);
    const color = RARITY_COLORS[item.rarity];
    const s = 7 + item.rarity * 1.3;
    const gfx = this.add.graphics().setDepth(8);
    gfx.fillStyle(color, 0.35);
    gfx.lineStyle(2, color, 1);
    const pts = [{ x: 0, y: -s }, { x: s * 0.7, y: 0 }, { x: 0, y: s }, { x: -s * 0.7, y: 0 }];
    gfx.fillPoints(poly(pts), true);
    gfx.strokePoints(poly(pts), true);
    const baseAlpha = 0.45 + item.rarity * 0.07;
    const glow = this.add
      .image(x, y, 'glow')
      .setDepth(7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setScale(0.45 + item.rarity * 0.14)
      .setAlpha(baseAlpha);
    let beam: Phaser.GameObjects.Image | undefined;
    if (item.rarity >= 4) {
      beam = this.add
        .image(x, y, 'px')
        .setOrigin(0.5, 1)
        .setDepth(7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setScale(0.9 + (item.rarity - 4) * 0.5, 22 + (item.rarity - 4) * 8)
        .setAlpha(0.5);
    }
    const a = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 150;
    this.drops.push({
      item, gfx, glow, beam, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      age: 0, phase: Math.random() * 6, baseAlpha,
    });
    gfx.setPosition(x, y);
    this.glowAt(x, y, color, 0.6 + item.rarity * 0.3, 0.2, 0.25, 0.7);
    this.sfx.drop(item.rarity);
    if (item.rarity >= 5) this.ring(x, y, color, 0.6, 6);
  }

  private updateDrops(dt: number): void {
    const L = T.loot;
    const now = this.time.now / 1000;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const k = Math.exp(-5 * dt);
      d.vx *= k;
      d.vy *= k;
      const dx = this.px - d.x;
      const dy = this.py - d.y;
      const dist = Math.hypot(dx, dy);
      if (d.age > L.magnetDelay && dist < L.magnetRadius) {
        const pull = L.magnetSpeed * (1 - dist / L.magnetRadius * 0.5);
        d.vx += (dx / Math.max(dist, 1)) * pull * dt * 6;
        d.vy += (dy / Math.max(dist, 1)) * pull * dt * 6;
      }
      d.x = clamp(d.x + d.vx * dt, X0 + 8, X1 - 8);
      d.y = clamp(d.y + d.vy * dt, Y0 + 8, Y1 - 8);
      d.gfx.setPosition(d.x, d.y).setRotation(now * 1.4 + d.phase);
      d.glow.setPosition(d.x, d.y).setAlpha(d.baseAlpha * (0.75 + 0.25 * Math.sin(now * 4 + d.phase)));
      d.beam?.setPosition(d.x, d.y);

      if (dist < L.pickupRadius && d.age > 0.15) {
        const color = RARITY_COLORS[d.item.rarity];
        runState.carried.push(d.item);
        pushFeed(`${d.item.rarityLabel} ${d.item.name}`, color);
        this.sfx.pickup(d.item.rarity);
        this.glowAt(d.x, d.y, color, 1.1, 2.4, 0.22, 0.8);
        this.particles.burst(d.x, d.y, 0, Math.PI * 2, 6 + d.item.rarity * 2, 40, 220, {
          life: 0.35, w: 7, h: 1.6, color, add: true, drag: 4, align: true,
        });
        d.gfx.destroy();
        d.glow.destroy();
        d.beam?.destroy();
        this.drops.splice(i, 1);
      }
    }
  }

  private extract(): void {
    const n = runState.carried.length;
    if (n === 0) {
      pushFeed('Nothing to extract', PALETTE.textDim);
      return;
    }
    runState.stash.push(...runState.carried);
    runState.carried = [];
    pushFeed(`Extracted ${n} item${n > 1 ? 's' : ''} to the stash`, PALETTE.structure);
    setBanner('EXTRACTED', 1.4);
    this.sfx.pickup(5);
    this.ring(this.px, this.py, PALETTE.structure, 0.6, 7);
  }

  // ------------------------------------------------------------------
  // Spawning and waves
  // ------------------------------------------------------------------

  private queueSpawn(kind: MobKind, delay: number, pipeIndex?: number): void {
    const pipe = PIPES[pipeIndex ?? Math.floor(Math.random() * PIPES.length)];
    this.spawnQueue.push({
      kind,
      x: pipe.x + pipe.dx * 46 + (Math.random() - 0.5) * 44,
      y: pipe.y + pipe.dy * 46 + (Math.random() - 0.5) * 44,
      t: delay,
    });
  }

  private queueSwarm(count: number): void {
    // Prefer pipes away from the player so they have to come to you.
    const far = PIPES.map((p, i) => ({ i, d: Math.hypot(p.x - this.px, p.y - this.py) }))
      .sort((a, b) => b.d - a.d)
      .slice(0, 3);
    for (let i = 0; i < count; i++) {
      this.queueSpawn('scav', i * T.waves.spawnStagger, far[i % far.length].i);
    }
  }

  private startWave(): void {
    const Wv = T.waves;
    this.wave += 1;
    this.waveLive = true;
    this.queueSwarm(Wv.scavBase + Wv.scavPerWave * (this.wave - 1));
    if (this.wave >= Wv.robotFromWave) {
      const robots = Math.min(Wv.robotCap, 1 + Math.floor((this.wave - Wv.robotFromWave) / Wv.robotEvery));
      for (let i = 0; i < robots; i++) this.queueSpawn('robot', 1.4 + i * 1.1);
    }
    setBanner(`WAVE ${this.wave}`, 2);
  }

  private updateSpawner(dt: number): void {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.t -= dt;
      if (s.t <= 0) {
        this.spawnMob(s.kind, s.x, s.y);
        this.spawnQueue.splice(i, 1);
      }
    }
    const alive = this.mobs.some((m) => !m.dead) || this.spawnQueue.length > 0;
    if (this.waveLive) {
      if (!alive) {
        this.waveLive = false;
        this.waveTimer = T.waves.intermission;
        setBanner('WAVE CLEARED', 1.8);
      }
    } else {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0 && !alive) this.startWave();
    }
  }

  private spawnMob(kind: MobKind, x: number, y: number): void {
    const robot = kind === 'robot';
    const cfg = robot ? T.robot : T.scav;
    const gfx = this.add.graphics().setDepth(robot ? 11 : 10);
    const m: Mob = {
      kind, gfx, x, y, vx: 0, vy: 0, hp: cfg.hp, maxHp: cfg.hp, radius: cfg.radius,
      speed: cfg.speed * (robot ? 1 : 1 + (Math.random() * 2 - 1) * T.scav.speedJitter),
      facing: Math.atan2(this.py - y, this.px - x), attackCd: 0.3, flash: 0, flashing: false,
      stagger: 0, wobble: Math.random() * 6, dead: false,
      phase: 'move', phaseTime: 0, shotsLeft: 0, shotTimer: 0,
      shotCd: robot ? Phaser.Math.FloatBetween(0.8, 1.6) : 0, aimAngle: 0,
      strafe: Math.random() < 0.5 ? 1 : -1,
    };
    if (robot) {
      m.bar = this.add.graphics().setDepth(12);
      this.drawBar(m);
    }
    this.drawMob(m, false);
    gfx.setPosition(x, y).setRotation(m.facing);
    this.mobs.push(m);
    this.glowAt(x, y, robot ? PALETTE.robot : PALETTE.hostile, robot ? 2.6 : 1.3, 0.3, 0.3, 0.7);
  }

  private killAll(): void {
    for (const m of this.mobs) {
      if (m.dead) continue;
      m.dead = true;
      m.gfx.destroy();
      m.bar?.destroy();
    }
    this.spawnQueue = [];
  }

  private resetWorld(first: boolean): void {
    this.killAll();
    this.mobs = [];
    for (const b of this.bullets) {
      b.active = false;
      b.img.setVisible(false);
    }
    for (const d of this.drops) {
      d.gfx.destroy();
      d.glow.destroy();
      d.beam?.destroy();
    }
    this.drops = [];
    this.px = W / 2;
    this.py = H / 2;
    this.pvx = this.pvy = this.lungeX = this.lungeY = 0;
    this.camX = this.px;
    this.camY = this.py;
    this.trauma = 0;
    this.kickX = this.kickY = 0;
    this.zoomPunch = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.sw.state = 'idle';
    this.sw.t = 0;
    this.sw.hit.clear();
    this.fireCd = 0;
    this.reloadT = -1;
    this.swordCd = 0;
    this.prevDashReady = 1;
    this.prevBladeReady = 1;
    for (const n of this.dmgNums) {
      n.active = false;
      n.txt.setVisible(false);
    }
    this.bloom = 0;
    this.shieldCd = 0;
    this.hitStop = 0;
    this.dead = false;
    this.wave = 0;
    this.waveLive = false;
    this.waveTimer = first ? 1.4 : 2;
    resetVitals();
    this.playerGfx.setVisible(true);
    this.shieldGfx.setVisible(true);
    this.floor.clear();
    this.floor.render();
    if (!first) setBanner('CLONE REGROWN', 1.6);
  }

  // ------------------------------------------------------------------
  // Mobs
  // ------------------------------------------------------------------

  private updateMobs(dt: number): void {
    this.mobs = this.mobs.filter((m) => !m.dead);
    const T_S = T.scav;
    const lasers: { x1: number; y1: number; x2: number; y2: number; k: number }[] = [];

    for (const m of this.mobs) {
      // Hit flash toggles the drawn colour only when the state flips.
      if (m.flash > 0) {
        m.flash -= dt;
        if (!m.flashing) {
          m.flashing = true;
          this.drawMob(m, true);
        }
      } else if (m.flashing) {
        m.flashing = false;
        this.drawMob(m, false);
      }
      if (m.stagger > 0) m.stagger -= dt;

      const dx = this.px - m.x;
      const dy = this.py - m.y;
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
          for (const o of this.mobs) {
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
          this.hurtPlayer(T_S.contactDamage, toPlayer + Math.PI);
        }
      } else {
        this.updateRobot(m, dt, dist, toPlayer, ux, uy, lasers);
      }

      this.collide(m, m.radius);
      m.gfx.setPosition(m.x, m.y).setRotation(m.facing);
      m.bar?.setPosition(m.x, m.y - m.radius - 12);
    }

    this.fxGfx.clear();
    for (const l of lasers) {
      this.fxGfx.lineStyle(1.5 + l.k * 2, PALETTE.robot, 0.25 + l.k * 0.65);
      this.fxGfx.lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
  }

  private updateRobot(
    m: Mob, dt: number, dist: number, toPlayer: number, ux: number, uy: number,
    lasers: { x1: number; y1: number; x2: number; y2: number; k: number }[],
  ): void {
    const R = T.robot;
    const los = !PILLARS.some((r) => segmentIntersectsRect(m.x, m.y, this.px, this.py, r));

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
        this.sfx.charge();
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
        this.fireBullet(mx, my, a, R.bulletSpeed, R.bulletDamage, false, R.bulletLife, PALETTE.robot, 20, 5);
        this.glowAt(mx, my, PALETTE.robot, 1.4, 0.6, 0.09, 0.9);
        m.vx -= Math.cos(a) * 70;
        m.vy -= Math.sin(a) * 70;
        this.sfx.robotShot();
        m.shotsLeft -= 1;
        m.shotTimer = R.burstGap;
        if (m.shotsLeft <= 0) {
          m.phase = 'move';
          m.shotCd = Phaser.Math.FloatBetween(R.cooldownMin, R.cooldownMax);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------------

  private applyCamera(dt: number, frozen: boolean): void {
    const C = T.camera;
    const cam = this.cameras.main;
    const tx = this.px + (this.mouseX - this.px) * C.lookAhead;
    const ty = this.py + (this.mouseY - this.py) * C.lookAhead;
    if (!frozen) {
      const k = 1 - Math.exp(-C.followLerp * dt);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    const z = C.zoom * (1 + this.zoomPunch);
    cam.setZoom(z);
    const vw = cam.width / z;
    const vh = cam.height / z;
    const cx = vw >= W ? W / 2 : clamp(this.camX, vw / 2, W - vw / 2);
    const cy = vh >= H ? H / 2 : clamp(this.camY, vh / 2, H - vh / 2);
    const shake = this.trauma * this.trauma * C.shakeMaxOffset;
    cam.centerOn(
      cx + (Math.random() * 2 - 1) * shake + this.kickX,
      cy + (Math.random() * 2 - 1) * shake + this.kickY,
    );
    if (!frozen) {
      this.trauma = Math.max(0, this.trauma - C.traumaDecay * dt);
      const kd = Math.exp(-C.kickDecay * dt);
      this.kickX *= kd;
      this.kickY *= kd;
      this.zoomPunch *= Math.exp(-C.zoomPunchDecay * dt);
    }
  }
}
