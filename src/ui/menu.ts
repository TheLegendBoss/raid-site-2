// A small vertical button list for the title and pause screens: mouse hover and click,
// plus keyboard focus (move / activate) driven by the owning scene.
import Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../data/palette';
import { snapFont } from './pixelUi';

export interface MenuItem {
  label: string;
  sub?: string;
  /** Disabled items stay visible, dim, and refuse to run. */
  enabled?: boolean;
  run: () => void;
}

interface Slot {
  item: MenuItem;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class Menu {
  private slots: Slot[] = [];
  private focus = 0;
  private x = 0;
  private y = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    items: MenuItem[],
    private readonly w = 320,
    private readonly h = 52,
    private readonly gap = 12,
    private readonly onMove?: () => void,
    private readonly onDeny?: () => void,
  ) {
    for (const item of items) {
      const bg = scene.add.graphics().setDepth(10);
      const label = scene.add
        .text(0, 0, item.label, { fontFamily: FONT, fontSize: `${snapFont(22)}px`, color: '#ffffff' })
        .setResolution(1).setDepth(11);
      const sub = item.sub
        ? scene.add.text(0, 0, item.sub, { fontFamily: FONT, fontSize: `${snapFont(12)}px`, color: hex(PALETTE.textDim) }).setResolution(1).setDepth(11)
        : undefined;
      const zone = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: false }).setDepth(12);
      const slot: Slot = { item, bg, label, sub, zone };
      const index = this.slots.length;
      zone.on('pointerover', () => this.setFocus(index, true));
      zone.on('pointerdown', () => this.activate(index));
      this.slots.push(slot);
    }
    this.focus = Math.max(0, this.slots.findIndex((s) => s.item.enabled !== false));
  }

  /** Top-centre of the list, in screen pixels. */
  layout(cx: number, top: number): void {
    this.x = cx - this.w / 2;
    this.y = top;
    this.slots.forEach((s, i) => {
      const y = this.y + i * (this.h + this.gap);
      s.zone.setPosition(this.x, y);
      s.label.setPosition(this.x + 22, y + (s.sub ? 8 : (this.h - s.label.height) / 2));
      s.sub?.setPosition(this.x + 22, y + this.h - 20);
    });
    this.draw();
  }

  get height(): number {
    return this.slots.length * (this.h + this.gap) - this.gap;
  }

  move(dir: number): void {
    const n = this.slots.length;
    let i = this.focus;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (this.slots[i].item.enabled !== false) break;
    }
    this.setFocus(i, false);
  }

  activate(index = this.focus): void {
    const s = this.slots[index];
    if (!s) return;
    if (s.item.enabled === false) {
      this.onDeny?.();
      return;
    }
    s.item.run();
  }

  setFocus(i: number, fromMouse: boolean): void {
    if (this.slots[i].item.enabled === false) {
      if (fromMouse) this.scene.input.setDefaultCursor('default');
      return;
    }
    if (i !== this.focus) this.onMove?.();
    this.focus = i;
    if (fromMouse) this.scene.input.setDefaultCursor('pointer');
    this.draw();
  }

  /** Cursor back to an arrow when the pointer leaves every button. */
  pointerOut(): void {
    this.scene.input.setDefaultCursor('default');
  }

  destroy(): void {
    for (const s of this.slots) {
      s.bg.destroy();
      s.label.destroy();
      s.sub?.destroy();
      s.zone.destroy();
    }
    this.slots = [];
  }

  private draw(): void {
    this.slots.forEach((s, i) => {
      const on = i === this.focus && s.item.enabled !== false;
      const dis = s.item.enabled === false;
      const y = this.y + i * (this.h + this.gap);
      s.bg.clear();
      s.bg.fillStyle(on ? 0x0e2a2c : 0x061013, dis ? 0.5 : 0.92);
      s.bg.fillRect(this.x, y, this.w, this.h);
      s.bg.lineStyle(on ? 2 : 1.5, on ? PALETTE.structure : PALETTE.structureDim, dis ? 0.35 : on ? 1 : 0.8);
      s.bg.strokeRect(this.x, y, this.w, this.h);
      if (on) {
        s.bg.fillStyle(PALETTE.structure, 1);
        s.bg.fillRect(this.x, y, 4, this.h);
      }
      s.label.setColor(dis ? hex(PALETTE.textDim) : on ? '#ffffff' : hex(PALETTE.text));
      s.sub?.setColor(hex(dis ? PALETTE.hostile : PALETTE.textDim));
    });
  }
}
