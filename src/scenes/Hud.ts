// HUD on its own scene so the game camera's shake, zoom and scroll never move it.
// Static chrome (plates, brackets) is drawn once and again only on resize; the Graphics that change
// every frame hold just the fills, icons and the weapon animation.
import Phaser from 'phaser';
import { profile } from '../game/profile';
import { FONT, PALETTE, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { runState } from '../game/runState';
import { clamp } from '../sim/math';
import { GUN_KITS } from '../data/gunKits';
import { pixGunKey, pixMagKey, pixMuzzle } from '../fx/pixGun';
import { sizePanel, snapFont, snapText, uiIcon, uiKey, uiPanel } from '../ui/pixelUi';

const FEED_LINES = 7;
const BOLT_TRAVEL = 15; // px the bolt slides back
const MAG_DROP = 26; // px the magazine falls when released

// Layout. Panels hug the screen corners with a 16px margin.
const MARGIN = 16;
const VIT = { w: 304, h: 182 }; // vitals + abilities, top-left
const STA = { w: 232, h: 96 }; // room and wave status, top-right
const BOSS = { h: 64, maxW: 560 }; // boss bar, top-centre
const WEP = { w: 360, h: 168 }; // weapon, bottom-right
const SLOT = { w: 132, h: 48 };
const FIELD_INSET = 6; // a field's 2 px art border at the UI scale

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

export class Hud extends Phaser.Scene {
  private vignette!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Image;
  private chrome!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private gunImg!: Phaser.GameObjects.Image;
  private magImg!: Phaser.GameObjects.Image;
  private gunFx!: Phaser.GameObjects.Graphics;
  private cross!: Phaser.GameObjects.Graphics;
  private chromeObjs: Phaser.GameObjects.GameObject[] = [];
  private slotPanels: Phaser.GameObjects.NineSlice[] = [];
  private slotIcons: Phaser.GameObjects.Image[] = [];
  private extractPanel!: Phaser.GameObjects.NineSlice;
  private carryPanel!: Phaser.GameObjects.NineSlice;
  private feedPanels: Phaser.GameObjects.NineSlice[] = [];
  private xhArms: Phaser.GameObjects.Image[] = [];
  private xhDot!: Phaser.GameObjects.Image;
  private allText: Txt[] = [];
  private shieldLabel!: Txt;
  private hullLabel!: Txt;
  private shieldNum!: Txt;
  private hullNum!: Txt;
  private waveText!: Txt;
  private roomText!: Txt;
  private bossText!: Txt;
  private bossPanel!: Phaser.GameObjects.NineSlice;
  private bossField!: Phaser.GameObjects.NineSlice;
  private bossGhost = 1;
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
    this.magImg = this.add.image(0, 0, 'pixmag_smg').setOrigin(0, 0).setDepth(5.5).setVisible(false);
    this.gunImg = this.add.image(0, 0, 'pixgun_smg').setOrigin(0, 0).setDepth(6).setVisible(false);
    this.gunFx = this.add.graphics().setDepth(7);
    this.cross = this.add.graphics().setDepth(9);

    // Pixel UI objects that change state, not size: pooled and shown or hidden per frame.
    const A = T.ui.panelAlpha;
    this.carryPanel = uiPanel(this, 'panel', 0, 0, 10, 10).setDepth(4).setAlpha(A);
    this.extractPanel = uiPanel(this, 'btn', 0, 0, 10, 10).setDepth(7.5).setVisible(false);
    for (let i = 0; i < 2; i++) {
      this.slotPanels.push(uiPanel(this, 'btn', 0, 0, SLOT.w, SLOT.h).setDepth(4.5));
      this.slotIcons.push(uiIcon(this, i === 0 ? 'dash' : 'blade', 0, 0).setDepth(6));
    }
    for (let i = 0; i < FEED_LINES; i++) this.feedPanels.push(uiPanel(this, 'panel', 0, 0, 10, 10).setDepth(4.2).setVisible(false));
    // Crosshair: four arms and a centre ring cut from the KabGames pack, moved out with aim spread.
    for (let i = 0; i < 4; i++) this.xhArms.push(this.add.image(0, 0, uiKey(i < 2 ? 'xh_arm_v' : 'xh_arm_h')).setScale(T.ui.crossPx).setDepth(9).setVisible(false));
    this.xhDot = this.add.image(0, 0, uiKey('xh_dot')).setScale(T.ui.crossPx).setDepth(9).setVisible(false);

    const mk = (size: number, color: number, ox = 0, oy = 0): Txt => {
      const t = this.add
        .text(0, 0, '', { fontFamily: FONT, fontSize: `${snapFont(size)}px`, color: hex(color) })
        .setResolution(1)
        .setOrigin(ox, oy)
        .setDepth(6);
      this.allText.push(t);
      return t;
    };

    this.shieldLabel = mk(16, PALETTE.textDim);
    this.hullLabel = mk(16, PALETTE.textDim);
    this.shieldNum = mk(24, PALETTE.shield, 1, 0);
    this.hullNum = mk(24, PALETTE.health, 1, 0);
    this.waveText = mk(24, PALETTE.structure, 0, 0);
    this.roomText = mk(12, PALETTE.text, 0, 0);
    this.bossText = mk(16, PALETTE.robot, 0.5, 0).setDepth(6);
    this.bossPanel = uiPanel(this, 'panel', 0, 0, 10, 10).setDepth(4).setAlpha(T.ui.panelAlpha).setVisible(false);
    this.bossField = uiPanel(this, 'field', 0, 0, 10, 10).setDepth(4.4).setVisible(false);
    this.hostText = mk(16, PALETTE.text, 1, 0);
    this.subText = mk(11, PALETTE.textDim);
    this.fpsText = mk(11, PALETTE.textDim, 1, 0);
    this.helpText = mk(11, PALETTE.textDim, 1, 0).setAlign('right');
    this.carryText = mk(12, PALETTE.text, 0.5, 1);
    this.extractText = mk(16, PALETTE.structure, 0.5, 0.5).setDepth(8);
    this.banner = mk(48, PALETTE.structure, 0.5, 0.5).setDepth(8);
    this.banner.setShadow(0, 4, '#000000', 0, false, true);
    this.comboText = mk(24, PALETTE.ammo, 0.5, 0.5).setDepth(8);
    this.dashName = mk(16, PALETTE.text, 0, 0);
    this.bladeName = mk(16, PALETTE.text, 0, 0);
    this.dashKey = mk(12, PALETTE.textDim);
    this.bladeKey = mk(12, PALETTE.textDim);
    this.dashTimer = mk(16, PALETTE.white, 1, 0.5).setDepth(7);
    this.bladeTimer = mk(16, PALETTE.white, 1, 0.5).setDepth(7);
    this.weaponName = mk(16, PALETTE.ammo, 0, 0);
    this.weaponState = mk(11, PALETTE.textDim);
    this.magCount = mk(48, PALETTE.ammo, 1, 0);
    this.magCount.setShadow(0, 4, '#000000', 0, false, true);
    this.reserveText = mk(16, PALETTE.textDim, 1, 0);
    this.cursorAmmo = mk(16, PALETTE.ammo, 0, 0);
    for (let i = 0; i < FEED_LINES; i++) {
      this.feedTexts.push(mk(12, PALETTE.text, 0, 1));
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
          : ['X use a pad (descend, or extract at a lift)   ESC pause   M mute   H hide help']),
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
    for (const t of this.allText) snapText(t);
  }

  /** Static chrome: the 9-slice panels and bar fields, rebuilt only when the screen size changes. */
  private drawChrome(w: number, h: number): void {
    for (const o of this.chromeObjs) o.destroy();
    this.chromeObjs = [];
    const A = T.ui.panelAlpha;
    const add = (kind: 'panel' | 'field', x: number, y: number, pw: number, ph: number, a = 1): void => {
      this.chromeObjs.push(uiPanel(this, kind, x, y, pw, ph).setDepth(kind === 'panel' ? 4 : 4.4).setAlpha(a));
    };
    add('panel', MARGIN, MARGIN, VIT.w, VIT.h, A);
    add('panel', w - MARGIN - STA.w, MARGIN, STA.w, STA.h, A);
    add('panel', w - MARGIN - WEP.w, h - MARGIN - WEP.h, WEP.w, WEP.h, A);
    // Vitals bar fields.
    const bx = MARGIN + 16;
    const bw = VIT.w - 32;
    add('field', bx, MARGIN + 38, bw, 24);
    add('field', bx, MARGIN + 90, bw, 24);
    // A divider under the weapon name.
    const wx = w - MARGIN - WEP.w;
    const wy = h - MARGIN - WEP.h;
    const g = this.chrome;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRect(wx + 18, wy + 38, WEP.w - 36, 3);
  }

  // ------------------------------------------------------------------
  // Top-left: vitals and ability cooldowns
  // ------------------------------------------------------------------

  /** A pixel bar inside a field: a lagging white ghost, then the live fill with a light top edge. */
  private pixBar(x: number, y: number, w: number, h: number, frac: number, ghost: number, color: number, alpha = 1): void {
    const g = this.bars;
    const iw = w - FIELD_INSET * 2;
    const ih = h - FIELD_INSET * 2;
    const fx = x + FIELD_INSET;
    const fy = y + FIELD_INSET;
    const gw = Math.round(iw * clamp(ghost, 0, 1));
    const fw = Math.round(iw * clamp(frac, 0, 1));
    if (gw > fw) {
      g.fillStyle(PALETTE.white, 0.6);
      g.fillRect(fx + fw, fy, gw - fw, ih);
    }
    if (fw > 0) {
      g.fillStyle(color, alpha);
      g.fillRect(fx, fy, fw, ih);
      g.fillStyle(PALETTE.white, 0.28 * alpha);
      g.fillRect(fx, fy, fw, 3);
      g.fillStyle(0x000000, 0.22 * alpha);
      g.fillRect(fx, fy + ih - 3, fw, 3);
    }
  }

  private drawVitals(dt: number): void {
    const s = runState;
    const g = this.bars;
    const x = MARGIN + 16;
    const y = MARGIN;
    const bw = VIT.w - 32;

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
    this.shieldLabel.setPosition(x, y + 15);
    this.hullLabel.setPosition(x, y + 66);
    this.setText(this.shieldNum, String(Math.floor(s.shield)));
    this.setText(this.hullNum, String(Math.ceil(Math.max(0, s.hp))));
    this.shieldNum.setPosition(x + bw, y + 9);
    this.hullNum.setColor(hex(lowHull ? PALETTE.healthLow : PALETTE.health)).setPosition(x + bw, y + 61);
    this.pixBar(x, y + 38, bw, 24, shF, this.ghostSh, PALETTE.shield);
    this.pixBar(x, y + 90, bw, 24, hpF, this.ghostHp, lowHull ? PALETTE.healthLow : PALETTE.health, pulse);

    if (s.refundFlash > 0) {
      g.lineStyle(3, PALETTE.white, s.refundFlash);
      g.strokeRect(MARGIN - 3, MARGIN - 3, VIT.w + 6, VIT.h + 6);
    }

    const sy = y + 122;
    this.slot(0, x, sy, s.dashReady, s.dashPing, s.dashDeny, PALETTE.structure);
    this.slot(1, x + SLOT.w + 8, sy, s.bladeReady, s.bladePing, s.bladeDeny, PALETTE.white);
    const dashLeft = (1 - s.dashReady) * T.player.dashCooldown;
    const bladeLeft = (1 - s.bladeReady) * T.sword.cooldown;
    this.dashName.setPosition(x + 40, sy + 7);
    this.dashKey.setPosition(x + 40, sy + 27);
    this.bladeName.setPosition(x + SLOT.w + 8 + 40, sy + 7);
    this.bladeKey.setPosition(x + SLOT.w + 8 + 40, sy + 27);
    this.setText(this.dashTimer, dashLeft > 0.05 ? dashLeft.toFixed(1) : '');
    this.setText(this.bladeTimer, bladeLeft > 0.05 ? bladeLeft.toFixed(1) : '');
    this.dashTimer.setPosition(x + SLOT.w - 10, sy + SLOT.h / 2);
    this.bladeTimer.setPosition(x + 2 * SLOT.w + 8 - 10, sy + SLOT.h / 2);
  }

  /** A cooldown button: fills left to right as it recharges, flashes white when it comes back. */
  private slot(i: number, x: number, y: number, ready: number, ping: number, deny: number, color: number): void {
    const g = this.bars;
    const { w, h } = SLOT;
    const isReady = ready >= 1;
    this.slotPanels[i].setTexture(uiKey(isReady ? 'wns_btn' : 'wns_btn_dis')).setPosition(x, y);
    this.slotIcons[i].setPosition(x + 10, y + 13).setTint(isReady ? color : 0x6f7a7e);
    if (!isReady) {
      g.fillStyle(color, 0.3);
      g.fillRect(x + FIELD_INSET, y + FIELD_INSET, Math.round((w - FIELD_INSET * 2) * clamp(ready, 0, 1)), h - FIELD_INSET * 2);
    }
    if (deny > 0) {
      g.fillStyle(PALETTE.hostile, deny * 0.45);
      g.fillRect(x + FIELD_INSET, y + FIELD_INSET, w - FIELD_INSET * 2, h - FIELD_INSET * 2);
    }
    if (ping > 0) {
      g.fillStyle(PALETTE.white, ping * 0.3);
      g.fillRect(x + FIELD_INSET, y + FIELD_INSET, w - FIELD_INSET * 2, h - FIELD_INSET * 2);
      g.lineStyle(3, PALETTE.white, ping);
      g.strokeRect(x - 3, y - 3, w + 6, h + 6);
    }
  }

  // ------------------------------------------------------------------
  // Status, help, loot feed, banner
  // ------------------------------------------------------------------

  private drawStatus(w: number): void {
    const s = runState;
    const x = w - MARGIN - STA.w;
    this.setText(this.roomText, s.roomLabel || 'FREE PLAY');
    this.roomText.setColor(hex(s.roomLabel ? PALETTE.text : PALETTE.textDim)).setPosition(x + 18, MARGIN + 12);
    const waves = s.wave === 0 ? 'WAVE -' : s.waveTotal > 0 ? `WAVE ${s.wave}/${s.waveTotal}` : `WAVE ${s.wave}`;
    this.setText(this.waveText, waves);
    this.waveText.setPosition(x + 18, MARGIN + 32);
    this.setText(this.hostText, `${s.mobsAlive} HOSTILE${s.mobsAlive === 1 ? '' : 'S'}`);
    this.hostText.setColor(hex(s.mobsAlive > 0 ? PALETTE.hostile : PALETTE.textDim)).setPosition(x + STA.w - 18, MARGIN + 38);
    this.setText(this.subText, s.intermission > 0 ? `NEXT WAVE ${s.intermission.toFixed(1)}s` : s.mobsAlive > 0 ? 'ENGAGED' : 'CLEAR');
    this.subText.setPosition(x + 18, MARGIN + 70);
    this.setText(this.fpsText, `${Math.round(this.game.loop.actualFps)} FPS${s.muted ? '  MUTED' : ''}`);
    this.fpsText.setPosition(x + STA.w - 18, MARGIN + 70);
    this.drawBoss(w);
    this.helpText.setVisible(s.showHelp).setPosition(w - MARGIN, MARGIN + STA.h + 10);
  }

  /** The Warden's health, top-centre, only while one is alive. */
  private drawBoss(w: number): void {
    const s = runState;
    const on = s.bossMax > 0 && s.bossHp > 0;
    this.bossPanel.setVisible(on);
    this.bossField.setVisible(on);
    this.bossText.setVisible(on);
    if (!on) {
      this.bossGhost = 1;
      return;
    }
    const bw = Math.min(BOSS.maxW, Math.floor(w * 0.42));
    const bx = Math.round((w - bw) / 2);
    sizePanel(this.bossPanel, bx, MARGIN, bw, BOSS.h);
    sizePanel(this.bossField, bx + 16, MARGIN + 34, bw - 32, 24);
    this.setText(this.bossText, s.bossName);
    this.bossText.setPosition(w / 2, MARGIN + 10);
    const frac = clamp(s.bossHp / s.bossMax, 0, 1);
    this.bossGhost = Math.max(frac, this.bossGhost - 0.35 / 60);
    this.pixBar(bx + 16, MARGIN + 34, bw - 32, 24, frac, this.bossGhost, PALETTE.robot);
    // Stage ticks where the Warden changes its pattern.
    const iw = bw - 32 - 12;
    this.bars.fillStyle(0x000000, 0.7);
    for (const t of [0.66, 0.33]) this.bars.fillRect(bx + 16 + 6 + Math.round(iw * t), MARGIN + 40, 2, 12);
  }

  /** The pad prompt, above the status line, only while standing on a pad. */
  private drawExtractPrompt(w: number, aboveY: number): void {
    const s = runState;
    if (!s.extractPrompt) {
      this.extractText.setVisible(false);
      this.extractPanel.setVisible(false);
      return;
    }
    this.setText(this.extractText, s.extractPrompt);
    const pw = this.extractText.width + 56;
    const ph = this.extractText.height + 26;
    const py = aboveY - ph;
    sizePanel(this.extractPanel, Math.round(w / 2 - pw / 2), py, pw, ph);
    if (s.extractOpen) this.extractPanel.clearTint();
    else this.extractPanel.setTint(0xff7a6e);
    this.extractPanel.setVisible(true);
    this.extractText.setColor(hex(s.extractOpen ? PALETTE.structure : PALETTE.hostile)).setVisible(true).setPosition(w / 2, py + ph / 2);
  }

  private drawFeedAndBanner(w: number, h: number): void {
    const s = runState;
    const g = this.bars;
    this.setText(
      this.carryText,
      `CARRIED ${s.carried.length}/${profile.stats.carrySlots}${s.carriedScrap > 0 ? `  +${s.carriedScrap} scrap` : ''}   SCRAP ${profile.scrap}   INTEL ${profile.intel}   X extract at a pad${runState.devMode ? '   [B] base   [TAB] trees' : '   [ESC] pause'}`,
    );
    const cw = this.carryText.width + 36;
    const ch = this.carryText.height + 18;
    const cy = h - MARGIN - ch;
    sizePanel(this.carryPanel, Math.round(w / 2 - cw / 2), cy, cw, ch);
    this.carryText.setPosition(w / 2, cy + ch / 2 + this.carryText.height / 2);
    this.drawExtractPrompt(w, cy - 10);

    for (let i = 0; i < FEED_LINES; i++) {
      const t = this.feedTexts[i];
      const pan = this.feedPanels[i];
      const line = s.feed[s.feed.length - 1 - i];
      if (!line) {
        t.setVisible(false);
        pan.setVisible(false);
        continue;
      }
      const fade = 1 - clamp((line.age - (T.loot.feedSeconds - 1.2)) / 1.2, 0, 1);
      this.setText(t, line.text);
      const ph = 30;
      const py = h - 150 - i * (ph + 4);
      sizePanel(pan, MARGIN, py, t.width + 40, ph);
      pan.setAlpha(fade).setVisible(true);
      t.setColor(hex(line.color)).setAlpha(fade).setVisible(true).setPosition(MARGIN + 22, py + ph - 8);
      // Rarity-coloured tick inside the panel edge.
      g.fillStyle(line.color, 0.95 * fade);
      g.fillRect(MARGIN + 8, py + 8, 3, ph - 16);
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
      const half = this.banner.width / 2;
      g.fillStyle(col, a * 0.85);
      g.fillRect(w / 2 - half - 130, by - 2, 110, 4);
      g.fillRect(w / 2 + half + 20, by - 2, 110, 4);
      g.fillStyle(col, a * 0.5);
      g.fillRect(w / 2 - half - 100, by + 8, 80, 2);
      g.fillRect(w / 2 + half + 20, by + 8, 80, 2);
    } else {
      this.banner.setVisible(false);
    }
    if (s.combo >= 2) {
      this.setText(this.comboText, `x${s.combo}`);
      this.comboText.setPosition(w / 2, h * 0.2 + 48).setVisible(true);
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
    const gx = x0 + 24; // gun origin: stock end
    const gy = y0 + 70; // gun centre line

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
    this.drawGun(s.weaponShape, gx, gy, bolt, magY, magA, this.muzzle);
    this.drawCasings(dt);

    // Rounds remaining, as cells.
    const total = s.magSize;
    const loaded = this.pipsLoaded(p, s.mag, s.reserve, total, seat);
    const low = s.mag <= Math.ceil(total * 0.2);
    const px0 = x0 + 18;
    const py = y0 + WEP.h - 34;
    const gap = 2;
    const pw = (WEP.w - 36 - (total - 1) * gap) / total;
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
    this.weaponName.setPosition(x0 + 18, y0 + 14);
    this.setText(this.weaponState, state);
    this.weaponState.setColor(hex(stateColor)).setPosition(x0 + 18 + this.weaponName.width + 14, y0 + 18);

    const magCol = s.mag < 1 || low ? PALETTE.healthLow : reloading ? PALETTE.textDim : PALETTE.ammo;
    this.setText(this.magCount, String(s.mag));
    this.magCount.setColor(hex(magCol)).setPosition(x0 + WEP.w - 18, y0 + 46);
    this.setText(this.reserveText, `RESERVE ${Math.floor(s.reserve)}`);
    this.reserveText.setPosition(x0 + WEP.w - 18, y0 + 98);
  }

  /**
   * The Gears-style active reload bar, small and right under the reticle so the eyes never leave the
   * action. A dark track with a wide grey ACTIVE zone and the small white PERFECT zone inside it; a
   * white tick sweeps left to right. Perfect flashes the bar white, active flashes it grey, a miss
   * turns it red with the tick locked where the press landed. It only shows while reloading and for
   * a moment after the result. It replaces the old reload ring.
   */
  private drawActiveReloadBar(cx: number, y: number, reloading: boolean, p: number): void {
    const s = runState;
    const g = this.cross;
    const result = s.activeResult;
    const after = !reloading && s.activeFlash > 0 && result !== '';
    if (!reloading && !after) return;
    const bw = T.ui.reloadBar.w;
    const bh = T.ui.reloadBar.h;
    const bx = cx - Math.round(bw / 2);
    const fade = reloading ? 1 : clamp(s.activeFlash / 0.35, 0, 1);
    const jam = result === 'fumble';

    // Track with a 1 px outline.
    g.fillStyle(0x000000, 0.85 * fade);
    g.fillRect(bx - 2, y - 2, bw + 4, bh + 4);
    g.fillStyle(jam ? 0x3a0d0d : 0x15201f, fade);
    g.fillRect(bx, y, bw, bh);

    // Zones (hidden after a miss, like the action jamming shut).
    if (!jam && s.reloadGood1 > s.reloadGood0) {
      const gx0 = bx + Math.round(bw * clamp(s.reloadGood0, 0, 1));
      const gx1 = bx + Math.round(bw * clamp(s.reloadGood1, 0, 1));
      g.fillStyle(0x9fb0ac, 0.7 * fade);
      g.fillRect(gx0, y, gx1 - gx0, bh);
      const px0 = bx + Math.round(bw * clamp(s.reloadWin0, 0, 1));
      const px1 = bx + Math.round(bw * clamp(s.reloadWin1, 0, 1));
      g.fillStyle(0xffffff, fade);
      g.fillRect(px0, y, Math.max(2, px1 - px0), bh);
    }

    const prog = reloading ? clamp(p, 0, 1) : clamp(s.reloadMark, 0, 1);

    // Result flash over the whole bar.
    if (s.activeFlash > 0 && result) {
      const col = result === 'perfect' ? 0xffffff : result === 'good' ? 0xcfe3dd : PALETTE.healthLow;
      g.fillStyle(col, (result === 'fumble' ? 0.55 : 0.85) * s.activeFlash * fade);
      g.fillRect(bx, y, bw, bh);
    }

    // The tick: sweeps while reloading, locks where the press landed on a miss.
    const tx = bx + Math.round(bw * (jam ? clamp(s.reloadMark, 0, 1) : prog));
    g.fillStyle(0x000000, 0.9 * fade);
    g.fillRect(tx - 2, y - 4, 4, bh + 8);
    g.fillStyle(jam ? PALETTE.healthLow : 0xffffff, fade);
    g.fillRect(tx - 1, y - 3, 2, bh + 6);
  }

  /** How many cells read as loaded. While reloading they fill once the magazine has seated. */
  private pipsLoaded(p: number, mag: number, reserve: number, total: number, seat: number): number {
    if (p < 0) return mag;
    if (p < seat) return mag;
    const target = Math.min(total, mag + Math.floor(reserve));
    const k = clamp((p - seat) / 0.15, 0, 1);
    return Math.floor(mag + (target - mag) * k);
  }

  /**
   * Draw the equipped weapon as a baked PIXWEP sprite. The action reads as recoil (the whole gun
   * kicks back with the bolt), the magazine drops out of the well and seats again on reload, and
   * the muzzle flash sits on the barrel end.
   */
  private drawGun(shape: string, gx: number, gy: number, bolt: number, magY: number, magA: number, muzzle: number): void {
    const kit = GUN_KITS[shape] ?? GUN_KITS.smg;
    const key = pixGunKey(GUN_KITS[shape] ? shape : 'smg');
    const sc = T.pixGun.scale;
    const ix = gx + T.pixGun.x - bolt * T.pixGun.kick;
    const iy = gy + T.pixGun.y;
    this.gunImg.setTexture(key).setPosition(ix, iy).setScale(sc).setVisible(true);

    // The magazine sits in its well behind the gun and drops out and back in on reload.
    this.magImg
      .setTexture(pixMagKey(GUN_KITS[shape] ? shape : 'smg'))
      .setPosition(gx + T.pixGun.x + kit.mag.x * sc - (kit.mag.raked ? magY * T.pixGun.magRake : 0), iy + kit.mag.y * sc + magY)
      .setScale(sc)
      .setAlpha(magA)
      .setVisible(magA > 0.01);

    const f = this.gunFx;
    f.clear();
    if (muzzle > 0.05) {
      const tip = pixMuzzle[GUN_KITS[shape] ? shape : 'smg'];
      const fx = ix + tip.x * sc;
      const fy = iy + tip.y * sc;
      f.fillStyle(PALETTE.muzzle, muzzle * 0.9);
      f.fillCircle(fx + 5, fy, 5 + muzzle * 5);
      f.lineStyle(2, PALETTE.white, muzzle);
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.34;
        f.lineBetween(fx, fy, fx + Math.cos(a) * (14 + muzzle * 12), fy + Math.sin(a) * (14 + muzzle * 12));
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
        for (const o of [...this.xhArms, this.xhDot]) o.setVisible(false);
        return;
      }
      this.pointerSeen = true;
      for (const o of [...this.xhArms, this.xhDot]) o.setVisible(true);
    }
    const gap = Math.round(T.ui.crossGap + s.aimSpread * T.ui.crossSpread);
    const len = 10 * T.ui.crossPx;
    const reloading = s.reload >= 0;
    const col = s.dryFlash > 0 ? PALETTE.hostile : reloading ? PALETTE.ammo : PALETTE.player;
    const cx = Math.round(p.x);
    const cy = Math.round(p.y);
    const [up, down, left, right] = this.xhArms;
    up.setOrigin(0.5, 1).setPosition(cx, cy - gap).setTint(col);
    down.setOrigin(0.5, 0).setFlipY(true).setPosition(cx, cy + gap).setTint(col);
    left.setOrigin(1, 0.5).setPosition(cx - gap, cy).setTint(col);
    right.setOrigin(0, 0.5).setFlipX(true).setPosition(cx + gap, cy).setTint(col);
    this.xhDot.setPosition(cx, cy).setTint(col);

    // The active reload bar sits just under the reticle.
    this.drawActiveReloadBar(cx, cy + gap + len + 8, reloading, s.reload);

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
      .setPosition(cx + gap + len + 8, cy + gap + len - 4);
  }
}
