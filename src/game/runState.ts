// Plain shared state the HUD reads each frame. No engine imports.
import { TUNING } from '../data/tuning';
import type { Item } from '../sim/loot';

export interface FeedLine {
  text: string;
  color: number;
  age: number;
}

export interface RunState {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;

  // Carbine
  mag: number;
  magSize: number;
  reserve: number;
  maxReserve: number;
  reload: number; // -1 when idle, otherwise 0..1 progress
  reloadEmpty: boolean; // the current reload started from an empty mag
  reloadWin0: number; // PERFECT zone, as fractions of the reload (width 0 when there is none)
  reloadWin1: number;
  reloadGood0: number; // ACTIVE zone, which contains the perfect zone
  reloadGood1: number;
  reloadMark: number; // where the marker was when the result happened (drawn locked on a miss)
  activeFlash: number; // 0..1, decays: result of the last active reload press
  activeResult: 'perfect' | 'good' | 'fumble' | '';
  extractPrompt: string; // '' off a pad; otherwise the HUD prompt
  extractOpen: boolean; // the pad under the player can be used
  hotMag: boolean; // the loaded magazine carries the active reload damage bonus
  shotSeq: number; // increments once per round fired; the HUD animates on change
  dryFlash: number; // 0..1, decays: trigger pulled with nothing to fire

  // Cooldowns: 0..1 where 1 is ready. Pings flash when one comes back; denies flash on an early press.
  dashReady: number;
  dashPing: number;
  dashDeny: number;
  bladeReady: number;
  bladePing: number;
  bladeDeny: number;

  wave: number;
  /** Waves in this room (0 = endless, the dev room). */
  waveTotal: number;
  /** '' in the dev room; otherwise e.g. 'FLOOR 2   ROOM 1 / 2'. */
  roomLabel: string;
  roomsDone: number;
  roomsTotal: number;
  bossName: string;
  bossHp: number;
  bossMax: number;
  mobsAlive: number;
  intermission: number; // seconds left, 0 if a wave is live
  damageFlash: number; // 0..1, decays
  hitMarker: number; // 0..1, decays
  killMarker: number; // 0..1, decays
  refundFlash: number; // 0..1, decays: blade kills refund ammo and shield
  combo: number;
  aimSpread: number; // degrees, for the crosshair
  aimDist: number; // screen px from the player to the cursor, for the crosshair
  /** The run's haul: everything picked up. No cap; it is sorted out at the end, and lost on death. */
  carried: Item[];
  carriedScrap: number;
  /** Items banked by the last extraction that the player has not yet reviewed (keep, sell or dismantle). */
  fresh: Item[];
  stash: Item[];
  weaponName: string;
  weaponShape: string;
  feed: FeedLine[];
  banner: string;
  bannerTime: number;
  muted: boolean;
  showHelp: boolean;
  devMode: boolean; // the dev test room: base and trees open from the room
  lastLost: number; // items lost in the most recent death
}

export const runState: RunState = {
  hp: TUNING.player.maxHp,
  maxHp: TUNING.player.maxHp,
  shield: TUNING.player.maxShield,
  maxShield: TUNING.player.maxShield,

  mag: TUNING.gun.magSize,
  magSize: TUNING.gun.magSize,
  reserve: TUNING.gun.startReserve,
  maxReserve: TUNING.gun.maxReserve,
  reload: -1,
  reloadEmpty: false,
  reloadWin0: 0,
  reloadWin1: 0,
  reloadGood0: 0,
  reloadGood1: 0,
  reloadMark: 0,
  extractPrompt: '',
  extractOpen: false,
  activeFlash: 0,
  activeResult: '',
  hotMag: false,
  shotSeq: 0,
  dryFlash: 0,

  dashReady: 1,
  dashPing: 0,
  dashDeny: 0,
  bladeReady: 1,
  bladePing: 0,
  bladeDeny: 0,

  wave: 0,
  waveTotal: 0,
  roomLabel: '',
  roomsDone: 0,
  roomsTotal: 0,
  bossName: '',
  bossHp: 0,
  bossMax: 0,
  mobsAlive: 0,
  intermission: 0,
  damageFlash: 0,
  hitMarker: 0,
  killMarker: 0,
  refundFlash: 0,
  combo: 0,
  aimSpread: TUNING.gun.spread,
  aimDist: 200,
  carried: [],
  carriedScrap: 0,
  fresh: [],
  stash: [],
  weaponName: TUNING.gun.name,
  weaponShape: 'smg',
  feed: [],
  banner: '',
  bannerTime: 0,
  muted: false,
  showHelp: true,
  devMode: false,
  lastLost: 0,
};

export function resetVitals(): void {
  runState.hp = runState.maxHp;
  runState.shield = runState.maxShield;
  runState.mag = runState.magSize;
  runState.reserve = TUNING.gun.startReserve;
  runState.reload = -1;
  runState.hotMag = false;
  runState.activeFlash = 0;
  runState.dashReady = 1;
  runState.bladeReady = 1;
  runState.damageFlash = 0;
  runState.combo = 0;
}

export function pushFeed(text: string, color: number): void {
  runState.feed.push({ text, color, age: 0 });
  if (runState.feed.length > 7) runState.feed.shift();
}

export function setBanner(text: string, seconds = 2.2): void {
  runState.banner = text;
  runState.bannerTime = seconds;
}
