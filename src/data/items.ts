// Base items. Plain data, no engine imports. Four slots (design section 5):
// Primary, Blade, Armour, Pack. Rarity (data/loot.ts RARITY_TIER) scales the
// stats listed in each definition. The starting kit equals the old tuning, so
// a fresh profile plays exactly as the feel test did.

export type Slot = 'primary' | 'blade' | 'armour' | 'pack';
export const SLOTS: readonly Slot[] = ['primary', 'blade', 'armour', 'pack'];
export const SLOT_LABELS: Record<Slot, string> = {
  primary: 'PRIMARY',
  blade: 'BLADE',
  armour: 'ARMOUR',
  pack: 'PACK',
};

export type Family =
  | 'smg' | 'pistol' | 'magnum' | 'shotgun' | 'marksman' | 'burst'
  | 'arc' | 'cleaver' | 'stiletto'
  | 'plate' | 'rig' | 'pack';

/** Which vector silhouette the HUD draws for the weapon. */
export type GunShape = 'smg' | 'pistol' | 'magnum' | 'shotgun' | 'marksman' | 'burst';

export interface WeaponDef {
  shape: GunShape;
  armsKey: string; // art part holding the weapon
  muzzleOffset: number; // px forward of the clone's centre (art muzzle x minus 32)
  muzzleSide: number;
  fireDelay: number; // seconds between shots (or between bursts)
  damage: number; // per pellet at Common
  damageVariance: number;
  pellets: number;
  spread: number; // degrees
  bulletSpeed: number;
  bulletLife: number;
  bulletW: number;
  bulletH: number;
  mag: number; // rounds at Common
  reload: number;
  reloadEmpty: number;
  burstCount: number; // rounds per trigger pull (1 = semi/auto)
  burstGap: number;
  pierce: number; // extra enemies a round passes through
  recoilImpulse: number;
  cameraKick: number;
  shotTrauma: number;
  sound: 'smg' | 'pistol' | 'magnum' | 'shotgun' | 'rifle';
  // ---- stats borrowed from Helldivers 2 and Intravenous 2 -------------------------------
  /** Armour penetration. Compared with a target's armour: above it is full damage, level with it a
   *  glancing blow, below it most of the round is turned away (see TUNING.armour). */
  ap: number;
  /** Stagger force per hit. Robots build a stagger meter and stumble when it fills (TUNING.robot). */
  stagger: number;
  /** Spread added by each shot, the most it can add, and how fast it settles (deg, deg, deg/s). */
  bloomPerShot: number;
  bloomMax: number;
  bloomRecovery: number;
  /** Degrees of extra spread at full run speed: accuracy while moving. */
  moveSpread: number;
  /** Move speed multiplier while this weapon is equipped: heavier guns slow you. */
  mobility: number;
  // ---- feel -------------------------------------------------------------------------------
  /** How big the weapon feels: muzzle flash, light, shockwave, smoke, casing, zoom punch (SMG is 0.7). */
  heft: number;
  /** How hard its hits land on enemies: hit particles, kill hit-stop and shake. */
  impact: number;
  /** What each rarity step above Common improves, on top of the damage and magazine tier scaling. */
  step: WeaponStep;
}

/** Per rarity step. Fractions improve the stat by that share; counts are added and rounded down. */
export interface WeaponStep {
  rate?: number; // fire rate faster
  spread?: number; // tighter
  reload?: number; // faster
  bloom?: number; // less spread per shot
  recovery?: number; // settles faster
  stagger?: number; // more stagger force
  mobility?: number; // added to the multiplier
  ap?: number; // added armour penetration
  pellets?: number; // added pellets per shot
  pierce?: number; // added pierce
  burst?: number; // added rounds per burst
  burstGap?: number; // faster burst
}

export interface BladeDef {
  spriteKey: string;
  windup: number;
  swing: number;
  recover: number;
  reach: number;
  arcHalfAngle: number; // degrees
  damage: number;
  cooldown: number;
  lungeSpeed: number;
  knockback: number;
  stagger: number; // seconds a robot is staggered
}

export interface ArmourDef {
  hull: number;
  shield: number;
  moveMul: number;
  dashCdMul: number;
}

export interface PackDef {
  reserve: number;
  salvage: number; // added to the sell-value multiplier (0.1 = +10%)
  dashCdMul: number;
  bladeCdMul: number;
}

export interface BaseItem {
  id: string;
  slot: Slot;
  family: Family;
  name: string;
  desc: string;
  /** Scrap price at Common from the quartermaster. */
  price: number;
  /** Relative drop weight within its slot group. */
  weight: number;
  weapon?: WeaponDef;
  blade?: BladeDef;
  armour?: ArmourDef;
  pack?: PackDef;
}

