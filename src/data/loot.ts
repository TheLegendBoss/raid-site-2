// Loot tables. Plain data, no engine imports.

export const RARITY_LABELS = [
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Epic',
  'Legendary',
  'Aercho',
] as const;

// Relative weights per rarity index. Skewed generous for the feel test so
// the drop juice for high tiers can be seen without grinding.
export const RARITY_WEIGHTS: readonly number[] = [54, 26, 12, 5, 2, 0.6, 0.12];

export type ItemKind = 'scrap' | 'weapon' | 'armor' | 'module';

export const KIND_WEIGHTS: Readonly<Record<ItemKind, number>> = {
  scrap: 46,
  weapon: 22,
  armor: 18,
  module: 14,
};

export const ITEM_NAMES: Readonly<Record<ItemKind, readonly string[]>> = {
  scrap: ['Alloy Scrap', 'Coil Bundle', 'Cracked Cell', 'Servo Husk', 'Bio-Gel Vial'],
  weapon: ['Carbine', 'Scatter Rifle', 'Arc Blade', 'Rail Pistol', 'Burst Cannon'],
  armor: ['Greave Plate', 'Gorget', 'Pauldron', 'Helm Liner', 'Spine Rig'],
  module: ['Shield Cell', 'Targeting Lens', 'Dash Coil', 'Ammo Loom', 'Kill Siphon'],
};
