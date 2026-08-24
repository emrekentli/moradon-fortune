import { SeededRandom } from '../src/math/Random';
import { SlotEngine } from '../src/math/SlotEngine';
import { trinaChargesForScatters, upgradeChance } from '../src/bonus/AnvilMath';

const spins = Math.max(1, Number.parseInt(process.argv[2] ?? '250000', 10));
const seed = Number.parseInt(process.argv[3] ?? '20260824', 10);
const bet = 1;
const engine = new SlotEngine(new SeededRandom(seed));
const bonusRandom = new SeededRandom(seed ^ 0x9e3779b9);
let baseReturned = 0;
let totalReturned = 0;
let hits = 0;
let bonuses = 0;
let freeSpinsPlayed = 0;
let biggestMultiplier = 0;

function anvilAward(scatterCount: number): { spins: number; multiplier: number } {
  let trinaCharges = trinaChargesForScatters(scatterCount);
  let level = 1;
  while (level < 8) {
    const useTrina = trinaCharges > 0 && level + 1 >= 4;
    if (useTrina) trinaCharges -= 1;
    if (bonusRandom.next() < upgradeChance(level + 1, useTrina)) level += 1;
    else break;
  }
  return { spins: 6 + level, multiplier: 1 + (level - 1) * 0.5 };
}

for (let index = 0; index < spins; index += 1) {
  const result = engine.evaluate(engine.spin(), bet);
  baseReturned += result.amount;
  totalReturned += result.amount;
  if (result.amount > 0) hits += 1;
  let freeSpins = 0;
  let freeMultiplier = 1;
  if (result.scatters >= 3) {
    bonuses += 1;
    const award = anvilAward(result.scatters);
    freeSpins += award.spins;
    freeMultiplier = award.multiplier;
  }
  while (freeSpins > 0) {
    freeSpins -= 1;
    freeSpinsPlayed += 1;
    const freeResult = engine.evaluate(engine.spin(), bet);
    totalReturned += freeResult.amount * freeMultiplier;
    biggestMultiplier = Math.max(biggestMultiplier, freeResult.multiplier * freeMultiplier);
    if (freeResult.scatters >= 3) {
      bonuses += 1;
      const award = anvilAward(freeResult.scatters);
      freeSpins += award.spins;
      freeMultiplier = award.multiplier;
    }
  }
  biggestMultiplier = Math.max(biggestMultiplier, result.multiplier);
}

const percentage = (value: number): string => `${(value * 100).toFixed(3)}%`;
console.log(JSON.stringify({
  spins,
  seed,
  scope: 'paid spins plus Magic Anvil free-spin feature and retriggers',
  wagered: spins * bet,
  baseReturned: Number(baseReturned.toFixed(2)),
  totalReturned: Number(totalReturned.toFixed(2)),
  baseRtp: percentage(baseReturned / (spins * bet)),
  totalRtp: percentage(totalReturned / (spins * bet)),
  hitRate: percentage(hits / spins),
  bonusFrequency: bonuses > 0 ? `1 / ${(spins / bonuses).toFixed(1)}` : 'not observed',
  freeSpinsPlayed,
  biggestMultiplier,
}, null, 2));
