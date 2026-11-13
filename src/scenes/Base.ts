// The base. In 'hub' mode it is the screen between deployments: a permanent menu rail on the left
// (Base, Deploy, Armory, Quartermaster, Perks, Research) and the page for the chosen entry beside it.
// Every page but Base and Deploy has the same shape: a left panel for context, a list in the middle
// and a detail panel with action buttons on the right. In 'overlay' mode (dev test only) it opens
// over the paused room with B and shows just the armory page, including the run's haul.
//
// Rules shown on the armory page (design 5.5 and 6):
//  - equip from carried or stash; the replaced item takes its place;
//  - sell and dismantle only work on stashed items: the payout counts once you are back;
//  - the stash has no cap;
//  - the quartermaster sells baseline gear (Common and Uncommon) for Scrap.
//
// Deploy is one screen: swap gear on the left, choose a bunker on the right, go.
//
// Everything is clickable. The screen is drawn in immediate mode: render() rebuilds the labels when
// state changes, and hover is a separate overlay so moving the mouse never rebuilds text.
import Phaser from 'phaser';
import { FONT, PALETTE, RARITY_COLORS, TREE_TINTS, hex } from '../data/palette';
import { BASE_ITEMS, SLOTS, SLOT_LABELS, type BaseItem, type Slot } from '../data/items';
import { BUNKERS } from '../data/missions';
import { NODE_BY_ID, ROOT_IDS, STAT_LABELS, TREE_LABELS, TREE_NODES, type Effect, type StatKey, type TreeId, type TreeNode } from '../data/tree';
import { drawIcon } from '../fx/treeIcons';
import { QM, RARITY_LABELS } from '../data/loot';
import { MOBS } from '../data/mobs';
import { getSfx, type Sfx } from '../fx/audio';
import { buy, canBuy, dismantle, equip, freshHaul, keepHaul, move, profile, sell, tryUnlock, type Place } from '../game/profile';
import type { MissionResult } from '../game/mission';
import { beginRun } from '../game/run';
import { runState } from '../game/runState';
import { TUNING as T } from '../data/tuning';
import { statLines, type StatLine } from '../sim/describe';
import { resolveStats, type Loadout } from '../sim/stats';
import { checkUnlock } from '../sim/tree';
import { GUN_KITS, KIT_SLOTS, PART_NAMES } from '../data/gunKits';
import { pixGunKey, pixMagKey } from '../fx/pixGun';
import { baseOf, buyPrice, dismantleIntel, rarityLabel, sellValue, type Item } from '../sim/loot';
import { showCursor } from '../ui/cursor';
import { snapFont, snapText, uiIcon, uiPanel, type PanelKind } from '../ui/pixelUi';

type Txt = Phaser.GameObjects.Text;
type Mode = 'hub' | 'overlay';
type Page = 'home' | 'deploy' | 'armory' | 'quartermaster' | 'perks' | 'research';
type TabId = 'haul' | 'carried' | 'stash' | 'shop' | 'avail' | 'locked' | 'owned';
type Focus = 'loadout' | 'bunker';

interface Row {
  item?: Item; // carried or stash
  shop?: { base: BaseItem; rarity: number };
  node?: TreeNode; // a perk or research node
}

/** A gear candidate on the deploy screen. `from` is null for the item already equipped. */
interface Cand {
  item: Item;
  from: Place | null;
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

interface NavEntry {
  id: Page;
  label: string;
  /** One line under the label; `hot` colours it as something waiting for you. */
  sub: () => { text: string; hot?: boolean };
}

/** A suggestion on the Base page. */
interface NextStep {
  page: Page;
  label: string;
  sub: string;
}

const HEADER_H = 64;
const FOOTER_H = 44;
const RAIL_W = 200;
const LEFT_W = 330;
const RIGHT_W = 380;
const BTN_GAP = 6; // gap between the detail panel's action buttons
const ROW_H = 40;

/** What each Perk or Research node can do for you right now. */
const nodeState = (n: TreeNode): 'owned' | 'avail' | 'locked' =>
  profile.unlocked.has(n.id) ? 'owned' : !n.requires || profile.unlocked.has(n.requires) ? 'avail' : 'locked';
const treeNodes = (tree: TreeId): TreeNode[] => TREE_NODES.filter((n) => n.tree === tree && !ROOT_IDS.includes(n.id));
const affordable = (tree: TreeId): number => treeNodes(tree).filter((n) => nodeState(n) === 'avail' && profile.intel >= n.cost).length;

const NAV: readonly NavEntry[] = [
  { id: 'home', label: 'BASE', sub: () => ({ text: 'Where you stand' }) },
  { id: 'deploy', label: 'DEPLOY', sub: () => ({ text: `${profile.claimed.size}/${BUNKERS.length} bunkers claimed` }) },
  {
    id: 'armory', label: 'ARMORY',
    sub: () => {
      const n = freshHaul().length;
      return n > 0 ? { text: `${n} new in the haul`, hot: true } : { text: `${runState.stash.length} in the stash` };
    },
  },
  { id: 'quartermaster', label: 'QUARTERMASTER', sub: () => ({ text: `${profile.scrap} scrap to spend` }) },
  {
    id: 'perks', label: 'PERKS',
    sub: () => { const n = affordable('perks'); return n > 0 ? { text: `${n} you can unlock`, hot: true } : { text: 'Lasting bonuses' }; },
  },
  {
    id: 'research', label: 'RESEARCH',
    sub: () => { const n = affordable('research'); return n > 0 ? { text: `${n} you can unlock`, hot: true } : { text: 'New capabilities' }; },
  },
];

function fmtEffect(e: Effect): string {
  const parts: string[] = [];
  if (e.add) parts.push(`${e.add > 0 ? '+' : ''}${e.add}`);
  if (e.pct) parts.push(`${e.pct > 0 ? '+' : ''}${Math.round(e.pct * 100)}%`);
  return `${parts.join(' ')} ${STAT_LABELS[e.stat]}`;
}

/** An effective stat for the Aug panel. */
function fmtStat(k: StatKey, v: number): string {
  switch (k) {
    case 'salvage': case 'intelGain': case 'bladeRefund': case 'activeWidth':
      return `${Math.round(v * 100)}%`;
    case 'shieldRegenDelay': case 'dashCooldown': case 'reloadTime': case 'bladeCooldown':
      return `${v.toFixed(2)}s`;
    case 'spread':
      return `${v.toFixed(1)} deg`;
    case 'hull': case 'shield': case 'moveSpeed': case 'magSize': case 'reserveMax': case 'magnetRadius': case 'bladeReach':
      return String(Math.round(v));
    default:
      return v.toFixed(1);
  }
}

/** Stats listed on the Aug panel, in this order. Lower is better for these. */
const AUG_STATS: readonly StatKey[] = [
  'hull', 'shield', 'shieldRegenRate', 'shieldRegenDelay', 'moveSpeed', 'dashCooldown',
  'gunDamage', 'spread', 'reloadTime', 'activeWidth', 'magSize', 'reserveMax',
  'bladeDamage', 'bladeCooldown', 'bladeReach', 'bladeRefund', 'magnetRadius', 'intelGain', 'salvage',
];
const LOWER_IS_BETTER: ReadonlySet<StatKey> = new Set<StatKey>(['shieldRegenDelay', 'dashCooldown', 'spread', 'reloadTime', 'bladeCooldown']);

export class Base extends Phaser.Scene {
  private sfx!: Sfx;
  private mode: Mode = 'hub';
  private page: Page = 'home';
  private tab: TabId = 'stash';
  private slotFilter: Slot | null = null;
  private homeSel = 99;
  private bunkerSel = 0;
  private depSlot: Slot = 'primary';
  private depSel = 0;
  private depFocus: Focus = 'bunker';
  private depList: Cand[] = [];
  private result: MissionResult | null = null;
  private sel = 0;
  private scroll = 0;
  private rows: Row[] = [];
  private pendingConfirm = '';
  private toast = '';
  private toastColor: number = PALETTE.text;
  private leaving = false;
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
    const haul = this.mode === 'hub' && freshHaul().length > 0;
    this.page = this.mode === 'overlay' ? 'armory' : haul && this.result?.outcome === 'extracted' ? 'armory' : data.page ?? 'home';
    this.slotFilter = null;
    this.tab = this.mode === 'overlay' ? 'carried' : haul ? 'haul' : 'stash';
    this.sel = 0;
    this.scroll = 0;
    this.homeSel = 99;
    this.bunkerSel = 0;
    this.depSlot = 'primary';
    this.depSel = 0;
    this.depFocus = 'bunker';
    this.pendingConfirm = '';
    this.toast = '';
    this.leaving = false;
    this.hover = '';
  }

