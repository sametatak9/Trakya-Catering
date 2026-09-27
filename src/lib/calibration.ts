export interface CalibrationSample {
  perPortionBase: number | null;
  portions: number;
  included: boolean;
}

/**
 * Porsiyon ağırlıklı medyan (temel birim; yalnız önizleme). Veritabanındaki public.weighted_median ile aynı kural:
 * küçükten büyüğe sıralı değerlerde birikimli ağırlığın toplamın yarısına ulaştığı ilk değer (ortalama alınmaz).
 */
export function weightedMedian(samples: CalibrationSample[]): number | null {
  const values = samples
    .filter((sample) => sample.included && sample.perPortionBase !== null && Number.isFinite(sample.perPortionBase)
      && sample.perPortionBase > 0 && Number.isFinite(sample.portions) && sample.portions > 0)
    .map((sample) => ({ value: sample.perPortionBase!, weight: sample.portions }))
    .sort((a, b) => a.value - b.value);
  if (values.length === 0) return null;
  const midpoint = values.reduce((sum, entry) => sum + entry.weight, 0) / 2;
  let accumulated = 0;
  for (const entry of values) {
    accumulated += entry.weight;
    if (accumulated >= midpoint) return entry.value;
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
/** İlk üretim: X kişi için Y kullanıldı → 1 kişilik net = Y / X × (1 − fire). */
export function perPersonFromProduction(usedBase: number, people: number, wastePct: number): number {
  if (!(people > 0)) return 0;
  return round((usedBase / people) * (1 - wastePct / 100), 3);
}

/**
 * Ölçekleme: N kişi × 1 kişilik net ÷ (1 − fire) = brüt ihtiyaç (temel birim).
 * Stok biriminde gösterim: kg/lt 0,1 yukarı yuvarlanır (eksik kalmasın), adet tam sayıya yukarı.
 */
export function scaleNeed(people: number, netPerPerson: number, wastePct: number, stockUnitToBase: number, isCount: boolean): number {
  const grossBase = people * netPerPerson / (1 - wastePct / 100);
  const inStock = grossBase / stockUnitToBase;
  return isCount ? Math.ceil(round(inStock, 6)) : Math.ceil(round(inStock * 10, 6)) / 10;
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
