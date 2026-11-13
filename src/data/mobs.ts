// The enemy roster. Plain data: stats, armour, loot and the numbers each behaviour reads.
// Behaviours live in src/game/systems/mobAI.ts, art in src/fx/mobArt.ts, the wave composer in
// src/sim/waves.ts (it reads cost, weight, minDepth and maxPerWave).
import { PALETTE } from './palette';

export type MobKind = 'scav' | 'leaper' | 'bomber' | 'spitter' | 'brute' | 'robot' | 'sniper' | 'warden';
export type Behaviour = 'swarm' | 'leaper' | 'bomber' | 'spitter' | 'brute' | 'sentry' | 'warden';

/** Telegraphed ranged attack: a laser line, then a burst. Used by sentries, snipers and spitters. */
export interface RangedDef {
  preferredMin: number;
  preferredMax: number;
  range: number; // will not start an attack from further than this
  telegraph: number;
  burstCount: number;
  burstGap: number;
  cooldownMin: number;
  cooldownMax: number;
  bulletSpeed: number;
  bulletDamage: number;
  bulletLife: number;
  bulletW: number;
  bulletH: number;
  /** Radians between bullets when burstCount > 1 and `fan` is set (spitters). */
  fan: number;
  laser: boolean; // draw the aiming line while telegraphing
  lockTime: number; // the aim stops tracking the player this long before the shot
  recoil: number;
}

export interface MobDef {
  id: MobKind;
  name: string;
  behaviour: Behaviour;
  hp: number;
  radius: number;
  speed: number;
  speedJitter: number;
  /** Armour class vs weapon AP (TUNING.armour.table). 0 = soft. */
  armour: number;
  color: number;
  metal: boolean; // sparks and clanks instead of gore
  bar: boolean; // small health bar above it
  gunKnockback: number;
  bladeKnockback: number; // multiplier on the blade's knockback
  /** Gun hits build a stagger meter; null = cannot be staggered by gun fire. */
  stagger: { at: number; decay: number; time: number; immune: number } | null;
  /** Melee contact attack. */
  contact: { range: number; damage: number; cooldown: number } | null;
  ranged: RangedDef | null;
  // Wave composer
  cost: number;
  weight: number;
  minDepth: number;
  maxPerWave: number;
  loot: { chance: number; minRarity: number; drops: number };
  glow: number; // spawn flash scale
}

const NONE = null;

