// The base screen: equipped gear, carried items, the stash and the quartermaster.
// Opened from the room with B (the room is paused underneath). In the real game
// this is a place you reach by extracting; for now it can be opened anywhere.
//
// Rules shown here (design 5.5 and 6):
//  - equip from carried or stash; the replaced item takes its place;
//  - sell and dismantle only work on stashed items: the payout counts once you are back;
//  - the quartermaster sells baseline gear (Common and Uncommon) for Scrap.
import Phaser from 'phaser';
import { FONT, PALETTE, RARITY_COLORS, hex } from '../data/palette';
import { BASE_ITEMS, SLOTS, SLOT_LABELS, type BaseItem } from '../data/items';
import { QM, RARITY_LABELS, STASH_SLOTS } from '../data/loot';
import type { Sfx } from '../fx/audio';
import {
  buy, canBuy, dismantle, equip, move, profile, sell, stashFull, type Place,
} from '../game/profile';
import { runState } from '../game/runState';
import { statLines, type StatLine } from '../sim/describe';
import { baseOf, buyPrice, dismantleIntel, rarityLabel, sellValue, type Item } from '../sim/loot';

type Txt = Phaser.GameObjects.Text;
type TabId = 'carried' | 'stash' | 'shop';

interface Row {
  item?: Item; // carried or stash
  shop?: { base: BaseItem; rarity: number };
}

interface Btn {
  key: string;
  label: string;
  enabled: boolean;
  run: () => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'carried', label: 'CARRIED' },
  { id: 'stash', label: 'STASH' },
  { id: 'shop', label: 'QUARTERMASTER' },
];
const HEADER_H = 84;
const FOOTER_H = 44;
const LEFT_W = 330;
const RIGHT_W = 380;
const ROW_H = 40;

