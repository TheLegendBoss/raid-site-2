// The tree screen: Research and Perks as pannable node graphs. Main nodes sit
// on a grid joined by trunk lines; small chip nodes hang under their parent.
// Opened from the room with TAB; the room is paused underneath.
import Phaser from 'phaser';
import { snapFont } from '../ui/pixelUi';
import { FONT, PALETTE, TREE_TINTS, hex } from '../data/palette';
import {
  NODE_BY_ID,
  STAT_LABELS,
  TREE_LABELS,
  TREE_LAYOUT as L,
  type Effect,
  type TreeId,
  type TreeNode,
} from '../data/tree';
import { drawIcon } from '../fx/treeIcons';
import { getSfx, type Sfx } from '../fx/audio';
import { showCursor } from '../ui/cursor';
import { profile, tryUnlock } from '../game/profile';
import { checkUnlock, nodesOf } from '../sim/tree';

type NodeState = 'owned' | 'ready' | 'poor' | 'locked';
type Txt = Phaser.GameObjects.Text;

interface View {
  node: TreeNode;
  x: number; // top-left in tree space
  y: number;
  w: number;
  h: number;
  box: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Graphics;
  name: Txt;
  cost: Txt;
  cont: Phaser.GameObjects.Container;
}

const TABS: TreeId[] = ['research', 'perks'];
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.5;
const HEADER_H = 84;
const FOOTER_H = 44;

function fmtEffect(e: Effect): string {
  const label = STAT_LABELS[e.stat];
  const parts: string[] = [];
  if (e.add) parts.push(`${e.add > 0 ? '+' : ''}${e.add}`);
  if (e.pct) parts.push(`${e.pct > 0 ? '+' : ''}${Math.round(e.pct * 100)}%`);
  return `${parts.join(' ')} ${label}`;
}

export class Tree extends Phaser.Scene {
  private sfx?: Sfx;
  private tab: TreeId = 'research';
  private views = new Map<string, View>();
  private world!: Phaser.GameObjects.Container;
  private grid!: Phaser.GameObjects.Graphics;
  private lines!: Phaser.GameObjects.Graphics;
  private cursor!: Phaser.GameObjects.Graphics;
  private uiBg!: Phaser.GameObjects.Graphics;
  private title!: Txt;
  private tabText: Txt[] = [];
  private intelText!: Txt;
  private hint!: Txt;
  private infoGfx!: Phaser.GameObjects.Graphics;
  private infoTitle!: Txt;
  private infoBody!: Txt;
  private infoStatus!: Txt;
  private flash!: Phaser.GameObjects.Rectangle;
  private bg!: Phaser.GameObjects.Rectangle;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  private panX = 0;
  private panY = 0;
  private zoom = 1;
  private selected = '';
  private dragging = false;
  private dragMoved = false;
  private dragStart = { x: 0, y: 0, px: 0, py: 0 };

  constructor() {
    super('Tree');
  }

  private returnTo = 'FeelTest';

  init(data: { sfx?: Sfx; tab?: TreeId; returnTo?: string }): void {
    this.sfx = data.sfx ?? getSfx();
    this.returnTo = data.returnTo ?? 'FeelTest';
    this.tab = data.tab ?? this.tab;
  }

  create(): void {
    showCursor(this, true);
    this.views.clear();
    this.tabText = [];
    this.bg = this.add.rectangle(0, 0, 10, 10, PALETTE.bg, 1).setOrigin(0, 0).setDepth(0);
    this.grid = this.add.graphics().setDepth(1);
    this.world = this.add.container(0, 0).setDepth(2);
    this.lines = this.add.graphics();
    this.cursor = this.add.graphics();
    this.world.add([this.lines, this.cursor]);

    this.buildUi();
    this.keys = this.input.keyboard!.addKeys(
      'LEFT,RIGHT,UP,DOWN,ENTER,SPACE,Q,E,ONE,TWO,TAB,ESC,A,D,W,S',
    ) as Record<string, Phaser.Input.Keyboard.Key>;

    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('wheel', this.onWheel, this);
    this.scale.on('resize', this.layoutUi, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutUi, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
      this.input.off('wheel', this.onWheel, this);
    });

