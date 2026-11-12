// The persistent profile: Intel, unlocked tree nodes and the stash. Survives
// death and restarts (Research and Perks belong to the programme, not to one
// Aug). `profile.stats` is what combat reads.
import { INTEL } from '../data/tree';
import { resolveStats, type EffectiveStats } from '../sim/stats';
import { checkUnlock, initialUnlocked, sanitizeUnlocked, type UnlockCheck } from '../sim/tree';
import { NODE_BY_ID } from '../data/tree';
import { seedItemIds, type Item } from '../sim/loot';
import { readSaveText, writeSaveText } from './host';
import { runState } from './runState';

const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  intel: number;
  unlocked: string[];
  stash: Item[];
}

export const profile: {
  intel: number;
  unlocked: Set<string>;
  stats: EffectiveStats;
} = {
  intel: 0,
  unlocked: initialUnlocked(),
  stats: resolveStats(initialUnlocked()),
};

function validItem(x: unknown): x is Item {
  const i = x as Item;
  return (
    !!i && typeof i.id === 'number' && typeof i.kind === 'string' && typeof i.rarity === 'number' &&
    typeof i.rarityLabel === 'string' && typeof i.name === 'string'
  );
}

/** Recompute stats and push the maxima into runState. Raising a max also raises the current value. */
export function refreshStats(): void {
  const st = resolveStats(profile.unlocked);
  const r = runState;
  const dHp = st.hull - r.maxHp;
  const dSh = st.shield - r.maxShield;
  profile.stats = st;
  r.maxHp = st.hull;
  r.maxShield = st.shield;
  r.magSize = st.magSize;
  r.maxReserve = st.reserveMax;
  r.hp = Math.min(r.maxHp, r.hp + Math.max(0, dHp));
  r.shield = Math.min(r.maxShield, r.shield + Math.max(0, dSh));
  r.mag = Math.min(r.magSize, r.mag);
  r.reserve = Math.min(r.maxReserve, r.reserve);
}

export async function loadProfile(): Promise<void> {
  try {
    const text = await readSaveText();
    if (text) {
      const s = JSON.parse(text) as Partial<SaveFile>;
      if (s.version === SAVE_VERSION) {
        profile.intel = typeof s.intel === 'number' && s.intel >= 0 ? Math.floor(s.intel) : 0;
        profile.unlocked = sanitizeUnlocked(Array.isArray(s.unlocked) ? s.unlocked : []);
        const stash = Array.isArray(s.stash) ? s.stash.filter(validItem) : [];
        runState.stash = stash;
        seedItemIds(stash);
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

export function saveProfile(): void {
  const s: SaveFile = {
    version: SAVE_VERSION,
    intel: profile.intel,
    unlocked: [...profile.unlocked],
    stash: runState.stash,
  };
  void writeSaveText(JSON.stringify(s)).catch(() => undefined);
}

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
