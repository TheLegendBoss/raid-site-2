// Run generation: a bunker becomes a list of floors, each with a seed, so a run can be read (and
// tested) before anything is drawn. The floor itself is built from its seed by src/sim/dungeon.ts
// when it is entered. Pure.
import type { BunkerDef } from '../data/missions';
import type { FloorParams } from './dungeon';
import type { Rng } from './math';

export interface FloorPlan {
  index: number; // 0-based across the run
  floor: number; // 1-based
  floors: number;
  seed: number;
  /** The Warden's floor: its far room is the boss room, and the exit opens when it falls. */
  final: boolean;
  /** What the enemy composer sees: deeper floors unlock the nastier kinds sooner. */
  depth: number;
}

export interface RunPlan {
  bunkerId: string;
  plans: FloorPlan[];
}

export function generateRun(b: BunkerDef, rng: Rng): RunPlan {
  const plans: FloorPlan[] = [];
  for (let i = 0; i < b.floors; i++) {
    plans.push({
      index: i, floor: i + 1, floors: b.floors, final: i === b.floors - 1,
      depth: i * 2 + b.depthBonus, seed: Math.floor(rng.next() * 4294967296),
    });
  }
  return { bunkerId: b.id, plans };
}

export function floorParams(plan: FloorPlan, b: BunkerDef): FloorParams {
  return { seed: plan.seed, depth: plan.depth, final: plan.final, rooms: b.rooms, budgetMul: b.budgetMul, bias: b.bias };
}