    this.buildTree(this.tab);
    this.layoutUi();
    this.fitView();
    this.refreshAll();
  }

  // ------------------------------------------------------------------
  // Building
  // ------------------------------------------------------------------

  private buildUi(): void {
    this.uiBg = this.add.graphics();
    this.title = this.text(0, 0, '', 26, PALETTE.text);
    this.intelText = this.text(0, 0, '', 20, PALETTE.robot).setOrigin(1, 0);
    for (const t of TABS) this.tabText.push(this.text(0, 0, t.toUpperCase(), 14, PALETTE.textDim));
    this.hint = this.text(0, 0, '', 13, PALETTE.textDim).setOrigin(0, 1);
    this.infoGfx = this.add.graphics();
    this.infoTitle = this.text(0, 0, '', 20, PALETTE.white);
    this.infoBody = this.text(0, 0, '', 14, PALETTE.text);
    this.infoBody.setWordWrapWidth(330);
    this.infoStatus = this.text(0, 0, '', 14, PALETTE.ammo);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0, 0);
    this.add
      .container(0, 0, [
        this.uiBg, this.title, this.intelText, ...this.tabText, this.hint,
        this.infoGfx, this.infoTitle, this.infoBody, this.infoStatus, this.flash,
      ])
      .setDepth(10);
  }

  private text(x: number, y: number, s: string, size: number, color: number): Txt {
    return this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${snapFont(size)}px`, color: hex(color) })
      .setResolution(1)
      .setOrigin(0, 0);
  }

  private clearTree(): void {
    for (const v of this.views.values()) v.cont.destroy();
    this.views.clear();
  }

  private buildTree(tab: TreeId): void {
    this.clearTree();
    const nodes = nodesOf(tab);
    const mains = nodes.filter((n) => n.kind === 'main');
    const place = new Map<string, { x: number; y: number }>();
    for (const n of mains) {
      place.set(n.id, { x: L.originX + (n.col ?? 0) * L.colPitch, y: L.originY + (n.row ?? 0) * L.rowPitch });
    }
    for (const n of nodes.filter((c) => c.kind === 'chip')) {
      const siblings = nodes.filter((c) => c.kind === 'chip' && c.requires === n.requires);
      const i = siblings.indexOf(n);
      const total = siblings.length * L.chipW + (siblings.length - 1) * L.chipGap;
      const p = place.get(n.requires!)!;
      place.set(n.id, {
        x: p.x + (L.nodeW - total) / 2 + i * (L.chipW + L.chipGap),
        y: p.y + L.nodeH + L.chipDrop,
      });
    }
    for (const n of nodes) {
      const pos = place.get(n.id)!;
      const chip = n.kind === 'chip';
      const w = chip ? L.chipW : L.nodeW;
      const h = chip ? L.chipH : L.nodeH;
      const box = this.add.graphics();
      const icon = this.add.graphics();
      const size = chip ? 12 : 13;
      const name = this.text(chip ? 6 : 10, chip ? 4 : 8, n.name, size, PALETTE.text);
      const cost = this.text(chip ? 6 : 10, h - (chip ? 17 : 26), '', chip ? 12 : 16, PALETTE.text);
      if (chip) {
        icon.setPosition(w - 15, h - 16).setScale(0.38);
      } else {
        icon.setPosition(w / 2, h / 2 + 6).setScale(1.5);
      }
      drawIcon(icon, n.icon, TREE_TINTS[n.tint]);
      const cont = this.add.container(pos.x, pos.y, [box, icon, name, cost]);
      this.world.add(cont);
      this.views.set(n.id, { node: n, x: pos.x, y: pos.y, w, h, box, icon, name, cost, cont });
    }
    this.selected = mains[0]?.id ?? '';
  }

  // ------------------------------------------------------------------
  // State and drawing
  // ------------------------------------------------------------------

  private stateOf(n: TreeNode): NodeState {
    if (profile.unlocked.has(n.id)) return 'owned';
    if (n.requires && !profile.unlocked.has(n.requires)) return 'locked';
    return profile.intel >= n.cost ? 'ready' : 'poor';
  }

  private refreshAll(): void {
    for (const v of this.views.values()) this.drawNode(v);
    this.drawLines();
    this.drawCursor();
    this.drawInfo();
    this.drawHeader();
  }

  private drawNode(v: View): void {
    const st = this.stateOf(v.node);
    const tint = TREE_TINTS[v.node.tint];
    const chip = v.node.kind === 'chip';
    const g = v.box;
    g.clear();
    const dim = st === 'locked' ? 0.35 : 1;
    g.fillStyle(0x050c12, 0.92);
    g.fillRect(0, 0, v.w, v.h);
    g.fillStyle(tint, st === 'owned' ? 0.34 : st === 'locked' ? 0.07 : 0.18);
    g.fillRect(0, 0, v.w, v.h);
    // Scanline texture.
    g.lineStyle(1, 0x000000, 0.18);
    for (let y = 3; y < v.h; y += 4) g.lineBetween(0, y, v.w, y);
    const borderColor = st === 'ready' ? 0xffffff : st === 'locked' ? 0x6a7a80 : tint;
    g.lineStyle(st === 'owned' || st === 'ready' ? 2 : 1.5, borderColor, st === 'locked' ? 0.5 : st === 'poor' ? 0.7 : 1);
    g.strokeRect(0, 0, v.w, v.h);
    if (chip) {
      g.fillStyle(tint, dim);
      g.fillRect(0, 0, 3, v.h);
    }
    v.icon.setAlpha(st === 'locked' ? 0.3 : st === 'poor' ? 0.7 : 1);
    v.name.setAlpha(st === 'locked' ? 0.5 : 1);
    if (st === 'owned') {
      v.cost.setText('OK').setColor(hex(0xffffff));
    } else {
      v.cost.setText(v.node.cost.toLocaleString('en-US')).setColor(hex(st === 'poor' ? PALETTE.hostile : st === 'locked' ? PALETTE.textDim : PALETTE.white));
    }
  }

  private drawLines(): void {
    const g = this.lines;
    g.clear();
    const lineFor = (childId: string, draw: () => void): void => {
      const lit = profile.unlocked.has(childId);
      g.lineStyle(lit ? 2.5 : 1.5, lit ? TREE_TINTS[NODE_BY_ID.get(childId)!.tint] : 0x8fa4ab, lit ? 0.95 : 0.4);
      draw();
    };
    // Group chips by parent so they share one bracket.
    const chipsByParent = new Map<string, View[]>();
    for (const v of this.views.values()) {
      const p = v.node.requires ? this.views.get(v.node.requires) : undefined;
      if (!p) continue;
      if (v.node.kind === 'main') {
        const x1 = p.x + p.w;
        const y1 = p.y + p.h / 2;
        const x2 = v.x;
        const y2 = v.y + v.h / 2;
        const mid = (x1 + x2) / 2;
        lineFor(v.node.id, () => {
          g.lineBetween(x1, y1, mid, y1);
          g.lineBetween(mid, y1, mid, y2);
          g.lineBetween(mid, y2, x2, y2);
        });
      } else {
        const arr = chipsByParent.get(p.node.id) ?? [];
        arr.push(v);
        chipsByParent.set(p.node.id, arr);
      }
    }
    for (const [pid, chips] of chipsByParent) {
      const p = this.views.get(pid)!;
      const sx = p.x + p.w / 2;
      const by = p.y + p.h + L.chipDrop / 2;
      const anyLit = chips.some((c) => profile.unlocked.has(c.node.id));
      g.lineStyle(anyLit ? 2.5 : 1.5, anyLit ? TREE_TINTS[p.node.tint] : 0x8fa4ab, anyLit ? 0.95 : 0.4);
      g.lineBetween(sx, p.y + p.h, sx, by);
      const xs = chips.map((c) => c.x + c.w / 2);
      g.lineBetween(Math.min(sx, ...xs), by, Math.max(sx, ...xs), by);
      for (const c of chips) {
        lineFor(c.node.id, () => g.lineBetween(c.x + c.w / 2, by, c.x + c.w / 2, c.y));
      }
    }
  }

  private drawCursor(): void {
    const g = this.cursor;
    g.clear();
    const v = this.views.get(this.selected);
    if (!v) return;
    const tint = TREE_TINTS[v.node.tint];
    g.lineStyle(2, 0xffffff, 0.95);
    g.strokeRect(v.x - 6, v.y - 6, v.w + 12, v.h + 12);
    g.lineStyle(1, tint, 0.7);
    g.strokeRect(v.x - 10, v.y - 10, v.w + 20, v.h + 20);
    // Corner ticks.
    g.lineStyle(3, 0xffffff, 1);
    const c = 12;
    for (const [cx, cy, sx, sy] of [
      [v.x - 6, v.y - 6, 1, 1], [v.x + v.w + 6, v.y - 6, -1, 1],
      [v.x - 6, v.y + v.h + 6, 1, -1], [v.x + v.w + 6, v.y + v.h + 6, -1, -1],
    ] as const) {
      g.lineBetween(cx, cy, cx + c * sx, cy);
      g.lineBetween(cx, cy, cx, cy + c * sy);
    }
  }

  private drawHeader(): void {
    this.title.setText(`| ${TREE_LABELS[this.tab]} |`);
    this.intelText.setText(`INTEL ${profile.intel.toLocaleString('en-US')}`);
    this.tabText.forEach((t, i) => {
      const on = TABS[i] === this.tab;
      t.setColor(hex(on ? PALETTE.white : PALETTE.textDim));
      t.setText(`${on ? '[' : ' '}${TABS[i].toUpperCase()}${on ? ']' : ' '}`);
    });
  }

  private drawInfo(): void {
    const v = this.views.get(this.selected);
    const g = this.infoGfx;
    g.clear();
    if (!v) return;
    const n = v.node;
    const st = this.stateOf(n);
    const w = this.scale.width;
    const h = this.scale.height;
    const pw = 372;
    const x = w - pw - 20;
    const lines = n.effects.map(fmtEffect);
    this.infoTitle.setText(n.name).setColor(hex(TREE_TINTS[n.tint]));
    this.infoBody.setText(`${n.desc}\n\n${lines.map((l) => `- ${l}`).join('\n')}`);
    let status: string;
    let color: number = PALETTE.ammo;
    if (st === 'owned') {
      status = n.cost === 0 ? 'ACTIVE' : 'UNLOCKED';
      color = PALETTE.player;
    } else if (st === 'locked') {
      status = `REQUIRES ${NODE_BY_ID.get(n.requires!)!.name}`;
      color = PALETTE.textDim;
    } else if (st === 'poor') {
      status = `${n.cost.toLocaleString('en-US')} INTEL  -  NEED ${(n.cost - profile.intel).toLocaleString('en-US')} MORE`;
      color = PALETTE.hostile;
    } else {
      status = `${n.cost.toLocaleString('en-US')} INTEL  -  [ENTER] UNLOCK`;
    }
    this.infoStatus.setText(status).setColor(hex(color));
    const ph = 20 + this.infoTitle.height + 8 + this.infoBody.height + 12 + this.infoStatus.height + 16;
    const y = h - FOOTER_H - ph - 12;
    g.fillStyle(0x040a0f, 0.9);
    g.fillRect(x, y, pw, ph);
    g.lineStyle(2, TREE_TINTS[n.tint], 0.9);
    g.strokeRect(x, y, pw, ph);
    this.infoTitle.setPosition(x + 18, y + 14);
    this.infoBody.setPosition(x + 18, y + 14 + this.infoTitle.height + 8);
    this.infoStatus.setPosition(x + 18, y + ph - 16 - this.infoStatus.height);
  }

  private layoutUi(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.bg.setSize(w, h);
    this.flash.setSize(w, h);
    const g = this.uiBg;
    g.clear();
    g.fillStyle(PALETTE.bg, 0.88);
    g.fillRect(0, 0, w, HEADER_H);
    g.fillRect(0, h - FOOTER_H, w, FOOTER_H);
    g.lineStyle(1, PALETTE.structureDim, 0.8);
    g.lineBetween(0, HEADER_H, w, HEADER_H);
    g.lineBetween(0, h - FOOTER_H, w, h - FOOTER_H);
    this.title.setPosition(24, 14);
    this.tabText.forEach((t, i) => t.setPosition(26 + i * 120, 52));
    this.intelText.setPosition(w - 24, 18);
    this.hint
      .setText('ARROWS select   ENTER / CLICK unlock   DRAG pan   WHEEL zoom   Q E switch tree   TAB close')
      .setPosition(24, h - 14);
    this.drawGrid();
    this.drawInfo();
  }

  private drawGrid(): void {
    const g = this.grid;
    g.clear();
    const w = this.scale.width;
    const h = this.scale.height;
    const step = 100 * this.zoom;
    const ox = ((this.panX % step) + step) % step;
    const oy = ((this.panY % step) + step) % step;
    for (let x = ox; x < w; x += step) {
      g.lineStyle(1, PALETTE.floorLine, 1);
      g.lineBetween(x, 0, x, h);
    }
    for (let y = oy; y < h; y += step) {
      g.lineStyle(1, PALETTE.floorLine, 1);
      g.lineBetween(0, y, w, y);
    }
  }

  // ------------------------------------------------------------------
  // View
  // ------------------------------------------------------------------

  private applyView(): void {
    this.world.setPosition(this.panX, this.panY).setScale(this.zoom);
    this.drawGrid();
  }

  private fitView(): void {
    let maxX = 0;
    let maxY = 0;
    for (const v of this.views.values()) {
      maxX = Math.max(maxX, v.x + v.w);
      maxY = Math.max(maxY, v.y + v.h);
    }
    const w = this.scale.width;
    const h = this.scale.height - HEADER_H - FOOTER_H;
    const bw = maxX + L.originX * 0.4;
    const bh = maxY + 40 - L.originY * 0.5;
    this.zoom = Phaser.Math.Clamp(Math.min(w / bw, h / bh, 1), ZOOM_MIN, 1);
    this.panX = 16;
    this.panY = HEADER_H + 10 - L.originY * 0.5 * this.zoom;
    this.applyView();
  }

  private ensureVisible(v: View): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const m = 40;
    const left = this.panX + v.x * this.zoom;
    const right = this.panX + (v.x + v.w) * this.zoom;
    const top = this.panY + v.y * this.zoom;
    const bottom = this.panY + (v.y + v.h) * this.zoom;
    if (left < m) this.panX += m - left;
    if (right > w - m) this.panX -= right - (w - m);
    if (top < HEADER_H + m) this.panY += HEADER_H + m - top;
    if (bottom > h - FOOTER_H - m) this.panY -= bottom - (h - FOOTER_H - m);
    this.applyView();
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------

  private toTree(px: number, py: number): { x: number; y: number } {
    return { x: (px - this.panX) / this.zoom, y: (py - this.panY) / this.zoom };
  }

  private nodeAt(px: number, py: number): View | undefined {
    const p = this.toTree(px, py);
    for (const v of this.views.values()) {
      if (p.x >= v.x && p.x <= v.x + v.w && p.y >= v.y && p.y <= v.y + v.h) return v;
    }
    return undefined;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    this.dragging = true;
    this.dragMoved = false;
    this.dragStart = { x: p.x, y: p.y, px: this.panX, py: this.panY };
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging && p.isDown) {
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      if (this.dragMoved || Math.hypot(dx, dy) > 5) {
        this.dragMoved = true;
        this.panX = this.dragStart.px + dx;
        this.panY = this.dragStart.py + dy;
        this.applyView();
      }
      return;
    }
    const v = this.nodeAt(p.x, p.y);
    if (v && v.node.id !== this.selected) {
      this.selected = v.node.id;
      this.drawCursor();
      this.drawInfo();
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const wasDrag = this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;
    if (wasDrag) return;
    if (p.y < HEADER_H) {
      // Tabs live in the header.
      TABS.forEach((t, i) => {
        const tt = this.tabText[i];
        if (p.x >= tt.x && p.x <= tt.x + 110 && p.y >= tt.y - 6) this.switchTab(t);
      });
      return;
    }
    const v = this.nodeAt(p.x, p.y);
    if (!v) return;
    this.selected = v.node.id;
    this.buy(v);
  }

  private onWheel(p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    const before = this.toTree(p.x, p.y);
    this.zoom = Phaser.Math.Clamp(this.zoom * (dy > 0 ? 0.9 : 1.1), ZOOM_MIN, ZOOM_MAX);
    this.panX = p.x - before.x * this.zoom;
    this.panY = p.y - before.y * this.zoom;
    this.applyView();
  }

  update(): void {
    const K = Phaser.Input.Keyboard;
    const k = this.keys;
    if (K.JustDown(k.TAB) || K.JustDown(k.ESC)) {
      this.close();
      return;
    }
    if (K.JustDown(k.Q)) this.switchTab(TABS[(TABS.indexOf(this.tab) + TABS.length - 1) % TABS.length]);
    if (K.JustDown(k.E)) this.switchTab(TABS[(TABS.indexOf(this.tab) + 1) % TABS.length]);
    if (K.JustDown(k.ONE)) this.switchTab('research');
    if (K.JustDown(k.TWO)) this.switchTab('perks');
    if (K.JustDown(k.LEFT) || K.JustDown(k.A)) this.move(-1, 0);
    if (K.JustDown(k.RIGHT) || K.JustDown(k.D)) this.move(1, 0);
    if (K.JustDown(k.UP) || K.JustDown(k.W)) this.move(0, -1);
    if (K.JustDown(k.DOWN) || K.JustDown(k.S)) this.move(0, 1);
    if (K.JustDown(k.ENTER) || K.JustDown(k.SPACE)) {
      const v = this.views.get(this.selected);
      if (v) this.buy(v);
    }
  }

  private move(dx: number, dy: number): void {
    let cur = this.views.get(this.selected);
    if (!cur) return;
    if (cur.node.kind === 'chip') {
      const parent = this.views.get(cur.node.requires!);
      if (!parent) return;
      if (dy < 0) return this.select(parent);
      if (dx !== 0) {
        const sibs = [...this.views.values()]
          .filter((v) => v.node.kind === 'chip' && v.node.requires === cur!.node.requires)
          .sort((p, q) => p.x - q.x);
        const next = sibs[sibs.indexOf(cur) + dx];
        if (next) return this.select(next);
      }
      cur = parent;
    } else if (dy > 0) {
      const chip = [...this.views.values()]
        .filter((v) => v.node.kind === 'chip' && v.node.requires === cur!.node.id)
        .sort((p, q) => p.x - q.x)[0];
      if (chip) return this.select(chip);
    }
    const cx = cur.x + cur.w / 2;
    const cy = cur.y + cur.h / 2;
    let best: View | undefined;
    let bestScore = Infinity;
    for (const v of this.views.values()) {
      if (v === cur || v.node.kind !== 'main') continue;
      const vx = v.x + v.w / 2 - cx;
      const vy = v.y + v.h / 2 - cy;
      const along = vx * dx + vy * dy;
      if (along <= 4) continue;
      const across = Math.abs(vx * dy) + Math.abs(vy * dx);
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = v;
      }
    }
    if (best) this.select(best);
  }

  private select(v: View): void {
    this.selected = v.node.id;
    this.ensureVisible(v);
    this.drawCursor();
    this.drawInfo();
  }

  private switchTab(t: TreeId): void {
    if (t === this.tab) return;
    this.tab = t;
    this.buildTree(t);
    this.fitView();
    this.refreshAll();
    this.sfx?.step();
  }

  private buy(v: View): void {
    const c = checkUnlock(v.node.id, profile.unlocked, profile.intel);
    if (!c.ok) {
      if (c.reason !== 'owned') {
        this.sfx?.empty();
        this.tweens.add({ targets: v.cont, x: v.x + 6, duration: 40, yoyo: true, repeat: 2, onComplete: () => v.cont.setX(v.x) });
      }
      this.drawInfo();
      return;
    }
    tryUnlock(v.node.id);
    this.sfx?.pickup(4);
    this.flash.setAlpha(0.18);
    this.tweens.add({ targets: this.flash, alpha: 0, duration: 260 });
    this.tweens.add({ targets: v.cont, scale: 1.06, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.refreshAll();
  }

  private close(): void {
    if (this.returnTo === 'FeelTest') showCursor(this, false);
    this.scene.resume(this.returnTo);
    this.scene.stop();
  }
}
