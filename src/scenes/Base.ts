// The base. In 'hub' mode it is the screen between deployments: outfit your Aug, pick a mission,
// open the research and perk trees, deploy. In 'overlay' mode (dev test only) it opens over the
// paused room with B and shows just the outfit page, including carried items.
//
// Rules shown on the outfit page (design 5.5 and 6):
//  - equip from carried or stash; the replaced item takes its place;
//  - sell and dismantle only work on stashed items: the payout counts once you are back;
//  - the quartermaster sells baseline gear (Common and Uncommon) for Scrap.
//
// Everything is clickable. The screen is drawn in immediate mode: render() rebuilds the labels when
// state changes, and hover is a separate overlay so moving the mouse never rebuilds text.
import Phaser from 'phaser';
import { FONT, PALETTE, RARITY_COLORS, hex } from '../data/palette';
import { BASE_ITEMS, SLOTS, SLOT_LABELS, type BaseItem, type Slot } from '../data/items';
import { MISSIONS } from '../data/missions';
import { QM, RARITY_LABELS, STASH_SLOTS } from '../data/loot';
import { getSfx, type Sfx } from '../fx/audio';
import {
  buy, canBuy, dismantle, equip, move, profile, sell, stashFull, type Place,
} from '../game/profile';
import type { MissionResult } from '../game/mission';
import { runState } from '../game/runState';
import { TUNING as T } from '../data/tuning';
import { statLines, type StatLine } from '../sim/describe';
import { GUN_KITS, KIT_SLOTS, PART_NAMES } from '../data/gunKits';
import { pixGunKey, pixMagKey } from '../fx/pixGun';
import { baseOf, buyPrice, dismantleIntel, rarityLabel, sellValue, type Item } from '../sim/loot';
import { showCursor } from '../ui/cursor';
import { snapFont, snapText, uiIcon, uiPanel, type PanelKind } from '../ui/pixelUi';

type Txt = Phaser.GameObjects.Text;
type Mode = 'hub' | 'overlay';
type Page = 'outfit' | 'missions';
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

/** A clickable rectangle registered while drawing. */
interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  run: () => void;
  /** Disabled hits still react (to explain themselves) but do not highlight. */
  enabled?: boolean;
}

const HEADER_H = 84;
const FOOTER_H = 44;
const LEFT_W = 330;
const RIGHT_W = 380;
const BTN_GAP = 6; // gap between the detail panel's action buttons
const ROW_H = 40;
const PAGES: { id: Page | 'research' | 'perks'; label: string }[] = [
  { id: 'outfit', label: 'OUTFIT' },
  { id: 'missions', label: 'MISSIONS' },
  { id: 'research', label: 'RESEARCH' },
  { id: 'perks', label: 'PERKS' },
];

export class Base extends Phaser.Scene {
  private sfx!: Sfx;
  private mode: Mode = 'hub';
  private page: Page = 'outfit';
  private tab: TabId = 'stash';
  private slotFilter: Slot | null = null;
  private missionSel = 0;
  private result: MissionResult | null = null;
  private sel = 0;
  private scroll = 0;
  private rows: Row[] = [];
  private pendingConfirm = '';
  private toast = '';
  private toastColor: number = PALETTE.text;
  private deploying = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private hits: Hit[] = [];
  private hover = '';
  private btns: Btn[] = [];
  private listRect = { x: 0, y: 0, w: 0, h: 0 };

  constructor() {
    super('Base');
  }

  init(data: { mode?: Mode; sfx?: Sfx; result?: MissionResult; page?: Page }): void {
    this.mode = data.mode ?? 'hub';
    this.sfx = data.sfx ?? getSfx();
    this.result = data.result ?? null;
    this.page = data.page ?? (this.result ? 'missions' : 'outfit');
    this.slotFilter = null;
    this.tab = this.mode === 'overlay' ? 'carried' : runState.stash.length > 0 ? 'stash' : 'shop';
    this.sel = 0;
    this.scroll = 0;
    this.missionSel = 0;
    this.pendingConfirm = '';
    this.toast = '';
    this.deploying = false;
    this.hover = '';
  }

