// The deployment in progress: which bunker, the generated rooms, where you are. Plain module state,
// like runState and profile. Each room is a fresh FeelTest scene; this is what carries across them.
import { BUNKER_BY_ID, type BunkerDef } from '../data/missions';
import { Rng } from '../sim/math';
import { generateRun, type RoomPlan, type RunPlan } from '../sim/run';
import { extractAll, profile } from './profile';
import { resetVitals, runState } from './runState';

export interface ActiveRun {
  bunker: BunkerDef;
  plan: RunPlan;
  /** Index of the room in play. */
  index: number;
  startIntel: number;
  roomsCleared: number;
}

let active: ActiveRun | null = null;

export const currentRun = (): ActiveRun | null => active;
export const currentRoom = (): RoomPlan | null => (active ? active.plan.rooms[active.index] : null);

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
    roomsCleared: 0,
  };
  return active;
}

/** Descend to the next room. Restores some hull, all shield and some ammo, as the lift ride does. */
export function advanceRun(heal: number, ammo: number): RoomPlan | null {
  if (!active || active.index >= active.plan.rooms.length - 1) return null;
  active.roomsCleared += 1;
  active.index += 1;
  runState.hp = Math.min(runState.maxHp, runState.hp + runState.maxHp * heal);
  runState.shield = runState.maxShield;
  runState.reserve = Math.min(runState.maxReserve, runState.reserve + Math.round(runState.maxReserve * ammo));
  return active.plan.rooms[active.index];
}

export function endRun(): void {
  active = null;
}
