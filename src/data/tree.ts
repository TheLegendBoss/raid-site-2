// Research and Perk trees. Plain data, no engine imports.
// Layout follows the aircraft-tree idea: main nodes on a grid joined by
// trunk lines, with small chip nodes hanging under their parent. Everything
// is bought with Intel; a node needs its parent unlocked first.
import type { TreeTint } from './palette';

export type TreeId = 'research' | 'perks';

/** Stats a node can change. Resolved by src/sim/stats.ts. */
export type StatKey =
  | 'hull' | 'shield' | 'shieldRegenRate' | 'shieldRegenDelay' | 'moveSpeed'
  | 'dashCooldown' | 'gunDamage' | 'spread' | 'reloadTime' | 'magSize'
  | 'reserveMax' | 'bladeDamage' | 'bladeCooldown' | 'bladeReach' | 'bladeRefund'
  | 'magnetRadius' | 'carrySlots' | 'intelGain' | 'activeWidth';

/** `add` is flat; `pct` is a fraction (0.1 = +10%). Both stack across nodes. */
export interface Effect {
  stat: StatKey;
  add?: number;
  pct?: number;
}

export type IconId =
  | 'core' | 'hull' | 'shield' | 'regen' | 'boots' | 'dash' | 'mag' | 'bolt'
  | 'reload' | 'reserve' | 'blade' | 'reach' | 'siphon' | 'crate' | 'magnet'
  | 'intel' | 'lens';

export interface TreeNode {
  id: string;
  tree: TreeId;
  kind: 'main' | 'chip';
  name: string;
  desc: string;
  icon: IconId;
  tint: TreeTint;
  cost: number;
  /** Parent node id. Mains hang off another main, chips off their main. */
  requires?: string;
  /** Grid position for mains (chips are placed under their parent). */
  col?: number;
  row?: number;
  effects: Effect[];
}

export const TREE_LAYOUT = {
  nodeW: 160,
  nodeH: 132,
  chipW: 80,
  chipH: 46,
  chipGap: 6,
  chipDrop: 14, // gap between a main node and its chips
  colPitch: 300,
  rowPitch: 232,
  originX: 120,
  originY: 150,
} as const;

export const TREE_LABELS: Record<TreeId, string> = {
  research: 'RESEARCH TREE',
  perks: 'PERK TREE',
};

export const STAT_LABELS: Record<StatKey, string> = {
  hull: 'Hull',
  shield: 'Shield',
  shieldRegenRate: 'Shield regen',
  shieldRegenDelay: 'Regen delay',
  moveSpeed: 'Move speed',
  dashCooldown: 'Dash cooldown',
  gunDamage: 'Gun damage',
  spread: 'Gun spread',
  reloadTime: 'Reload time',
  activeWidth: 'Active reload window',
  magSize: 'Magazine',
  reserveMax: 'Reserve',
  bladeDamage: 'Blade damage',
  bladeCooldown: 'Blade cooldown',
  bladeReach: 'Blade reach',
  bladeRefund: 'Kill refund',
  magnetRadius: 'Loot magnet',
  carrySlots: 'Carry slots',
  intelGain: 'Intel gained',
};

/** Intel earned in the feel-test room. Silos replace this with room and Warden rewards. */
export const INTEL = {
  waveBase: 10,
  waveStep: 5,
} as const;

const R = 'research' as const;
const P = 'perks' as const;

