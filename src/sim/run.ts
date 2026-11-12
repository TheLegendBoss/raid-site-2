// Run generation: a bunker becomes a list of rooms, each with its layout and its waves already
// composed, so a run can be read (and tested) before anything is drawn. Pure.
import { LAYOUTS, ROOM_LAYOUTS, type LayoutId } from '../data/arena';
import type { BunkerDef } from '../data/missions';
import { composeWave, type WaveEntry } from './waves';
import type { Rng } from './math';

export interface RoomPlan {
  index: number; // 0-based across the run
  floor: number; // 1-based
  roomOnFloor: number; // 1-based
  roomsOnFloor: number;
  layout: LayoutId;
  waves: WaveEntry[][];
  /** The first room of a floor: its entry pad is the floor's lift, and extracts. */
  elevator: boolean;
  /** The Warden's room: clearing it completes the run. */
  final: boolean;
  /** Room index plus the bunker's depth bonus: what the wave composer sees. */
  depth: number;
}

export interface RunPlan {
  bunkerId: string;
  floors: number;
  rooms: RoomPlan[];
}

export function generateRun(b: BunkerDef, rng: Rng): RunPlan {
  const rooms: RoomPlan[] = [];
  const total = b.floors.reduce((a, n) => a + n, 0);
  let prev: LayoutId | null = null;
  b.floors.forEach((count, fi) => {
    for (let r = 0; r < count; r++) {
      const index = rooms.length;
      const final = index === total - 1;
      const depth = index + b.depthBonus;
      let layout: LayoutId;
      let waves: WaveEntry[][];
      if (final) {
        layout = 'sanctum';
        waves = [[{ kind: 'warden', count: 1 }]];
      } else {
        const options = ROOM_LAYOUTS.filter((l) => l !== prev);
        layout = rng.pick(options);
        const n = Math.round(rng.range(b.waves[0], b.waves[1]));
        waves = [];
        for (let w = 0; w < n; w++) {
          waves.push(composeWave({ depth, waveIndex: w, budgetMul: b.budgetMul, bias: b.bias }, rng));
        }
      }
      prev = layout;
      rooms.push({ index, floor: fi + 1, roomOnFloor: r + 1, roomsOnFloor: count, layout, waves, elevator: r === 0, final, depth });
    }
  });
  return { bunkerId: b.id, floors: b.floors.length, rooms };
}

export const layoutName = (id: LayoutId): string => LAYOUTS[id].name;
