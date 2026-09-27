import { describe, expect, it } from 'vitest';
import { calibrationSummary, weightedMedian } from './calibration';

const sample = (perPortionBase: number, portions = 100, included = true) => ({ perPortionBase, portions, included });

describe('weightedMedian', () => {
  it('uses the middle value for an odd number of equal-weight samples', () => {
    expect(weightedMedian([sample(20), sample(10), sample(30)])).toBe(20);
  });

  it('averages the two middle values when equal weights split exactly at the midpoint', () => {
    expect(weightedMedian([sample(20), sample(10)])).toBe(15);
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
