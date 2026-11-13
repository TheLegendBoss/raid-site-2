// The persistent profile: Intel, Scrap, equipped gear, unlocked tree nodes and
// the stash. Survives death and restarts (Research and Perks belong to the
// programme, not to one Aug). `profile.stats` is what combat reads.
import { BASE_BY_ID, SLOTS, type Slot } from '../data/items';
import { INTEL, NODE_BY_ID } from '../data/tree';
import {
  baseOf, buyPrice, dismantleIntel, isValidItem, makeItem, seedItemIds, sellValue, startingItems, type Item,
} from '../sim/loot';
import { resolveStats, type EffectiveStats, type Loadout } from '../sim/stats';
import { checkUnlock, initialUnlocked, sanitizeUnlocked, type UnlockCheck } from '../sim/tree';
import { readSaveText, writeSaveText } from './host';
import { runState } from './runState';

const SAVE_VERSION = 3;

interface SaveFile {
  version: number;
  intel: number;
  scrap: number;
  unlocked: string[];
  stash: Item[];
  equipped: Partial<Record<Slot, Item | null>>;
  /** Dismantled weapons per family: analysis progress for the Armoury. */
  analysis: Record<string, number>;
  /** Bunkers whose Warden has fallen. */
  claimed: string[];
}

export const profile: {
  intel: number;
  scrap: number;
  unlocked: Set<string>;
  equipped: Record<Slot, Item | null>;
  analysis: Record<string, number>;
  claimed: Set<string>;
  /** A save was found and loaded at boot (or one has been written since). */
  hasSave: boolean;
  stats: EffectiveStats;
} = {
  intel: 0,
  scrap: 0,
  unlocked: initialUnlocked(),
  equipped: startingItems(),
  analysis: {},
  claimed: new Set<string>(),
  hasSave: false,
  stats: resolveStats(initialUnlocked(), { primary: null, blade: null, armour: null, pack: null }),
};

