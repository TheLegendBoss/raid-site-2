// HUD on its own scene so the game camera's shake, zoom and scroll never move it.
import Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { runState } from '../game/runState';
import { clamp } from '../sim/math';

const FEED_LINES = 7;
const PANEL_W = 312;
const PANEL_H = 138;
const BOLT_TRAVEL = 15; // px the bolt slides back
const MAG_DROP = 46; // px the magazine falls when released

interface Casing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
}

export class Hud extends Phaser.Scene {
  private vignette!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private cross!: Phaser.GameObjects.Graphics;
  private vitalsText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private carryText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private dashLabel!: Phaser.GameObjects.Text;
  private bladeLabel!: Phaser.GameObjects.Text;
  private dashTimer!: Phaser.GameObjects.Text;
  private bladeTimer!: Phaser.GameObjects.Text;
  private panelTitle!: Phaser.GameObjects.Text;
  private magCount!: Phaser.GameObjects.Text;
  private reserveText!: Phaser.GameObjects.Text;
  private cursorAmmo!: Phaser.GameObjects.Text;
  private feedTexts: Phaser.GameObjects.Text[] = [];
  private textCache = new Map<Phaser.GameObjects.Text, string>();

  // Weapon animation state, driven by runState changes.
  private casings: Casing[] = [];
  private lastShotSeq = 0;
  private kick = 0; // bolt travel 0..1, springs back
  private muzzle = 0; // muzzle flash 0..1
  private pipFlash = 0; // the pip that just emptied

  constructor() {
    super('Hud');
  }

  create(): void {
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0.5).setAlpha(0.95).setDepth(0);
    this.hurt = this.add
      .image(0, 0, 'vignette')
      .setOrigin(0.5)
      .setTint(0xff2a1a)
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(0)
      .setDepth(1);

    this.bars = this.add.graphics().setDepth(5);
    this.panel = this.add.graphics().setDepth(5);
    this.cross = this.add.graphics().setDepth(9);

