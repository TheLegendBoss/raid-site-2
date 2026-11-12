// Resolves base tuning plus unlocked tree effects into the numbers combat
// reads. Pure TypeScript. Systems read EffectiveStats, never TUNING.gun etc.
// for anything a node can change.
import { TREE_NODES, type StatKey } from '../data/tree';
import { TUNING as T } from '../data/tuning';

export interface EffectiveStats {
  hull: number;
  shield: number;
  shieldRegenRate: number;
  shieldRegenDelay: number;
  moveSpeed: number;
  dashCooldown: number;
  gunDamage: number;
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
}

const BASE: Record<StatKey, number> = {
  hull: T.player.maxHp,
  shield: T.player.maxShield,
  shieldRegenRate: T.player.shieldRegenRate,
  shieldRegenDelay: T.player.shieldRegenDelay,
  moveSpeed: T.player.maxSpeed,
  dashCooldown: T.player.dashCooldown,
  gunDamage: T.gun.damage,
  spread: T.gun.spread,
  reloadTime: T.gun.reloadTime,
  magSize: T.gun.magSize,
  reserveMax: T.gun.maxReserve,
  bladeDamage: T.sword.damage,
  bladeCooldown: T.sword.cooldown,
  bladeReach: T.sword.reach,
  bladeRefund: 1,
  magnetRadius: T.loot.magnetRadius,
  carrySlots: T.loot.carrySlots,
  intelGain: 1,
};

/** Never let a percentage stack take a stat below this fraction of its base. */
const FLOOR = 0.25;

export function resolveStats(unlocked: ReadonlySet<string>): EffectiveStats {
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
    reloadTimeEmpty: reloadTime * (T.gun.reloadTimeEmpty / T.gun.reloadTime),
    magSize: Math.round(v('magSize')),
    reserveMax: Math.round(v('reserveMax')),
    bladeDamage: v('bladeDamage'),
    bladeCooldown: v('bladeCooldown'),
    bladeReach: v('bladeReach'),
    bladeRefund: v('bladeRefund'),
    magnetRadius: v('magnetRadius'),
    carrySlots: Math.round(v('carrySlots')),
    intelGain: v('intelGain'),
  };
}
