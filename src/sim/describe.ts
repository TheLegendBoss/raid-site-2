// Turns an item into display stat lines (for the base screen). Pure TypeScript.
import type { BaseItem } from '../data/items';
import { RARITY_TIER } from '../data/loot';
import { resolveWeapon } from './weapon';

export interface StatLine {
  key: string;
  label: string;
  value: number;
  text: string;
  /** True when a bigger number is better (so comparisons colour correctly). */
  higherBetter: boolean;
}

const line = (key: string, label: string, value: number, text: string, higherBetter = true): StatLine => ({
  key, label, value, text, higherBetter,
});

const r1 = (n: number): string => (Math.round(n * 10) / 10).toString();

export function statLines(base: BaseItem, rarity: number): StatLine[] {
  const t = RARITY_TIER[rarity];
  if (base.weapon) {
    // Resolved at this rarity, so the lines show what an item of this rarity really fires with.
    const w = resolveWeapon(base.weapon, rarity);
    const perPull = w.damage * w.pellets * w.burstCount;
    const rate = w.burstCount / w.fireDelay;
    const dps = perPull / (w.fireDelay + (w.burstCount - 1) * w.burstGap);
    return [
      line('dmg', 'Damage', perPull, w.pellets > 1 ? `${r1(w.damage)} x${w.pellets}` : w.burstCount > 1 ? `${r1(w.damage)} x${w.burstCount}` : r1(w.damage)),
      line('dps', 'DPS', dps, r1(dps)),
      line('rate', 'Fire rate', rate, `${r1(rate)}/s`),
      line('mag', 'Magazine', w.mag, String(w.mag)),
      line('reload', 'Reload', w.reload, `${r1(w.reload)}s`, false),
      line('spread', 'Spread', w.spread, `${r1(w.spread)}°`, false),
      line('move', 'Spread on the move', w.moveSpread, `+${r1(w.moveSpread)}°`, false),
      line('ap', 'Armour pen', w.ap, r1(w.ap)),
      line('stagger', 'Stagger', w.stagger * w.pellets, String(Math.round(w.stagger * w.pellets * 100))),
      line('mobility', 'Mobility', w.mobility, `${Math.round(w.mobility * 100)}%`),
      ...(w.pierce > 0 ? [line('pierce', 'Pierces', w.pierce, `${w.pierce}`)] : []),
    ];
  }
  if (base.blade) {
    const b = base.blade;
    return [
      line('dmg', 'Damage', b.damage * t, r1(b.damage * t)),
      line('cd', 'Cooldown', b.cooldown, `${r1(b.cooldown)}s`, false),
      line('reach', 'Reach', b.reach, String(b.reach)),
      line('arc', 'Arc', b.arcHalfAngle * 2, `${b.arcHalfAngle * 2}°`),
      line('stagger', 'Stagger', b.stagger, `${r1(b.stagger)}s`),
    ];
  }
  if (base.armour) {
    const a = base.armour;
    return [
      line('hull', 'Hull', a.hull * t, String(Math.round(a.hull * t))),
      line('shield', 'Shield', a.shield * t, String(Math.round(a.shield * t))),
      line('move', 'Move speed', a.moveMul, `${Math.round(a.moveMul * 100)}%`),
      line('dash', 'Dash cooldown', a.dashCdMul, `${Math.round(a.dashCdMul * 100)}%`, false),
    ];
  }
  const p = base.pack!;
  return [
    line('reserve', 'Reserve', p.reserve * t, String(Math.round(p.reserve * t))),
    line('carry', 'Carry slots', p.carry, `${p.carry >= 0 ? '+' : ''}${p.carry}`),
    line('dash', 'Dash cooldown', p.dashCdMul, `${Math.round(p.dashCdMul * 100)}%`, false),
    line('bcd', 'Blade cooldown', p.bladeCdMul, `${Math.round(p.bladeCdMul * 100)}%`, false),
  ];
}
