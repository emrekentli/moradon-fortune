import type { SpinMatrix } from '../game/types';

export const DEBUG_SCENARIOS: Record<'anvil' | 'big-win' | 'loss', SpinMatrix> = {
  anvil: [
    ['scatter', 'hp', 'mp'],
    ['bow', 'coin', 'scroll'],
    ['shard', 'scatter', 'hp'],
    ['mp', 'raptor', 'coin'],
    ['scroll', 'bow', 'scatter'],
  ],
  'big-win': [
    ['raptor', 'hp', 'mp'],
    ['wild', 'coin', 'scroll'],
    ['raptor', 'bow', 'hp'],
    ['raptor', 'shard', 'coin'],
    ['raptor', 'mp', 'scroll'],
  ],
  loss: [
    ['hp', 'mp', 'scroll'],
    ['coin', 'bow', 'raptor'],
    ['shard', 'hp', 'mp'],
    ['scroll', 'coin', 'bow'],
    ['mp', 'raptor', 'shard'],
  ],
};

export function cloneScenario(name: keyof typeof DEBUG_SCENARIOS): SpinMatrix {
  return DEBUG_SCENARIOS[name].map((column) => [...column]);
}
