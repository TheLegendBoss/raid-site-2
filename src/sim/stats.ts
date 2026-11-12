// Resolves equipped gear plus unlocked tree effects into the numbers combat
// reads. Pure TypeScript. Systems read EffectiveStats, never TUNING.gun etc.
// for anything gear or a node can change.
//
// Order: gear sets the base (weapon, blade, armour and pack, scaled by their
// rarity tier), then tree nodes add flat amounts and percentages on top.
import { BASE_BY_ID, STARTING_KIT, type GunShape, type Slot, type WeaponDef } from '../data/items';
import { RARITY_TIER } from '../data/loot';
import { TREE_NODES, type StatKey } from '../data/tree';
import { TUNING as T } from '../data/tuning';
import type { Item } from './loot';

export type Loadout = Readonly<Record<Slot, Item | null>>;

/** Weapon behaviour the gun system needs besides the tunable numbers. */
export interface WeaponStats {
  name: string;
  shape: GunShape;
  armsKey: string;
  muzzleOffset: number;
  muzzleSide: number;
  fireDelay: number;
  damageVariance: number;
  pellets: number;
  bulletSpeed: number;
  bulletLife: number;
  bulletW: number;
  bulletH: number;
  burstCount: number;
  burstGap: number;
  pierce: number;
  recoilImpulse: number;
  cameraKick: number;
  shotTrauma: number;
  sound: WeaponDef['sound'];
}

export interface BladeStats {
  name: string;
  spriteKey: string;
  windup: number;
  swing: number;
  recover: number;
  arcHalfAngle: number;
  lungeSpeed: number;
  knockback: number;
  stagger: number;
}

export interface EffectiveStats {
  hull: number;
  shield: number;
  shieldRegenRate: number;
  shieldRegenDelay: number;
  moveSpeed: number;
  dashCooldown: number;
  gunDamage: number; // per pellet
  spread: number;
  reloadTime: number;
  reloadTimeEmpty: number;
  magSize: number;
  reserveMax: number;
  bladeDamage: number;
  bladeCooldown: number;
  bladeReach: number;
  bladeRefund: number; // multiplier on the reserve and shield refunded per blade kill
  magnetRadius: number;
  carrySlots: number;
  intelGain: number; // multiplier
  activeWidth: number; // active reload window, fraction of the reload
  weapon: WeaponStats;
  blade: BladeStats;
}

/** Never let a percentage stack take a stat below this fraction of its base. */
const FLOOR = 0.25;

function baseFor(loadout: Loadout, slot: Slot): { def: ReturnType<typeof BASE_BY_ID.get>; tier: number } {
  const it = loadout[slot];
  const def = BASE_BY_ID.get(it ? it.baseId : STARTING_KIT[slot])!;
  return { def, tier: it ? RARITY_TIER[it.rarity] : 1 };
}

export function resolveStats(unlocked: ReadonlySet<string>, loadout: Loadout): EffectiveStats {
  const pri = baseFor(loadout, 'primary');
  const bld = baseFor(loadout, 'blade');
  const arm = baseFor(loadout, 'armour');
  const pck = baseFor(loadout, 'pack');
  const wp = pri.def!.weapon!;
  const bl = bld.def!.blade!;
  const ar = arm.def!.armour!;
  const pk = pck.def!.pack!;

  const BASE: Record<StatKey, number> = {
    hull: ar.hull * arm.tier,
    shield: ar.shield * arm.tier,
    shieldRegenRate: T.player.shieldRegenRate,
    shieldRegenDelay: T.player.shieldRegenDelay,
    moveSpeed: T.player.maxSpeed * ar.moveMul,
    dashCooldown: T.player.dashCooldown * ar.dashCdMul * pk.dashCdMul,
    gunDamage: wp.damage * pri.tier,
    spread: wp.spread,
    reloadTime: wp.reload,
    magSize: wp.mag * pri.tier,
    reserveMax: pk.reserve * pck.tier,
    bladeDamage: bl.damage * bld.tier,
    bladeCooldown: bl.cooldown * pk.bladeCdMul,
    bladeReach: bl.reach,
    bladeRefund: 1,
    magnetRadius: T.loot.magnetRadius,
    carrySlots: T.loot.carrySlots + pk.carry,
    intelGain: 1,
    activeWidth: T.gun.activeReload.width,
  };

  const add: Partial<Record<StatKey, number>> = {};
  const pct: Partial<Record<StatKey, number>> = {};
  for (const n of TREE_NODES) {
    if (!unlocked.has(n.id)) continue;
    for (const e of n.effects) {
      if (e.add) add[e.stat] = (add[e.stat] ?? 0) + e.add;
      if (e.pct) pct[e.stat] = (pct[e.stat] ?? 0) + e.pct;
    }
  }
  const v = (k: StatKey): number => Math.max(BASE[k] * FLOOR, (BASE[k] + (add[k] ?? 0)) * (1 + (pct[k] ?? 0)));
  const reloadTime = v('reloadTime');

  return {
    hull: v('hull'),
    shield: v('shield'),
    shieldRegenRate: v('shieldRegenRate'),
    shieldRegenDelay: v('shieldRegenDelay'),
    moveSpeed: v('moveSpeed'),
    dashCooldown: v('dashCooldown'),
    gunDamage: v('gunDamage'),
    spread: v('spread'),
    reloadTime,
    reloadTimeEmpty: reloadTime * (wp.reloadEmpty / wp.reload),
    magSize: Math.max(1, Math.round(v('magSize'))),
    reserveMax: Math.round(v('reserveMax')),
    bladeDamage: v('bladeDamage'),
    bladeCooldown: v('bladeCooldown'),
    bladeReach: v('bladeReach'),
    bladeRefund: v('bladeRefund'),
    magnetRadius: v('magnetRadius'),
    carrySlots: Math.max(4, Math.round(v('carrySlots'))),
    intelGain: v('intelGain'),
    activeWidth: Math.min(T.gun.activeReload.maxWidth, v('activeWidth')),
    weapon: {
      name: pri.def!.name, shape: wp.shape, armsKey: wp.armsKey, muzzleOffset: wp.muzzleOffset, muzzleSide: wp.muzzleSide,
      fireDelay: wp.fireDelay, damageVariance: wp.damageVariance, pellets: wp.pellets, bulletSpeed: wp.bulletSpeed,
      bulletLife: wp.bulletLife, bulletW: wp.bulletW, bulletH: wp.bulletH, burstCount: wp.burstCount, burstGap: wp.burstGap,
      pierce: wp.pierce, recoilImpulse: wp.recoilImpulse, cameraKick: wp.cameraKick, shotTrauma: wp.shotTrauma, sound: wp.sound,
    },
    blade: {
      name: bld.def!.name, spriteKey: bl.spriteKey, windup: bl.windup, swing: bl.swing, recover: bl.recover,
      arcHalfAngle: bl.arcHalfAngle, lungeSpeed: bl.lungeSpeed, knockback: bl.knockback, stagger: bl.stagger,
    },
  };
}
