import { describe, expect, it } from 'vitest';
import { attemptsForScatters, trinaChargesForScatters, upgradeChance } from '../src/bonus/AnvilMath';

describe('Magic Anvil math', () => {
  it('opens a path from +1 up to +8 as scatter count rises', () => {
    expect([3, 4, 5].map(attemptsForScatters)).toEqual([5, 6, 7]);
  });

  it('awards visible Trina charges for every bonus tier', () => {
    expect([3, 4, 5].map(trinaChargesForScatters)).toEqual([1, 2, 3]);
  });

  it('adds fifteen percentage points without exceeding 98%', () => {
    expect(upgradeChance(5, false)).toBe(0.46);
    expect(upgradeChance(5, true)).toBeCloseTo(0.61);
    expect(upgradeChance(2, true)).toBe(0.98);
  });
});
