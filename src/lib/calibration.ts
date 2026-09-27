export interface CalibrationSample {
  perPortionBase: number | null;
  portions: number;
  included: boolean;
}

/** Portion-weighted median in the base unit stored by Supabase (for display and preview only). */
export function weightedMedian(samples: CalibrationSample[]): number | null {
  const values = samples
    .filter((sample) => sample.included && sample.perPortionBase !== null && Number.isFinite(sample.perPortionBase)
      && sample.perPortionBase > 0 && Number.isFinite(sample.portions) && sample.portions > 0)
    .map((sample) => ({ value: sample.perPortionBase!, weight: sample.portions }))
    .sort((a, b) => a.value - b.value);
  if (values.length === 0) return null;
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  const midpoint = totalWeight / 2;
  let accumulated = 0;
  for (let i = 0; i < values.length; i += 1) {
    accumulated += values[i].weight;
    if (accumulated > midpoint) return values[i].value;
    if (accumulated === midpoint && values[i + 1]) return (values[i].value + values[i + 1].value) / 2;
  }
  return values[values.length - 1].value;
}

export function calibrationSummary(samples: CalibrationSample[]) {
  const included = samples.filter((sample) => sample.included && sample.perPortionBase !== null && sample.perPortionBase > 0);
  const excluded = samples.length - included.length;
  return {
    median: weightedMedian(samples),
    includedCount: included.length,
    excludedCount: excluded,
    totalPeople: included.reduce((sum, sample) => sum + Math.max(0, sample.portions), 0),
  };
}