    const mk = (size: number, color: number, ox = 0, oy = 0, bold = false): Phaser.GameObjects.Text =>
      this.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: `${size}px`,
          color: hex(color),
          fontStyle: bold ? 'bold' : 'normal',
        })
        .setOrigin(ox, oy)
        .setDepth(6);

    this.vitalsText = mk(13, PALETTE.text);
    this.statusText = mk(13, PALETTE.text, 1, 0).setAlign('right');
    this.helpText = mk(11, PALETTE.textDim, 1, 0).setAlign('right');
    this.carryText = mk(13, PALETTE.text, 0.5, 1);
    this.banner = mk(42, PALETTE.structure, 0.5, 0.5).setDepth(8);
    this.comboText = mk(22, PALETTE.ammo, 0.5, 0.5).setDepth(8);
    this.dashLabel = mk(10, PALETTE.text);
    this.bladeLabel = mk(10, PALETTE.text);
    this.dashTimer = mk(15, PALETTE.white, 1, 0.5, true).setDepth(7);
    this.bladeTimer = mk(15, PALETTE.white, 1, 0.5, true).setDepth(7);
    this.panelTitle = mk(11, PALETTE.textDim);
    this.magCount = mk(38, PALETTE.ammo, 1, 0, true);
    this.reserveText = mk(15, PALETTE.textDim, 1, 0);
    this.cursorAmmo = mk(13, PALETTE.ammo, 0, 0, true);
    for (let i = 0; i < FEED_LINES; i++) {
      this.feedTexts.push(mk(13, PALETTE.text, 0, 1));
    }

    this.setText(this.dashLabel, 'DASH\nSHIFT');
    this.setText(this.bladeLabel, 'BLADE\nRMB');
    this.setText(this.panelTitle, 'CARBINE');
    this.setText(
      this.helpText,
      [
        'WASD move   SHIFT / SPACE dash',
        'LMB carbine   R reload',
        'RMB / F arc blade',
        'blade kills refund reserve ammo + shield',
        '1 swarm   2 robot   K clear   T reset room',
        'X extract   M mute   H hide help',
      ].join('\n'),
    );
  }

  private setText(t: Phaser.GameObjects.Text, s: string): void {
    if (this.textCache.get(t) === s) return;
    this.textCache.set(t, s);
    t.setText(s);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color: number): void {
    const g = this.bars;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, y, w, h);
    g.fillStyle(color, 1);
    g.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2);
    g.lineStyle(1, PALETTE.structureDim, 1);
    g.strokeRect(x, y, w, h);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    const s = runState;
    const w = this.scale.width;
    const h = this.scale.height;

    this.vignette.setPosition(w / 2, h / 2).setDisplaySize(w * 1.5, h * 1.5);
    this.hurt.setPosition(w / 2, h / 2).setDisplaySize(w * 1.25, h * 1.25).setAlpha(s.damageFlash * 0.85);

    this.drawVitals();
    this.drawStatus(w);
    this.drawFeedAndBanner(w, h);
    this.drawWeaponPanel(w, h, dt);
    this.drawCrosshair();
  }

  // ------------------------------------------------------------------
  // Top-left: vitals and ability cooldowns
  // ------------------------------------------------------------------

  private drawVitals(): void {
    const s = runState;
    const g = this.bars;
    g.clear();
    const x = 18;
    const bw = 230;
    const hpFrac = s.hp / s.maxHp;
    this.bar(x, 18, bw, 9, s.shield / s.maxShield, PALETTE.shield);
    this.bar(x, 34, bw, 9, hpFrac, hpFrac < 0.3 ? PALETTE.healthLow : PALETTE.health);
    if (s.refundFlash > 0) {
      g.lineStyle(2, PALETTE.white, s.refundFlash);
      g.strokeRect(x - 2, 16, bw + 4, 29);
    }
    this.setText(this.vitalsText, `SHIELD ${Math.floor(s.shield)}   HULL ${Math.ceil(Math.max(0, s.hp))}`);
    this.vitalsText.setPosition(x, 48);

    const by = 70;
    this.ability(x, by, s.dashReady, s.dashPing, s.dashDeny, PALETTE.structure);
    this.ability(x + 86, by, s.bladeReady, s.bladePing, s.bladeDeny, PALETTE.white);
    this.dashLabel.setPosition(x + 6, by + 5);
    this.bladeLabel.setPosition(x + 92, by + 5);
    const dashLeft = (1 - s.dashReady) * T.player.dashCooldown;
    const bladeLeft = (1 - s.bladeReady) * T.sword.cooldown;
    this.setText(this.dashTimer, dashLeft > 0.05 ? dashLeft.toFixed(1) : '');
    this.setText(this.bladeTimer, bladeLeft > 0.05 ? bladeLeft.toFixed(1) : '');
    this.dashTimer.setPosition(x + 76, by + 20);
    this.bladeTimer.setPosition(x + 162, by + 20);
  }

  /** A cooldown box: fills left to right as it recharges, rings white when it comes back. */
  private ability(x: number, y: number, ready: number, ping: number, deny: number, color: number): void {
    const g = this.bars;
    const w = 78;
    const h = 40;
    const isReady = ready >= 1;
    g.fillStyle(0x000000, 0.55);
    g.fillRect(x, y, w, h);
    g.fillStyle(color, isReady ? 0.22 : 0.3);
    g.fillRect(x + 1, y + 1, (w - 2) * clamp(ready, 0, 1), h - 2);
    if (deny > 0) {
      g.fillStyle(PALETTE.hostile, deny * 0.4);
      g.fillRect(x, y, w, h);
    }
    g.lineStyle(isReady ? 2 : 1, deny > 0 ? PALETTE.hostile : isReady ? color : PALETTE.textDim, 1);
    g.strokeRect(x, y, w, h);
    if (ping > 0) {
      g.fillStyle(PALETTE.white, ping * 0.3);
      g.fillRect(x, y, w, h);
      g.lineStyle(3, PALETTE.white, ping);
      g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    }
  }

  // ------------------------------------------------------------------
  // Status, help, loot feed, banner
  // ------------------------------------------------------------------

  private drawStatus(w: number): void {
    const s = runState;
    const wave = s.wave === 0 ? 'WAVE -' : `WAVE ${s.wave}`;
    const next = s.intermission > 0 ? `\nNEXT WAVE ${s.intermission.toFixed(1)}s` : '';
    this.setText(
      this.statusText,
      `${wave}   HOSTILES ${s.mobsAlive}${next}\n${Math.round(this.game.loop.actualFps)} FPS${s.muted ? '   MUTED' : ''}`,
    );
    this.statusText.setPosition(w - 18, 16);
    this.helpText.setVisible(s.showHelp).setPosition(w - 18, 74);
  }

  private drawFeedAndBanner(w: number, h: number): void {
    const s = runState;
    this.setText(
      this.carryText,
      `CARRIED ${s.carried.length}   STASH ${s.stash.length}   [X] extract (carried is lost on death)`,
    );
    this.carryText.setPosition(w / 2, h - 16);

    for (let i = 0; i < FEED_LINES; i++) {
      const t = this.feedTexts[i];
      const line = s.feed[s.feed.length - 1 - i];
      if (!line) {
        t.setVisible(false);
        continue;
      }
      const fade = 1 - clamp((line.age - (T.loot.feedSeconds - 1.2)) / 1.2, 0, 1);
      this.setText(t, line.text);
      t.setColor(hex(line.color)).setAlpha(fade).setVisible(true).setPosition(18, h - 48 - i * 19);
    }

    if (s.bannerTime > 0) {
      this.setText(this.banner, s.banner);
      this.banner
        .setColor(hex(s.banner.includes('LOST') ? PALETTE.hostile : PALETTE.structure))
        .setAlpha(clamp(s.bannerTime / 0.5, 0, 1))
        .setPosition(w / 2, h * 0.2)
        .setVisible(true);
    } else {
      this.banner.setVisible(false);
    }
    if (s.combo >= 2) {
      this.setText(this.comboText, `x${s.combo}`);
      this.comboText.setPosition(w / 2, h * 0.2 + 44).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  // ------------------------------------------------------------------
  // Weapon panel: a side-on carbine whose action works, rounds, reserve
  // ------------------------------------------------------------------

  private drawWeaponPanel(w: number, h: number, dt: number): void {
    const s = runState;
    const G = T.gun;
    const g = this.panel;
    g.clear();

    const x0 = w - PANEL_W - 18;
    const y0 = h - PANEL_H - 18;
    const gx = x0 + 14; // gun origin: stock end
    const gy = y0 + 70; // gun centre line

    // React to shots fired since last frame.
    if (s.shotSeq !== this.lastShotSeq) {
      const fired = s.shotSeq - this.lastShotSeq;
      this.lastShotSeq = s.shotSeq;
      if (fired > 0) {
        this.kick = 1;
        this.muzzle = 1;
        this.pipFlash = 1;
        this.spawnCasing(gx + 68, gy - 13);
      }
    }
    this.kick *= Math.exp(-24 * dt);
    this.muzzle = Math.max(0, this.muzzle - dt * 22);
    this.pipFlash = Math.max(0, this.pipFlash - dt * 5);

    // Panel backing.
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x0, y0, PANEL_W, PANEL_H);
    g.lineStyle(1, PALETTE.structureDim, 1);
    g.strokeRect(x0, y0, PANEL_W, PANEL_H);

    // Work out the action pose from the reload progress.
    const reloading = s.reload >= 0;
    const p = s.reload;
    const seat = G.magInAt;
    let magY = 0;
    let magA = 1;
    let bolt = this.kick * BOLT_TRAVEL;
    if (reloading) {
      if (p < 0.2) {
        const k = p / 0.2;
        magY = k * MAG_DROP;
        magA = 1 - k;
      } else if (p < seat) {
        magY = MAG_DROP;
        magA = 0;
      } else if (p < seat + 0.15) {
        const k = (p - seat) / 0.15;
        magY = MAG_DROP * (1 - k);
        magA = k;
      } else if (s.reloadEmpty) {
        // Charging handle: the bolt is hauled back, then released.
        const q = (p - (seat + 0.15)) / (1 - (seat + 0.15));
        bolt = Math.sin(clamp(q, 0, 1) * Math.PI) * BOLT_TRAVEL;
      }
    } else if (s.mag < 1) {
      bolt = BOLT_TRAVEL; // bolt locked back on an empty magazine
    }

    this.drawCarbine(gx, gy, bolt, magY, magA, s.mag, this.muzzle);
    this.drawCasings(dt);

    // Rounds remaining, as pips.
    const total = s.magSize;
    const loaded = this.pipsLoaded(p, s.mag, s.reserve, total, seat);
    const low = s.mag <= Math.ceil(total * 0.2);
    const px0 = x0 + 12;
    const py = y0 + PANEL_H - 22;
    const gap = 2;
    const pw = (PANEL_W - 24 - (total - 1) * gap) / total;
    for (let i = 0; i < total; i++) {
      const x = px0 + i * (pw + gap);
      if (i < loaded) {
        g.fillStyle(low && !reloading ? PALETTE.healthLow : PALETTE.ammo, 1);
        g.fillRect(x, py, pw, 12);
      } else if (i === s.mag && this.pipFlash > 0 && !reloading) {
        g.fillStyle(PALETTE.white, this.pipFlash);
        g.fillRect(x, py, pw, 12);
      } else {
        g.lineStyle(1, PALETTE.textDim, 0.7);
        g.strokeRect(x + 0.5, py + 0.5, pw - 1, 11);
      }
    }

    // Reload bar above the pips.
    if (reloading) {
      g.fillStyle(0x000000, 0.6);
      g.fillRect(x0 + 12, py - 10, PANEL_W - 24, 4);
      g.fillStyle(PALETTE.ammo, 1);
      g.fillRect(x0 + 12, py - 10, (PANEL_W - 24) * clamp(p, 0, 1), 4);
    }

    // Numbers and status.
    const noAmmo = s.mag < 1 && s.reserve < 1 && !reloading;
    let title = 'CARBINE';
    let titleColor: number = PALETTE.textDim;
    if (reloading) {
      title = s.reloadEmpty ? 'RELOADING  (BOLT)' : 'RELOADING';
      titleColor = PALETTE.ammo;
    } else if (noAmmo) {
      title = 'NO AMMO';
      titleColor = PALETTE.healthLow;
    } else if (low && s.reserve >= 1) {
      title = 'LOW  [R] RELOAD';
      titleColor = PALETTE.healthLow;
    }
    this.setText(this.panelTitle, title);
    this.panelTitle.setColor(hex(titleColor)).setPosition(x0 + 12, y0 + 8);

    this.setText(this.magCount, String(s.mag));
    this.magCount
      .setColor(hex(s.mag < 1 ? PALETTE.healthLow : low ? PALETTE.healthLow : reloading ? PALETTE.textDim : PALETTE.ammo))
      .setPosition(x0 + PANEL_W - 12, y0 + 6);
    this.setText(this.reserveText, `/ ${Math.floor(s.reserve)}`);
    this.reserveText.setPosition(x0 + PANEL_W - 12, y0 + 50);
  }

  /** How many pips read as loaded. While reloading they fill once the magazine has seated. */
  private pipsLoaded(p: number, mag: number, reserve: number, total: number, seat: number): number {
    if (p < 0) return mag;
    if (p < seat) return mag;
    const target = Math.min(total, mag + Math.floor(reserve));
    const k = clamp((p - seat) / 0.15, 0, 1);
    return Math.floor(mag + (target - mag) * k);
  }

  private drawCarbine(gx: number, gy: number, bolt: number, magY: number, magA: number, mag: number, muzzle: number): void {
    const g = this.panel;
    const line = PALETTE.structure;
    const body = 0x0d1c1e;
    const poly = (pts: number[][], fill: number, fa: number, stroke: number, lw: number): void => {
      const v = pts.map(([x, y]) => new Phaser.Math.Vector2(gx + x, gy + y));
      g.fillStyle(fill, fa);
      g.fillPoints(v, true);
      g.lineStyle(lw, stroke, fa < 1 ? 1 : 1);
      g.strokePoints(v, true);
    };
    const rect = (x: number, y: number, w: number, h: number, fill: number, fa: number, stroke: number, lw: number): void => {
      g.fillStyle(fill, fa);
      g.fillRect(gx + x, gy + y, w, h);
      g.lineStyle(lw, stroke, 1);
      g.strokeRect(gx + x, gy + y, w, h);
    };

    // Magazine goes first so the receiver draws over its top.
    if (magA > 0.01) {
      rect(64, 10 + magY, 17, 30, body, magA, line, 2);
      g.lineStyle(1, PALETTE.ammo, magA * 0.9);
      const rounds = clamp(Math.ceil((mag / T.gun.magSize) * 4), 0, 4);
      for (let i = 0; i < rounds; i++) g.lineBetween(gx + 68, gy + 15 + magY + i * 6, gx + 77, gy + 15 + magY + i * 6);
    }

    poly([[0, -6], [30, -10], [30, 10], [0, 14]], body, 1, line, 2); // stock
    poly([[46, 10], [60, 10], [56, 32], [42, 32]], body, 1, line, 2); // grip
    rect(30, -14, 68, 24, body, 1, line, 2); // receiver
    rect(98, -11, 40, 18, body, 1, line, 2); // handguard
    rect(138, -6, 24, 8, body, 1, line, 2); // barrel
    rect(162, -9, 8, 14, body, 1, line, 2); // muzzle brake
    rect(44, -24, 36, 8, body, 1, line, 1.5); // optic
    g.lineStyle(1.5, line, 1);
    g.lineBetween(gx + 50, gy - 16, gx + 50, gy - 14);
    g.lineBetween(gx + 74, gy - 16, gx + 74, gy - 14);

    // Ejection port, then the bolt sliding back over it.
    rect(60, -14, 18, 5, 0x000000, 1, PALETTE.structureDim, 1);
    rect(66 - bolt, -13, 24, 7, PALETTE.ammo, 0.9, PALETTE.white, 1.5);

    if (muzzle > 0.05) {
      const mx = gx + 172;
      const my = gy - 2;
      g.fillStyle(PALETTE.muzzle, muzzle * 0.9);
      g.fillCircle(mx + 5, my, 5 + muzzle * 5);
      g.lineStyle(2, PALETTE.white, muzzle);
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.34;
        g.lineBetween(mx, my, mx + Math.cos(a) * (14 + muzzle * 12), my + Math.sin(a) * (14 + muzzle * 12));
      }
    }
  }

  private spawnCasing(x: number, y: number): void {
    if (this.casings.length > 14) this.casings.shift();
    this.casings.push({
      x,
      y,
      vx: -70 + Math.random() * 100,
      vy: -(110 + Math.random() * 90),
      rot: Math.random() * Math.PI,
      vr: (Math.random() * 2 - 1) * 22,
      age: 0,
    });
  }

  private drawCasings(dt: number): void {
    const g = this.panel;
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.age += dt;
      if (c.age > 0.8) {
        this.casings.splice(i, 1);
        continue;
      }
      c.vy += 720 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      const a = 1 - c.age / 0.8;
      const cs = Math.cos(c.rot);
      const sn = Math.sin(c.rot);
      const hw = 4.5;
      const hh = 1.8;
      const pts = [
        [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
      ].map(([px, py]) => new Phaser.Math.Vector2(c.x + px * cs - py * sn, c.y + px * sn + py * cs));
      g.fillStyle(0xffd36b, a);
      g.fillPoints(pts, true);
    }
  }

  // ------------------------------------------------------------------
  // Crosshair, markers, and the ammo that follows the cursor
  // ------------------------------------------------------------------

  private drawCrosshair(): void {
    const s = runState;
    const g = this.cross;
    const p = this.input.activePointer;
    g.clear();
    const gap = 6 + s.aimSpread * 2.6;
    const len = 8;
    const reloading = s.reload >= 0;
    const col = s.dryFlash > 0 ? PALETTE.hostile : reloading ? PALETTE.ammo : PALETTE.player;
    g.lineStyle(2, col, 0.95);
    g.lineBetween(p.x - gap - len, p.y, p.x - gap, p.y);
    g.lineBetween(p.x + gap, p.y, p.x + gap + len, p.y);
    g.lineBetween(p.x, p.y - gap - len, p.x, p.y - gap);
    g.lineBetween(p.x, p.y + gap, p.x, p.y + gap + len);
    g.fillStyle(col, 0.9);
    g.fillCircle(p.x, p.y, 1.6);

    // Reload progress sweeps around the cursor, where your eyes already are.
    if (reloading) {
      const r = gap + len + 8;
      g.lineStyle(3, PALETTE.ammo, 0.95);
      g.beginPath();
      g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + clamp(s.reload, 0, 1) * Math.PI * 2, false);
      g.strokePath();
    }

    // Hit and kill markers.
    if (s.hitMarker > 0 || s.killMarker > 0.55) {
      const kill = s.killMarker > 0.55;
      const a = kill ? s.killMarker : s.hitMarker;
      const d = kill ? 16 : 11 + (1 - s.hitMarker) * 4;
      const c = kill ? PALETTE.hostile : PALETTE.white;
      g.lineStyle(kill ? 3 : 2, c, a);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.lineBetween(p.x + sx * d, p.y + sy * d, p.x + sx * (d * 0.5), p.y + sy * (d * 0.5));
      }
    }

    // Rounds left in the magazine, beside the cursor.
    const low = s.mag <= Math.ceil(s.magSize * 0.2);
    this.setText(this.cursorAmmo, reloading ? '' : String(s.mag));
    this.cursorAmmo
      .setColor(hex(low ? PALETTE.healthLow : PALETTE.ammo))
      .setPosition(p.x + gap + len + 6, p.y + gap + len - 4);
  }
}
