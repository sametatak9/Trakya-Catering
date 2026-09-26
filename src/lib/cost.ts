// Reçete maliyet matematiği — veritabanındaki v_recipe_lines ile birebir aynı formül.
// Editörde kaydetmeden önce canlı önizleme için kullanılır; kaydedilen değerin doğruluk kaynağı veritabanıdır.

export interface UnitDef { code: string; dimension: 'kutle' | 'hacim' | 'adet'; to_base: number }

export function baseUnitOf(dimension: UnitDef['dimension']): 'g' | 'ml' | 'adet' {
  return dimension === 'kutle' ? 'g' : dimension === 'hacim' ? 'ml' : 'adet';
}

/** Brüt = Net / (1 − fire/100) */
export function grossQty(net: number, wastePct: number): number {
  if (wastePct < 0 || wastePct >= 100) throw new RangeError('Fire oranı 0 ile 100 arasında olmalı');
  return net / (1 - wastePct / 100);
}

export interface LineInput {
  netQty: number;          // temel birimde (g / ml / adet)
  wastePct: number;        // efektif fire
  unitToBase: number;      // stok biriminin temel birime çarpanı (kg → 1000)
  price: number | null;    // stok birimi başına fiyat
}

export interface LineResult { gross: number; grossStock: number; cost: number | null }

export function lineCost(l: LineInput): LineResult {
  const gross = grossQty(l.netQty, l.wastePct);
  const grossStock = gross / l.unitToBase;
  return { gross, grossStock, cost: l.price === null ? null : grossStock * l.price };
}

export function recipeCost(lines: LineInput[]): { total: number; missingPrice: number } {
  let total = 0;
  let missingPrice = 0;
  for (const l of lines) {
    const r = lineCost(l);
    if (r.cost === null) missingPrice++;
    else total += r.cost;
  }
  return { total, missingPrice };
}

/** Yemek maliyeti oranı (food cost %) ve brüt marj */
export function foodCostPct(cost: number, price: number | null): number | null {
  if (!price || price <= 0) return null;
  return (cost / price) * 100;
}