  create(): void {
    showCursor(this, true);
    this.add.rectangle(0, 0, 4000, 4000, PALETTE.bg, 1).setOrigin(0, 0).setDepth(0);
    this.gfx = this.add.graphics().setDepth(1);
    this.hoverGfx = this.add.graphics().setDepth(4);
    this.keys = this.input.keyboard!.addKeys(
      'UP,DOWN,LEFT,RIGHT,ENTER,SPACE,E,M,S,D,R,P,O,ONE,TWO,THREE,TAB,ESC,B',
    ) as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.on('pointerdown', this.onClick, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('wheel', this.onWheel, this);
    this.input.on('gameout', this.clearHover, this);
    this.scale.on('resize', this.render, this);
    this.events.on('resume', this.onResume, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onClick, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('wheel', this.onWheel, this);
      this.input.off('gameout', this.clearHover, this);
      this.scale.off('resize', this.render, this);
      this.events.off('resume', this.onResume, this);
    });
    if (this.mode === 'hub') this.cameras.main.fadeIn(300, 2, 6, 8);
    this.render();
  }

  private onResume(): void {
    this.input.keyboard!.resetKeys();
    showCursor(this, true);
    this.render();
  }

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------

  private tabs(): { id: TabId; label: string }[] {
    const out: { id: TabId; label: string }[] = [];
    if (this.mode === 'overlay' || runState.carried.length > 0) out.push({ id: 'carried', label: `CARRIED ${runState.carried.length}/${profile.stats.carrySlots}` });
    out.push({ id: 'stash', label: `STASH ${runState.stash.length}/${STASH_SLOTS}` });
    out.push({ id: 'shop', label: 'QUARTERMASTER' });
    return out;
  }

