export type SymbolId =
  | 'hp'
  | 'mp'
  | 'scroll'
  | 'raptor'
  | 'shard'
  | 'bow'
  | 'wild'
  | 'coin'
  | 'scatter';

export type SymbolDef = {
  id: SymbolId;
  name: string;
  atlasIndex: number;
  weight: number;
  payout: Record<number, number>;
};

export type SpinMatrix = SymbolId[][];

export type SpinOutcome = {
  matrix: SpinMatrix;
  stops: number[];
};

export type LineWin = {
  lineIndex: number;
  symbol: SymbolId;
  count: number;
  multiplier: number;
  positions: Array<{ col: number; row: number }>;
};

export type WinResult = {
  amount: number;
  positions: Set<string>;
  lines: number;
  scatters: number;
  multiplier: number;
  wins: LineWin[];
};

export enum GamePhase {
  Loading = 'loading',
  Idle = 'idle',
  Spinning = 'spinning',
  Stopping = 'stopping',
  Presenting = 'presenting',
  BonusIntro = 'bonus-intro',
  Disabled = 'disabled',
}