export const TREE_NODES: readonly TreeNode[] = [
  // ---------------------------------------------------------------- research
  { id: 'r_core', tree: R, kind: 'main', name: 'PROGRAMME', icon: 'core', tint: 'cyan', cost: 0, col: 0, row: 1.5,
    desc: 'The reclamation programme. Everything the vaults teach us hangs from here.', effects: [] },

  { id: 'r_carry1', tree: R, kind: 'main', name: 'CARRY RACK I', icon: 'crate', tint: 'amber', cost: 40, requires: 'r_core', col: 1, row: 0,
    desc: 'Lash more salvage to the frame.', effects: [{ stat: 'carrySlots', add: 2 }] },
  { id: 'r_magnet1', tree: R, kind: 'chip', name: 'MAGNET', icon: 'magnet', tint: 'amber', cost: 30, requires: 'r_carry1',
    desc: 'A coil that draws loot in from further away.', effects: [{ stat: 'magnetRadius', pct: 0.35 }] },
  { id: 'r_carry2', tree: R, kind: 'main', name: 'CARRY RACK II', icon: 'crate', tint: 'amber', cost: 120, requires: 'r_carry1', col: 2, row: 0,
    desc: 'Frame-mounted racks.', effects: [{ stat: 'carrySlots', add: 3 }] },
  { id: 'r_magnet2', tree: R, kind: 'chip', name: 'MAGNET II', icon: 'magnet', tint: 'amber', cost: 80, requires: 'r_carry2',
    desc: 'A stronger coil.', effects: [{ stat: 'magnetRadius', pct: 0.35 }] },
  { id: 'r_carry3', tree: R, kind: 'main', name: 'CARRY RACK III', icon: 'crate', tint: 'amber', cost: 300, requires: 'r_carry2', col: 3, row: 0,
    desc: 'A full hauling harness.', effects: [{ stat: 'carrySlots', add: 5 }] },

  { id: 'r_ammo1', tree: R, kind: 'main', name: 'AMMO LOOM I', icon: 'reserve', tint: 'orange', cost: 50, requires: 'r_core', col: 1, row: 1,
    desc: 'Weave spare rounds into the rig.', effects: [{ stat: 'reserveMax', add: 30 }] },
  { id: 'r_feed', tree: R, kind: 'chip', name: 'FAST FEED', icon: 'reload', tint: 'orange', cost: 40, requires: 'r_ammo1',
    desc: 'A sprung feed tray seats magazines faster.', effects: [{ stat: 'reloadTime', pct: -0.1 }] },
  { id: 'r_drill', tree: R, kind: 'chip', name: 'RELOAD DRILLS', icon: 'reload', tint: 'orange', cost: 60, requires: 'r_ammo2',
    desc: 'Rehearsed hands. The active reload window is wider.', effects: [{ stat: 'activeWidth', pct: 0.4 }] },
  { id: 'r_ammo2', tree: R, kind: 'main', name: 'AMMO LOOM II', icon: 'reserve', tint: 'orange', cost: 140, requires: 'r_ammo1', col: 2, row: 1,
    desc: 'Denser weave, more rounds.', effects: [{ stat: 'reserveMax', add: 50 }] },
  { id: 'r_ammo3', tree: R, kind: 'main', name: 'LONG MAGS', icon: 'mag', tint: 'orange', cost: 320, requires: 'r_ammo2', col: 3, row: 1,
    desc: 'Extended magazines.', effects: [{ stat: 'magSize', add: 6 }] },

  { id: 'r_intel1', tree: R, kind: 'main', name: 'SALVAGE LOGS', icon: 'intel', tint: 'violet', cost: 60, requires: 'r_core', col: 1, row: 2,
    desc: 'Log what the dead left behind.', effects: [{ stat: 'intelGain', pct: 0.25 }] },
  { id: 'r_intel2', tree: R, kind: 'main', name: 'FIELD ANALYSIS', icon: 'intel', tint: 'violet', cost: 180, requires: 'r_intel1', col: 2, row: 2,
    desc: 'Read the wreckage properly.', effects: [{ stat: 'intelGain', pct: 0.35 }] },

  { id: 'r_med1', tree: R, kind: 'main', name: 'SHIELD CELLS', icon: 'shield', tint: 'cyan', cost: 70, requires: 'r_core', col: 1, row: 3,
    desc: 'Bigger cells behind the emitter.', effects: [{ stat: 'shield', add: 20 }] },
  { id: 'r_med2', tree: R, kind: 'main', name: 'REGEN PROTOCOL', icon: 'regen', tint: 'cyan', cost: 160, requires: 'r_med1', col: 2, row: 3,
    desc: 'The shield comes back sooner and faster.',
    effects: [{ stat: 'shieldRegenDelay', pct: -0.25 }, { stat: 'shieldRegenRate', pct: 0.25 }] },

  // ------------------------------------------------------------------- perks
  { id: 'p_core', tree: P, kind: 'main', name: 'AUG CORE', icon: 'core', tint: 'green', cost: 0, col: 0, row: 1.5,
    desc: 'What every Aug is built on. Training here carries over to the next Aug.', effects: [] },

  { id: 'p_hull1', tree: P, kind: 'main', name: 'HARDENED HULL I', icon: 'hull', tint: 'green', cost: 40, requires: 'p_core', col: 1, row: 0,
    desc: 'Denser plating under the skin.', effects: [{ stat: 'hull', add: 15 }] },
  { id: 'p_pad', tree: P, kind: 'chip', name: 'PADDING', icon: 'hull', tint: 'green', cost: 30, requires: 'p_hull1',
    desc: 'Impact padding at the joints.', effects: [{ stat: 'hull', add: 10 }] },
  { id: 'p_hull2', tree: P, kind: 'main', name: 'HARDENED HULL II', icon: 'hull', tint: 'green', cost: 100, requires: 'p_hull1', col: 2, row: 0,
    desc: 'More of the same, thicker.', effects: [{ stat: 'hull', add: 20 }] },
  { id: 'p_hull3', tree: P, kind: 'main', name: 'HARDENED HULL III', icon: 'hull', tint: 'green', cost: 260, requires: 'p_hull2', col: 3, row: 0,
    desc: 'Built to be hit.', effects: [{ stat: 'hull', add: 30 }] },

  { id: 'p_frame', tree: P, kind: 'main', name: 'LIGHT FRAME', icon: 'boots', tint: 'cyan', cost: 50, requires: 'p_core', col: 1, row: 1,
    desc: 'Strip the dead weight.', effects: [{ stat: 'moveSpeed', pct: 0.06 }] },
  { id: 'p_dash1', tree: P, kind: 'main', name: 'DASH COIL I', icon: 'dash', tint: 'cyan', cost: 90, requires: 'p_frame', col: 2, row: 1,
    desc: 'The dash recharges faster.', effects: [{ stat: 'dashCooldown', pct: -0.15 }] },
  { id: 'p_sprint', tree: P, kind: 'chip', name: 'SPRINT', icon: 'boots', tint: 'cyan', cost: 60, requires: 'p_dash1',
    desc: 'Longer strides.', effects: [{ stat: 'moveSpeed', pct: 0.04 }] },
  { id: 'p_dash2', tree: P, kind: 'main', name: 'DASH COIL II', icon: 'dash', tint: 'cyan', cost: 220, requires: 'p_dash1', col: 3, row: 1,
    desc: 'Nearly always ready.', effects: [{ stat: 'dashCooldown', pct: -0.15 }] },

  { id: 'p_hot1', tree: P, kind: 'main', name: 'HOT LOADS I', icon: 'bolt', tint: 'orange', cost: 50, requires: 'p_core', col: 1, row: 2,
    desc: 'Hotter charges behind every round.', effects: [{ stat: 'gunDamage', pct: 0.1 }] },
  { id: 'p_tight', tree: P, kind: 'chip', name: 'TIGHT', icon: 'lens', tint: 'orange', cost: 40, requires: 'p_hot1',
    desc: 'Steadier hands, tighter groups.', effects: [{ stat: 'spread', pct: -0.2 }] },
  { id: 'p_quick', tree: P, kind: 'chip', name: 'QUICKHAND', icon: 'reload', tint: 'orange', cost: 40, requires: 'p_hot1',
    desc: 'Faster magazine changes.', effects: [{ stat: 'reloadTime', pct: -0.15 }] },
  { id: 'p_hot2', tree: P, kind: 'main', name: 'HOT LOADS II', icon: 'bolt', tint: 'orange', cost: 150, requires: 'p_hot1', col: 2, row: 2,
    desc: 'Hotter still.', effects: [{ stat: 'gunDamage', pct: 0.12 }] },

  { id: 'p_edge1', tree: P, kind: 'main', name: 'HONED EDGE I', icon: 'blade', tint: 'red', cost: 50, requires: 'p_core', col: 1, row: 3,
    desc: 'A keener edge.', effects: [{ stat: 'bladeDamage', pct: 0.12 }] },
  { id: 'p_reach', tree: P, kind: 'chip', name: 'REACH', icon: 'reach', tint: 'red', cost: 45, requires: 'p_edge1',
    desc: 'A longer cut.', effects: [{ stat: 'bladeReach', pct: 0.08 }] },
  { id: 'p_fast', tree: P, kind: 'main', name: 'FAST DRAW', icon: 'blade', tint: 'red', cost: 90, requires: 'p_edge1', col: 2, row: 3,
    desc: 'The blade is ready sooner.', effects: [{ stat: 'bladeCooldown', pct: -0.15 }] },
  { id: 'p_siphon', tree: P, kind: 'chip', name: 'SIPHON', icon: 'siphon', tint: 'red', cost: 70, requires: 'p_fast',
    desc: 'Blade kills return more ammo and shield.', effects: [{ stat: 'bladeRefund', pct: 0.5 }] },
  { id: 'p_edge2', tree: P, kind: 'main', name: 'HONED EDGE II', icon: 'blade', tint: 'red', cost: 170, requires: 'p_fast', col: 3, row: 3,
    desc: 'Cuts through armour plate.', effects: [{ stat: 'bladeDamage', pct: 0.15 }] },
];

export const NODE_BY_ID: ReadonlyMap<string, TreeNode> = new Map(TREE_NODES.map((n) => [n.id, n]));

/** Nodes that start unlocked: the free roots. */
export const ROOT_IDS: readonly string[] = TREE_NODES.filter((n) => n.cost === 0 && !n.requires).map((n) => n.id);
