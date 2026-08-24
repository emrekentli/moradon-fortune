import { describe, expect, it } from 'vitest';
import { trinaChargesForScatters, upgradeChance } from '../src/bonus/AnvilMath';

describe('Magic Anvil math', () => {
  it('awards visible Trina charges for every bonus tier', () => {
    expect([3, 4, 5].map(trinaChargesForScatters)).toEqual([1, 2, 3]);
  });

  it('adds fifteen percentage points without exceeding 98%', () => {
    expect(upgradeChance(5, false)).toBe(0.46);
    expect(upgradeChance(5, true)).toBeCloseTo(0.61);
    expect(upgradeChance(2, true)).toBe(0.98);
  });

  it('reduces upgrade chance as the item approaches +8', () => {
    expect(upgradeChance(2)).toBe(0.9);
    expect(upgradeChance(6)).toBe(0.3);
    expect(upgradeChance(8)).toBe(0.1);
  });
});
