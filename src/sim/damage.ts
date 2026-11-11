// Pure damage rolls. No engine imports.
import type { Rng } from './math';

/** Whole-number damage in [base * (1 - variance), base * (1 + variance)], at least 1. */
export function rollDamage(rng: Rng, base: number, variance: number): number {
  const factor = 1 + (rng.next() * 2 - 1) * variance;
  return Math.max(1, Math.round(base * factor));
}
