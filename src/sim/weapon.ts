// Turns a base weapon and a rarity into the numbers it actually fires with. Pure TypeScript, used
// by both the stat resolver (combat) and the stat lines (base screen) so they can never disagree.
//
// Rarity does two things. It scales damage and magazine with the shared tier multiplier, and it
// applies the weapon's own `step`: what that family gets better at with each rarity step above
// Common. So an Epic SMG is faster and tighter, an Epic shotgun throws more pellets, an Epic
// marksman rifle pierces more armour and more enemies. Same rarity, different guns.
import type { WeaponDef } from '../data/items';
import { RARITY_TIER } from '../data/loot';

const faster = (v: number, share: number, steps: number): number => v / (1 + share * steps);
const tighter = (v: number, share: number, steps: number): number => v * Math.max(0.3, 1 - share * steps);

export function resolveWeapon(def: WeaponDef, rarity: number): WeaponDef {
  const n = Math.max(0, rarity);
  const t = RARITY_TIER[Math.min(rarity, RARITY_TIER.length - 1)] ?? 1;
  const st = def.step;
  const reloadScale = tighter(1, st.reload ?? 0, n);
  return {
    ...def,
    damage: def.damage * t,
    mag: Math.max(1, Math.round(def.mag * t)),
    fireDelay: faster(def.fireDelay, st.rate ?? 0, n),
    spread: tighter(def.spread, st.spread ?? 0, n),
    reload: def.reload * reloadScale,
    reloadEmpty: def.reloadEmpty * reloadScale,
    bloomPerShot: tighter(def.bloomPerShot, st.bloom ?? 0, n),
    bloomRecovery: def.bloomRecovery * (1 + (st.recovery ?? 0) * n),
    stagger: def.stagger * (1 + (st.stagger ?? 0) * n),
    mobility: def.mobility + (st.mobility ?? 0) * n,
    ap: def.ap + (st.ap ?? 0) * n,
    pellets: def.pellets + Math.floor((st.pellets ?? 0) * n),
    pierce: def.pierce + Math.floor((st.pierce ?? 0) * n),
    burstCount: def.burstCount + (def.burstCount > 1 ? Math.floor((st.burst ?? 0) * n) : 0),
    burstGap: tighter(def.burstGap, st.burstGap ?? 0, n),
  };
}

/** Share of damage that gets through armour. diff = weapon AP minus target armour. */
export function armourFactor(ap: number, armour: number, table: readonly number[]): number {
  if (armour <= 0) return 1;
  const diff = ap - armour;
  if (diff >= 1) return table[3];
  if (diff >= 0) return table[2];
  if (diff >= -1) return table[1];
  return table[0];
}
