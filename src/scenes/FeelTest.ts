// The feel-test room: one arena, one SMG, one power blade, scavenger
// swarms and rogue robots. Everything here exists to answer one question:
// does being a clone super soldier feel heavy, fast and good for ten minutes?
//
// This scene is only the loop and the wiring. Rules and effects live in
// src/game/systems/*, state in src/game/world.ts.
import Phaser from 'phaser';
import { H, SPAWN, W } from '../data/arena';
import { PALETTE } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { getSfx } from '../fx/audio';
import { drawFloor } from '../fx/arenaArt';
import { DamageNumbers } from '../fx/damageNumbers';
import { Glows } from '../fx/glows';
import { Particles } from '../fx/particles';
import { PlayerRig } from '../fx/playerRig';
import { Ctx } from '../game/ctx';
import type { MissionResult } from '../game/mission';
import { onStatsChanged, profile } from '../game/profile';
import { resetVitals, runState, setBanner } from '../game/runState';
import { BladeSystem } from '../game/systems/blade';
import { CameraSystem } from '../game/systems/camera';
import { CombatSystem } from '../game/systems/combat';
import { GunSystem } from '../game/systems/gun';
import { ExtractSystem } from '../game/systems/extract';
import { LootSystem } from '../game/systems/loot';
import { MobSystem } from '../game/systems/mobs';
import { PlayerSystem } from '../game/systems/player';
import type { KeyMap } from '../game/types';
import { World } from '../game/world';
import { Rng } from '../sim/math';

const BULLET_POOL = 220;

export class FeelTest extends Phaser.Scene {
  private w = new World();
  private g!: Ctx;

  /** 'dev' is the free-play test room; 'mission' is a deployment that ends by extracting, dying or aborting. */
  private mode: 'dev' | 'mission' = 'dev';
  private missionId = 'dev';
  private startIntel = 0;
  private ending = false;

  constructor() {
    super('FeelTest');
  }

  init(data: { mode?: 'dev' | 'mission'; missionId?: string }): void {
    this.mode = data.mode ?? 'dev';
    this.missionId = data.missionId ?? 'dev';
    this.ending = false;
    this.w = new World();
  }

  create(): void {
    runState.devMode = this.mode === 'dev';
    runState.carried = [];
    runState.carriedScrap = 0;
    this.startIntel = profile.intel;
    const g = new Ctx(this, this.w, getSfx(), new Rng((Date.now() ^ 0x9e3779b9) >>> 0));
    this.g = g;
    this.w = g.w;

    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.input.mouse?.disableContextMenu();
    this.input.setDefaultCursor('none');
    g.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,F,X,R,K,M,T,H,ONE,TWO,TAB,B,ESC',
    ) as unknown as KeyMap;

    const unlock = (): void => g.sfx.unlock();
    this.input.on('pointerdown', unlock);
    this.input.keyboard!.on('keydown', unlock);

    drawFloor(this);
    g.floor = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(-10);
    g.particles = new Particles(this, g.floor);

    g.fxGfx = this.add.graphics().setDepth(16);

    g.rig = new PlayerRig(this, 14);
    const off = onStatsChanged((st) => {
      g.rig.setWeapon(st.weapon.armsKey);
      g.rig.setBlade(st.blade.spriteKey);
    });
    this.events.once('shutdown', () => {
      off();
      this.input.setDefaultCursor('default');
    });
    g.rig.setWeapon(profile.stats.weapon.armsKey);
    g.rig.setBlade(profile.stats.blade.spriteKey);
    g.shieldGfx = this.add.graphics().setDepth(13);
    g.shieldGfx.lineStyle(2, PALETTE.shield, 1);
    g.shieldGfx.strokeCircle(0, 0, T.player.radius + 8);

