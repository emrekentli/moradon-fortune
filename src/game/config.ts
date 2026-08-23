import type { SymbolDef, SymbolId } from './types';

export const DESIGN_W = 1280;
export const DESIGN_H = 720;
export const REEL_X = 215;
export const REEL_Y = 151;
export const CELL_W = 170;
export const CELL_H = 137;
export const COLS = 5;
export const ROWS = 3;

export const SYMBOLS: SymbolDef[] = [
  { id: 'hp', name: 'HP İksiri', atlasIndex: 0, weight: 18, payout: { 3: 0.5, 4: 1, 5: 2.5 } },
  { id: 'mp', name: 'MP İksiri', atlasIndex: 1, weight: 18, payout: { 3: 0.5, 4: 1, 5: 2.5 } },
  { id: 'scroll', name: 'Blessed Scroll', atlasIndex: 2, weight: 14, payout: { 3: 0.8, 4: 1.8, 5: 4 } },
  { id: 'raptor', name: 'Raptor', atlasIndex: 3, weight: 8, payout: { 3: 2.5, 4: 6, 5: 15 } },
  { id: 'shard', name: 'Shard', atlasIndex: 4, weight: 9, payout: { 3: 2, 4: 5, 5: 12 } },
  { id: 'bow', name: 'Iron Bow', atlasIndex: 5, weight: 10, payout: { 3: 1.5, 4: 4, 5: 10 } },
  { id: 'wild', name: 'Trina Wild', atlasIndex: 6, weight: 5, payout: { 3: 3, 4: 8, 5: 20 } },
  { id: 'coin', name: 'Noah', atlasIndex: 7, weight: 14, payout: { 3: 0.8, 4: 2, 5: 5 } },
  { id: 'scatter', name: 'Moradon Scatter', atlasIndex: 8, weight: 2, payout: { 3: 2, 4: 8, 5: 25 } },
];

export const PAYLINES = [
  [0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0], [2, 1, 0, 1, 2], [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2], [1, 0, 1, 2, 1], [1, 2, 1, 0, 1],
  [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2], [1, 1, 0, 1, 1],
];

export const BETS = [5, 10, 20, 50];

// Normalizes the 20-line paytable to a sustainable base-game return.
// Bonus free-spin value is intentionally kept outside this base-game factor.
export const PAYOUT_FACTOR = 0.76;

const DEBUG_COLUMNS: SymbolId[][][] = [
  [['scatter', 'hp', 'mp'], ['raptor', 'hp', 'mp'], ['hp', 'mp', 'scroll']],
  [['bow', 'coin', 'scroll'], ['wild', 'coin', 'scroll'], ['coin', 'bow', 'raptor']],
  [['shard', 'scatter', 'hp'], ['raptor', 'bow', 'hp'], ['shard', 'hp', 'mp']],
  [['mp', 'raptor', 'coin'], ['raptor', 'shard', 'coin'], ['scroll', 'coin', 'bow']],
  [['scroll', 'bow', 'scatter'], ['raptor', 'mp', 'scroll'], ['mp', 'raptor', 'shard']],
];

function createReelStrip(reelIndex: number): SymbolId[] {
  const weighted = SYMBOLS.flatMap((symbol) =>
    Array.from({ length: Math.max(1, Math.round(symbol.weight / 2)) }, () => symbol.id),
  );
  let state = (0x9e3779b9 ^ ((reelIndex + 1) * 0x85ebca6b)) >>> 0;
  for (let index = weighted.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [weighted[index], weighted[swapIndex]] = [weighted[swapIndex], weighted[index]];
  }
  return [
    ...DEBUG_COLUMNS[reelIndex].flatMap((column) => [...column, 'coin' as SymbolId]),
    ...weighted,
  ];
}

export const REEL_STRIPS: SymbolId[][] = Array.from({ length: COLS }, (_, reel) => createReelStrip(reel));
