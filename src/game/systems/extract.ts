// Extract pads: the floor's entry (always open) and its exit (opens once the floor is beaten).
// Extraction only works while standing on an open pad. Pad art is static (arenaArt); this system
// owns the small state overlay (open/sealed ring, the pulse while you stand on one) and redraws it
// only when that state changes.
import Phaser from 'phaser';
import { EXTRACTS } from '../../data/arena';
import { PALETTE } from '../../data/palette';
import { TUNING as T } from '../../data/tuning';
import type { Ctx } from '../ctx';
import { pushFeed, runState } from '../runState';

type Pad = (typeof EXTRACTS)[number];

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

  isOpen(pad: Pad): boolean {
    return pad.id === 'entry' || this.wavesCleared() >= T.extract.exitAfterWave;
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
      pushFeed(`Exit sealed: clear ${T.extract.exitAfterWave - this.wavesCleared()} more wave(s)`, PALETTE.hostile);
      this.g.sfx.empty();
      return false;
    }
    return true;
  }

  update(dt: number): void {
    const under = this.padUnder();
    const exitOpen = this.isOpen(EXTRACTS[1]);
    const key = `${under?.id ?? ''}:${exitOpen}`;
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.redraw(under, exitOpen);
    }
    // The pulse under your feet is a tween on an image, not a Graphics redraw.
    this.pulse += dt * 4;
    EXTRACTS.forEach((e, i) => {
      const open = this.isOpen(e);
      const on = under?.id === e.id;
      const base = open ? 0.1 : 0.03;
      this.glows[i].setTint(open ? PALETTE.structure : PALETTE.hostile);
      this.glows[i].setAlpha(on && open ? base + 0.14 + Math.sin(this.pulse) * 0.08 : base);
    });
    runState.extractOpen = !!under && this.isOpen(under);
    runState.extractPrompt = !under
      ? ''
      : this.isOpen(under)
        ? `[X] EXTRACT  (${under.label})`
        : `EXIT SEALED  clear ${T.extract.exitAfterWave - this.wavesCleared()} more wave(s)`;
  }

  private redraw(under: Pad | null, exitOpen: boolean): void {
    const g = this.gfx;
    g.clear();
    const r = T.extract.padRadius;
    for (const e of EXTRACTS) {
      const open = e.id === 'entry' || exitOpen;
      const on = under?.id === e.id;
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