type Listener = (s: EffectiveStats) => void;
const listeners: Listener[] = [];
/** Called after every stats refresh (equip, unlock, load). The scene uses it to swap art. */
export function onStatsChanged(cb: Listener): () => void {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/** Recompute stats and push the maxima into runState. Raising a max also raises the current value. */
export function refreshStats(): void {
  const prev = profile.stats;
  const st = resolveStats(profile.unlocked, profile.equipped as Loadout);
  const r = runState;
  const dHp = st.hull - r.maxHp;
  const dSh = st.shield - r.maxShield;
  const weaponChanged = st.weapon.name !== prev.weapon.name;
  profile.stats = st;
  r.maxHp = st.hull;
  r.maxShield = st.shield;
  r.magSize = st.magSize;
  r.maxReserve = st.reserveMax;
  r.weaponName = st.weapon.name;
  r.weaponShape = st.weapon.shape;
  r.hp = Math.min(r.maxHp, r.hp + Math.max(0, dHp));
  r.shield = Math.min(r.maxShield, r.shield + Math.max(0, dSh));
  // A different weapon comes with a full magazine; otherwise only trim to the new maxima.
  r.mag = weaponChanged ? r.magSize : Math.min(r.magSize, r.mag);
  r.reserve = Math.min(r.maxReserve, r.reserve);
  if (weaponChanged) r.reload = -1;
  for (const cb of listeners) cb(st);
}

export async function loadProfile(): Promise<void> {
  try {
    const text = await readSaveText();
    if (text) {
      const s = JSON.parse(text) as Partial<SaveFile>;
      // Version 1 saves (Intel and unlocks only, plus placeholder loot) migrate by keeping Intel and unlocks.
      // Version 2 saves lack the claimed bunkers.
      if (s.version === SAVE_VERSION || s.version === 2 || s.version === 1) {
        profile.hasSave = true;
        profile.intel = typeof s.intel === 'number' && s.intel >= 0 ? Math.floor(s.intel) : 0;
        profile.unlocked = sanitizeUnlocked(Array.isArray(s.unlocked) ? s.unlocked : []);
        if (s.version === SAVE_VERSION || s.version === 2) {
          profile.scrap = typeof s.scrap === 'number' && s.scrap >= 0 ? Math.floor(s.scrap) : 0;
          const stash = Array.isArray(s.stash) ? s.stash.filter(isValidItem) : [];
          runState.stash = stash;
          const kit = startingItems();
          const eq = {} as Record<Slot, Item | null>;
          for (const slot of SLOTS) {
            const it = s.equipped?.[slot];
            eq[slot] = isValidItem(it) && baseOf(it).slot === slot ? it : kit[slot];
          }
          profile.equipped = eq;
          profile.analysis = s.analysis && typeof s.analysis === 'object' ? { ...s.analysis } : {};
          profile.claimed = new Set(Array.isArray(s.claimed) ? s.claimed.filter((x): x is string => typeof x === 'string') : []);
          seedItemIds([...stash, ...Object.values(eq).filter((x): x is Item => !!x)]);
        }
      }
    }
  } catch {
    // A damaged save falls back to a fresh profile. The desktop host keeps the previous file as save.bak.
  }
  refreshStats();
  runState.hp = runState.maxHp;
  runState.shield = runState.maxShield;
  runState.mag = runState.magSize;
}

/** Start over: a fresh programme, the starting kit and an empty stash, written over the old save. */
export function newProfile(): void {
  profile.intel = 0;
  profile.scrap = 0;
  profile.unlocked = initialUnlocked();
  profile.equipped = startingItems();
  profile.analysis = {};
  profile.claimed = new Set<string>();
  runState.stash = [];
  runState.carried = [];
  runState.carriedScrap = 0;
  refreshStats();
  runState.hp = runState.maxHp;
  runState.shield = runState.maxShield;
  runState.mag = runState.magSize;
  runState.reserve = runState.maxReserve;
  saveProfile();
}

export function saveProfile(): void {
  profile.hasSave = true;
  const s: SaveFile = {
    version: SAVE_VERSION,
    intel: profile.intel,
    scrap: profile.scrap,
    unlocked: [...profile.unlocked],
    stash: runState.stash,
    equipped: profile.equipped,
    analysis: profile.analysis,
    claimed: [...profile.claimed],
  };
  void writeSaveText(JSON.stringify(s)).catch(() => undefined);
}

// ------------------------------------------------------------------ Intel

/** Add Intel (scaled by the Intel Gained stat). Returns the amount actually added. */
export function addIntel(base: number): number {
  const n = Math.max(1, Math.round(base * profile.stats.intelGain));
  profile.intel += n;
  saveProfile();
  return n;
}

export function waveIntel(wave: number): number {
  return addIntel(INTEL.waveBase + INTEL.waveStep * (wave - 1));
}

export function tryUnlock(id: string): UnlockCheck {
  const c = checkUnlock(id, profile.unlocked, profile.intel);
  if (!c.ok) return c;
  profile.intel -= NODE_BY_ID.get(id)!.cost;
  profile.unlocked.add(id);
  refreshStats();
  saveProfile();
  return c;
}

// ------------------------------------------------------- gear and the stash

export type Place = 'carried' | 'stash';
const listOf = (p: Place): Item[] => (p === 'carried' ? runState.carried : runState.stash);
const remove = (list: Item[], item: Item): boolean => {
  const i = list.indexOf(item);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
};

/** Equip an item from carried or stash. The item it replaces takes its place in that list. */
export function equip(item: Item, from: Place): boolean {
  const slot = baseOf(item).slot;
  const list = listOf(from);
  if (!remove(list, item)) return false;
  const old = profile.equipped[slot];
  profile.equipped[slot] = item;
  if (old) list.push(old);
  refreshStats();
  saveProfile();
  return true;
}

/** Move between carried and stash. Banking from the field is extraction; this is the base screen's version. */
export function move(item: Item, from: Place): boolean {
  const to: Place = from === 'carried' ? 'stash' : 'carried';
  if (to === 'carried' && runState.carried.length >= profile.stats.carrySlots) return false;
  if (!remove(listOf(from), item)) return false;
  listOf(to).push(item);
  saveProfile();
  return true;
}

/** Sell a stashed item for scrap. Base only: carried items must be banked first. */
export function sell(item: Item): number {
  if (!remove(runState.stash, item)) return 0;
  const n = sellValue(item);
  profile.scrap += n;
  saveProfile();
  return n;
}

/**
 * Dismantle a stashed weapon or any gear: it is consumed, pays Intel and adds
 * analysis progress to its family. Only stashed items count: the payout is
 * applied when you bring the item back.
 */
export function dismantle(item: Item): number {
  if (!remove(runState.stash, item)) return 0;
  const fam = baseOf(item).family;
  profile.analysis[fam] = (profile.analysis[fam] ?? 0) + 1;
  const n = addIntel(dismantleIntel(item)); // saves
  return n;
}

export function canBuy(baseId: string, rarity: number): boolean {
  const b = BASE_BY_ID.get(baseId);
  return !!b && profile.scrap >= buyPrice(b, rarity);
}

/** Buy baseline gear from the quartermaster into the stash. */
export function buy(baseId: string, rarity: number): Item | null {
  if (!canBuy(baseId, rarity)) return null;
  profile.scrap -= buyPrice(BASE_BY_ID.get(baseId)!, rarity);
  const it = makeItem(baseId, rarity);
  runState.stash.push(it);
  saveProfile();
  return it;
}

/** Extraction: bank everything carried (the stash has no cap) and carried scrap. */
export function extractAll(): { items: number; left: number; scrap: number } {
  const items = runState.carried.length;
  runState.stash.push(...runState.carried);
  runState.carried = [];
  const scrap = runState.carriedScrap;
  profile.scrap += scrap;
  runState.carriedScrap = 0;
  saveProfile();
  return { items, left: 0, scrap };
}

/** A bunker's Warden fell: mark it claimed. Returns true the first time. */
export function claimBunker(id: string): boolean {
  if (profile.claimed.has(id)) return false;
  profile.claimed.add(id);
  saveProfile();
  return true;
}
