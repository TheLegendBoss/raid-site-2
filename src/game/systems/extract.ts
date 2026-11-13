// Pads: a floor's entry and its exit. In a bunker the entry is the lift you came down in (it extracts);
// the exit descends to the next floor, or on the Warden's floor opens once it has fallen and extracts with
// the run complete. In the dev room the entry is always open and the exit opens after a few waves.
// Standing on an open pad is required. Pad art is static (arenaArt); this system
// owns the small state overlay (open/sealed ring, the pulse while you stand on one) and redraws it
// only when that state changes.
import Phaser from 'phaser';
import { EXTRACTS, type PadDef } from '../../data/arena';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import type { Ctx } from '../ctx';
import { pushFeed, runState } from '../runState';

type Pad = PadDef;
export type PadAction = 'extract' | 'descend';

export class ExtractSystem {
  private gfx: Phaser.GameObjects.Graphics;
  private glows: Phaser.GameObjects.Image[] = [];
  private drawnKey = '';
  private pulse = 0;

  constructor(private readonly g: Ctx) {
    this.gfx = g.scene.add.graphics().setDepth(-20);
    for (const e of EXTRACTS) {
      this.glows.push(
        g.scene.add.image(e.x, e.y, 'glow').setDepth(-21).setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0),
      );
    }
  }

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  /** Waves beaten so far; the wave counter ticks up when a wave starts. */
  private wavesCleared(): number {
    return this.w.waveLive ? this.w.wave - 1 : this.w.wave;
  }

  private wavesLeft(): number {
    return Math.max(0, this.w.wavesToClear - this.wavesCleared());
  }

  isOpen(pad: Pad): boolean {
    const plan = this.w.plan;
    if (plan) {
      // A bunker floor: the lift you came down in always takes you back up; the way down is open
      // unless it is the Warden's floor, where the exit waits for the Warden.
      if (pad.id === 'entry') return true;
      return !plan.final || this.w.bossDown;
    }
    if (pad.id === 'entry') return true;
    return this.wavesLeft() === 0 && !this.w.waveLive;
  }

  /** What using the pad under the player does. */
  action(pad: Pad): PadAction {
    if (pad.id === 'exit' && this.w.plan && !this.w.plan.final) return 'descend';
    return 'extract';
  }

  private openPrompt(pad: Pad): string {
    const plan = this.w.plan;
    if (!plan) return `[X] EXTRACT  (${pad.label})`;
    if (pad.id === 'entry') return '[X] EXTRACT  (LIFT UP)';
    if (plan.final) return '[X] EXTRACT  (RUN COMPLETE)';
    return `[X] DESCEND  (FLOOR ${plan.floor + 1})`;
  }

  /** The pad under the player, if any. */
  padUnder(): Pad | null {
    const r = T.extract.padRadius;
    for (const e of EXTRACTS) {
      if (Math.hypot(this.w.px - e.x, this.w.py - e.y) <= r) return e;
    }
    return null;
  }

  /** True when X may extract right now. Otherwise explains why in the feed. */
  canExtract(): boolean {
    const pad = this.padUnder();
    if (!pad) {
      pushFeed('No extract point here. Reach the entry or the exit pad.', PALETTE.hostile);
      this.g.sfx.empty();
      return false;
    }
    if (!this.isOpen(pad)) {
      pushFeed(this.w.plan ? 'The exit is sealed until the Warden falls.' : `Exit sealed: clear ${this.wavesLeft()} more wave(s)`, PALETTE.hostile);
      this.g.sfx.empty();
      return false;
    }
    return true;
  }

  update(dt: number): void {
    const under = this.padUnder();
    const exitOpen = this.isOpen(EXTRACTS[1]);
    const entryOpen = this.isOpen(EXTRACTS[0]);
    const key = `${under?.id ?? ''}:${exitOpen}:${entryOpen}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.redraw(under, exitOpen, entryOpen);
    }
    // The pulse under your feet is a tween on an image, not a Graphics redraw.
    this.pulse += dt * 4;
    EXTRACTS.forEach((e, i) => {
      const open = this.isOpen(e);
      const on = under?.id === e.id;
      const base = open ? 0.1 : 0.03;
      this.glows[i].setPosition(e.x, e.y);
      this.glows[i].setTint(open ? PALETTE.structure : e.id === 'entry' ? PALETTE.structureDim : PALETTE.hostile);
      this.glows[i].setAlpha(on && open ? base + 0.14 + Math.sin(this.pulse) * 0.08 : base);
    });
    runState.extractOpen = !!under && this.isOpen(under);
    runState.extractPrompt = !under
      ? ''
      : this.isOpen(under)
        ? this.openPrompt(under)
        : under.id === 'entry'
          ? ''
          : this.w.plan
            ? 'EXIT SEALED  the Warden still stands'
            : `EXIT SEALED  clear ${this.wavesLeft()} more wave(s)`;
  }

  private redraw(under: Pad | null, exitOpen: boolean, entryOpen: boolean): void {
    const g = this.gfx;
    g.clear();
    const r = T.extract.padRadius;
    for (const e of EXTRACTS) {
      const open = e.id === 'entry' ? entryOpen : exitOpen;
      const on = under?.id === e.id;
      if (e.id === 'entry' && !entryOpen) {
        // A lift you came down in: spent, not a threat.
        g.lineStyle(2, PALETTE.structureDim, 0.5);
        g.strokeCircle(e.x, e.y, r + 6);
        continue;
      }
      g.lineStyle(on ? 5 : 3, open ? PALETTE.structure : PALETTE.hostile, open ? (on ? 1 : 0.7) : 0.6);
      g.strokeCircle(e.x, e.y, r + 6);
      if (!open) {
        // Sealed: a bar across the shaft.
        g.lineStyle(6, PALETTE.hostile, 0.8);
        g.lineBetween(e.x - r * 0.6, e.y - r * 0.6, e.x + r * 0.6, e.y + r * 0.6);
        g.lineBetween(e.x - r * 0.6, e.y + r * 0.6, e.x + r * 0.6, e.y - r * 0.6);
      }
    }
  }
}
