// Mutable run state for the feel-test room. Systems read and write this;
// the scene owns the loop. Pure data, no rendering objects except the pools
// that systems fill (mobs, bullets, drops).
import { W, H } from '../data/arena';
import { TUNING as T } from '../data/tuning';
import type { Floor } from '../sim/dungeon';
import type { FloorPlan } from '../sim/run';
import type { Bullet, Drop, Mob, Spawn, SwordState } from './types';

export class World {
  mobs: Mob[] = [];
  bullets: Bullet[] = [];
  drops: Drop[] = [];
  spawnQueue: Spawn[] = [];

  // player
  px = W / 2;
  py = H / 2;
  pvx = 0;
  pvy = 0;
  lungeX = 0;
  lungeY = 0;
  aim = 0;
  mouseX = W / 2;
  mouseY = H / 2;
  fireCd = 0;
  bloom = 0;
  dashT = 0;
  /** Move-speed factor from the ground under the player (acid), set each frame by the hazard system. */
  groundSlow = 1;
  dashCd = 0;
  dashX = 1;
  dashY = 0;
  stepDist = 0;
  shieldCd = 0;
  playerFlash = 0;
  playerFlashing = false;
  rmbWas = false;
  sw: SwordState = { state: 'idle', t: 0, angle: 0, dir: 1, hit: new Set() };
  comboTimer = 0;
  swordCd = 0;
  prevDashReady = 1;
  prevBladeReady = 1;

  // burst fire
  burstLeft = 0;
  burstTimer = 0;

  // reload
  reloadT = -1; // seconds into the current reload, -1 when idle
  reloadTime: number = T.gun.reloadTime;
  reloadMagIn = false;
  reloadWasEmpty = false;
  reloadFumbled = false; // a mistimed active-reload press already happened this reload
  hotMag = false; // the current magazine was loaded with an active reload

  // room
  /** The bunker floor being played; null in the dev test room. */
  plan: FloorPlan | null = null;
  /** The generated map of that floor. */
  floor: Floor | null = null;
  hpMul = 1;
  dmgMul = 1;
  /** Waves that must be beaten before the exit pad opens. */
  wavesToClear: number = T.extract.exitAfterWave;
  bossDown = false;
  /** Minimum rarity of the Warden's bonus drop. */
  bossRarity = 2;
  wave = 0;
  waveLive = false;
  waveTimer = 1.2;
  dead = false;
  deadTimer = 0;
  hitStop = 0;

  // camera
  camX = W / 2;
  camY = H / 2;
  trauma = 0;
  kickX = 0;
  kickY = 0;
  zoomPunch = 0;

  addHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }
}
