// Wave composition: spend a threat budget on the enemies a room's depth allows. Pure.
import { MOBS, MOB_KINDS, type MobKind } from '../data/mobs';
import { TUNING as T } from '../data/tuning';
import type { Rng } from './math';

export interface WaveEntry {
  kind: MobKind;
  count: number;
}

export interface WaveParams {
  depth: number; // room index plus the bunker's depth bonus
  waveIndex: number; // 0-based within the room
  budgetMul: number;
  bias: Partial<Record<MobKind, number>>;
}

export function waveBudget(p: WaveParams): number {
  const R = T.run;
  return Math.round((R.budgetBase + R.budgetPerDepth * p.depth + R.budgetPerWave * p.waveIndex) * p.budgetMul);
}

export function composeWave(p: WaveParams, rng: Rng): WaveEntry[] {
  return composeBudget(waveBudget(p), p.depth, p.bias, rng);
}

/** Buy enemies with the budget: weighted picks from everything unlocked at this depth, capped per kind. */
export function composeBudget(budget: number, depth: number, bias: Partial<Record<MobKind, number>>, rng: Rng): WaveEntry[] {
  const p = { depth, bias };
  const pool = MOB_KINDS.filter((k) => MOBS[k].weight > 0 && MOBS[k].minDepth <= p.depth);
  const counts = new Map<MobKind, number>();
  let left = budget;
  for (let guard = 0; left > 0 && guard < 200; guard++) {
    const open = pool.filter((k) => MOBS[k].cost <= left && (counts.get(k) ?? 0) < MOBS[k].maxPerWave);
    if (open.length === 0) break;
    const weights = open.map((k) => MOBS[k].weight * (p.bias[k] ?? 1));
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    let pick = open[open.length - 1];
    for (let i = 0; i < open.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        pick = open[i];
        break;
      }
    }
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
    left -= MOBS[pick].cost;
  }
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => MOBS[a.kind].cost - MOBS[b.kind].cost);
}
