// Bunkers: the sites you can deploy to. Each is a run of floors, each floor a few rooms, ending in a
// Warden. Numbers and copy only; the run generator is src/sim/run.ts.
import type { MobKind } from './mobs';

export interface MissionDef {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  threats: string;
  rewards: string;
  /** When set, the mission cannot be deployed to and this is why. */
  locked?: string;
}

export interface BunkerDef extends MissionDef {
  /** Rooms on each floor. The last room of the last floor is the Warden's. */
  floors: readonly number[];
  /** Scales enemy hull, enemy damage and how many enemies a wave budget buys. */
  hpMul: number;
  dmgMul: number;
  budgetMul: number;
  /** Added to a room's depth when deciding which enemies may appear (harder roster sooner). */
  depthBonus: number;
  /** Waves per ordinary room, inclusive range. */
  waves: readonly [number, number];
  /** Per-kind weight multipliers: what this site is full of. */
  bias: Partial<Record<MobKind, number>>;
  /** Guaranteed minimum rarity of the Warden's drops. */
  bossRarity: number;
  /** Paid out when the Warden falls and you extract. */
  clear: { scrap: number; intel: number };
  /** Gear tier the site expects, shown on the deploy screen. */
  advice: string;
}

export const BUNKERS: readonly BunkerDef[] = [
  {
    id: 'silo',
    name: 'SILO 7',
    tag: 'MAINTENANCE SILO  /  3 FLOORS',
    blurb: 'A sealed maintenance silo, cut off from the network. The scavengers got in years ago and never left. Break in, take what the dead left, put down whatever runs the place.',
    threats: 'Scavenger swarms, bloaters, sentries; brutes near the bottom',
    rewards: 'Gear, scrap, Intel',
    floors: [2, 2, 2],
    hpMul: 1, dmgMul: 1, budgetMul: 1, depthBonus: 0, waves: [2, 2],
    bias: { scav: 1.4, bomber: 1.4, brute: 1.2, robot: 0.7, sniper: 0.5 },
    bossRarity: 2,
    clear: { scrap: 120, intel: 150 },
    advice: 'Starting kit is enough. Common to Uncommon gear.',
  },
  {
    id: 'relay',
    name: 'RELAY STATION',
    tag: 'SIGNAL RELAY  /  4 FLOORS',
    blurb: 'A relay that still talks to something. Its maintenance machines were never told to stop, and they have learned to aim.',
    threats: 'Sentries and marksmen in numbers, stalkers, brutes',
    rewards: 'Better gear, scrap, Intel',
    floors: [2, 2, 2, 2],
    hpMul: 1.2, dmgMul: 1.15, budgetMul: 1.15, depthBonus: 1, waves: [2, 3],
    bias: { robot: 1.8, sniper: 1.8, scav: 0.7, leaper: 1.2 },
    bossRarity: 3,
    clear: { scrap: 260, intel: 320 },
    advice: 'Bring armour-piercing: machines turn soft rounds away. Rare gear.',
  },
  {
    id: 'archive',
    name: 'DEEP ARCHIVE',
    tag: 'COLD STORAGE  /  5 FLOORS',
    blurb: 'Five floors of cold storage under the old city. Something in the stacks has been feeding what lives here for a long time.',
    threats: 'Stalkers, spitters, brutes, everything else behind them',
    rewards: 'Best gear, scrap, Intel',
    floors: [2, 2, 2, 2, 2],
    hpMul: 1.45, dmgMul: 1.3, budgetMul: 1.3, depthBonus: 2, waves: [2, 3],
    bias: { leaper: 1.7, spitter: 1.7, brute: 1.3, bomber: 1.2 },
    bossRarity: 4,
    clear: { scrap: 520, intel: 700 },
    advice: 'Very Rare gear and a full tree. Do not come in with the starting kit.',
  },
];

export const BUNKER_BY_ID = new Map(BUNKERS.map((b) => [b.id, b]));
export const MISSIONS: readonly MissionDef[] = BUNKERS;
export const MISSION_BY_ID = new Map<string, MissionDef>(MISSIONS.map((m) => [m.id, m]));