export const MOBS: Record<MobKind, MobDef> = {
  scav: {
    id: 'scav', name: 'Scavenger', behaviour: 'swarm',
    hp: 22, radius: 12, speed: 150, speedJitter: 0.25, armour: 0, color: PALETTE.hostile,
    metal: false, bar: false, gunKnockback: 140, bladeKnockback: 1, stagger: NONE,
    contact: { range: 30, damage: 8, cooldown: 0.75 }, ranged: NONE,
    cost: 1, weight: 10, minDepth: 0, maxPerWave: 40,
    loot: { chance: 0.34, minRarity: 0, drops: 1 }, glow: 1.3,
  },
  bomber: {
    id: 'bomber', name: 'Bloater', behaviour: 'bomber',
    hp: 30, radius: 15, speed: 118, speedJitter: 0.15, armour: 0, color: PALETTE.ember,
    metal: false, bar: false, gunKnockback: 90, bladeKnockback: 1, stagger: NONE,
    contact: NONE, ranged: NONE,
    cost: 2, weight: 3, minDepth: 1, maxPerWave: 8,
    loot: { chance: 0.3, minRarity: 0, drops: 1 }, glow: 1.6,
  },
  leaper: {
    id: 'leaper', name: 'Stalker', behaviour: 'leaper',
    hp: 34, radius: 12, speed: 175, speedJitter: 0.15, armour: 0, color: PALETTE.hostile,
    metal: false, bar: false, gunKnockback: 120, bladeKnockback: 1, stagger: NONE,
    contact: { range: 30, damage: 16, cooldown: 0.9 }, ranged: NONE,
    cost: 3, weight: 3, minDepth: 2, maxPerWave: 6,
    loot: { chance: 0.4, minRarity: 0, drops: 1 }, glow: 1.4,
  },
  spitter: {
    id: 'spitter', name: 'Spitter', behaviour: 'spitter',
    hp: 46, radius: 14, speed: 96, speedJitter: 0.1, armour: 0, color: PALETTE.acid,
    metal: false, bar: false, gunKnockback: 90, bladeKnockback: 1, stagger: NONE,
    contact: NONE,
    ranged: {
      preferredMin: 280, preferredMax: 430, range: 560, telegraph: 0.55, burstCount: 3, burstGap: 0,
      cooldownMin: 1.8, cooldownMax: 3, bulletSpeed: 300, bulletDamage: 9, bulletLife: 2.6,
      bulletW: 14, bulletH: 14, fan: 0.24, laser: false, lockTime: 0.1, recoil: 40,
    },
    cost: 3, weight: 3, minDepth: 2, maxPerWave: 5,
    loot: { chance: 0.45, minRarity: 0, drops: 1 }, glow: 1.5,
  },
  brute: {
    id: 'brute', name: 'Brute', behaviour: 'brute',
    hp: 260, radius: 26, speed: 72, speedJitter: 0.05, armour: 1, color: PALETTE.ember,
    metal: false, bar: true, gunKnockback: 18, bladeKnockback: 0.35,
    stagger: { at: 2.6, decay: 1.2, time: 0.45, immune: 2.2 },
    contact: { range: 44, damage: 20, cooldown: 1.1 }, ranged: NONE,
    cost: 7, weight: 2, minDepth: 3, maxPerWave: 2,
    loot: { chance: 1, minRarity: 1, drops: 1 }, glow: 2.4,
  },
  robot: {
    id: 'robot', name: 'Sentry', behaviour: 'sentry',
    hp: 120, radius: 21, speed: 78, speedJitter: 0, armour: 2, color: PALETTE.robot,
    metal: true, bar: true, gunKnockback: 25, bladeKnockback: 0.3,
    stagger: { at: 1, decay: 1.4, time: 0.55, immune: 1.2 },
    contact: NONE,
    ranged: {
      preferredMin: 230, preferredMax: 340, range: 640, telegraph: 0.6, burstCount: 3, burstGap: 0.1,
      cooldownMin: 1.7, cooldownMax: 2.6, bulletSpeed: 430, bulletDamage: 11, bulletLife: 2.2,
      bulletW: 20, bulletH: 5, fan: 0, laser: true, lockTime: 0.16, recoil: 70,
    },
    cost: 5, weight: 3, minDepth: 1, maxPerWave: 4,
    loot: { chance: 1, minRarity: 1, drops: 2 }, glow: 2.6,
  },
  sniper: {
    id: 'sniper', name: 'Marksman', behaviour: 'sentry',
    hp: 80, radius: 18, speed: 70, speedJitter: 0, armour: 1, color: PALETTE.robot,
    metal: true, bar: true, gunKnockback: 25, bladeKnockback: 0.3,
    stagger: { at: 0.8, decay: 1.4, time: 0.7, immune: 1.4 },
    contact: NONE,
    ranged: {
      preferredMin: 430, preferredMax: 580, range: 860, telegraph: 1.15, burstCount: 1, burstGap: 0.1,
      cooldownMin: 2.4, cooldownMax: 3.4, bulletSpeed: 980, bulletDamage: 24, bulletLife: 1.4,
      bulletW: 38, bulletH: 4, fan: 0, laser: true, lockTime: 0.4, recoil: 140,
    },
    cost: 5, weight: 2, minDepth: 3, maxPerWave: 2,
    loot: { chance: 1, minRarity: 1, drops: 2 }, glow: 2.2,
  },
  warden: {
    id: 'warden', name: 'The Warden', behaviour: 'warden',
    hp: 1400, radius: 40, speed: 62, speedJitter: 0, armour: 1, color: PALETTE.robot,
    metal: true, bar: false, gunKnockback: 4, bladeKnockback: 0.1, stagger: NONE,
    contact: NONE, ranged: NONE,
    cost: 0, weight: 0, minDepth: 99, maxPerWave: 1,
    loot: { chance: 1, minRarity: 2, drops: 3 }, glow: 4,
  },
};

export const MOB_KINDS = Object.keys(MOBS) as MobKind[];

/** Numbers for the behaviours that are not plain melee or ranged. */
export const MOB_AI = {
  /** Shooters that finish a burst may duck out of the player's sight and peek back. */
  cover: { chance: 0.7, probe: [90, 170, 250], time: [0.9, 1.9], speedMul: 1.15, arrive: 18, minDist: 150 },
  leaper: { triggerMin: 130, triggerMax: 340, windup: 0.5, leapSpeed: 780, leapTime: 0.27, recover: 0.7, cooldownMin: 0.9, cooldownMax: 1.8 },
  bomber: { primeRange: 54, fuse: 0.45, blastRadius: 105, blastDamage: 22, blastKnock: 420, deathBlast: true },
  brute: { triggerRange: 250, windup: 0.8, chargeSpeed: 640, chargeTime: 0.55, recover: 0.95, cooldownMin: 1.2, cooldownMax: 2.2, hitKnock: 520 },
  warden: {
    preferredMin: 260, preferredMax: 400,
    stageHp: [0.66, 0.33], // stage 2 below the first, stage 3 below the second
    stageSpeed: [1, 1.15, 1.35],
    cooldown: [2.2, 1.6, 1.1], // idle seconds between attacks, per stage
    fan: { telegraph: 0.7, count: [5, 5, 7], arc: 0.62, speed: 430, damage: 10 },
    ring: { telegraph: 0.9, count: [18, 22, 26], speed: 250, damage: 9, second: [false, false, true], secondDelay: 0.38 },
    sweep: { duration: 1.9, gap: 0.075, spin: 3.6, speed: 300, damage: 8 },
    summon: { telegraph: 1, count: [0, 4, 6] },
    bulletW: 16, bulletH: 7,
  },
} as const;
