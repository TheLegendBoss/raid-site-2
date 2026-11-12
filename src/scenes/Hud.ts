// HUD on its own scene so the game camera's shake, zoom and scroll never move it.
// Static chrome (plates, brackets) is drawn once and again only on resize; the Graphics that change
// every frame hold just the fills, icons and the weapon animation.
import Phaser from 'phaser';
import { profile } from '../game/profile';
import { FONT, PALETTE, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { runState } from '../game/runState';
import { clamp } from '../sim/math';

const FEED_LINES = 7;
const BOLT_TRAVEL = 15; // px the bolt slides back
const MAG_DROP = 26; // px the magazine falls when released

// Layout. Panels hug the screen corners with a 16px margin.
const MARGIN = 16;
const VIT = { w: 268, h: 132 }; // vitals + abilities, top-left
const STA = { w: 214, h: 58 }; // wave status, top-right
const WEP = { w: 344, h: 152 }; // weapon, bottom-right
const SLOT = { w: 118, h: 38 };

interface Casing {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  age: number;
}

type Txt = Phaser.GameObjects.Text;

/** A rectangle with the corners cut at 45 degrees, to match the armour in the game. */
function chamfer(x: number, y: number, w: number, h: number, c: number): Phaser.Math.Vector2[] {
  return [
    [x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c],
    [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c],
  ].map(([px, py]) => new Phaser.Math.Vector2(px, py));
}


type Slab = [number, number, number, number, number]; // x, y, w, h, chamfer
interface GunSpec {
  stock?: Slab;
  body: Slab;
  parts: Slab[]; // handguard, barrel, brake and so on, drawn after the body
  vents?: { x: number; n: number; step: number };
  pump?: Slab; // slides back with the action
  scope?: { slab: Slab; lens: [number, number] };
  dot?: { x: number; y: number; color: number };
  slide?: boolean; // the whole top slide cycles (pistol)
  magX: number;
  muzzle: [number, number];
  port: [number, number, number]; // x, y, w of the ejection port and bolt
}

/** Side-on silhouettes for the non-SMG weapons, in the same coordinate space as drawSmg (stock end at 0). */
const GUN_SPECS: Record<string, GunSpec> = {
  pistol: {
    body: [40, -16, 66, 22, 5],
    parts: [[104, -10, 24, 16, 3], [128, -13, 8, 22, 2], [96, -26, 16, 9, 2]],
    magX: 54, muzzle: [140, -3], port: [64, -14, 20], slide: true,
  },
  magnum: {
    body: [34, -20, 56, 28, 6],
    parts: [[90, -16, 62, 16, 3], [152, -20, 8, 24, 2], [92, -2, 48, 11, 2], [30, -28, 14, 12, 2]],
    magX: 50, muzzle: [162, -8], port: [52, -17, 18], slide: false,
  },
  shotgun: {
    stock: [0, -12, 34, 22, 4],
    body: [34, -17, 60, 30, 6],
    parts: [[94, -14, 88, 10, 2], [94, 0, 74, 10, 2], [180, -19, 6, 8, 1]],
    pump: [112, -19, 36, 30, 4],
    magX: 56, muzzle: [190, -9], port: [58, -15, 22],
  },
  marksman: {
    stock: [0, -12, 32, 22, 4],
    body: [32, -16, 60, 28, 5],
    parts: [[92, -10, 82, 16, 3], [172, -14, 12, 24, 2]],
    scope: { slab: [44, -40, 66, 16, 6], lens: [108, -32] },
    magX: 50, muzzle: [190, -2], port: [58, -14, 22],
  },
  burst: {
    stock: [0, -9, 18, 15, 3],
    body: [18, -17, 78, 30, 6],
    parts: [[96, -14, 48, 24, 4], [144, -9, 18, 8, 1.5], [160, -15, 14, 20, 2]],
    vents: { x: 104, n: 5, step: 7 },
    dot: { x: 56, y: -23.5, color: 0x6dff8a },
    magX: 46, muzzle: [178, -5], port: [66, -15, 22],
  },
};

export class Hud extends Phaser.Scene {
  private vignette!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Image;
  private chrome!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private cross!: Phaser.GameObjects.Graphics;
  private shieldLabel!: Txt;
  private hullLabel!: Txt;
  private shieldNum!: Txt;
  private hullNum!: Txt;
  private waveText!: Txt;
  private hostText!: Txt;
  private subText!: Txt;
  private fpsText!: Txt;
  private helpText!: Txt;
  private carryText!: Txt;
  private extractText!: Txt;
  private banner!: Txt;
  private comboText!: Txt;
  private dashName!: Txt;
  private bladeName!: Txt;
  private dashKey!: Txt;
  private bladeKey!: Txt;
  private dashTimer!: Txt;
  private bladeTimer!: Txt;
  private weaponName!: Txt;
  private weaponState!: Txt;
  private magCount!: Txt;
  private reserveText!: Txt;
  private cursorAmmo!: Txt;
  private feedTexts: Txt[] = [];
  private textCache = new Map<Txt, string>();
  private pointerSeen = false;

  private chromeW = 0;
  private chromeH = 0;
  private clock = 0;

  // Damage ghost: the bar's old value lingers, then drains.
  private ghostSh = 1;
  private ghostHp = 1;
  private holdSh = 0;
  private holdHp = 0;

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

    this.chrome = this.add.graphics().setDepth(4);
    this.bars = this.add.graphics().setDepth(5);
    this.panel = this.add.graphics().setDepth(5);
    this.cross = this.add.graphics().setDepth(9);

    const mk = (size: number, color: number, ox = 0, oy = 0, bold = false): Txt =>
      this.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: `${size}px`,
          color: hex(color),
          fontStyle: bold ? 'bold' : 'normal',
        })
        .setOrigin(ox, oy)
        .setDepth(6);

    this.shieldLabel = mk(10, PALETTE.textDim);
    this.hullLabel = mk(10, PALETTE.textDim);
    this.shieldNum = mk(15, PALETTE.shield, 1, 0, true);
    this.hullNum = mk(15, PALETTE.health, 1, 0, true);
    this.waveText = mk(20, PALETTE.structure, 0, 0, true);
    this.hostText = mk(12, PALETTE.text, 1, 0);
    this.subText = mk(11, PALETTE.textDim);
    this.fpsText = mk(11, PALETTE.textDim, 1, 0);
    this.helpText = mk(11, PALETTE.textDim, 1, 0).setAlign('right');
    this.carryText = mk(13, PALETTE.text, 0.5, 1);
    this.extractText = mk(18, PALETTE.structure, 0.5, 1).setDepth(8);
    this.banner = mk(42, PALETTE.structure, 0.5, 0.5, true).setDepth(8);
    this.banner.setShadow(0, 0, hex(PALETTE.structure), 14, false, true);
    this.comboText = mk(22, PALETTE.ammo, 0.5, 0.5, true).setDepth(8);
    this.dashName = mk(12, PALETTE.text, 0, 0, true);
    this.bladeName = mk(12, PALETTE.text, 0, 0, true);
    this.dashKey = mk(9, PALETTE.textDim);
    this.bladeKey = mk(9, PALETTE.textDim);
    this.dashTimer = mk(15, PALETTE.white, 1, 0.5, true).setDepth(7);
    this.bladeTimer = mk(15, PALETTE.white, 1, 0.5, true).setDepth(7);
    this.weaponName = mk(13, PALETTE.ammo, 0, 0, true);
    this.weaponState = mk(11, PALETTE.textDim);
    this.magCount = mk(42, PALETTE.ammo, 1, 0, true);
    this.magCount.setShadow(0, 0, hex(PALETTE.ammo), 10, false, true);
    this.reserveText = mk(12, PALETTE.textDim, 1, 0);
    this.cursorAmmo = mk(13, PALETTE.ammo, 0, 0, true);
    for (let i = 0; i < FEED_LINES; i++) {
      this.feedTexts.push(mk(13, PALETTE.text, 0, 1));
    }

    this.setText(this.shieldLabel, 'SHIELD');
    this.setText(this.hullLabel, 'HULL');
    this.setText(this.dashName, 'DASH');
    this.setText(this.bladeName, 'BLADE');
    this.setText(this.dashKey, 'SHIFT');
    this.setText(this.bladeKey, 'RMB');
    this.setText(
      this.helpText,
      [
        'WASD move   SHIFT / SPACE dash',
        'LMB fire   R reload (R again: white = perfect, grey = active)',
        'RMB / F arc blade',
        'blade kills refund reserve ammo + shield',
        ...(runState.devMode
          ? ['1 swarm   2 robot   K clear   T reset room', 'X extract   B base   TAB trees   ESC pause   M mute   H hide help']
          : ['X extract and leave   ESC pause   M mute   H hide help']),
      ].join('\n'),
    );
  }

  private setText(t: Txt, s: string): void {
    if (this.textCache.get(t) === s) return;
    this.textCache.set(t, s);
    t.setText(s);
  }

  // ------------------------------------------------------------------
  // Frame
  // ------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.clock += dt;
    const s = runState;
    const w = this.scale.width;
    const h = this.scale.height;

    this.vignette.setPosition(w / 2, h / 2).setDisplaySize(w * 1.5, h * 1.5);
    this.hurt.setPosition(w / 2, h / 2).setDisplaySize(w * 1.25, h * 1.25).setAlpha(s.damageFlash * 0.85);

    if (w !== this.chromeW || h !== this.chromeH) {
      this.chromeW = w;
      this.chromeH = h;
      this.drawChrome(w, h);
    }

    this.bars.clear();
    this.drawVitals(dt);
    this.drawStatus(w);
    this.drawFeedAndBanner(w, h);
    this.drawWeaponPanel(w, h, dt);
    this.drawCrosshair();
  }

  /** A dark plate with a chamfered outline, a faint top sheen and bright corner brackets. */
  private plate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, c: number, accent: number): void {
    const v = chamfer(x, y, w, h, c);
    g.fillStyle(0x02080a, 0.74);
    g.fillPoints(v, true);
    g.fillStyle(0xffffff, 0.035);
    g.fillRect(x + c, y + 1, w - 2 * c, 9);
    g.lineStyle(1, PALETTE.structureDim, 1);
    g.strokePoints(v, true);
    g.lineStyle(2, accent, 0.95);
    g.lineBetween(x + c, y, x + c + 24, y);
    g.lineBetween(x, y + c, x, y + c + 14);
    g.lineBetween(x + w - c, y + h, x + w - c - 24, y + h);
    g.lineBetween(x + w, y + h - c, x + w, y + h - c - 14);
  }

  /** Static chrome, drawn once per size. */
  private drawChrome(w: number, h: number): void {
    const g = this.chrome;
    g.clear();
    this.plate(g, MARGIN, MARGIN, VIT.w, VIT.h, 7, PALETTE.structure);
    g.lineStyle(1, PALETTE.structureDim, 0.8);
    g.lineBetween(MARGIN + 14, MARGIN + 74, MARGIN + VIT.w - 14, MARGIN + 74);

    this.plate(g, w - MARGIN - STA.w, MARGIN, STA.w, STA.h, 7, PALETTE.structure);

    const wx = w - MARGIN - WEP.w;
    const wy = h - MARGIN - WEP.h;
    this.plate(g, wx, wy, WEP.w, WEP.h, 9, PALETTE.ammo);
    g.lineStyle(1, PALETTE.structureDim, 0.8);
    g.lineBetween(wx + 14, wy + 28, wx + WEP.w - 14, wy + 28);
  }

  // ------------------------------------------------------------------
  // Top-left: vitals and ability cooldowns
  // ------------------------------------------------------------------

  /** A bar of cells. The ghost shows where the value was a moment ago. */
  private segBar(x: number, y: number, w: number, h: number, n: number, frac: number, ghost: number, color: number, alpha = 1): void {
    const g = this.bars;
    const gap = 2;
    const sw = (w - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * (sw + gap);
      g.fillStyle(0x0b1a18, 0.95);
      g.fillRect(sx, y, sw, h);
      const gf = clamp(ghost * n - i, 0, 1);
      if (gf > 0) {
        g.fillStyle(PALETTE.white, 0.55);
        g.fillRect(sx, y, sw * gf, h);
      }
      const f = clamp(frac * n - i, 0, 1);
      if (f > 0) {
        g.fillStyle(color, alpha);
        g.fillRect(sx, y, sw * f, h);
        g.fillStyle(PALETTE.white, 0.2 * alpha);
        g.fillRect(sx, y, sw * f, 2);
      }
    }
  }

  private drawVitals(dt: number): void {
    const s = runState;
    const g = this.bars;
    const x = MARGIN + 14;
    const y = MARGIN;
    const bw = VIT.w - 28;

    const shF = clamp(s.shield / s.maxShield, 0, 1);
    const hpF = clamp(s.hp / s.maxHp, 0, 1);
    if (shF >= this.ghostSh) {
      this.ghostSh = shF;
      this.holdSh = 0.45;
    } else {
      this.holdSh -= dt;
      if (this.holdSh <= 0) this.ghostSh = Math.max(shF, this.ghostSh - dt * 0.8);
    }
    if (hpF >= this.ghostHp) {
      this.ghostHp = hpF;
      this.holdHp = 0.45;
    } else {
      this.holdHp -= dt;
      if (this.holdHp <= 0) this.ghostHp = Math.max(hpF, this.ghostHp - dt * 0.8);
    }

    const lowHull = hpF < 0.3;
    const pulse = lowHull ? 0.7 + 0.3 * Math.sin(this.clock * 9) : 1;
    this.shieldLabel.setPosition(x, y + 11);
    this.hullLabel.setPosition(x, y + 43);
    this.setText(this.shieldNum, String(Math.floor(s.shield)));
    this.setText(this.hullNum, String(Math.ceil(Math.max(0, s.hp))));
    this.shieldNum.setPosition(x + bw, y + 8);
    this.hullNum.setColor(hex(lowHull ? PALETTE.healthLow : PALETTE.health)).setPosition(x + bw, y + 40);
    this.segBar(x, y + 26, bw, 9, 20, shF, this.ghostSh, PALETTE.shield);
    this.segBar(x, y + 58, bw, 9, 20, hpF, this.ghostHp, lowHull ? PALETTE.healthLow : PALETTE.health, pulse);

    if (s.refundFlash > 0) {
      g.lineStyle(2, PALETTE.white, s.refundFlash);
      g.strokePoints(chamfer(MARGIN - 2, MARGIN - 2, VIT.w + 4, VIT.h + 4, 8), true);
    }

    const sy = y + 82;
    this.slot(x, sy, s.dashReady, s.dashPing, s.dashDeny, PALETTE.structure, 'dash');
    this.slot(x + SLOT.w + 8, sy, s.bladeReady, s.bladePing, s.bladeDeny, PALETTE.white, 'blade');
    const dashLeft = (1 - s.dashReady) * T.player.dashCooldown;
    const bladeLeft = (1 - s.bladeReady) * T.sword.cooldown;
    this.dashName.setPosition(x + 38, sy + 6);
    this.dashKey.setPosition(x + 38, sy + 23);
    this.bladeName.setPosition(x + SLOT.w + 8 + 38, sy + 6);
    this.bladeKey.setPosition(x + SLOT.w + 8 + 38, sy + 23);
    this.setText(this.dashTimer, dashLeft > 0.05 ? dashLeft.toFixed(1) : '');
    this.setText(this.bladeTimer, bladeLeft > 0.05 ? bladeLeft.toFixed(1) : '');
    this.dashTimer.setPosition(x + SLOT.w - 8, sy + SLOT.h / 2 + 8);
    this.bladeTimer.setPosition(x + 2 * SLOT.w + 8 - 8, sy + SLOT.h / 2 + 8);
  }

  /** A cooldown slot: fills left to right as it recharges, rings white when it comes back. */
  private slot(x: number, y: number, ready: number, ping: number, deny: number, color: number, icon: 'dash' | 'blade'): void {
    const g = this.bars;
    const { w, h } = SLOT;
    const isReady = ready >= 1;
    const v = chamfer(x, y, w, h, 6);
    g.fillStyle(0x010607, 0.85);
    g.fillPoints(v, true);
    g.fillStyle(color, isReady ? 0.18 : 0.3);
    g.fillRect(x + 1, y + 6, (w - 2) * clamp(ready, 0, 1), h - 12);
    if (deny > 0) {
      g.fillStyle(PALETTE.hostile, deny * 0.45);
      g.fillPoints(v, true);
    }
    g.lineStyle(isReady ? 2 : 1, deny > 0 ? PALETTE.hostile : isReady ? color : PALETTE.textDim, 1);
    g.strokePoints(v, true);

    // Icon.
    const ic = isReady ? color : PALETTE.textDim;
    const ix = x + 9;
    const iy = y + 9;
    g.lineStyle(2.4, ic, 1);
    if (icon === 'dash') {
      for (let i = 0; i < 3; i++) {
        const cx = ix + i * 7;
        g.lineBetween(cx, iy, cx + 6, iy + 10);
        g.lineBetween(cx + 6, iy + 10, cx, iy + 20);
      }
    } else {
      g.lineStyle(3, ic, 1);
      g.lineBetween(ix + 2, iy + 20, ix + 22, iy);
      g.lineStyle(2, ic, 1);
      g.lineBetween(ix + 5, iy + 11, ix + 11, iy + 17);
      g.lineStyle(1, ic, 0.6);
      g.beginPath();
      g.arc(ix + 2, iy + 20, 14, -Math.PI * 0.42, -Math.PI * 0.05, false);
      g.strokePath();
    }

    if (ping > 0) {
      g.fillStyle(PALETTE.white, ping * 0.3);
      g.fillPoints(v, true);
      g.lineStyle(3, PALETTE.white, ping);
      g.strokePoints(chamfer(x - 3, y - 3, w + 6, h + 6, 8), true);
    }
  }

  // ------------------------------------------------------------------
  // Status, help, loot feed, banner
  // ------------------------------------------------------------------

  private drawStatus(w: number): void {
    const s = runState;
    const x = w - MARGIN - STA.w;
    this.setText(this.waveText, s.wave === 0 ? 'WAVE -' : `WAVE ${s.wave}`);
    this.waveText.setPosition(x + 14, MARGIN + 7);
    this.setText(this.hostText, `${s.mobsAlive} HOSTILE${s.mobsAlive === 1 ? '' : 'S'}`);
    this.hostText.setColor(hex(s.mobsAlive > 0 ? PALETTE.hostile : PALETTE.textDim)).setPosition(x + STA.w - 14, MARGIN + 12);
    this.setText(this.subText, s.intermission > 0 ? `NEXT WAVE ${s.intermission.toFixed(1)}s` : s.mobsAlive > 0 ? 'ENGAGED' : 'CLEAR');
    this.subText.setPosition(x + 14, MARGIN + 36);
    this.setText(this.fpsText, `${Math.round(this.game.loop.actualFps)} FPS${s.muted ? '  MUTED' : ''}`);
    this.fpsText.setPosition(x + STA.w - 14, MARGIN + 36);
    this.helpText.setVisible(s.showHelp).setPosition(w - MARGIN, MARGIN + STA.h + 10);
  }

  /** The pad prompt, above the status line, only while standing on a pad. */
  private drawExtractPrompt(w: number, h: number): void {
    const s = runState;
    const g = this.bars;
    if (!s.extractPrompt) {
      this.extractText.setVisible(false);
      return;
    }
    const col = s.extractOpen ? PALETTE.structure : PALETTE.hostile;
    this.setText(this.extractText, s.extractPrompt);
    this.extractText.setColor(hex(col)).setVisible(true).setPosition(w / 2, h - MARGIN - 44);
    this.extractText.setShadow(0, 0, hex(col), 12, false, true);
    const pw = this.extractText.width + 40;
    const ph = this.extractText.height + 12;
    g.fillStyle(0x02080a, 0.75);
    g.fillPoints(chamfer(w / 2 - pw / 2, h - MARGIN - 44 - ph + 6, pw, ph, 6), true);
    g.lineStyle(1.5, col, 0.9);
    g.strokePoints(chamfer(w / 2 - pw / 2, h - MARGIN - 44 - ph + 6, pw, ph, 6), true);
  }

  private drawFeedAndBanner(w: number, h: number): void {
    const s = runState;
    const g = this.bars;
    this.setText(
      this.carryText,
      `CARRIED ${s.carried.length}/${profile.stats.carrySlots}${s.carriedScrap > 0 ? `  +${s.carriedScrap} scrap` : ''}   SCRAP ${profile.scrap}   INTEL ${profile.intel}   X extract at a pad${runState.devMode ? '   [B] base   [TAB] trees' : '   [ESC] pause'}`,
    );
    this.drawExtractPrompt(w, h);
    this.carryText.setPosition(w / 2, h - MARGIN);
    const cw = this.carryText.width + 28;
    const ch = this.carryText.height + 8;
    g.fillStyle(0x02080a, 0.6);
    g.fillPoints(chamfer(w / 2 - cw / 2, h - MARGIN - ch + 4, cw, ch, 5), true);
    g.lineStyle(1, PALETTE.structureDim, 1);
    g.strokePoints(chamfer(w / 2 - cw / 2, h - MARGIN - ch + 4, cw, ch, 5), true);

    for (let i = 0; i < FEED_LINES; i++) {
      const t = this.feedTexts[i];
      const line = s.feed[s.feed.length - 1 - i];
      if (!line) {
        t.setVisible(false);
        continue;
      }
      const fade = 1 - clamp((line.age - (T.loot.feedSeconds - 1.2)) / 1.2, 0, 1);
      this.setText(t, line.text);
      const ty = h - 56 - i * 24;
      t.setColor(hex(line.color)).setAlpha(fade).setVisible(true).setPosition(MARGIN + 14, ty);
      // Plate with a rarity-coloured tick.
      g.fillStyle(0x02080a, 0.6 * fade);
      g.fillRect(MARGIN, ty - 19, t.width + 28, 22);
      g.fillStyle(line.color, 0.95 * fade);
      g.fillRect(MARGIN, ty - 19, 3, 22);
    }

    if (s.bannerTime > 0) {
      const lost = s.banner.includes('LOST');
      const col = lost ? PALETTE.hostile : PALETTE.structure;
      this.setText(this.banner, s.banner);
      const a = clamp(s.bannerTime / 0.5, 0, 1);
      const by = h * 0.2;
      this.banner
        .setColor(hex(col))
        .setAlpha(a)
        .setPosition(w / 2, by)
        .setVisible(true);
      this.banner.setShadow(0, 0, hex(col), 14, false, true);
      const half = this.banner.width / 2;
      g.lineStyle(2, col, a * 0.85);
      g.lineBetween(w / 2 - half - 110, by, w / 2 - half - 20, by);
      g.lineBetween(w / 2 + half + 20, by, w / 2 + half + 110, by);
      g.lineStyle(1, col, a * 0.5);
      g.lineBetween(w / 2 - half - 90, by + 8, w / 2 - half - 20, by + 8);
      g.lineBetween(w / 2 + half + 20, by + 8, w / 2 + half + 90, by + 8);
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
  // Weapon panel: a side-on SMG whose action works, rounds, reserve
  // ------------------------------------------------------------------

  private drawWeaponPanel(w: number, h: number, dt: number): void {
    const s = runState;
    const G = T.gun;
    const g = this.panel;
    g.clear();

    const x0 = w - MARGIN - WEP.w;
    const y0 = h - MARGIN - WEP.h;
    const gx = x0 + 18; // gun origin: stock end
    const gy = y0 + 62; // gun centre line

    // React to shots fired since last frame.
    if (s.shotSeq !== this.lastShotSeq) {
      const fired = s.shotSeq - this.lastShotSeq;
      this.lastShotSeq = s.shotSeq;
      if (fired > 0) {
        this.kick = 1;
        this.muzzle = 1;
        this.pipFlash = 1;
        this.spawnCasing(gx + 84, gy - 12);
      }
    }
    this.kick *= Math.exp(-24 * dt);
    this.muzzle = Math.max(0, this.muzzle - dt * 22);
    this.pipFlash = Math.max(0, this.pipFlash - dt * 5);

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

    this.setText(this.weaponName, s.weaponName.toUpperCase());
    this.drawGun(s.weaponShape, gx, gy, bolt, magY, magA, s.mag, this.muzzle);
    this.drawCasings(dt);

    // Rounds remaining, as cells.
    const total = s.magSize;
    const loaded = this.pipsLoaded(p, s.mag, s.reserve, total, seat);
    const low = s.mag <= Math.ceil(total * 0.2);
    const px0 = x0 + 14;
    const py = y0 + WEP.h - 26;
    const gap = 2;
    const pw = (WEP.w - 28 - (total - 1) * gap) / total;
    for (let i = 0; i < total; i++) {
      const x = px0 + i * (pw + gap);
      if (i < loaded) {
        const c = low && !reloading ? PALETTE.healthLow : PALETTE.ammo;
        g.fillStyle(c, 1);
        g.fillRect(x, py, pw, 12);
        g.fillStyle(PALETTE.white, 0.28);
        g.fillRect(x, py, pw, 3);
      } else if (i === s.mag && this.pipFlash > 0 && !reloading) {
        g.fillStyle(PALETTE.white, this.pipFlash);
        g.fillRect(x, py, pw, 12);
      } else {
        g.fillStyle(0x0b1a18, 0.9);
        g.fillRect(x, py, pw, 12);
        g.lineStyle(1, PALETTE.textDim, 0.45);
        g.strokeRect(x + 0.5, py + 0.5, pw - 1, 11);
      }
    }

    this.drawActiveReloadBar(x0, y0 - 30, WEP.w, reloading, p);

    // Numbers and status.
    const noAmmo = s.mag < 1 && s.reserve < 1 && !reloading;
    let state = '';
    let stateColor: number = PALETTE.textDim;
    if (s.activeFlash > 0.35 && s.activeResult === 'perfect') {
      state = `PERFECT  +${Math.round(T.gun.activeReload.bonusDamage * 100)}% DMG`;
      stateColor = PALETTE.white;
    } else if (s.activeFlash > 0.35 && s.activeResult === 'good') {
      state = 'ACTIVE RELOAD';
      stateColor = PALETTE.player;
    } else if (s.activeFlash > 0.35 && s.activeResult === 'fumble') {
      state = 'JAMMED';
      stateColor = PALETTE.healthLow;
    } else if (reloading) {
      state = s.reloadEmpty ? 'RELOADING  (BOLT)' : 'RELOADING';
      stateColor = PALETTE.ammo;
    } else if (s.hotMag) {
      state = 'HOT MAG';
      stateColor = PALETTE.player;
    } else if (noAmmo) {
      state = 'NO AMMO';
      stateColor = PALETTE.healthLow;
    } else if (low && s.reserve >= 1) {
      state = 'LOW  [R] RELOAD';
      stateColor = PALETTE.healthLow;
    }
    this.weaponName.setPosition(x0 + 14, y0 + 8);
    this.setText(this.weaponState, state);
    this.weaponState.setColor(hex(stateColor)).setPosition(x0 + 14 + this.weaponName.width + 12, y0 + 10);

    const magCol = s.mag < 1 || low ? PALETTE.healthLow : reloading ? PALETTE.textDim : PALETTE.ammo;
    this.setText(this.magCount, String(s.mag));
    this.magCount.setColor(hex(magCol)).setPosition(x0 + WEP.w - 14, y0 + 34);
    this.magCount.setShadow(0, 0, hex(magCol), reloading ? 0 : 10, false, true);
    this.setText(this.reserveText, `RESERVE ${Math.floor(s.reserve)}`);
    this.reserveText.setPosition(x0 + WEP.w - 14, y0 + 84);
  }

  /**
   * The Gears-style active reload bar, floating above the weapon panel. A dark track with a wide
   * grey ACTIVE zone and the small white PERFECT zone inside it; a white tick sweeps left to right.
   * Perfect flashes the whole bar white, active flashes it grey, a miss turns it red with the tick
   * locked where the press landed. It only shows while reloading and for a moment after the result.
   */
  private drawActiveReloadBar(x: number, y: number, w: number, reloading: boolean, p: number): void {
    const s = runState;
    const g = this.panel;
    const result = s.activeResult;
    const after = !reloading && s.activeFlash > 0 && result !== '';
    if (!reloading && !after) return;
    const bx = x + 14;
    const bw = w - 28;
    const bh = 14;
    const fade = reloading ? 1 : clamp(s.activeFlash / 0.35, 0, 1);
    const jam = result === 'fumble';

    // Track.
    g.fillStyle(0x000000, 0.75 * fade);
    g.fillRect(bx - 3, y - 3, bw + 6, bh + 6);
    g.fillStyle(jam ? 0x3a0d0d : 0x15201f, 1 * fade);
    g.fillRect(bx, y, bw, bh);

    // Zones (hidden after a miss, like the action jamming shut).
    if (!jam && s.reloadGood1 > s.reloadGood0) {
      const gx0 = bx + bw * clamp(s.reloadGood0, 0, 1);
      const gx1 = bx + bw * clamp(s.reloadGood1, 0, 1);
      g.fillStyle(0x9fb0ac, 0.55 * fade);
      g.fillRect(gx0, y, gx1 - gx0, bh);
      const px0 = bx + bw * clamp(s.reloadWin0, 0, 1);
      const px1 = bx + bw * clamp(s.reloadWin1, 0, 1);
      g.fillStyle(0xffffff, 0.95 * fade);
      g.fillRect(px0, y, px1 - px0, bh);
    }

    // Fill behind the tick, so the sweep reads at a glance.
    const prog = reloading ? clamp(p, 0, 1) : clamp(s.reloadMark, 0, 1);
    if (reloading && !jam) {
      g.fillStyle(PALETTE.ammo, 0.35);
      g.fillRect(bx, y + bh - 3, bw * prog, 3);
    }

    // Result flash over the whole bar.
    if (s.activeFlash > 0 && result) {
      const col = result === 'perfect' ? 0xffffff : result === 'good' ? 0xcfe3dd : PALETTE.healthLow;
      g.fillStyle(col, (result === 'fumble' ? 0.55 : 0.85) * s.activeFlash * fade);
      g.fillRect(bx, y, bw, bh);
    }

    g.lineStyle(1.5, jam ? PALETTE.healthLow : PALETTE.ammo, 0.9 * fade);
    g.strokeRect(bx, y, bw, bh);

    // The tick: sweeps while reloading, locks where the press landed on a miss.
    const tx = bx + bw * (jam ? clamp(s.reloadMark, 0, 1) : prog);
    g.fillStyle(0x000000, 0.8 * fade);
    g.fillRect(tx - 2.5, y - 6, 5, bh + 12);
    g.fillStyle(jam ? PALETTE.healthLow : 0xffffff, fade);
    g.fillRect(tx - 1.5, y - 6, 3, bh + 12);
  }

  /** How many cells read as loaded. While reloading they fill once the magazine has seated. */
  private pipsLoaded(p: number, mag: number, reserve: number, total: number, seat: number): number {
    if (p < 0) return mag;
    if (p < seat) return mag;
    const target = Math.min(total, mag + Math.floor(reserve));
    const k = clamp((p - seat) / 0.15, 0, 1);
    return Math.floor(mag + (target - mag) * k);
  }

  /** Draw the equipped weapon: the detailed SMG, or a spec-driven silhouette for the others. */
  private drawGun(shape: string, gx: number, gy: number, bolt: number, magY: number, magA: number, mag: number, muzzle: number): void {
    const spec = GUN_SPECS[shape];
    if (!spec) {
      this.drawSmg(gx, gy, bolt, magY, magA, mag, muzzle);
      return;
    }
    const g = this.panel;
    const line = PALETTE.structure;
    const body = 0x0b1a1c;
    const poly = (pts: Phaser.Math.Vector2[], fill: number, fa: number, stroke: number, lw: number): void => {
      g.fillStyle(fill, fa);
      g.fillPoints(pts, true);
      g.lineStyle(lw, stroke, 1);
      g.strokePoints(pts, true);
    };
    const slab = (s: Slab, dx = 0, fill: number = body, fa = 1, stroke: number = line, lw = 2): void =>
      poly(chamfer(gx + s[0] + dx, gy + s[1], s[2], s[3], s[4]), fill, fa, stroke, lw);

    // Grip sleeve and the magazine inside it.
    const mx = spec.magX;
    poly(
      [[mx - 2, 10], [mx + 20, 10], [mx + 16, 38], [mx - 6, 38]].map(([px, py]) => new Phaser.Math.Vector2(gx + px, gy + py)),
      0x050d0e, 1, PALETTE.structureDim, 1.5,
    );
    if (magA > 0.01) {
      slab([mx, 8 + magY, 16, 34, 3], 0, body, magA);
      g.lineStyle(1, PALETTE.ammo, magA * 0.9);
      const rounds = clamp(Math.ceil((mag / runState.magSize) * 5), 0, 5);
      for (let i = 0; i < rounds; i++) g.lineBetween(gx + mx + 4, gy + 15 + magY + i * 5, gx + mx + 12, gy + 15 + magY + i * 5);
    }

    if (spec.stock) slab(spec.stock);
    slab(spec.body, spec.slide ? -bolt * 0.6 : 0);
    for (const p of spec.parts) slab(p);
    if (spec.vents) {
      g.lineStyle(1.5, PALETTE.structureDim, 1);
      for (let i = 0; i < spec.vents.n; i++) {
        g.lineBetween(gx + spec.vents.x + i * spec.vents.step, gy - 9, gx + spec.vents.x + i * spec.vents.step, gy + 5);
      }
    }
    if (spec.scope) {
      slab(spec.scope.slab, 0, 0x0d1c1e, 1, line, 1.8);
      g.fillStyle(PALETTE.shield, 1);
      g.fillCircle(gx + spec.scope.lens[0], gy + spec.scope.lens[1], 3);
      g.fillStyle(PALETTE.shield, 0.25);
      g.fillCircle(gx + spec.scope.lens[0], gy + spec.scope.lens[1], 7);
    }
    if (spec.dot) {
      slab([spec.dot.x - 6, spec.dot.y - 6, 26, 11, 2], 0, 0x0d1c1e, 1, line, 1.8);
      g.fillStyle(spec.dot.color, 1);
      g.fillCircle(gx + spec.dot.x, gy + spec.dot.y, 2.2);
      g.fillStyle(spec.dot.color, 0.25);
      g.fillCircle(gx + spec.dot.x, gy + spec.dot.y, 5);
    }
    if (spec.pump) slab(spec.pump, -bolt * 1.6, 0x0d1c1e, 1, line, 2);

    // Ejection port and the bolt sliding back over it.
    const [px, py, pw] = spec.port;
    slab([px, py, pw, 6, 1.5], 0, 0x000000, 1, PALETTE.structureDim, 1);
    if (!spec.pump && !spec.slide) slab([px - bolt, py, pw, 7, 1.5], 0, PALETTE.ammo, 0.92, PALETTE.white, 1.4);

    if (muzzle > 0.05) {
      const fx = gx + spec.muzzle[0];
      const fy = gy + spec.muzzle[1];
      g.fillStyle(PALETTE.muzzle, muzzle * 0.9);
      g.fillCircle(fx + 5, fy, 5 + muzzle * 5);
      g.lineStyle(2, PALETTE.white, muzzle);
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.34;
        g.lineBetween(fx, fy, fx + Math.cos(a) * (14 + muzzle * 12), fy + Math.sin(a) * (14 + muzzle * 12));
      }
    }
  }

  /** The SMG in profile, facing right. Matches the in-game model: folded stock, red dot, vented shroud. */
  private drawSmg(gx: number, gy: number, bolt: number, magY: number, magA: number, mag: number, muzzle: number): void {
    const g = this.panel;
    const line = PALETTE.structure;
    const body = 0x0b1a1c;
    const poly = (pts: Phaser.Math.Vector2[], fill: number, fa: number, stroke: number, lw: number): void => {
      g.fillStyle(fill, fa);
      g.fillPoints(pts, true);
      g.lineStyle(lw, stroke, 1);
      g.strokePoints(pts, true);
    };
    const slab = (x: number, y: number, w: number, h: number, c: number, fill: number = body, fa = 1, stroke: number = line, lw = 2): void =>
      poly(chamfer(gx + x, gy + y, w, h, c), fill, fa, stroke, lw);

    // Grip sleeve, then the magazine inside it, so the receiver covers its top.
    poly(
      [[44, 10], [66, 10], [62, 38], [40, 38]].map(([px, py]) => new Phaser.Math.Vector2(gx + px, gy + py)),
      0x050d0e, 1, PALETTE.structureDim, 1.5,
    );
    if (magA > 0.01) {
      slab(46, 8 + magY, 16, 34, 3, body, magA, line, 2);
      g.lineStyle(1, PALETTE.ammo, magA * 0.9);
      const rounds = clamp(Math.ceil((mag / runState.magSize) * 5), 0, 5);
      for (let i = 0; i < rounds; i++) g.lineBetween(gx + 50, gy + 15 + magY + i * 5, gx + 58, gy + 15 + magY + i * 5);
    }

    slab(0, -9, 22, 15, 3); // folded stock
    g.lineStyle(1.5, PALETTE.structureDim, 1);
    g.lineBetween(gx + 4, gy - 2, gx + 18, gy - 2);
    slab(18, -17, 78, 30, 6); // receiver
    g.lineStyle(1, line, 0.35);
    g.lineBetween(gx + 24, gy - 13, gx + 90, gy - 13);
    slab(96, -14, 44, 24, 4); // shroud
    g.lineStyle(1.5, PALETTE.structureDim, 1);
    for (let i = 0; i < 5; i++) g.lineBetween(gx + 104 + i * 7, gy - 9, gx + 104 + i * 7, gy + 5);
    poly(chamfer(gx + 140, gy - 9, 20, 8, 1.5), body, 1, line, 2); // barrel
    slab(160, -12, 12, 14, 2); // muzzle brake

    // Red dot sight on the rail.
    slab(50, -29, 26, 11, 2, 0x0d1c1e, 1, line, 1.8);
    g.fillStyle(PALETTE.hostile, 1);
    g.fillCircle(gx + 56, gy - 23.5, 2.2);
    g.fillStyle(PALETTE.hostile, 0.25);
    g.fillCircle(gx + 56, gy - 23.5, 5);

    // Trigger guard.
    g.lineStyle(1.5, line, 0.9);
    g.beginPath();
    g.moveTo(gx + 70, gy + 13);
    g.lineTo(gx + 72, gy + 22);
    g.lineTo(gx + 62, gy + 22);
    g.strokePath();

    // Ejection port, then the bolt sliding back over it.
    slab(66, -15, 22, 6, 1.5, 0x000000, 1, PALETTE.structureDim, 1);
    slab(70 - bolt, -15, 22, 7, 1.5, PALETTE.ammo, 0.92, PALETTE.white, 1.4);

    if (muzzle > 0.05) {
      const mx = gx + 174;
      const my = gy - 5;
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
    // The pointer sits at 0,0 until the first mouse event; do not draw a crosshair there.
    if (!this.pointerSeen) {
      if (p.x === 0 && p.y === 0) {
        this.cursorAmmo.setText('');
        this.textCache.delete(this.cursorAmmo);
        return;
      }
      this.pointerSeen = true;
    }
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
      const a0 = -Math.PI / 2;
      g.lineStyle(2, 0x000000, 0.45);
      g.strokeCircle(p.x, p.y, r);
      g.lineStyle(3, s.activeResult === 'fumble' ? PALETTE.healthLow : PALETTE.ammo, 0.95);
      g.beginPath();
      g.arc(p.x, p.y, r, a0, a0 + clamp(s.reload, 0, 1) * Math.PI * 2, false);
      g.strokePath();
    }
    if (s.activeFlash > 0 && s.activeResult) {
      const res = s.activeResult;
      const r = gap + len + 8 + (1 - s.activeFlash) * (res === 'perfect' ? 30 : 18);
      g.lineStyle(res === 'perfect' ? 4 : 3, res === 'perfect' ? PALETTE.white : res === 'good' ? PALETTE.player : PALETTE.healthLow, s.activeFlash);
      g.strokeCircle(p.x, p.y, r);
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
