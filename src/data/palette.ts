// Colour carries meaning. Near-black field, vector line art, no sprites.
export const PALETTE = {
  bg: 0x05080a,
  floorLine: 0x0f1f1f,
  floorLineBright: 0x17302e,
  structure: 0x4de1c1, // cyan: walls, structure
  structureDim: 0x1f5a50,
  player: 0x6dff8a, // green: the clone
  hostile: 0xff5a4d, // red: scavengers
  robot: 0xd070ff, // violet: machines
  loot: 0xffb347, // gold
  spark: 0xffe3a0,
  muzzle: 0xffe3a0,
  white: 0xffffff,
  shield: 0x5ab0ff,
  health: 0x6dff8a,
  healthLow: 0xff5a4d,
  ammo: 0xffd36b,
  text: 0xc2cfcb,
  textDim: 0x5d6c69,
} as const;

// Rarity ladder, index 0..6. Matches RARITY_LABELS in data/loot.ts.
export const RARITY_COLORS: readonly number[] = [
  0xc2cfcb, // common
  0x5ee06a, // uncommon
  0x5ab0ff, // rare
  0xa070ff, // very rare
  0xff5fd2, // epic
  0xffb347, // legendary
  0xbffcff, // aercho
];

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
