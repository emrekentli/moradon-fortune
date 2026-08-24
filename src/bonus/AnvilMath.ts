export const ANVIL_CHANCES = [1, 1, 0.9, 0.78, 0.62, 0.46, 0.3, 0.18, 0.1] as const;
export const TRINA_CHANCE_BOOST = 0.15;

export function trinaChargesForScatters(scatterCount: number): number {
  return Math.max(1, Math.min(3, scatterCount - 2));
}

export function upgradeChance(targetLevel: number, useTrina = false): number {
  const base = ANVIL_CHANCES[Math.min(8, Math.max(1, targetLevel))];
  return Math.min(0.98, base + (useTrina ? TRINA_CHANCE_BOOST : 0));
}
