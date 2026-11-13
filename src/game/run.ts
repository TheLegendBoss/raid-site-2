// The deployment in progress: which bunker, the generated rooms, where you are. Plain module state,
// like runState and profile. Each room is a fresh FeelTest scene; this is what carries across them.
import { BUNKER_BY_ID, type BunkerDef } from '../data/missions';
import { Rng } from '../sim/math';
import { generateRun, type FloorPlan, type RunPlan } from '../sim/run';
import { extractAll, profile } from './profile';
import { resetVitals, runState } from './runState';

export interface ActiveRun {
  bunker: BunkerDef;
  plan: RunPlan;
  /** Index of the floor in play. */
  index: number;
  startIntel: number;
  floorsCleared: number;
}

let active: ActiveRun | null = null;

export const currentRun = (): ActiveRun | null => active;
export const currentFloor = (): FloorPlan | null => (active ? active.plan.plans[active.index] : null);

/** Start a deployment: bank anything left in the pack, refill, roll the rooms. */
export function beginRun(bunkerId: string): ActiveRun | null {
  const bunker = BUNKER_BY_ID.get(bunkerId);
  if (!bunker) return null;
  extractAll();
  runState.carried = [];
  runState.carriedScrap = 0;
  resetVitals();
  active = {
    bunker,
    plan: generateRun(bunker, new Rng((Date.now() ^ 0x51ed270b) >>> 0)),
    index: 0,
    startIntel: profile.intel,
    floorsCleared: 0,
  };
  return active;
}

/** Descend to the next floor. Restores some hull, all shield and some ammo, as the lift ride does. */
export function advanceRun(heal: number, ammo: number): FloorPlan | null {
  if (!active || active.index >= active.plan.plans.length - 1) return null;
  active.floorsCleared += 1;
  active.index += 1;
  runState.hp = Math.min(runState.maxHp, runState.hp + runState.maxHp * heal);
  runState.shield = runState.maxShield;
  runState.reserve = Math.min(runState.maxReserve, runState.reserve + Math.round(runState.maxReserve * ammo));
  return active.plan.plans[active.index];
}

export function endRun(): void {
  active = null;
}