  private buildRows(): Row[] {
    const keep = (base: BaseItem): boolean => !this.slotFilter || base.slot === this.slotFilter;
    if (this.tab === 'carried') return runState.carried.filter((i) => keep(baseOf(i))).map((item) => ({ item }));
    if (this.tab === 'stash') return runState.stash.filter((i) => keep(baseOf(i))).map((item) => ({ item }));
    const out: Row[] = [];
    for (const base of BASE_ITEMS) {
      if (base.price === 0 || !keep(base)) continue; // the starting kit is not for sale
      for (let r = 0; r <= QM.maxRarity; r++) out.push({ shop: { base, rarity: r } });
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

  /** Valuable items need the action twice. */
  private confirmed(kind: string, item: Item, run: () => void): void {
    const tag = `${kind}:${item.id}`;
    if (item.rarity >= 3 && this.pendingConfirm !== tag) {
      this.pendingConfirm = tag;
      this.say(`${kind === 'sell' ? 'Sell' : 'Dismantle'} ${rarityLabel(item)} ${baseOf(item).name}? Do it again to confirm.`, PALETTE.ammo);
      this.sfx.empty();
      this.render();
      return;
    }
    this.pendingConfirm = '';
    run();
  }

  private after(): void {
    this.render();
  }

  private doEquip(item: Item, from: Place): void {
    equip(item, from);
    this.say(`Equipped ${rarityLabel(item)} ${baseOf(item).name}`, RARITY_COLORS[item.rarity]);
    this.sfx.pickup(item.rarity);
    this.after();
  }

  private doMove(item: Item, from: Place): void {
    if (!move(item, from)) {
      this.say(from === 'carried' ? 'Stash is full' : 'Pack is full', PALETTE.hostile);
      this.sfx.empty();
    } else {
      this.say(from === 'carried' ? 'Moved to the stash' : 'Taken into the pack');
      this.sfx.step();
    }
    this.after();
  }

  private doSell(item: Item): void {
    const n = sell(item);
    this.say(`Sold ${baseOf(item).name} for ${n} scrap`, PALETTE.scrap);
    this.sfx.pickup(2);
    this.after();
  }

  private doDismantle(item: Item): void {
    const fam = baseOf(item).family;
    const n = dismantle(item);
    this.say(`Dismantled ${baseOf(item).name}: +${n} Intel  (${fam} analysis ${profile.analysis[fam]})`, PALETTE.robot);
    this.sfx.pickup(3);
    this.after();
  }

  private doBuy(base: BaseItem, rarity: number): void {
    const it = buy(base.id, rarity);
    if (!it) {
      this.say(stashFull() ? 'Stash is full' : 'Not enough scrap', PALETTE.hostile);
      this.sfx.empty();
    } else {
      this.say(`Bought ${RARITY_LABELS[rarity]} ${base.name} (in the stash)`, RARITY_COLORS[rarity]);
      this.sfx.pickup(rarity);
    }
    this.after();
  }

  private deny(b: Btn): void {
    this.sfx.empty();
    if (b.key === 'S' || b.key === 'D') this.say('Bank it in the stash first: only stashed items can be sold or dismantled.', PALETTE.hostile);
    else if (b.key === 'M') this.say(this.tab === 'stash' ? 'Your pack is full.' : 'The stash is full.', PALETTE.hostile);
    else if (b.key === 'ENTER') this.say(stashFull() ? 'The stash is full.' : 'Not enough scrap.', PALETTE.hostile);
    this.render();
  }

  private setPage(p: Page): void {
    if (p === this.page) return;
    this.page = p;
    this.result = null;
    this.pendingConfirm = '';
    this.toast = '';
    this.sfx.step();
    this.render();
  }

  private openTree(tab: 'research' | 'perks'): void {
    this.sfx.step();
    this.scene.pause();
    this.scene.launch('Tree', { sfx: this.sfx, tab, returnTo: 'Base' });
    this.scene.bringToTop('Tree');
  }

  private deploy(): void {
    const m = MISSIONS[this.missionSel];
    if (this.deploying) return;
    if (m.locked) {
      this.sfx.empty();
      this.say(m.locked, PALETTE.hostile);
      this.render();
      return;
    }
    this.deploying = true;
    this.sfx.pickup(4);
    this.cameras.main.fadeOut(350, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('FeelTest', { mode: 'mission', missionId: m.id }));
  }

  private toTitle(): void {
    if (this.deploying) return;
    this.deploying = true;
    this.cameras.main.fadeOut(220, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  private closeOverlay(): void {
    showCursor(this, false);
    this.scene.resume('FeelTest');
    this.scene.stop();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------

  update(): void {
    if (this.deploying) return;
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (this.mode === 'overlay') {
      if (K.JustDown(k.ESC) || K.JustDown(k.B)) return this.closeOverlay();
      if (K.JustDown(k.TAB)) {
        this.scene.stop();
        this.scene.launch('Tree', { sfx: this.sfx });
        this.scene.bringToTop('Tree');
        return;
      }
    } else {
      if (K.JustDown(k.ESC)) return this.toTitle();
      if (K.JustDown(k.TAB)) return this.setPage(this.page === 'outfit' ? 'missions' : 'outfit');
      if (K.JustDown(k.R)) return this.openTree('research');
      if (K.JustDown(k.P)) return this.openTree('perks');
    }
    if (this.page === 'missions') return this.updateMissions();
    this.updateOutfit();
  }

  private updateMissions(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (K.JustDown(k.UP)) this.selectMission(this.missionSel - 1);
    if (K.JustDown(k.DOWN)) this.selectMission(this.missionSel + 1);
    if (K.JustDown(k.ENTER) || K.JustDown(k.SPACE)) this.deploy();
    if (K.JustDown(k.O)) this.setPage('outfit');
  }

  private selectMission(i: number): void {
    const n = Phaser.Math.Clamp(i, 0, MISSIONS.length - 1);
    if (n === this.missionSel) return;
    this.missionSel = n;
    this.toast = '';
    this.sfx.step();
    this.render();
  }

  private updateOutfit(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    const tabs = this.tabs();
    const ti = tabs.findIndex((t) => t.id === this.tab);
    if (K.JustDown(k.ONE) && tabs[0]) this.setTab(tabs[0].id);
    if (K.JustDown(k.TWO) && tabs[1]) this.setTab(tabs[1].id);
    if (K.JustDown(k.THREE) && tabs[2]) this.setTab(tabs[2].id);
    if (K.JustDown(k.LEFT)) this.setTab(tabs[(ti + tabs.length - 1) % tabs.length].id);
    if (K.JustDown(k.RIGHT)) this.setTab(tabs[(ti + 1) % tabs.length].id);
    if (K.JustDown(k.UP)) this.select(this.sel - 1);
    if (K.JustDown(k.DOWN)) this.select(this.sel + 1);
    for (const b of this.buttons()) {
      const pressed = b.key === 'ENTER' ? K.JustDown(k.ENTER) : K.JustDown(k[b.key]);
      if (pressed) {
        if (b.enabled) b.run();
        else this.deny(b);
      }
    }
  }

  private setTab(t: TabId): void {
    if (t === this.tab) return;
    this.tab = t;
    this.sel = 0;
    this.scroll = 0;
    this.pendingConfirm = '';
    this.toast = '';
    this.sfx.step();
    this.render();
  }

  private setFilter(slot: Slot | null): void {
    this.slotFilter = this.slotFilter === slot ? null : slot;
    this.sel = 0;
    this.scroll = 0;
    this.sfx.step();
    this.render();
  }

  private select(i: number): void {
    if (this.rows.length === 0) return;
    const n = Phaser.Math.Clamp(i, 0, this.rows.length - 1);
    if (n !== this.sel) this.sfx.step();
    this.sel = n;
    this.pendingConfirm = '';
    this.keepVisible();
    this.render();
  }

  private visibleRows(): number {
    return Math.max(1, Math.floor(this.listRect.h / ROW_H));
  }

  private keepVisible(): void {
    const visible = this.visibleRows();
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + visible) this.scroll = this.sel - visible + 1;
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    if (this.page !== 'outfit' || this.deploying) return;
    const max = Math.max(0, this.rows.length - this.visibleRows());
    const next = Phaser.Math.Clamp(this.scroll + (dy > 0 ? 1 : -1), 0, max);
    if (next === this.scroll) return;
    this.scroll = next;
    this.render();
  }

  private hitAt(x: number, y: number): Hit | undefined {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return undefined;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.deploying) return;
    const h = this.hitAt(p.x, p.y);
    const id = h ? h.id : '';
    this.input.setDefaultCursor(h && h.enabled !== false ? 'pointer' : 'default');
    if (id === this.hover) return;
    this.hover = id;
    this.drawHover();
  }

  private clearHover(): void {
    this.hover = '';
    this.drawHover();
  }

  private onClick(p: Phaser.Input.Pointer): void {
    if (this.deploying) return;
    this.hitAt(p.x, p.y)?.run();
  }

  private drawHover(): void {
    const g = this.hoverGfx;
    g.clear();
    const h = this.hits.find((o) => o.id === this.hover);
    if (!h || h.enabled === false) return;
    g.fillStyle(0xffffff, 0.06);
    g.fillRect(h.x, h.y, h.w, h.h);
    g.lineStyle(1.5, PALETTE.structure, 0.9);
    g.strokeRect(h.x, h.y, h.w, h.h);
  }

  // ------------------------------------------------------------------
  // Drawing
  // ------------------------------------------------------------------

  private text(x: number, y: number, s: string, size: number, color: number, origin: [number, number] = [0, 0]): Txt {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${snapFont(size)}px`, color: hex(color) })
      .setResolution(1)
      .setOrigin(origin[0], origin[1])
      .setDepth(5);
    snapText(t);
    this.dyn.push(t);
    return t;
  }

  /** A Waste No Space 9-slice box behind the text and lines (depth 0.5, under the Graphics at 1). */
  private box(kind: PanelKind, x: number, y: number, w: number, h: number, alpha = 1, tint?: number): Phaser.GameObjects.NineSlice {
    const n = uiPanel(this, kind, Math.round(x), Math.round(y), w, h).setDepth(0.5).setAlpha(alpha);
    if (tint !== undefined) n.setTint(tint);
    this.dyn.push(n);
    return n;
  }

  private hit(id: string, x: number, y: number, w: number, h: number, run: () => void, enabled = true): void {
    this.hits.push({ id, x, y, w, h, run, enabled });
  }

  private panel(x: number, y: number, w: number, h: number): void {
    this.box('panel', x, y, w, h, T.ui.panelAlpha);
  }

  private render(): void {
    if (!this.gfx) return;
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.hits = [];
    this.rows = this.buildRows();
    this.sel = Phaser.Math.Clamp(this.sel, 0, Math.max(0, this.rows.length - 1));
    if (!this.tabs().some((t) => t.id === this.tab)) this.tab = 'stash';

    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.gfx;
    g.clear();

    this.drawChrome(w, h);
    let top = HEADER_H + 14;
    if (this.result) {
      this.drawResult(24, top, w - 48);
      top += 50;
    }
    const ch = h - FOOTER_H - top - 14;
    if (this.page === 'missions') this.drawMissions(24, top, w - 48, ch);
    else this.drawOutfit(24, top, w - 48, ch);
    this.drawHover();
  }

  private drawChrome(w: number, h: number): void {
    // Header and footer are panels pushed past the screen edge so only the inner border shows.
    this.box('panel', -12, -12, w + 24, HEADER_H + 12);
    this.box('panel', -12, h - FOOTER_H, w + 24, FOOTER_H + 12);
    this.text(24, 14, this.mode === 'hub' ? '| BASE |' : '| OUTFIT |', 26, PALETTE.text);

    if (this.mode === 'hub') {
      let tx = 26;
      for (const p of PAGES) {
        const on = p.id === this.page;
        const tt = this.text(tx + 16, on ? 56 : 58, p.label, 16, on ? PALETTE.white : PALETTE.textDim);
        const id = p.id;
        // The tab sits on the header's lower border; the active one stands a little taller.
        this.box(on ? 'tab_sel' : 'tab_un', tx, on ? 44 : 48, tt.width + 32, on ? 42 : 38);
        this.hit(`page:${id}`, tx, 44, tt.width + 32, 42, () => {
          if (id === 'research' || id === 'perks') this.openTree(id);
          else this.setPage(id);
        });
        tx += tt.width + 40;
      }
      const t = this.text(w - 42, 55, '< TITLE  [ESC]', 16, PALETTE.text, [1, 0]);
      this.box('btn', w - 24 - t.width - 36, 44, t.width + 36, 38);
      this.hit('title', w - 24 - t.width - 36, 44, t.width + 36, 38, () => this.toTitle());
    }
    const intel = this.text(w - 24, 14, `INTEL ${profile.intel}`, 16, PALETTE.robot, [1, 0]);
    this.text(w - 24 - intel.width - 28, 14, `SCRAP ${profile.scrap}`, 16, PALETTE.scrap, [1, 0]);

    const hint = this.mode === 'overlay'
      ? 'LEFT/RIGHT tabs   UP/DOWN select   E equip   M move   S sell   D dismantle   TAB trees   ESC close'
      : this.page === 'missions'
        ? 'UP/DOWN select   ENTER deploy   O outfit   TAB page   R research   P perks   ESC title'
        : 'LEFT/RIGHT tabs   UP/DOWN select   E equip   M move   S sell   D dismantle   TAB missions   R research   P perks   ESC title';
    this.text(24, h - 14, hint, 12, PALETTE.textDim, [0, 1]);
    if (this.toast) this.text(w - 24, h - 14, this.toast, 13, this.toastColor, [1, 1]);
  }

  private drawResult(x: number, y: number, w: number): void {
    const r = this.result!;
    const g = this.gfx;
    const color = r.outcome === 'extracted' ? PALETTE.player : PALETTE.hostile;
    this.box('field', x, y, w, 42, 1, color);
    g.fillStyle(color, 1);
    g.fillRect(x + 6, y + 6, 4, 30);
    const head = r.outcome === 'extracted' ? 'EXTRACTED' : r.outcome === 'lost' ? 'AUG LOST' : 'MISSION ABORTED';
    const bits: string[] = [];
    if (r.outcome === 'extracted') {
      bits.push(r.items > 0 ? `${r.items} item${r.items > 1 ? 's' : ''} banked` : 'nothing banked');
      if (r.scrap > 0) bits.push(`+${r.scrap} scrap`);
    } else {
      bits.push(r.lost > 0 ? `${r.lost} carried item${r.lost > 1 ? 's' : ''} lost` : 'nothing carried');
      if (r.outcome === 'lost') bits.push('a new Aug has regrown at the base');
    }
    if (r.intel > 0) bits.push(`+${r.intel} Intel`);
    if (r.wave > 0) bits.push(`reached wave ${r.wave}`);
    this.text(x + 22, y + 13, head, 16, color);
    this.text(x + 22 + 170, y + 14, bits.join('   '), 12, PALETTE.text);
    const ico = uiIcon(this, 'close', x + w - 34, y + 10).setDepth(5);
    this.dyn.push(ico);
    this.hit('result', x + w - 44, y, 44, 42, () => {
      this.result = null;
      this.sfx.step();
      this.render();
    });
  }

  // ---- outfit page ---------------------------------------------------------------------------

  private drawOutfit(x: number, y: number, w: number, h: number): void {
    this.drawEquipped(x, y, LEFT_W, h);
    const lx = x + LEFT_W + 20;
    const lw = Math.max(240, w - LEFT_W - RIGHT_W - 40);
    this.drawList(lx, y, lw, h);
    this.drawDetail(x + w - RIGHT_W, y, RIGHT_W, h);
  }

  private drawEquipped(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.text(x + 14, y + 10, 'EQUIPPED', 14, PALETTE.textDim);
    this.text(x + w - 14, y + 12, this.slotFilter ? 'click to clear filter' : 'click a slot to filter', 11, PALETTE.textDim, [1, 0]);
    const cardH = Math.min(118, (h - 40) / 4);
    SLOTS.forEach((slot, i) => {
      const cy = y + 34 + i * cardH;
      const it = profile.equipped[slot];
      const on = this.slotFilter === slot;
      if (on) {
        this.box('btn_hover', x + 8, cy - 6, w - 16, cardH - 2, 1);
      } else {
        this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
        this.gfx.lineBetween(x + 10, cy - 4, x + w - 10, cy - 4);
      }
      this.hit(`slot:${slot}`, x + 6, cy - 6, w - 12, cardH - 2, () => this.setFilter(slot));
      this.text(x + 14, cy, SLOT_LABELS[slot], 11, on ? PALETTE.structure : PALETTE.textDim);
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
    // Sub-tabs.
    let tx = x + 14;
    for (const t of this.tabs()) {
      const on = t.id === this.tab;
      const tt = this.text(tx + 14, y + 17, t.label, 12, on ? PALETTE.white : PALETTE.textDim);
      this.box(on ? 'tab_sel' : 'tab_un', tx, y + 8, tt.width + 28, on ? 32 : 28);
      this.hit(`tab:${t.id}`, tx, y + 8, tt.width + 28, 32, () => this.setTab(t.id));
      tx += tt.width + 36;
    }
    if (this.slotFilter) {
      this.text(x + w - 18, y + 16, `filter: ${SLOT_LABELS[this.slotFilter]}`, 12, PALETTE.structure, [1, 0]);
    } else if (this.tab === 'carried' && runState.carriedScrap > 0) {
      this.text(x + w - 18, y + 16, `+${runState.carriedScrap} scrap carried`, 12, PALETTE.scrap, [1, 0]);
    }
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(x + 8, y + 40, x + w - 8, y + 40);

    if (this.rows.length === 0) {
      const f = this.slotFilter ? ' for this slot' : '';
      const msg = this.tab === 'carried'
        ? `Nothing carried${f}. Gear you pick up in a run is lost if you die, until you extract it.`
        : this.tab === 'stash'
          ? `The stash is empty${f}. Extract from a mission to bank what you carry, or buy baseline gear from the quartermaster.`
          : 'Nothing for sale.';
      const t = this.text(x + 14, y + 54, msg, 13, PALETTE.textDim);
      t.setWordWrapWidth(w - 28);
      return;
    }
    this.keepVisible();
    const visible = this.visibleRows();
    for (let i = 0; i < visible; i++) {
      const idx = this.scroll + i;
      const row = this.rows[idx];
      if (!row) break;
      const ry = this.listRect.y + i * ROW_H;
      const rarity = row.item ? row.item.rarity : row.shop!.rarity;
      const base = row.item ? baseOf(row.item) : row.shop!.base;
      const col = RARITY_COLORS[rarity];
      this.hit(`row:${idx}`, x + 4, ry, w - 8, ROW_H - 2, () => this.select(idx));
      if (idx === this.sel) {
        this.box('btn_hover', x + 8, ry, w - 16, ROW_H - 2, 1).setDepth(0.6);
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
    let dy = y + 64;
    const kit = base.slot === 'primary' && base.weapon ? GUN_KITS[base.weapon.shape] : undefined;
    if (kit && base.weapon) dy = this.drawGunSchematic(x + 16, dy, w - 32, base.weapon.shape, kit, col) + 8;
    const d = this.text(x + 16, dy, base.desc, 13, PALETTE.text);
    d.setWordWrapWidth(w - 32);

    // Buttons sit at the bottom; the stat lines get whatever room is left above them.
    this.btns = this.buttons();
    const bh = 32;
    const btnTop = y + h - 16 - this.btns.length * (bh + BTN_GAP) + BTN_GAP;

    // Stat lines compared with what is equipped in that slot.
    const eq = profile.equipped[base.slot];
    const mine = eq ? new Map(statLines(baseOf(eq), eq.rarity).map((l) => [l.key, l])) : new Map<string, StatLine>();
    let ly = dy + d.height + 18;
    this.text(x + 16, ly, 'STATS  vs equipped', 11, PALETTE.textDim);
    ly += 17;
    const lines = statLines(base, rarity);
    // Weapons carry a lot of stats: squeeze the row spacing to fit above the buttons.
    const bottom = btnTop - 24;
    const lh = Math.max(14, Math.min(22, (bottom - ly) / lines.length));
    const fs = lh < 15 ? 11 : lh < 18 ? 12 : 13;
    for (const l of lines) {
      this.text(x + 16, ly, l.label, fs, PALETTE.text);
      this.text(x + w - 130, ly, l.text, fs, PALETTE.white, [1, 0]);
      const m = mine.get(l.key);
      if (m && row.item !== eq) {
        const diff = l.value - m.value;
        if (Math.abs(diff) > 1e-6) {
          const better = l.higherBetter ? diff > 0 : diff < 0;
          const pct = m.value !== 0 ? Math.round((diff / Math.abs(m.value)) * 100) : 0;
          this.text(x + w - 16, ly, `${diff > 0 ? '+' : ''}${pct}%`, fs, better ? PALETTE.player : PALETTE.hostile, [1, 0]);
        }
      }
      ly += lh;
    }

    // Action buttons along the bottom.
    let by = btnTop;
    for (const b of this.btns) {
      const on = b.enabled;
      this.box(on ? 'btn' : 'btn_dis', x + 16, by, w - 32, bh);
      this.text(x + 28, by + 9, `[${b.key}]`, 12, on ? PALETTE.ammo : PALETTE.textDim);
      this.text(x + 96, by + 9, b.label, 13, on ? PALETTE.white : PALETTE.textDim);
      this.hit(`btn:${b.key}`, x + 16, by, w - 32, bh, () => (b.enabled ? b.run() : this.deny(b)), b.enabled);
      by += bh + BTN_GAP;
    }
    if (row.shop) {
      this.text(x + 16, btnTop - 16, 'Epic and above is never for sale.', 11, PALETTE.textDim);
    }
  }

  /**
   * The pixel gun beside its mod slots: receiver, barrel, optic and stock, each with the part fitted.
   * Returns the y below the block.
   */
  private drawGunSchematic(x: number, y: number, w: number, shape: string, kit: (typeof GUN_KITS)[string], col: number): number {
    const sc = 2;
    const gw = 64 * sc;
    const rowH = 15;
    const rows: { label: string; part?: string }[] = [
      ...KIT_SLOTS.map((slot) => ({ label: slot.label, part: kit[slot.key] })),
      { label: 'MAGAZINE', part: kit.mag.part },
    ];
    const bh = rows.length * rowH + 8;
    this.box('field', x, y, w, bh, 1);
    this.gfx.fillStyle(col, 1);
    this.gfx.fillRect(x + 6, y + 6, 3, bh - 12);
    const ix = x + 8;
    const iy = y + (bh - 32 * sc) / 2;
    const mag = this.add.image(ix + kit.mag.x * sc, iy + kit.mag.y * sc, pixMagKey(shape)).setOrigin(0, 0).setScale(sc).setDepth(5);
    const img = this.add.image(ix, iy, pixGunKey(shape)).setOrigin(0, 0).setScale(sc).setDepth(5);
    this.dyn.push(mag, img);
    const cx = x + gw + 24;
    rows.forEach((r, i) => {
      const ry = y + 5 + i * rowH;
      this.text(cx, ry + 3, r.label, 8, PALETTE.textDim);
      this.text(x + w - 8, ry, r.part ? (PART_NAMES[r.part] ?? r.part) : 'none', 12, r.part ? PALETTE.text : PALETTE.textDim, [1, 0]);
      if (i < rows.length - 1) {
        this.gfx.lineStyle(1, PALETTE.structureDim, 0.35);
        this.gfx.lineBetween(cx, ry + 12, x + w - 8, ry + 12);
      }
    });
    return y + bh;
  }

  // ---- missions page -------------------------------------------------------------------------

  private drawMissions(x: number, y: number, w: number, h: number): void {
    const listW = Math.min(380, Math.floor(w * 0.36));
    this.panel(x, y, listW, h);
    this.text(x + 14, y + 12, 'MISSIONS', 14, PALETTE.textDim);
    const cardH = 92;
    MISSIONS.forEach((m, i) => {
      const cy = y + 40 + i * (cardH + 10);
      const on = i === this.missionSel;
      const locked = !!m.locked;
      this.box(on ? 'btn_hover' : 'field', x + 8, cy, listW - 16, cardH, locked ? 0.7 : 1);
      if (on) {
        this.gfx.fillStyle(PALETTE.structure, 1);
        this.gfx.fillRect(x + 14, cy + 6, 4, cardH - 12);
      }
      this.hit(`mission:${i}`, x + 8, cy, listW - 16, cardH, () => this.selectMission(i), true);
      this.text(x + 26, cy + 12, m.name, 22, locked ? PALETTE.textDim : PALETTE.white);
      this.text(x + 26, cy + 42, m.tag, 12, PALETTE.textDim);
      this.text(x + 26, cy + 64, locked ? 'LOCKED' : 'AVAILABLE', 12, locked ? PALETTE.hostile : PALETTE.player);
    });

    const dx = x + listW + 20;
    const dw = w - listW - 20;
    this.panel(dx, y, dw, h);
    const m = MISSIONS[this.missionSel];
    const locked = !!m.locked;
    this.text(dx + 22, y + 18, m.name, 34, locked ? PALETTE.textDim : PALETTE.white);
    this.text(dx + 22, y + 62, m.tag, 13, PALETTE.textDim);
    const body = this.text(dx + 22, y + 90, m.blurb, 14, PALETTE.text);
    body.setWordWrapWidth(dw - 44);
    let ly = y + 90 + body.height + 18;
    this.text(dx + 22, ly, 'THREATS', 11, PALETTE.textDim);
    this.text(dx + 120, ly - 1, m.threats, 13, PALETTE.text);
    ly += 24;
    this.text(dx + 22, ly, 'REWARDS', 11, PALETTE.textDim);
    this.text(dx + 120, ly - 1, m.rewards, 13, PALETTE.text);
    ly += 38;

    // Loadout: what goes out the door. Click a row to change it.
    this.text(dx + 22, ly, 'LOADOUT  (click to change)', 11, PALETTE.textDim);
    ly += 22;
    for (const slot of SLOTS) {
      const it = profile.equipped[slot];
      this.hit(`load:${slot}`, dx + 14, ly - 4, dw - 28, 30, () => {
        this.slotFilter = slot;
        this.tab = runState.stash.length > 0 ? 'stash' : 'shop';
        this.sel = 0;
        this.scroll = 0;
        this.setPage('outfit');
      });
      this.text(dx + 22, ly + 2, SLOT_LABELS[slot], 11, PALETTE.textDim);
      if (it) {
        this.text(dx + 120, ly, `${rarityLabel(it)} ${baseOf(it).name}`, 14, RARITY_COLORS[it.rarity]);
        const s = statLines(baseOf(it), it.rarity).slice(0, 2).map((l) => `${l.label} ${l.text}`).join('   ');
        this.text(dx + dw - 22, ly + 2, s, 11, PALETTE.textDim, [1, 0]);
      } else {
        this.text(dx + 120, ly, '(empty)', 14, PALETTE.textDim);
      }
      ly += 30;
    }

    // Deploy.
    const bh = 54;
    const by = y + h - bh - 22;
    this.text(dx + 22, by - 40, locked ? m.locked! : 'Carried loot is lost if you die. Extract with X to bank it.', 12, locked ? PALETTE.hostile : PALETTE.textDim).setWordWrapWidth(dw - 44);
    this.box(locked ? 'btn_dis' : 'btn_hover', dx + 22, by, dw - 44, bh);
    this.text(dx + dw / 2, by + bh / 2, locked ? 'SEALED' : 'DEPLOY  [ENTER]', 22, locked ? PALETTE.textDim : PALETTE.white, [0.5, 0.5]);
    this.hit('deploy', dx + 22, by, dw - 44, bh, () => this.deploy(), !locked);
  }
}
