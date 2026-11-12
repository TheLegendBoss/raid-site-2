import { TUNING as T } from '../../data/tuning';
import { extractAll, profile } from '../profile';
import Phaser from 'phaser';
import { PALETTE, RARITY_COLORS } from '../../data/palette';
import { X0, X1, Y0, Y1 } from '../../data/arena';
import { poly } from '../../fx/mobArt';
import { pushFeed, runState, setBanner } from '../runState';
import { baseOf, rarityLabel, rollDrop } from '../../sim/loot';
import { clamp } from '../../sim/math';
import type { Ctx } from '../ctx';

/** Drops, pickup and extraction. */
export class LootSystem {
  constructor(private readonly g: Ctx) {}

  private get w(): Ctx['w'] {
    return this.g.w;
  }

  dropLoot(x: number, y: number, minRarity: number): void {
    const roll = rollDrop(this.g.rng, minRarity);
    const item = roll.kind === 'item' ? roll.item : undefined;
    const scrap = roll.kind === 'scrap' ? roll.amount : undefined;
    const rarity = item ? item.rarity : 0;
    const color = item ? RARITY_COLORS[item.rarity] : PALETTE.scrap;
    const s = item ? 7 + rarity * 1.3 : 5.5;
    const gfx = this.g.scene.add.graphics().setDepth(8);
    gfx.fillStyle(color, 0.35);
    gfx.lineStyle(2, color, 1);
    const pts = [{ x: 0, y: -s }, { x: s * 0.7, y: 0 }, { x: 0, y: s }, { x: -s * 0.7, y: 0 }];
    gfx.fillPoints(poly(pts), true);
    gfx.strokePoints(poly(pts), true);
    const baseAlpha = item ? 0.45 + rarity * 0.07 : 0.4;
    const glow = this.g.scene.add
      .image(x, y, 'glow')
      .setDepth(7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(color)
      .setScale(item ? 0.45 + rarity * 0.14 : 0.35)
      .setAlpha(baseAlpha);
    let beam: Phaser.GameObjects.Image | undefined;
    if (rarity >= 4) {
      beam = this.g.scene.add
        .image(x, y, 'px')
        .setOrigin(0.5, 1)
        .setDepth(7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color)
        .setScale(0.9 + (rarity - 4) * 0.5, 22 + (rarity - 4) * 8)
        .setAlpha(0.5);
    }
    const a = Math.random() * Math.PI * 2;
    const sp = 70 + Math.random() * 150;
    this.w.drops.push({
      item, scrap, gfx, glow, beam, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      age: 0, phase: Math.random() * 6, baseAlpha,
    });
    gfx.setPosition(x, y);
    this.g.glows.at(x, y, color, 0.6 + rarity * 0.3, 0.2, 0.25, 0.7);
    this.g.sfx.drop(rarity);
    if (rarity >= 5) this.g.ring(x, y, color, 0.6, 6);
  }

  updateDrops(dt: number): void {
    const L = T.loot;
    this.w.fullWarn -= dt;
    const now = this.g.scene.time.now / 1000;
    for (let i = this.w.drops.length - 1; i >= 0; i--) {
      const d = this.w.drops[i];
      d.age += dt;
      const k = Math.exp(-5 * dt);
      d.vx *= k;
      d.vy *= k;
      const dx = this.w.px - d.x;
      const dy = this.w.py - d.y;
      const dist = Math.hypot(dx, dy);
      const magnet = profile.stats.magnetRadius;
      if (d.age > L.magnetDelay && dist < magnet) {
        const pull = L.magnetSpeed * (1 - dist / magnet * 0.5);
        d.vx += (dx / Math.max(dist, 1)) * pull * dt * 6;
        d.vy += (dy / Math.max(dist, 1)) * pull * dt * 6;
      }
      d.x = clamp(d.x + d.vx * dt, X0 + 8, X1 - 8);
      d.y = clamp(d.y + d.vy * dt, Y0 + 8, Y1 - 8);
      d.gfx.setPosition(d.x, d.y).setRotation(now * 1.4 + d.phase);
      d.glow.setPosition(d.x, d.y).setAlpha(d.baseAlpha * (0.75 + 0.25 * Math.sin(now * 4 + d.phase)));
      d.beam?.setPosition(d.x, d.y);

      if (dist < L.pickupRadius && d.age > 0.15) {
        const item = d.item;
        if (item && runState.carried.length >= profile.stats.carrySlots) {
          // Pack full: the item stays on the floor until there is room.
          if (this.w.fullWarn <= 0) {
            pushFeed('Pack full', PALETTE.hostile);
            this.g.sfx.empty();
            this.w.fullWarn = 1.2;
          }
          continue;
        }
        const rarity = item ? item.rarity : 0;
        const color = item ? RARITY_COLORS[rarity] : PALETTE.scrap;
        if (item) {
          runState.carried.push(item);
          pushFeed(`${rarityLabel(item)} ${baseOf(item).name}`, color);
        } else {
          runState.carriedScrap += d.scrap ?? 0;
          pushFeed(`+${d.scrap} scrap`, color);
        }
        this.g.sfx.pickup(rarity);
        this.g.glows.at(d.x, d.y, color, 1.1, 2.4, 0.22, 0.8);
        this.g.particles.burst(d.x, d.y, 0, Math.PI * 2, 6 + rarity * 2, 40, 220, {
          life: 0.35, w: 7, h: 1.6, color, add: true, drag: 4, align: true,
        });
        d.gfx.destroy();
        d.glow.destroy();
        d.beam?.destroy();
        this.w.drops.splice(i, 1);
      }
    }
  }

  /** Bank everything carried. Null when there was nothing to bank. */
  extract(): { items: number; scrap: number; left: number } | null {
    const n = runState.carried.length;
    if (n === 0 && runState.carriedScrap === 0) {
      pushFeed('Nothing to extract', PALETTE.textDim);
      return null;
    }
    const r = extractAll();
    if (r.items > 0) pushFeed(`Extracted ${r.items} item${r.items > 1 ? 's' : ''} to the stash`, PALETTE.structure);
    if (r.scrap > 0) pushFeed(`Banked ${r.scrap} scrap`, PALETTE.scrap);
    setBanner('EXTRACTED', 1.4);
    this.g.sfx.pickup(5);
    this.g.ring(this.w.px, this.w.py, PALETTE.structure, 0.6, 7);
    return r;
  }
}
