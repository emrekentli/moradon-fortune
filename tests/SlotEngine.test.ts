import { describe, expect, it } from 'vitest';
import { DEBUG_SCENARIOS } from '../src/debug/Scenarios';
import { REEL_STRIPS } from '../src/game/config';
import { SeededRandom } from '../src/math/Random';
import { SlotEngine } from '../src/math/SlotEngine';

describe('SlotEngine', () => {
  it('produces the same sequence for the same seed', () => {
    const first = new SlotEngine(new SeededRandom(424242));
    const second = new SlotEngine(new SeededRandom(424242));
    expect(Array.from({ length: 20 }, () => first.spin()))
      .toEqual(Array.from({ length: 20 }, () => second.spin()));
  });

  it('builds every visible result from consecutive fixed-strip stops', () => {
    const outcome = new SlotEngine(new SeededRandom(77)).spinWithStops();
    outcome.matrix.forEach((column, reel) => {
      expect(column).toEqual(column.map((_, row) =>
        REEL_STRIPS[reel][(outcome.stops[reel] + row) % REEL_STRIPS[reel].length],
      ));
    });
  });

  it('evaluates a known loss as zero', () => {
    const result = new SlotEngine().evaluate(DEBUG_SCENARIOS.loss, 10);
    expect(result.amount).toBe(0);
    expect(result.positions.size).toBe(0);
  });

  it('counts three scatter symbols and their award', () => {
    const result = new SlotEngine().evaluate(DEBUG_SCENARIOS.anvil, 10);
    expect(result.scatters).toBe(3);
    expect(result.positions.size).toBeGreaterThanOrEqual(3);
    expect(result.amount).toBe(15.2);
  });

  it('lets wild substitute on a left-to-right premium line', () => {
    const result = new SlotEngine().evaluate(DEBUG_SCENARIOS['big-win'], 10);
    expect(result.wins.some((win) => win.symbol === 'raptor' && win.count === 5)).toBe(true);
    expect(result.amount).toBe(114);
  });
});
