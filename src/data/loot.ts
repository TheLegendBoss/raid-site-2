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

/** Rarity is a stat tier (design 5.2): multiplies the base stats an item scales. */
export const RARITY_TIER: readonly number[] = [1.0, 1.08, 1.18, 1.3, 1.45, 1.65, 1.9];

/** What a kill drops: loose scrap (currency, carried until extracted) or a piece of gear. */
export const DROP_KIND_WEIGHTS = { scrap: 46, gear: 54 } as const;

export const SCRAP_DROP = { min: 4, max: 10, perRarity: 3 } as const;

/** Scrap an item sells for, by rarity, before the item's own price factor. */
export const RARITY_SELL: readonly number[] = [8, 18, 42, 95, 210, 460, 1000];

/** Intel gained by dismantling at the base, by rarity. */
export const DISMANTLE_INTEL: readonly number[] = [4, 9, 20, 45, 100, 220, 500];

/** The quartermaster sells baseline gear up to this rarity (inclusive), at a markup per rarity. */
export const QM = { maxRarity: 1, markup: [1, 2.2] as readonly number[] } as const;