const SMG: WeaponDef = {
  shape: 'smg', armsKey: 'clone_arms', muzzleOffset: 38.5, muzzleSide: 11.5,
  fireDelay: 0.085, damage: 11, damageVariance: 0.15, pellets: 1, spread: 2.2,
  bulletSpeed: 1050, bulletLife: 0.9, bulletW: 28, bulletH: 2.6,
  mag: 30, reload: 1.15, reloadEmpty: 1.6, burstCount: 1, burstGap: 0, pierce: 0,
  recoilImpulse: 20, cameraKick: 1.5, shotTrauma: 0.022, sound: 'smg',
  ap: 1, stagger: 0.04, bloomPerShot: 0.7, bloomMax: 5, bloomRecovery: 14, moveSpread: 1.2, mobility: 1,
  heft: 0.7, impact: 0.5,
  step: { rate: 0.05, spread: 0.05, reload: 0.04, ap: 0.15 },
};

export const BASE_ITEMS: readonly BaseItem[] = [
  // ----------------------------------------------------------------- primary
  { id: 'smg', slot: 'primary', family: 'smg', name: 'SMG', price: 0, weight: 30,
    desc: 'Fast and light, with the lowest kick. Chews through scavengers; machines shrug it off.', weapon: SMG },
  { id: 'autopistol', slot: 'primary', family: 'pistol', name: 'Autopistol', price: 45, weight: 22,
    desc: 'Light, accurate and quick to reload. Hits harder per round than the SMG and keeps you quick.',
    weapon: { ...SMG, shape: 'pistol', armsKey: 'clone_arms_pistol', muzzleOffset: 34.2, fireDelay: 0.14, damage: 15,
      spread: 1.6, mag: 15, reload: 0.8, reloadEmpty: 1.1, recoilImpulse: 36, cameraKick: 3.4, shotTrauma: 0.06, sound: 'pistol',
      ap: 1, stagger: 0.06, bloomPerShot: 1.1, bloomMax: 4, bloomRecovery: 16, moveSpread: 0.6, mobility: 1.04,
      heft: 1, impact: 0.8, step: { reload: 0.06, spread: 0.07, ap: 0.3, rate: 0.03 } } },
  { id: 'magnum', slot: 'primary', family: 'magnum', name: 'Magnum', price: 130, weight: 12,
    desc: 'Six heavy rounds. Punches through light plating and rocks machines back on their heels. Slow to bring back on target.',
    weapon: { ...SMG, shape: 'magnum', armsKey: 'clone_arms_magnum', muzzleOffset: 37.6, muzzleSide: 11.5, fireDelay: 0.55, damage: 52,
      damageVariance: 0.1, spread: 0.8, bulletSpeed: 1350, bulletLife: 0.9, bulletW: 36, bulletH: 3.4, mag: 6,
      reload: 1.7, reloadEmpty: 2.3, recoilImpulse: 200, cameraKick: 8, shotTrauma: 0.14, sound: 'magnum',
      ap: 3, stagger: 0.45, bloomPerShot: 3, bloomMax: 6, bloomRecovery: 7, moveSpread: 2, mobility: 0.96,
      heft: 1.9, impact: 1.6, step: { ap: 0.35, stagger: 0.08, reload: 0.05, spread: 0.06 } } },
  { id: 'shotgun', slot: 'primary', family: 'shotgun', name: 'Scatter Gun', price: 90, weight: 16,
    desc: 'Eight pellets, short range, slow to cycle. Devastating up close, and the blast staggers machines.',
    weapon: { ...SMG, shape: 'shotgun', armsKey: 'clone_arms_shotgun', muzzleOffset: 39.8, fireDelay: 0.72, damage: 8,
      pellets: 8, spread: 7, bulletSpeed: 900, bulletLife: 0.38, bulletW: 16, bulletH: 2.4, mag: 6, reload: 1.9, reloadEmpty: 2.3,
      recoilImpulse: 230, cameraKick: 9, shotTrauma: 0.15, sound: 'shotgun',
      ap: 2, stagger: 0.12, bloomPerShot: 2.5, bloomMax: 4, bloomRecovery: 9, moveSpread: 1.5, mobility: 0.94,
      heft: 1.9, impact: 1.2, step: { pellets: 0.5, stagger: 0.08, ap: 0.3, reload: 0.05 } } },
  { id: 'marksman', slot: 'primary', family: 'marksman', name: 'Marksman Rifle', price: 140, weight: 12,
    desc: 'Slow, precise, armour-piercing. The round passes through two enemies. Do not run and gun with it.',
    weapon: { ...SMG, shape: 'marksman', armsKey: 'clone_arms_marksman', muzzleOffset: 39.9, fireDelay: 0.52, damage: 58,
      damageVariance: 0.1, spread: 0.3, bulletSpeed: 1600, bulletLife: 1.1, bulletW: 44, bulletH: 2.8, mag: 8,
      reload: 1.7, reloadEmpty: 2.1, pierce: 2, recoilImpulse: 150, cameraKick: 7, shotTrauma: 0.1, sound: 'rifle',
      ap: 4, stagger: 0.7, bloomPerShot: 2.2, bloomMax: 5, bloomRecovery: 6, moveSpread: 3, mobility: 0.92,
      heft: 1.6, impact: 1.4, step: { ap: 0.4, pierce: 0.35, rate: 0.03, recovery: 0.06 } } },
  { id: 'burst', slot: 'primary', family: 'burst', name: 'Burst Carbine', price: 100, weight: 14,
    desc: 'Three tight rounds per pull, with enough bite for light armour.',
    weapon: { ...SMG, shape: 'burst', armsKey: 'clone_arms_burst', muzzleOffset: 39.8, fireDelay: 0.4, damage: 14,
      spread: 1.0, mag: 24, reload: 1.3, reloadEmpty: 1.7, burstCount: 3, burstGap: 0.055, recoilImpulse: 30, cameraKick: 2.8, shotTrauma: 0.05,
      sound: 'smg', ap: 2, stagger: 0.08, bloomPerShot: 0.8, bloomMax: 4.5, bloomRecovery: 12, moveSpread: 1, mobility: 1,
      heft: 1, impact: 0.8, step: { burst: 0.3, burstGap: 0.05, spread: 0.06, ap: 0.2 } } },

  // ------------------------------------------------------------------- blade
  { id: 'arc', slot: 'blade', family: 'arc', name: 'Arc Blade', price: 0, weight: 30,
    desc: 'Balanced. A wide lunging cleave.',
    blade: { spriteKey: 'clone_sword', windup: 0.085, swing: 0.13, recover: 0.17, reach: 96, arcHalfAngle: 82, damage: 70,
      cooldown: 0.8, lungeSpeed: 560, knockback: 260, stagger: 0.65 } },
  { id: 'cleaver', slot: 'blade', family: 'cleaver', name: 'Great Cleaver', price: 120, weight: 14,
    desc: 'Slow and very wide. Heavy blows stagger machines.',
    blade: { spriteKey: 'clone_cleaver', windup: 0.15, swing: 0.2, recover: 0.26, reach: 108, arcHalfAngle: 100, damage: 125,
      cooldown: 1.3, lungeSpeed: 420, knockback: 420, stagger: 1.1 } },
  { id: 'stiletto', slot: 'blade', family: 'stiletto', name: 'Stiletto', price: 70, weight: 18,
    desc: 'Fast and narrow, with a long lunge.',
    blade: { spriteKey: 'clone_stiletto', windup: 0.045, swing: 0.09, recover: 0.11, reach: 80, arcHalfAngle: 48, damage: 42,
      cooldown: 0.5, lungeSpeed: 820, knockback: 190, stagger: 0.4 } },

  // ------------------------------------------------------------------ armour
  { id: 'scrapplate', slot: 'armour', family: 'plate', name: 'Scrap Plate', price: 0, weight: 30,
    desc: 'Cheap and balanced.', armour: { hull: 100, shield: 100, moveMul: 1, dashCdMul: 1 } },
  { id: 'assaultplate', slot: 'armour', family: 'plate', name: 'Assault Plate', price: 120, weight: 14,
    desc: 'Heavy: a big hull, but slower and a sluggish dash.', armour: { hull: 155, shield: 80, moveMul: 0.92, dashCdMul: 1.12 } },
  { id: 'runnerrig', slot: 'armour', family: 'rig', name: 'Runner Rig', price: 90, weight: 16,
    desc: 'Light: quick on your feet, thin hull.', armour: { hull: 70, shield: 115, moveMul: 1.08, dashCdMul: 0.82 } },

  // -------------------------------------------------------------------- pack
  { id: 'stdpack', slot: 'pack', family: 'pack', name: 'Standard Rig', price: 0, weight: 30,
    desc: 'Balanced.', pack: { reserve: 180, salvage: 0, dashCdMul: 1, bladeCdMul: 1 } },
  { id: 'hauler', slot: 'pack', family: 'pack', name: 'Ammo Hauler', price: 90, weight: 14,
    desc: 'A huge reserve and more room, at the cost of a slower dash.', pack: { reserve: 300, salvage: 0.1, dashCdMul: 1.15, bladeCdMul: 1 } },
  { id: 'harness', slot: 'pack', family: 'pack', name: 'Light Harness', price: 70, weight: 16,
    desc: 'Fast cooldowns, a small reserve.', pack: { reserve: 120, salvage: 0, dashCdMul: 0.85, bladeCdMul: 0.88 } },
];

export const BASE_BY_ID: ReadonlyMap<string, BaseItem> = new Map(BASE_ITEMS.map((b) => [b.id, b]));

/** What a fresh profile wears: the old feel-test kit. */
export const STARTING_KIT: Readonly<Record<Slot, string>> = {
  primary: 'smg',
  blade: 'arc',
  armour: 'scrapplate',
  pack: 'stdpack',
};
