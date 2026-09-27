import { describe, expect, it } from 'vitest';
import { calibrationSummary, weightedMedian } from './calibration';

const sample = (perPortionBase: number, portions = 100, included = true) => ({ perPortionBase, portions, included });

describe('weightedMedian', () => {
  it('uses the middle value for an odd number of equal-weight samples', () => {
    expect(weightedMedian([sample(20), sample(10), sample(30)])).toBe(20);
  });

  it('takes the first value reaching half the weight, like the database (no averaging)', () => {
    expect(weightedMedian([sample(20), sample(10)])).toBe(10);
    expect(weightedMedian([sample(83.33, 1200), sample(77.78, 900)])).toBe(83.33);
  });

  it('weights a production by the number of portions it represents', () => {
    expect(weightedMedian([sample(10, 10), sample(20, 1000), sample(80, 10)])).toBe(20);
  });

  it('ignores excluded, empty, invalid, and non-positive measurements', () => {
    expect(weightedMedian([
      sample(50, 100, false),
      { perPortionBase: null, portions: 100, included: true },
      { perPortionBase: Number.NaN, portions: 100, included: true },
      sample(-4),
    ])).toBeNull();
  });

  it('returns an empty summary for a recipe with no measurements', () => {
    expect(calibrationSummary([])).toEqual({ median: null, includedCount: 0, excludedCount: 0, totalPeople: 0 });
  });

  it('summarizes included and excluded history separately', () => {
    expect(calibrationSummary([sample(25, 200), sample(90, 20, false)])).toEqual({
      median: 25, includedCount: 1, excludedCount: 1, totalPeople: 200,
    });
  });
});

describe('1 kişilik reçete', () => {
  it('ilk üretim: 1200 kişi / 100 kg, fire %10 → 75 g net', async () => {
    const { perPersonFromProduction } = await import('./calibration');
    expect(perPersonFromProduction(100_000, 1200, 10)).toBe(75);
    expect(perPersonFromProduction(100_000, 0, 10)).toBe(0);
  });
  it('ölçekleme: 1200 × 90 g net, fire %10 → 120 kg brüt; adet yukarı yuvarlanır', async () => {
    const { scaleNeed } = await import('./calibration');
    expect(scaleNeed(1200, 90, 10, 1000, false)).toBe(120);
    expect(scaleNeed(7, 0.5, 0, 1, true)).toBe(4);
  });
});
