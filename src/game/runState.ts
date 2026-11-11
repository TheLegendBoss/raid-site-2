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
  ammo: number;
  maxAmmo: number;
  dashReady: number; // 0..1
  wave: number;
  mobsAlive: number;
  intermission: number; // seconds left, 0 if a wave is live
  damageFlash: number; // 0..1, decays
  hitMarker: number; // 0..1, decays
  killMarker: number; // 0..1, decays
  refundFlash: number; // 0..1, decays: blade kills refund ammo and shield
  combo: number;
  aimSpread: number; // degrees, for the crosshair
  carried: Item[];
  stash: Item[];
  feed: FeedLine[];
  banner: string;
  bannerTime: number;
  muted: boolean;
}

export const runState: RunState = {
  hp: TUNING.player.maxHp,
  maxHp: TUNING.player.maxHp,
  shield: TUNING.player.maxShield,
  maxShield: TUNING.player.maxShield,
  ammo: TUNING.gun.maxAmmo,
  maxAmmo: TUNING.gun.maxAmmo,
  dashReady: 1,
  wave: 0,
  mobsAlive: 0,
  intermission: 0,
  damageFlash: 0,
  hitMarker: 0,
  killMarker: 0,
  refundFlash: 0,
  combo: 0,
  aimSpread: TUNING.gun.spread,
  carried: [],
  stash: [],
  feed: [],
  banner: '',
  bannerTime: 0,
  muted: false,
};

export function resetVitals(): void {
  runState.hp = runState.maxHp;
  runState.shield = runState.maxShield;
  runState.ammo = runState.maxAmmo;
  runState.dashReady = 1;
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
