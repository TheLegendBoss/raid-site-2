// HUD on its own scene so the game camera's shake, zoom and scroll never move it.
import Phaser from 'phaser';
import { PALETTE, RARITY_COLORS, hex } from '../data/palette';
import { TUNING as T } from '../data/tuning';
import { runState } from '../game/runState';
import { clamp } from '../sim/math';

const FONT = '"Space Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FEED_LINES = 7;

export class Hud extends Phaser.Scene {
  private vignette!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private cross!: Phaser.GameObjects.Graphics;
  private ammoText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private carryText!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private feedTexts: Phaser.GameObjects.Text[] = [];
  private textCache = new Map<Phaser.GameObjects.Text, string>();

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
    this.cross = this.add.graphics().setDepth(9);

    const style = (size: number, color: number): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: hex(color),
    });

    this.ammoText = this.add.text(0, 0, '', style(13, PALETTE.ammo)).setDepth(6);
    this.statusText = this.add.text(0, 0, '', style(13, PALETTE.text)).setOrigin(1, 0).setAlign('right').setDepth(6);
    this.carryText = this.add.text(0, 0, '', style(13, PALETTE.text)).setOrigin(0.5, 1).setDepth(6);
    this.helpText = this.add
      .text(0, 0, '', style(11, PALETTE.textDim))
      .setOrigin(1, 1)
      .setAlign('right')
      .setDepth(6);
    this.banner = this.add.text(0, 0, '', style(42, PALETTE.structure)).setOrigin(0.5).setDepth(8);
    this.comboText = this.add.text(0, 0, '', style(22, PALETTE.ammo)).setOrigin(0.5).setDepth(8);
    for (let i = 0; i < FEED_LINES; i++) {
      this.feedTexts.push(this.add.text(0, 0, '', style(13, PALETTE.text)).setOrigin(0, 1).setDepth(6));
    }

    this.setText(
      this.helpText,
      [
        'WASD  move      SHIFT  dash',
        'LMB  carbine    RMB / F  arc blade',
        'blade kills refund ammo + shield',
        '1 swarm   2 robot   K clear   R reset',
        'X extract   M mute',
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

  update(): void {
    const s = runState;
    const w = this.scale.width;
    const h = this.scale.height;

    this.vignette.setPosition(w / 2, h / 2).setDisplaySize(w * 1.5, h * 1.5);
    this.hurt.setPosition(w / 2, h / 2).setDisplaySize(w * 1.25, h * 1.25).setAlpha(s.damageFlash * 0.85);

    // Bars, top-left.
    const g = this.bars;
    g.clear();
    const x = 18;
    const bw = 230;
    const hpFrac = s.hp / s.maxHp;
    this.bar(x, 18, bw, 9, s.shield / s.maxShield, PALETTE.shield);
    this.bar(x, 34, bw, 9, hpFrac, hpFrac < 0.3 ? PALETTE.healthLow : PALETTE.health);
    this.bar(x, 50, bw, 9, s.ammo / s.maxAmmo, PALETTE.ammo);
    this.bar(x, 66, bw * 0.4, 5, s.dashReady, s.dashReady >= 1 ? PALETTE.structure : PALETTE.textDim);
    if (s.refundFlash > 0) {
      g.lineStyle(2, PALETTE.white, s.refundFlash);
      g.strokeRect(x - 2, 16, bw + 4, 45);
    }
    this.setText(this.ammoText, `AMMO ${Math.floor(s.ammo)}   SHIELD ${Math.floor(s.shield)}   HULL ${Math.ceil(s.hp)}`);
    this.ammoText.setPosition(x, 76);

    // Status, top-right.
    const wave = s.wave === 0 ? 'WAVE -' : `WAVE ${s.wave}`;
    const next = s.intermission > 0 ? `\nNEXT WAVE ${s.intermission.toFixed(1)}s` : '';
    this.setText(
      this.statusText,
      `${wave}   HOSTILES ${s.mobsAlive}${next}\n${Math.round(this.game.loop.actualFps)} FPS${s.muted ? '   MUTED' : ''}`,
    );
    this.statusText.setPosition(w - 18, 16);

    // Cargo, bottom-centre.
    this.setText(
      this.carryText,
      `CARRIED ${s.carried.length}   STASH ${s.stash.length}   [X] extract (carried is lost on death)`,
    );
    this.carryText.setPosition(w / 2, h - 16);

    this.helpText.setPosition(w - 18, h - 18);

    // Loot feed, bottom-left.
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

    // Banner and combo.
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

    this.drawCrosshair();
  }

  private drawCrosshair(): void {
    const s = runState;
    const g = this.cross;
    const p = this.input.activePointer;
    g.clear();
    const gap = 6 + s.aimSpread * 2.6;
    const len = 8;
    g.lineStyle(2, PALETTE.player, 0.95);
    g.lineBetween(p.x - gap - len, p.y, p.x - gap, p.y);
    g.lineBetween(p.x + gap, p.y, p.x + gap + len, p.y);
    g.lineBetween(p.x, p.y - gap - len, p.x, p.y - gap);
    g.lineBetween(p.x, p.y + gap, p.x, p.y + gap + len);
    g.fillStyle(PALETTE.player, 0.9);
    g.fillCircle(p.x, p.y, 1.6);

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
  }
}

// Rarity swatch export keeps the palette import honest for future inventory UI.
export const RARITY_SWATCHES = RARITY_COLORS;