  create(): void {
    showCursor(this, true);
    this.add.rectangle(0, 0, 4000, 4000, PALETTE.bg, 1).setOrigin(0, 0).setDepth(0);
    this.gfx = this.add.graphics().setDepth(1);
    this.hoverGfx = this.add.graphics().setDepth(4);
    this.keys = this.input.keyboard!.addKeys(
      'UP,DOWN,LEFT,RIGHT,ENTER,SPACE,E,M,S,D,J,K,ONE,TWO,THREE,FOUR,FIVE,SIX,TAB,ESC,B,OPEN_BRACKET,CLOSED_BRACKET',
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
    if (this.mode === 'hub' && this.page === 'quartermaster') return [{ id: 'shop', label: 'BASELINE GEAR' }];
    if (this.page === 'perks' || this.page === 'research') {
      const all = treeNodes(this.page);
      const n = (s: string): number => all.filter((x) => nodeState(x) === s).length;
      return [
        { id: 'avail', label: `AVAILABLE ${n('avail')}` },
        { id: 'locked', label: `LOCKED ${n('locked')}` },
        { id: 'owned', label: `UNLOCKED ${n('owned')}` },
      ];
    }
    const out: { id: TabId; label: string }[] = [];
    if (this.mode === 'hub' && freshHaul().length > 0) out.push({ id: 'haul', label: `NEW HAUL ${freshHaul().length}` });
    if (this.mode === 'overlay') out.push({ id: 'carried', label: `HAUL ${runState.carried.length}` });
    out.push({ id: 'stash', label: `STASH ${runState.stash.length}` });
    if (this.mode === 'overlay') out.push({ id: 'shop', label: 'QUARTERMASTER' });
    return out;
  }

  private buildRows(): Row[] {
    const keep = (base: BaseItem): boolean => !this.slotFilter || base.slot === this.slotFilter;
    if (this.page === 'perks' || this.page === 'research') {
      const want = this.tab === 'owned' ? 'owned' : this.tab === 'locked' ? 'locked' : 'avail';
      const list = treeNodes(this.page).filter((n) => nodeState(n) === want);
      // Things you can pay for now come first, then the cheapest.
      if (want === 'avail') list.sort((a, b) => Number(profile.intel < a.cost) - Number(profile.intel < b.cost) || a.cost - b.cost);
      return list.map((node) => ({ node }));
    }
    if (this.tab === 'haul') return freshHaul().filter((i) => keep(baseOf(i))).map((item) => ({ item }));
    if (this.tab === 'carried') return runState.carried.filter((i) => keep(baseOf(i))).map((item) => ({ item }));
    if (this.tab === 'stash') return runState.stash.filter((i) => keep(baseOf(i))).map((item) => ({ item }));
    const out: Row[] = [];
    for (const base of BASE_ITEMS) {
      if (base.price === 0 || !keep(base)) continue; // the starting kit is not for sale
      for (let r = 0; r <= QM.maxRarity; r++) out.push({ shop: { base, rarity: r } });
    }
    return out;
  }

  /** Everything that can go in a slot: what is equipped first, then the rest by rarity. */
  private buildCands(): Cand[] {
    const slot = this.depSlot;
    const out: Cand[] = [];
    const eq = profile.equipped[slot];
    if (eq) out.push({ item: eq, from: null });
    const others: Cand[] = [
      ...runState.stash.map((item) => ({ item, from: 'stash' as Place })),
      ...runState.carried.map((item) => ({ item, from: 'carried' as Place })),
    ].filter((c) => baseOf(c.item).slot === slot);
    others.sort((a, b) => b.item.rarity - a.item.rarity || baseOf(a.item).name.localeCompare(baseOf(b.item).name));
    return out.concat(others);
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
    if (row.node) {
      const n = row.node;
      const owned = nodeState(n) === 'owned';
      return [{
        key: 'ENTER', label: owned ? 'UNLOCKED' : `UNLOCK  ${n.cost} INTEL`,
        enabled: checkUnlock(n.id, profile.unlocked, profile.intel).ok, run: () => this.doUnlock(n),
      }];
    }
    if (row.shop) {
      const { base, rarity } = row.shop;
      const price = buyPrice(base, rarity);
      return [{
        key: 'ENTER', label: `BUY  ${price}`, enabled: canBuy(base.id, rarity),
        run: () => this.doBuy(base, rarity),
      }];
    }
    const item = row.item!;
    const from: Place = this.tab === 'carried' ? 'carried' : 'stash';
    const inStash = from === 'stash';
    const out: Btn[] = [{ key: 'E', label: 'EQUIP', enabled: true, run: () => this.doEquip(item, from) }];
    // Moving gear between the haul and the stash only matters in the dev room.
    if (this.mode === 'overlay') {
      out.push({ key: 'M', label: inStash ? 'TAKE' : 'STASH', enabled: true, run: () => this.doMove(item, from) });
    }
    out.push(
      { key: 'S', label: `SELL  ${Math.round(sellValue(item) * profile.stats.salvage)}`, enabled: inStash, run: () => this.confirmed('sell', item, () => this.doSell(item)) },
      {
        key: 'D', label: `DISMANTLE  +${dismantleIntel(item)}`, enabled: inStash,
        run: () => this.confirmed('dismantle', item, () => this.doDismantle(item)),
      },
    );
    if (this.tab === 'haul') {
      const junk = freshHaul().filter((i) => i.rarity <= 1);
      out.push(
        { key: 'J', label: `SELL ALL JUNK (${junk.length})`, enabled: junk.length > 0, run: () => this.doSellJunk(junk) },
        { key: 'K', label: 'KEEP ALL', enabled: true, run: () => this.doKeepAll() },
      );
    }
    return out;
  }

  private doSellJunk(junk: Item[]): void {
    let n = 0;
    for (const i of junk) n += sell(i);
    this.say(`Sold ${junk.length} common item${junk.length === 1 ? '' : 's'} for ${n} scrap`, PALETTE.scrap);
    this.sfx.pickup(2);
    this.sel = 0;
    this.afterHaul();
  }

  private doKeepAll(): void {
    const n = freshHaul().length;
    keepHaul();
    this.say(`Kept ${n} item${n === 1 ? '' : 's'} in the stash`, PALETTE.structure);
    this.sfx.pickup(1);
    this.afterHaul();
  }

  /** The haul tab disappears once it is empty: fall back to the stash. */
  private afterHaul(): void {
    if (this.tab === 'haul' && freshHaul().length === 0) {
      this.tab = 'stash';
      this.sel = 0;
      this.scroll = 0;
    }
    this.render();
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
    this.afterHaul();
  }

  private doEquip(item: Item, from: Place): void {
    equip(item, from);
    this.say(`Equipped ${rarityLabel(item)} ${baseOf(item).name}`, RARITY_COLORS[item.rarity]);
    this.sfx.pickup(item.rarity);
    this.after();
  }

  private doMove(item: Item, from: Place): void {
    if (!move(item, from)) {
      this.say('Pack is full', PALETTE.hostile);
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

  private doUnlock(n: TreeNode): void {
    const c = tryUnlock(n.id);
    if (!c.ok) return this.deny({ key: 'ENTER', label: '', enabled: false, run: () => undefined });
    this.say(`Unlocked ${n.name}: ${n.effects.map(fmtEffect).join(', ')}`, TREE_TINTS[n.tint]);
    this.sfx.pickup(3);
    this.render();
  }

  private doBuy(base: BaseItem, rarity: number): void {
    const it = buy(base.id, rarity);
    if (!it) {
      this.say('Not enough scrap', PALETTE.hostile);
      this.sfx.empty();
    } else {
      this.say(`Bought ${RARITY_LABELS[rarity]} ${base.name} (in the stash)`, RARITY_COLORS[rarity]);
      this.sfx.pickup(rarity);
    }
    this.after();
  }

  private deny(b: Btn): void {
    this.sfx.empty();
    if (b.key === 'S' || b.key === 'D') this.say('Only stashed items can be sold or dismantled.', PALETTE.hostile);
    else if (b.key === 'M') this.say('Your pack is full.', PALETTE.hostile);
    else if (b.key === 'ENTER') {
      const row = this.current();
      if (row?.node) {
        const c = checkUnlock(row.node.id, profile.unlocked, profile.intel);
        if (!c.ok && c.reason === 'owned') this.say('Already unlocked.');
        else if (!c.ok && c.reason === 'locked') this.say(`Unlock ${NODE_BY_ID.get(row.node.requires!)?.name ?? 'the previous node'} first.`, PALETTE.hostile);
        else this.say(`Not enough Intel: ${row.node.cost - profile.intel} more needed.`, PALETTE.hostile);
      } else this.say('Not enough scrap.', PALETTE.hostile);
    }
    this.render();
  }

  // ---- navigation ---------------------------------------------------------------------------

  private setPage(p: Page): void {
    if (p === this.page) return;
    this.page = p;
    this.result = null;
    this.pendingConfirm = '';
    this.toast = '';
    this.slotFilter = null;
    this.sel = 0;
    this.scroll = 0;
    if (p === 'armory') this.tab = this.mode === 'hub' && freshHaul().length > 0 ? 'haul' : 'stash';
    if (p === 'quartermaster') this.tab = 'shop';
    if (p === 'perks' || p === 'research') {
      this.tab = treeNodes(p).some((n) => nodeState(n) === 'avail') ? 'avail' : 'owned';
    }
    if (p === 'deploy') {
      this.depSel = 0;
      this.depFocus = 'bunker';
    }
    this.sfx.step();
    this.render();
  }

  private deploy(): void {
    const b = BUNKERS[this.bunkerSel];
    if (this.leaving) return;
    if (b.locked) {
      this.sfx.empty();
      this.say(b.locked, PALETTE.hostile);
      this.render();
      return;
    }
    if (!beginRun(b.id)) return;
    this.leaving = true;
    this.sfx.pickup(4);
    this.cameras.main.fadeOut(350, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('FeelTest', { mode: 'mission' }));
  }

  private toTitle(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(220, 2, 6, 8);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  private closeOverlay(): void {
    showCursor(this, false);
    this.scene.resume('FeelTest');
    this.scene.stop();
  }

  private back(): void {
    if (this.page === 'home') this.toTitle();
    else this.setPage('home');
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------

  update(): void {
    if (this.leaving) return;
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
      return this.updateList();
    }
    if (K.JustDown(k.ESC)) return this.back();
    const num = [k.ONE, k.TWO, k.THREE, k.FOUR, k.FIVE, k.SIX];
    num.forEach((key, i) => {
      if (K.JustDown(key)) this.setPage(NAV[i].id);
    });
    const at = NAV.findIndex((e) => e.id === this.page);
    if (K.JustDown(k.OPEN_BRACKET)) this.setPage(NAV[(at + NAV.length - 1) % NAV.length].id);
    if (K.JustDown(k.CLOSED_BRACKET)) this.setPage(NAV[(at + 1) % NAV.length].id);
    if (this.page === 'home') return this.updateHome();
    if (this.page === 'deploy') return this.updateDeploy();
    this.updateList();
  }

  private updateHome(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (K.JustDown(k.UP)) this.selectHome(Phaser.Math.Clamp(this.homeSel, 0, this.nextSteps().length - 1) - 1);
    if (K.JustDown(k.DOWN)) this.selectHome(Phaser.Math.Clamp(this.homeSel, 0, this.nextSteps().length - 1) + 1);
    if (K.JustDown(k.ENTER) || K.JustDown(k.SPACE)) {
      const steps = this.nextSteps();
      this.setPage(steps[Phaser.Math.Clamp(this.homeSel, 0, steps.length - 1)].page);
    }
  }

  private selectHome(i: number): void {
    const n = Phaser.Math.Clamp(i, 0, this.nextSteps().length - 1);
    if (n === this.homeSel) return;
    this.homeSel = n;
    this.sfx.step();
    this.render();
  }

  private updateDeploy(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (K.JustDown(k.TAB)) {
      this.depFocus = this.depFocus === 'loadout' ? 'bunker' : 'loadout';
      this.sfx.step();
      this.render();
    }
    if (K.JustDown(k.SPACE)) return this.deploy();
    if (this.depFocus === 'bunker') {
      if (K.JustDown(k.UP)) this.selectBunker(this.bunkerSel - 1);
      if (K.JustDown(k.DOWN)) this.selectBunker(this.bunkerSel + 1);
      if (K.JustDown(k.ENTER)) this.deploy();
      if (K.JustDown(k.LEFT)) {
        this.depFocus = 'loadout';
        this.render();
      }
      return;
    }
    const si = SLOTS.indexOf(this.depSlot);
    if (K.JustDown(k.LEFT)) this.selectSlot(SLOTS[(si + SLOTS.length - 1) % SLOTS.length]);
    if (K.JustDown(k.RIGHT)) {
      if (si === SLOTS.length - 1) {
        this.depFocus = 'bunker';
        this.render();
      } else this.selectSlot(SLOTS[si + 1]);
    }
    if (K.JustDown(k.UP)) this.selectCand(this.depSel - 1);
    if (K.JustDown(k.DOWN)) this.selectCand(this.depSel + 1);
    if (K.JustDown(k.ENTER) || K.JustDown(k.E)) this.equipCand(this.depSel);
  }

  private selectBunker(i: number): void {
    const n = Phaser.Math.Clamp(i, 0, BUNKERS.length - 1);
    this.depFocus = 'bunker';
    if (n !== this.bunkerSel) this.sfx.step();
    this.bunkerSel = n;
    this.toast = '';
    this.render();
  }

  private selectSlot(slot: Slot): void {
    this.depFocus = 'loadout';
    if (slot !== this.depSlot) this.sfx.step();
    this.depSlot = slot;
    this.depSel = 0;
    this.scroll = 0;
    this.render();
  }

  private selectCand(i: number): void {
    this.depFocus = 'loadout';
    if (this.depList.length === 0) return;
    const n = Phaser.Math.Clamp(i, 0, this.depList.length - 1);
    if (n !== this.depSel) this.sfx.step();
    this.depSel = n;
    this.keepVisible();
    this.render();
  }

  private equipCand(i: number): void {
    const c = this.depList[i];
    if (!c) return;
    if (c.from === null) {
      this.say('Already equipped.');
      this.sfx.step();
      this.render();
      return;
    }
    equip(c.item, c.from);
    this.say(`Equipped ${rarityLabel(c.item)} ${baseOf(c.item).name}`, RARITY_COLORS[c.item.rarity]);
    this.sfx.pickup(c.item.rarity);
    this.depSel = 0; // the item you just fitted is now the first row
    this.render();
  }

  private updateList(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    const tabs = this.tabs();
    const ti = tabs.findIndex((t) => t.id === this.tab);
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
    const sel = this.page === 'deploy' ? this.depSel : this.sel;
    if (sel < this.scroll) this.scroll = sel;
    if (sel >= this.scroll + visible) this.scroll = sel - visible + 1;
  }

  private onWheel(_p: unknown, _o: unknown, _dx: number, dy: number): void {
    if (this.leaving || this.page === 'home') return;
    const total = this.page === 'deploy' ? this.depList.length : this.rows.length;
    const max = Math.max(0, total - this.visibleRows());
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
    if (this.leaving) return;
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
    if (this.leaving) return;
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

  /** Text clipped to a width with an ASCII ellipsis. */
  private fit(s: string, size: number, maxW: number): string {
    const probe = this.add.text(0, 0, s, { fontFamily: FONT, fontSize: `${snapFont(size)}px` }).setResolution(1).setVisible(false);
    let out = s;
    while (out.length > 1 && probe.setText(out).width > maxW) out = out.slice(0, -1);
    probe.destroy();
    return out === s ? s : `${out.slice(0, -2)}..`;
  }

  private render(): void {
    if (!this.gfx) return;
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    this.hits = [];
    this.rows = this.buildRows();
    this.sel = Phaser.Math.Clamp(this.sel, 0, Math.max(0, this.rows.length - 1));
    this.depList = this.buildCands();
    this.depSel = Phaser.Math.Clamp(this.depSel, 0, Math.max(0, this.depList.length - 1));
    if (!this.tabs().some((t) => t.id === this.tab)) this.tab = this.tabs()[0].id;

    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.gfx;
    g.clear();

    this.drawChrome(w, h);
    const hub = this.mode === 'hub';
    const x0 = 24 + (hub ? RAIL_W + 16 : 0);
    const cw = w - x0 - 24;
    const top0 = HEADER_H + 14;
    let top = top0;
    if (hub) this.drawRail(24, top0, RAIL_W, h - FOOTER_H - top0 - 14);
    if (this.result && (this.page === 'home' || this.page === 'armory') && hub) {
      this.drawResult(x0, top, cw);
      top += 58;
    }
    const ch = h - FOOTER_H - top - 14;
    if (this.page === 'home') this.drawHome(x0, top, cw, ch);
    else if (this.page === 'deploy') this.drawDeploy(x0, top, cw, ch);
    else this.drawOutfit(x0, top, cw, ch);
    this.drawHover();
  }

  private pageTitle(): string {
    if (this.mode === 'overlay') return '| OUTFIT |';
    return `| ${NAV.find((e) => e.id === this.page)!.label} |`;
  }

  private drawChrome(w: number, h: number): void {
    // Header and footer are panels pushed past the screen edge so only the inner border shows.
    this.box('panel', -12, -12, w + 24, HEADER_H + 12);
    this.box('panel', -12, h - FOOTER_H, w + 24, FOOTER_H + 12);
    const title = this.text(24, 14, this.pageTitle(), 26, PALETTE.text);
    const rx = 24 + title.width + 40;
    const scrap = this.text(rx, 22, `SCRAP ${profile.scrap}`, 16, PALETTE.scrap);
    this.text(rx + scrap.width + 28, 22, `INTEL ${profile.intel}`, 16, PALETTE.robot);

    if (this.mode === 'hub') {
      const label = this.page === 'home' ? '< TITLE  [ESC]' : '< BASE  [ESC]';
      const t = this.text(w - 42, 22, label, 16, PALETTE.text, [1, 0]);
      this.box('btn', w - 24 - t.width - 36, 10, t.width + 36, 40);
      this.hit('back', w - 24 - t.width - 36, 10, t.width + 36, 40, () => this.back());
    }

    this.text(24, h - 14, this.hint(), 12, PALETTE.textDim, [0, 1]);
    if (this.toast) this.text(w - 24, h - 14, this.toast, 13, this.toastColor, [1, 1]);
  }

  private hint(): string {
    const nav = '1-6 or [ ] switch page';
    if (this.mode === 'overlay') return 'LEFT/RIGHT tabs   UP/DOWN select   E equip   M move   S sell   D dismantle   TAB trees   ESC close';
    if (this.page === 'home') return `UP/DOWN select   ENTER go   ${nav}   ESC title`;
    if (this.page === 'deploy') return `TAB switch gear / bunker   LEFT/RIGHT slot   UP/DOWN choose   ENTER equip or deploy   SPACE deploy   ${nav}`;
    if (this.page === 'perks' || this.page === 'research') return `LEFT/RIGHT tabs   UP/DOWN select   ENTER unlock   ${nav}   ESC base`;
    if (this.page === 'quartermaster') return `UP/DOWN select   ENTER buy   ${nav}   ESC base`;
    if (this.tab === 'haul') return `UP/DOWN select   E equip   S sell   D dismantle   J sell all junk   K keep all   ${nav}`;
    return `LEFT/RIGHT tabs   UP/DOWN select   E equip   S sell   D dismantle   ${nav}   ESC base`;
  }

  private drawResult(x: number, y: number, w: number): void {
    const r = this.result!;
    const g = this.gfx;
    const done = r.outcome === 'extracted' && r.complete;
    const color = done ? PALETTE.ammo : r.outcome === 'extracted' ? PALETTE.player : PALETTE.hostile;
    const h = 50;
    this.box('field', x, y, w, h, 1, color);
    g.fillStyle(color, 1);
    g.fillRect(x + 6, y + 6, 4, h - 12);
    const head = done ? 'BUNKER CLAIMED' : r.outcome === 'extracted' ? 'EXTRACTED' : r.outcome === 'lost' ? 'AUG LOST' : 'RUN ABORTED';
    const bits: string[] = [];
    if (r.outcome === 'extracted') {
      bits.push(r.items > 0 ? `${r.items} item${r.items > 1 ? 's' : ''} hauled out: sort them below` : 'nothing hauled out');
      if (r.scrap > 0) bits.push(`+${r.scrap} scrap`);
      if (r.bonusScrap > 0) bits.push(`+${r.bonusScrap} clear bonus`);
    } else {
      bits.push(r.lost > 0 ? `${r.lost} carried item${r.lost > 1 ? 's' : ''} lost` : 'nothing carried');
      if (r.outcome === 'lost') bits.push('a new Aug has regrown at the base');
    }
    if (r.intel > 0) bits.push(`+${r.intel} Intel`);
    if (r.roomsTotal > 0) bits.push(`${r.rooms}/${r.roomsTotal} rooms`);
    this.text(x + 22, y + 8, head, 16, color);
    this.text(x + 22, y + 29, bits.join('   '), 12, PALETTE.text);
    const ico = uiIcon(this, 'close', x + w - 34, y + 14).setDepth(5);
    this.dyn.push(ico);
    this.hit('result', x + w - 44, y, 44, h, () => {
      this.result = null;
      this.sfx.step();
      this.render();
    });
  }

  // ---- menu rail -------------------------------------------------------------------------------

  private drawRail(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    const gap = 8;
    const bh = Math.min(64, Math.floor((h - 24 - gap * (NAV.length - 1)) / NAV.length));
    NAV.forEach((e, i) => {
      const by = y + 12 + i * (bh + gap);
      const on = e.id === this.page;
      this.box(on ? 'btn_hover' : 'btn', x + 10, by, w - 20, bh);
      if (on) {
        this.gfx.fillStyle(PALETTE.structure, 1);
        this.gfx.fillRect(x + 16, by + 8, 4, bh - 16);
      }
      const label = this.text(x + 30, by + 9, e.label, 14, e.id === 'deploy' ? PALETTE.player : on ? PALETTE.white : PALETTE.text);
      void label;
      const sub = e.sub();
      this.text(x + 30, by + bh - 22, this.fit(sub.text, 11, w - 56), 11, sub.hot ? PALETTE.ammo : PALETTE.textDim);
      this.text(x + w - 22, by + 9, String(i + 1), 11, PALETTE.textDim, [1, 0]);
      this.hit(`nav:${e.id}`, x + 10, by, w - 20, bh, () => this.setPage(e.id));
    });
  }

  // ---- home ------------------------------------------------------------------------------------

  /** Things worth doing next, most urgent first. Deploy is always last. */
  private nextSteps(): NextStep[] {
    const out: NextStep[] = [];
    const fresh = freshHaul().length;
    if (fresh > 0) out.push({ page: 'armory', label: 'SORT YOUR HAUL', sub: `${fresh} new item${fresh === 1 ? '' : 's'}: keep, sell or dismantle` });
    const pk = affordable('perks');
    if (pk > 0) out.push({ page: 'perks', label: 'SPEND INTEL: PERKS', sub: `${pk} you can afford, ${profile.intel} Intel in hand` });
    const rs = affordable('research');
    if (rs > 0) out.push({ page: 'research', label: 'SPEND INTEL: RESEARCH', sub: `${rs} you can afford, ${profile.intel} Intel in hand` });
    out.push({ page: 'deploy', label: 'DEPLOY', sub: 'Choose your gear, then a bunker' });
    return out;
  }

  private drawHome(x: number, y: number, w: number, h: number): void {
    const steps = this.nextSteps();
    this.homeSel = Phaser.Math.Clamp(this.homeSel, 0, steps.length - 1);
    const menuW = Math.min(440, Math.floor(w * 0.44));
    const bh = 64;
    const menuH = Math.min(h, 52 + steps.length * (bh + 10) + 6);
    this.panel(x, y, menuW, menuH);
    this.text(x + 16, y + 14, 'NEXT', 14, PALETTE.textDim);
    steps.forEach((e, i) => {
      const by = y + 40 + i * (bh + 10);
      const on = i === this.homeSel;
      const deploy = e.page === 'deploy';
      this.box(on ? 'btn_hover' : 'btn', x + 16, by, menuW - 32, bh);
      if (deploy || on) {
        this.gfx.fillStyle(deploy ? PALETTE.player : PALETTE.structure, 1);
        this.gfx.fillRect(x + 22, by + 8, 4, bh - 16);
      }
      this.text(x + 38, by + 10, e.label, 18, deploy ? PALETTE.player : PALETTE.white);
      this.text(x + 38, by + bh - 24, this.fit(e.sub, 12, menuW - 80), 12, PALETTE.textDim);
      this.hit(`home:${i}`, x + 16, by, menuW - 32, bh, () => {
        this.homeSel = i;
        this.setPage(e.page);
      });
    });

    // Right: where you stand.
    const ix = x + menuW + 16;
    const iw = w - menuW - 16;
    this.panel(ix, y, iw, h);
    this.text(ix + 20, y + 16, 'AUG', 14, PALETTE.textDim);
    let ly = y + 40;
    for (const slot of SLOTS) {
      const it = profile.equipped[slot];
      this.text(ix + 20, ly + 2, SLOT_LABELS[slot], 11, PALETTE.textDim);
      if (it) {
        this.text(ix + 130, ly, `${rarityLabel(it)} ${baseOf(it).name}`, 16, RARITY_COLORS[it.rarity]);
      } else {
        this.text(ix + 130, ly, '(empty)', 16, PALETTE.textDim);
      }
      ly += 28;
    }
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(ix + 14, ly + 6, ix + iw - 14, ly + 6);
    ly += 22;
    this.text(ix + 20, ly, 'BUNKERS', 14, PALETTE.textDim);
    ly += 26;
    for (const b of BUNKERS) {
      const claimed = profile.claimed.has(b.id);
      const floors = b.floors.length;
      const rooms = b.floors.reduce((a, n) => a + n, 0);
      this.text(ix + 20, ly, b.name, 16, PALETTE.white);
      this.text(ix + 190, ly + 3, `${floors} floors, ${rooms} rooms`, 12, PALETTE.textDim);
      this.text(ix + iw - 20, ly + 2, claimed ? 'CLAIMED' : 'UNCLAIMED', 12, claimed ? PALETTE.player : PALETTE.textDim, [1, 0]);
      ly += 28;
    }
    ly += 12;
    this.gfx.lineBetween(ix + 14, ly - 4, ix + iw - 14, ly - 4);
    const note = this.text(ix + 20, ly + 8,
      'Gear is the progression. Take it from the dead, haul it out by reaching a lift or the last exit, and bring something better next time. The haul is lost if you die.',
      13, PALETTE.textDim);
    note.setWordWrapWidth(iw - 40);
  }

  // ---- outfit page ---------------------------------------------------------------------------

  private drawOutfit(x: number, y: number, w: number, h: number): void {
    const tree = this.page === 'perks' || this.page === 'research';
    const leftW = Math.round(Phaser.Math.Clamp(w * 0.27, 230, LEFT_W));
    const rightW = Math.round(Phaser.Math.Clamp(w * 0.33, 300, RIGHT_W));
    if (tree) this.drawAugStats(x, y, leftW, h);
    else this.drawEquipped(x, y, leftW, h);
    this.drawList(x + leftW + 16, y, Math.max(240, w - leftW - rightW - 32), h);
    this.drawDetail(x + w - rightW, y, rightW, h);
  }

  /** Perks and Research: the Aug's current stats, with what the selected node would change. */
  private drawAugStats(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.text(x + 14, y + 12, 'AUG STATS', 14, PALETTE.textDim);
    const node = this.current()?.node;
    let after: ReturnType<typeof resolveStats> | null = null;
    if (node && nodeState(node) !== 'owned') {
      after = resolveStats(new Set([...profile.unlocked, node.id]), profile.equipped as Loadout);
    }
    const touched = new Set<StatKey>(node ? node.effects.map((e) => e.stat) : []);
    const lh = Math.min(26, Math.floor((h - 70) / AUG_STATS.length));
    AUG_STATS.forEach((k, i) => {
      const ly = y + 42 + i * lh;
      const cur = profile.stats[k];
      const hot = touched.has(k);
      this.text(x + 14, ly, STAT_LABELS[k], 12, hot ? PALETTE.white : PALETTE.textDim);
      let value = fmtStat(k, cur);
      let col: number = hot ? PALETTE.white : PALETTE.text;
      if (after && hot && Math.abs(after[k] - cur) > 1e-6) {
        const better = LOWER_IS_BETTER.has(k) ? after[k] < cur : after[k] > cur;
        value = `${value} > ${fmtStat(k, after[k])}`;
        col = better ? PALETTE.player : PALETTE.hostile;
      }
      this.text(x + w - 14, ly, value, 12, col, [1, 0]);
    });
    this.text(x + 14, y + h - 22, 'Gear adds to these too.', 11, PALETTE.textDim);
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
      this.text(x + w - 18, y + 16, `+${runState.carriedScrap} scrap in the haul`, 12, PALETTE.scrap, [1, 0]);
    }
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(x + 8, y + 40, x + w - 8, y + 40);

    if (this.rows.length === 0) {
      const f = this.slotFilter ? ' for this slot' : '';
      const msg = this.tab === 'avail'
        ? 'Nothing to unlock right now. Check the locked tab: each node needs the one before it.'
        : this.tab === 'locked'
          ? 'Nothing locked: everything here is open to you or already yours.'
          : this.tab === 'owned'
            ? 'Nothing unlocked yet. Spend Intel on the available tab.'
            : this.tab === 'carried' || this.tab === 'haul'
        ? `Nothing in the haul${f}. Everything you pick up in a run is lost if you die, until you extract it.`
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
      if (row.node) {
        this.drawNodeRow(x, w, ry, idx, row.node);
        continue;
      }
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

  private drawNodeRow(x: number, w: number, ry: number, idx: number, n: TreeNode): void {
    const st = nodeState(n);
    const col = TREE_TINTS[n.tint];
    const dim = st === 'locked';
    this.hit(`row:${idx}`, x + 4, ry, w - 8, ROW_H - 2, () => this.select(idx));
    if (idx === this.sel) this.box('btn_hover', x + 8, ry, w - 16, ROW_H - 2, 1).setDepth(0.6);
    this.gfx.fillStyle(col, dim ? 0.4 : 1);
    this.gfx.fillRect(x + 10, ry + 6, 3, ROW_H - 14);
    this.text(x + 22, ry + 4, n.name, 14, dim ? PALETTE.textDim : col);
    this.text(x + 22, ry + 22, this.fit(n.effects.map(fmtEffect).join(', '), 11, w - 150), 11, PALETTE.textDim);
    let right = `${n.cost} INTEL`;
    let rc: number = profile.intel >= n.cost ? PALETTE.robot : PALETTE.hostile;
    if (st === 'owned') {
      right = 'UNLOCKED';
      rc = PALETTE.player;
    } else if (st === 'locked') {
      right = `needs ${NODE_BY_ID.get(n.requires!)?.name ?? '?'}`;
      rc = PALETTE.textDim;
    }
    this.text(x + w - 14, ry + 10, this.fit(right, 12, 150), 12, rc, [1, 0]);
  }

  /** A perk or research node: what it does, what it needs, what it opens, and the unlock button. */
  private drawNodeDetail(x: number, y: number, w: number, h: number, n: TreeNode): void {
    const col = TREE_TINTS[n.tint];
    const st = nodeState(n);
    const ig = this.add.graphics().setDepth(5).setPosition(x + 16 + 28, y + 16 + 28);
    drawIcon(ig, n.icon, col);
    this.dyn.push(ig);
    this.text(x + 86, y + 16, this.fit(n.name, 20, w - 102), 20, col);
    this.text(x + 86, y + 46, `${TREE_LABELS[n.tree]}   ${n.kind === 'main' ? 'MAIN NODE' : 'UPGRADE'}`, 11, PALETTE.textDim);
    const stText = st === 'owned' ? 'UNLOCKED' : st === 'avail' ? 'AVAILABLE' : 'LOCKED';
    const stCol = st === 'owned' ? PALETTE.player : st === 'avail' ? PALETTE.ammo : PALETTE.textDim;
    this.text(x + 86, y + 64, stText, 12, stCol);

    let dy = y + 92;
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(x + 12, dy - 6, x + w - 12, dy - 6);
    const d = this.text(x + 16, dy, n.desc, 13, PALETTE.text);
    d.setWordWrapWidth(w - 32);
    dy += d.height + 16;
    const kv = (k: string, v: string, c: number = PALETTE.text): void => {
      this.text(x + 16, dy + 1, k, 11, PALETTE.textDim);
      const t = this.text(x + 100, dy, v, 13, c);
      t.setWordWrapWidth(w - 116);
      dy += Math.max(22, t.height + 6);
    };
    for (const e of n.effects) kv('EFFECT', fmtEffect(e), PALETTE.white);
    if (n.requires) {
      const p = NODE_BY_ID.get(n.requires);
      kv('NEEDS', p ? p.name : '?', profile.unlocked.has(n.requires) ? PALETTE.player : PALETTE.hostile);
    }
    const kids = TREE_NODES.filter((o) => o.requires === n.id);
    if (kids.length) kv('OPENS', kids.map((o) => o.name).join(', '));
    kv('COST', st === 'owned' ? 'paid' : `${n.cost} Intel`, st === 'owned' ? PALETTE.textDim : profile.intel >= n.cost ? PALETTE.robot : PALETTE.hostile);
    kv('YOU HAVE', `${profile.intel} Intel`, PALETTE.textDim);

    this.btns = this.buttons();
    const bh = 40;
    let by = y + h - 16 - this.btns.length * (bh + BTN_GAP) + BTN_GAP;
    for (const b of this.btns) {
      const on = b.enabled;
      this.box(on ? 'btn_hover' : 'btn_dis', x + 16, by, w - 32, bh);
      this.text(x + 28, by + 13, `[${b.key}]`, 12, on ? PALETTE.ammo : PALETTE.textDim);
      this.text(x + 96, by + 12, b.label, 15, on ? PALETTE.player : PALETTE.textDim);
      this.hit(`btn:${b.key}`, x + 16, by, w - 32, bh, () => (b.enabled ? b.run() : this.deny(b)), b.enabled);
      by += bh + BTN_GAP;
    }
  }

  private drawDetail(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    const row = this.current();
    if (!row) {
      this.text(x + 14, y + 14, 'NOTHING SELECTED', 14, PALETTE.textDim);
      return;
    }
    if (row.node) return this.drawNodeDetail(x, y, w, h, row.node);
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
    const bh = this.btns.length > 3 ? 26 : 32;
    const btnTop = y + h - 16 - this.btns.length * (bh + BTN_GAP) + BTN_GAP;

    // Stat lines compared with what is equipped in that slot.
    const eq = profile.equipped[base.slot];
    const mine = eq ? new Map(statLines(baseOf(eq), eq.rarity).map((l) => [l.key, l])) : new Map<string, StatLine>();
    let ly = dy + d.height + 18;
    this.text(x + 16, ly, 'STATS  vs equipped', 11, PALETTE.textDim);
    ly += 17;
    const all = statLines(base, rarity);
    const lines = all.slice(0, Math.max(3, Math.floor((btnTop - 24 - ly) / 14)));
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

  // ---- deploy ----------------------------------------------------------------------------------

  /** Percent change of a candidate's first stat against what is equipped, for the row tag. */
  private diffTag(c: Cand): { text: string; color: number } | null {
    if (c.from === null) return null;
    const base = baseOf(c.item);
    const eq = profile.equipped[base.slot];
    if (!eq) return null;
    const mine = new Map(statLines(baseOf(eq), eq.rarity).map((l) => [l.key, l]));
    const lines = statLines(base, c.item.rarity).slice(0, 3);
    lines.sort((a, b) => Number(b.key === 'dps') - Number(a.key === 'dps'));
    for (const l of lines) {
      const m = mine.get(l.key);
      if (!m || m.value === 0) continue;
      const diff = l.value - m.value;
      if (Math.abs(diff) < 1e-6) continue;
      const better = l.higherBetter ? diff > 0 : diff < 0;
      const pct = Math.round((diff / Math.abs(m.value)) * 100);
      return { text: `${l.label} ${diff > 0 ? '+' : ''}${pct}%`, color: better ? PALETTE.player : PALETTE.hostile };
    }
    return null;
  }

  private drawDeploy(x: number, y: number, w: number, h: number): void {
    const lw = Math.floor(w * 0.5) - 10;
    this.drawLoadout(x, y, lw, h);
    this.drawBunkers(x + lw + 20, y, w - lw - 20, h);
  }

  private focusFrame(x: number, y: number, w: number, h: number, on: boolean): void {
    if (!on) return;
    this.gfx.lineStyle(2, PALETTE.structure, 0.9);
    this.gfx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  }

  private drawLoadout(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.focusFrame(x, y, w, h, this.depFocus === 'loadout');
    this.text(x + 16, y + 12, 'LOADOUT', 14, PALETTE.textDim);
    this.text(x + w - 16, y + 14, 'click a slot, then click gear to equip it', 11, PALETTE.textDim, [1, 0]);

    // Slot tiles.
    const gap = 6;
    const tw = Math.floor((w - 32 - gap * (SLOTS.length - 1)) / SLOTS.length);
    const ty = y + 38;
    const th = 64;
    SLOTS.forEach((slot, i) => {
      const tx = x + 16 + i * (tw + gap);
      const on = slot === this.depSlot;
      const it = profile.equipped[slot];
      this.box(on ? 'btn_hover' : 'btn', tx, ty, tw, th);
      this.text(tx + 10, ty + 8, SLOT_LABELS[slot], 11, on ? PALETTE.structure : PALETTE.textDim);
      if (it) {
        const col = RARITY_COLORS[it.rarity];
        this.text(tx + 10, ty + 26, this.fit(baseOf(it).name, 12, tw - 20), 12, col);
        this.text(tx + 10, ty + 44, RARITY_LABELS[it.rarity], 8, PALETTE.textDim);
      } else {
        this.text(tx + 10, ty + 28, '(empty)', 12, PALETTE.textDim);
      }
      this.hit(`dslot:${slot}`, tx, ty, tw, th, () => this.selectSlot(slot));
    });

    // Candidates.
    const ly = ty + th + 14;
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(x + 12, ly - 6, x + w - 12, ly - 6);
    this.listRect = { x, y: ly, w, h: y + h - ly - 10 };
    if (this.depList.length === 0) {
      this.text(x + 16, ly + 6, `Nothing for the ${SLOT_LABELS[this.depSlot].toLowerCase()} slot. Buy baseline gear from the quartermaster or bring something back.`, 13, PALETTE.textDim)
        .setWordWrapWidth(w - 32);
      return;
    }
    this.keepVisible();
    const visible = this.visibleRows();
    for (let i = 0; i < visible; i++) {
      const idx = this.scroll + i;
      const c = this.depList[idx];
      if (!c) break;
      const ry = ly + i * ROW_H;
      const base = baseOf(c.item);
      const col = RARITY_COLORS[c.item.rarity];
      if (idx === this.depSel) this.box('btn_hover', x + 8, ry, w - 16, ROW_H - 2, 1).setDepth(0.6);
      this.gfx.fillStyle(col, 1);
      this.gfx.fillRect(x + 14, ry + 6, 3, ROW_H - 14);
      this.text(x + 26, ry + 4, `${RARITY_LABELS[c.item.rarity]} ${base.name}`, 14, col);
      const lines = statLines(base, c.item.rarity).slice(0, 2).map((l) => `${l.label} ${l.text}`).join('   ');
      this.text(x + 26, ry + 22, lines, 11, PALETTE.textDim);
      if (c.from === null) {
        this.text(x + w - 18, ry + 11, 'EQUIPPED', 12, PALETTE.player, [1, 0]);
      } else {
        const d = this.diffTag(c);
        if (d) this.text(x + w - 18, ry + 11, d.text, 12, d.color, [1, 0]);
      }
      this.hit(`drow:${idx}`, x + 4, ry, w - 8, ROW_H - 2, () => { this.depSel = idx; this.depFocus = 'loadout'; this.equipCand(idx); });
    }
    if (this.depList.length > visible) {
      const sh = (this.listRect.h * visible) / this.depList.length;
      const sy = ly + (this.listRect.h - sh) * (this.scroll / (this.depList.length - visible));
      this.gfx.fillStyle(PALETTE.structureDim, 0.8);
      this.gfx.fillRect(x + w - 6, sy, 3, sh);
    }
  }

  private drawBunkers(x: number, y: number, w: number, h: number): void {
    this.panel(x, y, w, h);
    this.focusFrame(x, y, w, h, this.depFocus === 'bunker');
    this.text(x + 16, y + 12, 'BUNKER', 14, PALETTE.textDim);

    const cardH = 52;
    BUNKERS.forEach((b, i) => {
      const cy = y + 38 + i * (cardH + 6);
      const on = i === this.bunkerSel;
      const claimed = profile.claimed.has(b.id);
      this.box(on ? 'btn_hover' : 'field', x + 12, cy, w - 24, cardH, b.locked ? 0.7 : 1);
      if (on) {
        this.gfx.fillStyle(PALETTE.structure, 1);
        this.gfx.fillRect(x + 18, cy + 6, 4, cardH - 12);
      }
      this.text(x + 34, cy + 8, b.name, 16, b.locked ? PALETTE.textDim : PALETTE.white);
      this.text(x + 34, cy + 30, b.tag, 11, PALETTE.textDim);
      this.text(x + w - 28, cy + 10, b.locked ? 'LOCKED' : claimed ? 'CLAIMED' : 'UNCLAIMED', 12, b.locked ? PALETTE.hostile : claimed ? PALETTE.player : PALETTE.textDim, [1, 0]);
      this.hit(`bunker:${i}`, x + 12, cy, w - 24, cardH, () => this.selectBunker(i));
    });

    const b = BUNKERS[this.bunkerSel];
    const rooms = b.floors.reduce((a, n) => a + n, 0);
    let dy = y + 38 + BUNKERS.length * (cardH + 6) + 8;
    this.gfx.lineStyle(1, PALETTE.structureDim, 0.6);
    this.gfx.lineBetween(x + 12, dy - 4, x + w - 12, dy - 4);
    dy += 6;
    const body = this.text(x + 18, dy, b.blurb, 13, PALETTE.text);
    body.setWordWrapWidth(w - 36);
    dy += body.height + 12;
    const kv = (k: string, v: string, col: number = PALETTE.text): void => {
      this.text(x + 18, dy + 1, k, 11, PALETTE.textDim);
      const t = this.text(x + 112, dy, v, 13, col);
      t.setWordWrapWidth(w - 130);
      dy += Math.max(20, t.height + 4);
    };
    kv('LAYOUT', `${b.floors.length} floors, ${rooms} rooms, the Warden at the bottom`);
    kv('THREATS', b.threats);
    kv('REWARDS', b.rewards);
    kv('ADVICE', b.advice, PALETTE.ammo);
    const roster = (Object.keys(b.bias) as (keyof typeof b.bias)[]).filter((k) => (b.bias[k] ?? 1) > 1).map((k) => MOBS[k]!.name);
    if (roster.length) kv('SEEN HERE', roster.join(', '));

    // Deploy.
    const bh = 54;
    const by = y + h - bh - 16;
    const locked = !!b.locked;
    this.text(x + 18, by - 26, locked ? b.locked! : 'The haul is lost if you die. Lifts and the last exit get it out.', 12, locked ? PALETTE.hostile : PALETTE.textDim)
      .setWordWrapWidth(w - 36);
    this.box(locked ? 'btn_dis' : 'btn_hover', x + 16, by, w - 32, bh);
    this.text(x + w / 2, by + bh / 2, locked ? 'SEALED' : 'DEPLOY  [SPACE]', 24, locked ? PALETTE.textDim : PALETTE.player, [0.5, 0.5]);
    this.hit('deploy', x + 16, by, w - 32, bh, () => this.deploy(), !locked);
  }

}
