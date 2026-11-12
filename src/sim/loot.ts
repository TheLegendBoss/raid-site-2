// Pure loot rolling. No engine imports.
import {
  ITEM_NAMES,
  KIND_WEIGHTS,
  RARITY_LABELS,
  RARITY_WEIGHTS,
  type ItemKind,
} from '../data/loot';
import { Rng } from './math';

export interface Item {
  id: number;
  kind: ItemKind;
  rarity: number; // index into RARITY_LABELS
  rarityLabel: string;
  name: string;
}

let nextId = 1;

/** After loading a save, keep new item ids clear of the saved ones. */
export function seedItemIds(items: readonly Item[]): void {
  for (const it of items) nextId = Math.max(nextId, it.id + 1);
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

export function rollItem(rng: Rng, minRarity = 0): Item {
  const kinds = Object.keys(KIND_WEIGHTS) as ItemKind[];
  const kind = kinds[weightedIndex(rng, kinds.map((k) => KIND_WEIGHTS[k]))];
  const rarity = rollRarity(rng, minRarity);
  return {
    id: nextId++,
    kind,
    rarity,
    rarityLabel: RARITY_LABELS[rarity],
    name: rng.pick(ITEM_NAMES[kind]),
  };
}