export class Base extends Phaser.Scene {
  private sfx?: Sfx;
  private tab: TabId = 'carried';
  private sel = 0;
  private scroll = 0;
  private rows: Row[] = [];
  private pendingConfirm = '';
  private toast = '';
  private toastColor: number = PALETTE.text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private btns: { x: number; y: number; w: number; h: number; btn: Btn }[] = [];
  private tabHit: { x: number; w: number; id: TabId }[] = [];
  private rowHit: { y: number; idx: number }[] = [];
  private listRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Base');
  }

  init(data: { sfx?: Sfx }): void {
    this.sfx = data.sfx;
    this.sel = 0;
    this.scroll = 0;
    this.pendingConfirm = '';
    this.toast = '';
  }

  create(): void {
    this.add.rectangle(0, 0, 4000, 4000, PALETTE.bg, 1).setOrigin(0, 0).setDepth(0);
    this.gfx = this.add.graphics().setDepth(1);
    this.keys = this.input.keyboard!.addKeys(
      'UP,DOWN,LEFT,RIGHT,ENTER,E,M,S,D,ONE,TWO,THREE,TAB,ESC,B',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', this.onClick, this);
    this.input.on('wheel', this.onWheel, this);
    this.scale.on('resize', this.render, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onClick, this);
      this.input.off('wheel', this.onWheel, this);
      this.scale.off('resize', this.render, this);
    });
    this.render();
  }

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------

  private buildRows(): Row[] {
    if (this.tab === 'carried') return runState.carried.map((item) => ({ item }));
    if (this.tab === 'stash') return runState.stash.map((item) => ({ item }));
    const out: Row[] = [];
    for (const base of BASE_ITEMS) {
      if (base.price === 0) continue; // the starting kit is not for sale
      for (let r = 0; r <= QM.maxRarity; r++) {
        out.push({ shop: { base, rarity: r } });
      }
    }
    return out;
  }

  private current(): Row | undefined {
    return this.rows[this.sel];
  }

  private say(text: string, color: number = PALETTE.text): void {
    this.toast = text;
    this.toastColor = color;
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  private buttons(): Btn[] {
    const row = this.current();
    if (!row) return [];
    if (row.shop) {
      const { base, rarity } = row.shop;
      const price = buyPrice(base, rarity);
      return [{
        key: 'ENTER', label: `BUY  ${price}`, enabled: canBuy(base.id, rarity),
        run: () => this.doBuy(base, rarity),
      }];
    }
    const item = row.item!;
    const from: Place = this.tab === 'stash' ? 'stash' : 'carried';
    const inStash = from === 'stash';
    return [
      { key: 'E', label: 'EQUIP', enabled: true, run: () => this.doEquip(item, from) },
      {
        key: 'M', label: inStash ? 'TAKE' : 'STASH',
        enabled: inStash ? runState.carried.length < profile.stats.carrySlots : !stashFull(),
        run: () => this.doMove(item, from),
      },
      { key: 'S', label: `SELL  ${sellValue(item)}`, enabled: inStash, run: () => this.confirmed('sell', item, () => this.doSell(item)) },
      {
        key: 'D', label: `DISMANTLE  +${dismantleIntel(item)}`, enabled: inStash,
        run: () => this.confirmed('dismantle', item, () => this.doDismantle(item)),
      },
    ];
  }

  /** Valuable items need the key pressed twice. */
  private confirmed(kind: string, item: Item, run: () => void): void {
    const tag = `${kind}:${item.id}`;
    if (item.rarity >= 3 && this.pendingConfirm !== tag) {
      this.pendingConfirm = tag;
      this.say(`${kind === 'sell' ? 'Sell' : 'Dismantle'} ${rarityLabel(item)} ${baseOf(item).name}? Press again to confirm.`, PALETTE.ammo);
      this.sfx?.empty();
      this.render();
      return;
    }
    this.pendingConfirm = '';
    run();
  }

  private after(): void {
    this.rows = this.buildRows();
    this.sel = Phaser.Math.Clamp(this.sel, 0, Math.max(0, this.rows.length - 1));
    this.render();
  }

  private doEquip(item: Item, from: Place): void {
    equip(item, from);
    this.say(`Equipped ${rarityLabel(item)} ${baseOf(item).name}`, RARITY_COLORS[item.rarity]);
    this.sfx?.pickup(item.rarity);
    this.after();
  }

  private doMove(item: Item, from: Place): void {
    if (!move(item, from)) {
      this.say(from === 'carried' ? 'Stash is full' : 'Pack is full', PALETTE.hostile);
      this.sfx?.empty();
    } else {
      this.say(from === 'carried' ? 'Moved to the stash' : 'Taken into the pack');
      this.sfx?.step();
    }
    this.after();
  }

  private doSell(item: Item): void {
    const n = sell(item);
    this.say(`Sold ${baseOf(item).name} for ${n} scrap`, PALETTE.scrap);
    this.sfx?.pickup(2);
    this.after();
  }

  private doDismantle(item: Item): void {
    const fam = baseOf(item).family;
    const n = dismantle(item);
    this.say(`Dismantled ${baseOf(item).name}: +${n} Intel  (${fam} analysis ${profile.analysis[fam]})`, PALETTE.robot);
    this.sfx?.pickup(3);
    this.after();
  }

  private doBuy(base: BaseItem, rarity: number): void {
    const it = buy(base.id, rarity);
    if (!it) {
      this.say(stashFull() ? 'Stash is full' : 'Not enough scrap', PALETTE.hostile);
      this.sfx?.empty();
    } else {
      this.say(`Bought ${RARITY_LABELS[rarity]} ${base.name} (in the stash)`, RARITY_COLORS[rarity]);
      this.sfx?.pickup(rarity);
    }
    this.after();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------

  update(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (K.JustDown(k.ESC) || K.JustDown(k.B)) return this.close();
    if (K.JustDown(k.TAB)) {
      this.scene.stop();
      this.scene.launch('Tree', { sfx: this.sfx });
      this.scene.bringToTop('Tree');
      return;
    }
    if (K.JustDown(k.ONE)) this.setTab('carried');
    if (K.JustDown(k.TWO)) this.setTab('stash');
    if (K.JustDown(k.THREE)) this.setTab('shop');
    if (K.JustDown(k.LEFT)) this.setTab(TABS[(TABS.findIndex((t) => t.id === this.tab) + TABS.length - 1) % TABS.length].id);
    if (K.JustDown(k.RIGHT)) this.setTab(TABS[(TABS.findIndex((t) => t.id === this.tab) + 1) % TABS.length].id);
    if (K.JustDown(k.UP)) this.select(this.sel - 1);
    if (K.JustDown(k.DOWN)) this.select(this.sel + 1);
    for (const b of this.buttons()) {
      const pressed = b.key === 'ENTER' ? K.JustDown(k.ENTER) : K.JustDown(k[b.key]);
      if (pressed) {
        if (b.enabled) b.run();
        else {
          this.sfx?.empty();
          this.explainDisabled(b);
        }
      }
    }
  }

  private explainDisabled(b: Btn): void {
    if (b.key === 'S' || b.key === 'D') this.say('Bank it in the stash first: only stashed items can be sold or dismantled.', PALETTE.hostile);
    else if (b.key === 'M') this.say(this.tab === 'stash' ? 'Your pack is full.' : 'The stash is full.', PALETTE.hostile);
    else if (b.key === 'ENTER') this.say(stashFull() ? 'The stash is full.' : 'Not enough scrap.', PALETTE.hostile);
    this.render();
  }

  private setTab(t: TabId): void {
    if (t === this.tab) return;
    this.tab = t;
    this.sel = 0;
    this.scroll = 0;
    this.pendingConfirm = '';
    this.toast = '';
    this.sfx?.step();
    this.render();
  }

  private select(i: number): void {
    if (this.rows.length === 0) return;
    this.sel = Phaser.Math.Clamp(i, 0, this.rows.length - 1);
    this.pendingConfirm = '';
    this.keepVisible();
    this.render();
  }

  private keepVisible(): void {
    const visible = Math.max(1, Math.floor(this.listRect.h / ROW_H));
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + visible) this.scroll = this.sel - visible + 1;
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    const visible = Math.max(1, Math.floor(this.listRect.h / ROW_H));
    const max = Math.max(0, this.rows.length - visible);
    this.scroll = Phaser.Math.Clamp(this.scroll + (dy > 0 ? 1 : -1), 0, max);
    this.render();
  }

  private onClick(p: Phaser.Input.Pointer): void {
    for (const t of this.tabHit) {
      if (p.x >= t.x && p.x <= t.x + t.w && p.y >= 50 && p.y <= HEADER_H) return this.setTab(t.id);
    }
    for (const b of this.btns) {
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        if (b.btn.enabled) b.btn.run();
        else {
          this.sfx?.empty();
          this.explainDisabled(b.btn);
        }
        return;
      }
    }
    for (const r of this.rowHit) {
      if (p.x >= this.listRect.x && p.x <= this.listRect.x + this.listRect.w && p.y >= r.y && p.y < r.y + ROW_H) {
        this.select(r.idx);
        return;
      }
    }
  }

  private close(): void {
    this.scene.resume('FeelTest');
    this.scene.stop();
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------

  private text(x: number, y: number, s: string, size: number, color: number, origin: [number, number] = [0, 0]): Txt {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: hex(color) })
      .setResolution(2)
      .setOrigin(origin[0], origin[1])
      .setDepth(5);
    this.dyn.push(t);
    return t;
  }

  private render(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.btns = [];
    this.tabHit = [];
    this.rowHit = [];
    this.rows = this.buildRows();
    this.sel = Phaser.Math.Clamp(this.sel, 0, Math.max(0, this.rows.length - 1));

    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.gfx;
    g.clear();

    // Header and footer bands.
    g.fillStyle(0x040a0d, 1);
    g.fillRect(0, 0, w, HEADER_H);
    g.fillRect(0, h - FOOTER_H, w, FOOTER_H);
    g.lineStyle(1, PALETTE.structureDim, 0.8);
    g.lineBetween(0, HEADER_H, w, HEADER_H);
    g.lineBetween(0, h - FOOTER_H, w, h - FOOTER_H);
    this.text(24, 14, '| BASE |', 26, PALETTE.text);
    let tx = 26;
    for (const t of TABS) {
      const on = t.id === this.tab;
      const label = `${on ? '[' : ' '}${t.label}${on ? ']' : ' '}`;
      const tt = this.text(tx, 52, label, 14, on ? PALETTE.white : PALETTE.textDim);
      this.tabHit.push({ x: tx, w: tt.width, id: t.id });
      tx += tt.width + 18;
    }
    this.text(w - 24, 14, `SCRAP ${profile.scrap}`, 18, PALETTE.scrap, [1, 0]);
    this.text(w - 24, 40, `INTEL ${profile.intel}`, 18, PALETTE.robot, [1, 0]);
    this.text(24, h - 14,
      '← → tabs   ↑ ↓ select   E equip   M move   S sell   D dismantle   ENTER buy   TAB trees   ESC close',
      13, PALETTE.textDim, [0, 1]);
    if (this.toast) this.text(w - 24, h - 14, this.toast, 13, this.toastColor, [1, 1]);

    this.drawEquipped(24, HEADER_H + 18, LEFT_W, h - HEADER_H - FOOTER_H - 36);
    const lx = 24 + LEFT_W + 20;
    const lw = w - lx - RIGHT_W - 44;
    this.drawList(lx, HEADER_H + 18, Math.max(240, lw), h - HEADER_H - FOOTER_H - 36);
    this.drawDetail(w - RIGHT_W - 24, HEADER_H + 18, RIGHT_W, h - HEADER_H - FOOTER_H - 36);
  }

  private panel(x: number, y: number, w: number, h: number, color: number = PALETTE.structureDim): void {
    this.gfx.fillStyle(0x050c10, 0.9);
    this.gfx.fillRect(x, y, w, h);
    this.gfx.lineStyle(1.5, color, 0.9);
    this.gfx.strokeRect(x, y, w, h);
  }

  private drawEquipped(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.text(x + 14, y + 10, 'EQUIPPED', 14, PALETTE.textDim);
    const cardH = Math.min(118, (h - 40) / 4);
    SLOTS.forEach((slot, i) => {
      const cy = y + 34 + i * cardH;
      const it = profile.equipped[slot];
      this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
      this.gfx.lineBetween(x + 10, cy - 4, x + w - 10, cy - 4);
      this.text(x + 14, cy, SLOT_LABELS[slot], 11, PALETTE.textDim);
      if (!it) {
        this.text(x + 14, cy + 18, '(empty)', 15, PALETTE.textDim);
        return;
      }
      const col = RARITY_COLORS[it.rarity];
      this.gfx.fillStyle(col, 1);
      this.gfx.fillRect(x + 10, cy + 18, 3, 40);
      this.text(x + 22, cy + 16, baseOf(it).name, 16, col);
      this.text(x + 22, cy + 38, rarityLabel(it), 12, PALETTE.textDim);
      const lines = statLines(baseOf(it), it.rarity).slice(0, 3);
      this.text(x + 22, cy + 56, lines.map((l) => `${l.label} ${l.text}`).join('  '), 11, PALETTE.text).setWordWrapWidth(w - 36);
    });
  }

  private drawList(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.listRect = { x, y: y + 44, w, h: h - 52 };
    const heading =
      this.tab === 'carried' ? `CARRIED  ${runState.carried.length}/${profile.stats.carrySlots}` +
        (runState.carriedScrap > 0 ? `   +${runState.carriedScrap} scrap` : '')
      : this.tab === 'stash' ? `STASH  ${runState.stash.length}/${STASH_SLOTS}`
      : 'QUARTERMASTER  baseline gear for scrap';
    this.text(x + 14, y + 12, heading, 14, PALETTE.text);
    if (this.rows.length === 0) {
      const msg = this.tab === 'carried'
        ? 'Nothing carried. Gear you pick up in a run is lost if you die, until you extract it.'
        : this.tab === 'stash' ? 'The stash is empty. Extract (X in the room) to bank what you carry.' : 'Nothing for sale.';
      const t = this.text(x + 14, y + 52, msg, 13, PALETTE.textDim);
      t.setWordWrapWidth(w - 28);
      return;
    }
    this.keepVisible();
    const visible = Math.max(1, Math.floor(this.listRect.h / ROW_H));
    for (let i = 0; i < visible; i++) {
      const idx = this.scroll + i;
      const row = this.rows[idx];
      if (!row) break;
      const ry = this.listRect.y + i * ROW_H;
      this.rowHit.push({ y: ry, idx });
      const rarity = row.item ? row.item.rarity : row.shop!.rarity;
      const base = row.item ? baseOf(row.item) : row.shop!.base;
      const col = RARITY_COLORS[rarity];
      if (idx === this.sel) {
        this.gfx.fillStyle(col, 0.14);
        this.gfx.fillRect(x + 4, ry, w - 8, ROW_H - 2);
        this.gfx.lineStyle(1.5, 0xffffff, 0.9);
        this.gfx.strokeRect(x + 4, ry, w - 8, ROW_H - 2);
      }
      this.gfx.fillStyle(col, 1);
      this.gfx.fillRect(x + 10, ry + 6, 3, ROW_H - 14);
      this.text(x + 22, ry + 4, `${RARITY_LABELS[rarity]} ${base.name}`, 14, col);
      const lines = statLines(base, rarity).slice(0, 2).map((l) => `${l.label} ${l.text}`).join('   ');
      this.text(x + 22, ry + 22, lines, 11, PALETTE.textDim);
      const right = row.shop ? `${buyPrice(base, rarity)}` : SLOT_LABELS[base.slot];
      const rc = row.shop ? (canBuy(base.id, rarity) ? PALETTE.scrap : PALETTE.hostile) : PALETTE.textDim;
      this.text(x + w - 14, ry + 10, right, 13, rc, [1, 0]);
    }
    if (this.rows.length > visible) {
      const sh = (this.listRect.h * visible) / this.rows.length;
      const sy = this.listRect.y + (this.listRect.h - sh) * (this.scroll / (this.rows.length - visible));
      this.gfx.fillStyle(PALETTE.structureDim, 0.8);
      this.gfx.fillRect(x + w - 5, sy, 3, sh);
    }
  }

  private drawDetail(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    const row = this.current();
    if (!row) {
      this.text(x + 14, y + 14, 'NOTHING SELECTED', 14, PALETTE.textDim);
      return;
    }
    const rarity = row.item ? row.item.rarity : row.shop!.rarity;
    const base = row.item ? baseOf(row.item) : row.shop!.base;
    const col = RARITY_COLORS[rarity];
    this.text(x + 16, y + 14, base.name, 22, col);
    this.text(x + 16, y + 44, `${RARITY_LABELS[rarity]}  ${SLOT_LABELS[base.slot]}  (${base.family})`, 12, PALETTE.textDim);
    const d = this.text(x + 16, y + 68, base.desc, 13, PALETTE.text);
    d.setWordWrapWidth(w - 32);

    // Stat lines compared with what is equipped in that slot.
    const eq = profile.equipped[base.slot];
    const mine = eq ? new Map(statLines(baseOf(eq), eq.rarity).map((l) => [l.key, l])) : new Map<string, StatLine>();
    let ly = y + 68 + d.height + 18;
    this.text(x + 16, ly, 'STATS  vs equipped', 11, PALETTE.textDim);
    ly += 20;
    for (const l of statLines(base, rarity)) {
      this.text(x + 16, ly, l.label, 13, PALETTE.text);
      this.text(x + w - 130, ly, l.text, 13, PALETTE.white, [1, 0]);
      const m = mine.get(l.key);
      if (m && row.item !== eq) {
        const diff = l.value - m.value;
        if (Math.abs(diff) > 1e-6) {
          const better = l.higherBetter ? diff > 0 : diff < 0;
          const pct = m.value !== 0 ? Math.round((diff / Math.abs(m.value)) * 100) : 0;
          this.text(x + w - 16, ly, `${diff > 0 ? '+' : ''}${pct}%`, 13, better ? PALETTE.player : PALETTE.hostile, [1, 0]);
        }
      }
      ly += 22;
    }

    // Action buttons along the bottom.
    const btns = this.buttons();
    const bh = 34;
    let by = y + h - 16 - btns.length * (bh + 8) + 8;
    for (const b of btns) {
      const on = b.enabled;
      this.gfx.fillStyle(on ? 0x0b1f22 : 0x080e10, 1);
      this.gfx.fillRect(x + 16, by, w - 32, bh);
      this.gfx.lineStyle(1.5, on ? PALETTE.structure : PALETTE.textDim, on ? 0.9 : 0.4);
      this.gfx.strokeRect(x + 16, by, w - 32, bh);
      this.text(x + 28, by + 9, `[${b.key}]`, 13, on ? PALETTE.ammo : PALETTE.textDim);
      this.text(x + 96, by + 9, b.label, 13, on ? PALETTE.white : PALETTE.textDim);
      this.btns.push({ x: x + 16, y: by, w: w - 32, h: bh, btn: b });
      by += bh + 8;
    }
    if (row.shop) {
      this.text(x + 16, y + h - 16 - btns.length * (bh + 8) - 14, 'Epic and above is never for sale.', 11, PALETTE.textDim);
    }
  }
}