    g.bladeGfx = this.add.graphics().setDepth(15);
    g.bladeGlow = this.add
      .image(0, 0, 'glow')
      .setDepth(15)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xbffcff)
      .setVisible(false);

    for (let i = 0; i < BULLET_POOL; i++) {
      this.w.bullets.push({
        img: this.add.image(0, 0, 'px').setDepth(17).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
        active: false, friendly: true, x: 0, y: 0, vx: 0, vy: 0, life: 0, dmg: 0, pierce: 0, hit: new Set(), ap: 0, stagger: 0, impact: 0, shot: 0,
      });
    }

    g.glows = new Glows(this);
    g.nums = new DamageNumbers(this);

    g.playerSys = new PlayerSystem(g);
    g.gunSys = new GunSystem(g);
    g.bladeSys = new BladeSystem(g);
    g.combat = new CombatSystem(g);
    g.mobSys = new MobSystem(g);
    g.lootSys = new LootSystem(g);
    g.extractSys = new ExtractSystem(g);
    g.cam = new CameraSystem(g);

    this.events.on('resume', () => this.input.keyboard!.resetKeys());
    this.resetWorld(true);
    this.cameras.main.fadeIn(300, 2, 6, 8);
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
  }

  // ------------------------------------------------------------------
  // Loop
  // ------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const g = this.g;
    const w = this.w;
    const dt = Math.min(delta / 1000, 0.05);
    this.tickHud(dt);

    if (w.hitStop > 0) {
      // The freeze: nothing simulates, but the camera still jitters.
      w.hitStop -= dt;
      g.cam.applyCamera(dt, true);
      return;
    }

    this.updateMouse();

    if (w.dead) {
      w.deadTimer -= dt;
      g.particles.update(dt);
      g.glows.update(dt);
      g.nums.update(dt);
      g.cam.applyCamera(dt, false);
      if (w.deadTimer <= 0) {
        if (this.mode === 'mission') this.endMission('lost');
        else this.resetWorld(false);
      }
      return;
    }

    this.handleDebugKeys();
    g.playerSys.updatePlayer(dt);
    g.bladeSys.updateSword(dt);
    g.gunSys.updateGun(dt);
    g.mobSys.updateSpawner(dt);
    g.mobSys.updateMobs(dt);
    g.gunSys.updateBullets(dt);
    g.lootSys.updateDrops(dt);
    g.extractSys.update(dt);
    g.particles.update(dt);
    g.glows.update(dt);
    g.nums.update(dt);
    g.cam.applyCamera(dt, false);
    this.syncState();
  }

  private tickHud(dt: number): void {
    const s = runState;
    s.damageFlash *= Math.exp(-4.5 * dt);
    s.hitMarker = Math.max(0, s.hitMarker - dt * 7);
    s.killMarker = Math.max(0, s.killMarker - dt * 3.5);
    s.refundFlash = Math.max(0, s.refundFlash - dt * 2.2);
    s.dryFlash = Math.max(0, s.dryFlash - dt * 4);
    s.activeFlash = Math.max(0, s.activeFlash - dt / T.gun.activeReload.feedbackSeconds);
    s.dashPing = Math.max(0, s.dashPing - dt * 3);
    s.bladePing = Math.max(0, s.bladePing - dt * 3);
    s.dashDeny = Math.max(0, s.dashDeny - dt * 4);
    s.bladeDeny = Math.max(0, s.bladeDeny - dt * 4);
    s.bannerTime = Math.max(0, s.bannerTime - dt);
    for (const f of s.feed) f.age += dt;
    s.feed = s.feed.filter((f) => f.age < T.loot.feedSeconds);
    if (this.w.comboTimer > 0) {
      this.w.comboTimer -= dt;
      if (this.w.comboTimer <= 0) s.combo = 0;
    }
  }

  private syncState(): void {
    const s = runState;
    s.dashReady = this.w.dashCd <= 0 ? 1 : 1 - this.w.dashCd / profile.stats.dashCooldown;
    s.bladeReady = this.w.swordCd <= 0 ? 1 : 1 - this.w.swordCd / profile.stats.bladeCooldown;
    if (this.w.prevDashReady < 1 && s.dashReady >= 1) s.dashPing = 1;
    if (this.w.prevBladeReady < 1 && s.bladeReady >= 1) s.bladePing = 1;
    this.w.prevDashReady = s.dashReady;
    this.w.prevBladeReady = s.bladeReady;
    s.wave = this.w.wave;
    s.mobsAlive = this.w.mobs.filter((m) => !m.dead).length + this.w.spawnQueue.length;
    s.intermission = this.w.waveLive ? 0 : Math.max(0, this.w.waveTimer);
    s.aimSpread = profile.stats.spread + this.w.bloom;
    s.muted = this.g.sfx.muted;
  }

  private updateMouse(): void {
    const ptr = this.input.activePointer;
    ptr.updateWorldPoint(this.cameras.main);
    this.w.mouseX = ptr.worldX;
    this.w.mouseY = ptr.worldY;
    this.w.aim = Math.atan2(this.w.mouseY - this.w.py, this.w.mouseX - this.w.px);
  }

  private openPause(): void {
    this.scene.pause();
    this.scene.launch('Pause', {
      mission: this.mode === 'mission',
      onLeave: () => (this.mode === 'mission' ? this.endMission('aborted') : this.exitToTitle()),
    });
    this.scene.bringToTop('Pause');
  }

  private exitToTitle(): void {
    if (this.ending) return;
    this.ending = true;
    this.scene.stop('Hud');
    this.scene.start('Title');
  }

  /** Leave the room for the base. Extracting banks the haul; dying or aborting loses what was carried. */
  private endMission(outcome: MissionResult['outcome'], banked?: { items: number; scrap: number }): void {
    if (this.ending) return;
    this.ending = true;
    let lost = 0;
    if (outcome === 'lost') lost = runState.lastLost;
    if (outcome === 'aborted') {
      lost = runState.carried.length + (runState.carriedScrap > 0 ? 1 : 0);
      runState.carried = [];
      runState.carriedScrap = 0;
    }
    const result: MissionResult = {
      missionId: this.missionId,
      outcome,
      items: banked?.items ?? 0,
      scrap: banked?.scrap ?? 0,
      lost,
      intel: Math.max(0, profile.intel - this.startIntel),
      wave: this.w.wave,
    };
    this.scene.stop('Hud');
    this.cameras.main.fadeOut(outcome === 'lost' ? 500 : 350, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Base', { mode: 'hub', result }));
  }

  private openTree(): void {
    this.scene.pause();
    this.scene.launch('Tree', { sfx: this.g.sfx });
    this.scene.bringToTop('Tree');
  }

  private openBase(): void {
    this.scene.pause();
    this.scene.launch('Base', { mode: 'overlay', sfx: this.g.sfx });
    this.scene.bringToTop('Base');
  }

  private handleDebugKeys(): void {
    const K = Phaser.Input.Keyboard;
    if (K.JustDown(this.g.keys.H)) runState.showHelp = !runState.showHelp;
    if (K.JustDown(this.g.keys.M)) this.g.sfx.setMuted(!this.g.sfx.muted);
    if (K.JustDown(this.g.keys.ESC)) return this.openPause();
    if (K.JustDown(this.g.keys.X) && this.g.extractSys.canExtract()) {
      const r = this.g.lootSys.extract();
      if (this.mode === 'mission' && (!r || r.left === 0)) this.endMission('extracted', r ?? undefined);
    }
    if (this.mode !== 'dev') return;
    if (K.JustDown(this.g.keys.ONE)) this.g.mobSys.queueSwarm(T.waves.swarmSize);
    if (K.JustDown(this.g.keys.TWO)) this.g.mobSys.queueSpawn('robot', 0);
    if (K.JustDown(this.g.keys.K)) this.g.mobSys.killAll();
    if (K.JustDown(this.g.keys.T)) this.resetWorld(false);
    if (K.JustDown(this.g.keys.TAB)) this.openTree();
    if (K.JustDown(this.g.keys.B)) this.openBase();
  }

  private resetWorld(first: boolean): void {
    this.g.mobSys.killAll();
    this.w.mobs = [];
    for (const b of this.w.bullets) {
      b.active = false;
      b.img.setVisible(false);
    }
    for (const d of this.w.drops) {
      d.gfx.destroy();
      d.glow.destroy();
      d.beam?.destroy();
    }
    this.w.drops = [];
    this.w.px = SPAWN.x;
    this.w.py = SPAWN.y;
    this.w.pvx = this.w.pvy = this.w.lungeX = this.w.lungeY = 0;
    this.w.camX = this.w.px;
    this.w.camY = this.w.py;
    this.w.trauma = 0;
    this.w.kickX = this.w.kickY = 0;
    this.w.zoomPunch = 0;
    this.w.dashT = 0;
    this.w.dashCd = 0;
    this.w.sw.state = 'idle';
    this.w.sw.t = 0;
    this.w.sw.hit.clear();
    this.w.fireCd = 0;
    this.w.reloadT = -1;
    this.w.swordCd = 0;
    this.w.prevDashReady = 1;
    this.w.prevBladeReady = 1;
    this.g.nums.reset();
    this.w.bloom = 0;
    this.w.shieldCd = 0;
    this.w.hitStop = 0;
    this.w.dead = false;
    this.w.wave = 0;
    this.w.waveLive = false;
    this.w.waveTimer = first ? 1.4 : 2;
    resetVitals();
    this.g.rig.setVisible(true);
    this.g.shieldGfx.setVisible(true);
    this.g.floor.clear();
    this.g.floor.render();
    if (!first) setBanner('CLONE REGROWN', 1.6);
  }
}
