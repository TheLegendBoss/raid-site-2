// Pure loot rolling and item helpers. No engine imports.
import { BASE_BY_ID, BASE_ITEMS, STARTING_KIT, type BaseItem, type Slot } from '../data/items';
import {
  DISMANTLE_INTEL,
  DROP_KIND_WEIGHTS,
  QM,
  RARITY_LABELS,
  RARITY_SELL,
  RARITY_TIER,
  RARITY_WEIGHTS,
  SCRAP_DROP,
} from '../data/loot';
import { Rng } from './math';

/** A piece of gear. Everything else (name, stats) comes from its base item. */
export interface Item {
  id: number;
  baseId: string;
  rarity: number; // index into RARITY_LABELS
}

export type Drop = { kind: 'item'; item: Item } | { kind: 'scrap'; amount: number };

let nextId = 1;

/** After loading a save, keep new item ids clear of the saved ones. */
export function seedItemIds(items: readonly Item[]): void {
  for (const it of items) nextId = Math.max(nextId, it.id + 1);
}

export function makeItem(baseId: string, rarity = 0): Item {
  return { id: nextId++, baseId, rarity };
}

export function startingItems(): Record<Slot, Item> {
  const out = {} as Record<Slot, Item>;
  for (const slot of Object.keys(STARTING_KIT) as Slot[]) out[slot] = makeItem(STARTING_KIT[slot], 0);
  return out;
}

export function baseOf(item: Item): BaseItem {
  return BASE_BY_ID.get(item.baseId)!;
}

export const isValidItem = (x: unknown): x is Item => {
  const i = x as Item;
  return (
    !!i && typeof i.id === 'number' && typeof i.baseId === 'string' && BASE_BY_ID.has(i.baseId) &&
    Number.isInteger(i.rarity) && i.rarity >= 0 && i.rarity < RARITY_LABELS.length
  );
};

export const rarityLabel = (item: Item): string => RARITY_LABELS[item.rarity];
export const tierOf = (item: Item): number => RARITY_TIER[item.rarity];
export const sellValue = (item: Item): number => Math.round(RARITY_SELL[item.rarity] * (1 + baseOf(item).price / 100));
export const dismantleIntel = (item: Item): number => DISMANTLE_INTEL[item.rarity];

/** Quartermaster price for a baseline item at a rarity it sells (see QM). */
export function buyPrice(base: BaseItem, rarity: number): number {
  return Math.round(base.price * QM.markup[rarity]);
}

function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

export function rollRarity(rng: Rng, minRarity = 0): number {
  const weights = RARITY_WEIGHTS.map((w, i) => (i < minRarity ? 0 : w));
  return weightedIndex(rng, weights);
}

export function rollGear(rng: Rng, minRarity = 0): Item {
  const base = BASE_ITEMS[weightedIndex(rng, BASE_ITEMS.map((b) => b.weight))];
  return makeItem(base.id, rollRarity(rng, minRarity));
}

/** Gear or loose scrap. A minimum rarity above Common always rolls gear. */
export function rollDrop(rng: Rng, minRarity = 0): Drop {
  const scrap = minRarity === 0 && weightedIndex(rng, [DROP_KIND_WEIGHTS.scrap, DROP_KIND_WEIGHTS.gear]) === 0;
  if (scrap) {
    const rarity = rollRarity(rng);
    const amount = SCRAP_DROP.min + Math.floor(rng.next() * (SCRAP_DROP.max - SCRAP_DROP.min + 1)) + rarity * SCRAP_DROP.perRarity;
    return { kind: 'scrap', amount };
  }
  return { kind: 'item', item: rollGear(rng, minRarity) };
}
