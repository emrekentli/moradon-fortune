import { COLS, PAYLINES, PAYOUT_FACTOR, REEL_STRIPS, ROWS, SYMBOLS } from '../game/config';
import type { LineWin, SpinMatrix, SpinOutcome, SymbolDef, SymbolId, WinResult } from '../game/types';
import { CryptoRandom, type RandomSource } from './Random';

export class SlotEngine {
  private readonly totalWeight = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);
  private readonly symbolById = new Map(SYMBOLS.map((symbol) => [symbol.id, symbol]));

  constructor(private readonly random: RandomSource = new CryptoRandom()) {}

  spin(): SpinMatrix {
    return this.spinWithStops().matrix;
  }

  spinWithStops(): SpinOutcome {
    const stops = REEL_STRIPS.map((strip) => Math.floor(this.random.next() * strip.length));
    return { stops, matrix: this.matrixFromStops(stops) };
  }

  findStops(matrix: SpinMatrix): number[] {
    return matrix.map((column, reel) => {
      const strip = REEL_STRIPS[reel];
      const match = strip.findIndex((_, stop) =>
        column.every((id, row) => strip[(stop + row) % strip.length] === id),
      );
      return match >= 0 ? match : 0;
    });
  }

  private matrixFromStops(stops: number[]): SpinMatrix {
    return stops.map((stop, reel) => {
      const strip = REEL_STRIPS[reel];
      return Array.from({ length: ROWS }, (_, row) => strip[(stop + row) % strip.length]);
    });
  }

  randomSymbol(): SymbolId {
    const target = this.random.next() * this.totalWeight;
    let cursor = 0;
    for (const symbol of SYMBOLS) {
      cursor += symbol.weight;
      if (target < cursor) return symbol.id;
    }
    return SYMBOLS[0].id;
  }

  evaluate(result: SpinMatrix, bet: number): WinResult {
    let multiplier = 0;
    let lines = 0;
    const positions = new Set<string>();
    const wins: LineWin[] = [];

    for (let lineIndex = 0; lineIndex < PAYLINES.length; lineIndex += 1) {
      const payline = PAYLINES[lineIndex];
      const ids = payline.map((row, col) => result[col][row]);
      const base = ids.find((id) => id !== 'wild' && id !== 'scatter')
        ?? (ids[0] === 'wild' ? 'wild' : null);
      if (!base) continue;

      let count = 0;
      for (const id of ids) {
        if (id === base || id === 'wild') count += 1;
        else break;
      }
      if (count < 3) continue;

      const definition = this.symbolById.get(base);
      if (!definition) continue;
      const lineMultiplier = (definition.payout[count] ?? 0) * PAYOUT_FACTOR;
      multiplier += lineMultiplier;
      lines += 1;
      const linePositions = Array.from({ length: count }, (_, col) => ({ col, row: payline[col] }));
      for (const position of linePositions) positions.add(`${position.col}:${position.row}`);
      wins.push({
        lineIndex,
        symbol: base,
        count,
        multiplier: lineMultiplier,
        positions: linePositions,
      });
    }

    const scatterPositions: string[] = [];
    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        if (result[col][row] === 'scatter') scatterPositions.push(`${col}:${row}`);
      }
    }

    const scatters = scatterPositions.length;
    if (scatters >= 3) {
      multiplier += (this.symbolById.get('scatter')?.payout[Math.min(5, scatters)] ?? 0) * PAYOUT_FACTOR;
      for (const position of scatterPositions) positions.add(position);
    }

    return {
      amount: Math.round(multiplier * bet * 100) / 100,
      positions,
      lines,
      scatters,
      multiplier,
      wins,
    };
  }

  getDefinition(id: SymbolId): SymbolDef {
    const definition = this.symbolById.get(id);
    if (!definition) throw new Error(`Unknown symbol: ${id}`);
    return definition;
  }
}
