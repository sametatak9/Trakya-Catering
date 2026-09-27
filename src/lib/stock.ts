// Stok ve satınalma hesapları (saf fonksiyonlar, testli)

export interface Movement { ingredient_id: string; qty: number; kind: string; move_date: string; unit_cost?: number | null; customer_id?: string | null }

/** Hammadde başına eldeki miktar (stok biriminde). Sayım kaydı da işaretli fark olarak tutulur. */
export function stockLevels(moves: Movement[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of moves) m.set(x.ingredient_id, Math.round(((m.get(x.ingredient_id) ?? 0) + Number(x.qty)) * 1000) / 1000);
  return m;
}

/** Son N günün ortalama günlük tüketimi (çıkış + sevk + fire) → kaç gün yeter */
export function daysOfCover(moves: Movement[], ingredientId: string, onHand: number, today: string, window = 14): number | null {
  const from = new Date(today + 'T12:00:00Z'); from.setUTCDate(from.getUTCDate() - window);
  const f = from.toISOString().slice(0, 10);
  const used = moves.filter((x) => x.ingredient_id === ingredientId && x.qty < 0 && x.kind !== 'sayim' && x.move_date > f && x.move_date <= today)
    .reduce((s, x) => s - Number(x.qty), 0);
  if (used <= 0) return null;
  return Math.round((onHand / (used / window)) * 10) / 10;
}

export interface PlanSlot { date: string; meal: string; menu_id: string; people: number }
export interface MenuLine { menu_id: string; recipe_id: string; portion_factor: number }
export interface RecipeLine { recipe_id: string; ingredient_id: string; gross_stock_qty: number }

/**
 * Menü planı × kişi sayısı × reçete brüt miktarı → dönem ihtiyacı (hammadde, stok biriminde).
 * "Menünün maliyeti ve neyden ne kadar alınacağı belli olduğu için aylık satınalma menüye göre."
 */
export function needsFromPlan(slots: PlanSlot[], menuLines: MenuLine[], recipeLines: RecipeLine[]): Map<string, number> {
  const byMenu = new Map<string, MenuLine[]>();
  for (const l of menuLines) byMenu.set(l.menu_id, [...(byMenu.get(l.menu_id) ?? []), l]);
  const byRecipe = new Map<string, RecipeLine[]>();
  for (const l of recipeLines) byRecipe.set(l.recipe_id, [...(byRecipe.get(l.recipe_id) ?? []), l]);
  const need = new Map<string, number>();
  for (const s of slots) {
    for (const ml of byMenu.get(s.menu_id) ?? []) {
      for (const rl of byRecipe.get(ml.recipe_id) ?? []) {
        need.set(rl.ingredient_id, (need.get(rl.ingredient_id) ?? 0) + rl.gross_stock_qty * s.people * Number(ml.portion_factor));
      }
    }
  }
  for (const [k, v] of need) need.set(k, Math.round(v * 1000) / 1000);
  return need;
}

export interface Quote { supplier_id: string; ingredient_id: string; price: number; quoted_at: string }
/** Hammadde başına en uygun (son 60 gündeki en düşük) fiyat ve tedarikçi; ikinci en iyiyle fark */
export function bestQuotes(quotes: Quote[], today: string, days = 60): Map<string, { best: Quote; runnerUp: Quote | null; count: number }> {
  const from = new Date(today + 'T12:00:00Z'); from.setUTCDate(from.getUTCDate() - days);
  const f = from.toISOString().slice(0, 10);
  const latest = new Map<string, Quote>();   // tedarikçi × hammadde → son fiyat
  for (const q of quotes) {
    if (q.quoted_at < f) continue;
    const k = `${q.ingredient_id}|${q.supplier_id}`;
    const cur = latest.get(k);
    if (!cur || cur.quoted_at < q.quoted_at) latest.set(k, q);
  }
  const out = new Map<string, { best: Quote; runnerUp: Quote | null; count: number }>();
  const byIng = new Map<string, Quote[]>();
  for (const q of latest.values()) byIng.set(q.ingredient_id, [...(byIng.get(q.ingredient_id) ?? []), q]);
  for (const [ing, list] of byIng) {
    const sorted = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    out.set(ing, { best: sorted[0], runnerUp: sorted[1] ?? null, count: sorted.length });
  }
  return out;
}

/** Teklif fiyatı: (hammadde + genel gider) / (1 − kâr marjı) — marj satış fiyatı üzerinden */
export function quotePrice(foodCost: number, overhead: number, marginPct: number): number {
  const cost = foodCost + overhead;
  const m = Math.min(Math.max(marginPct, 0), 90) / 100;
  return Math.ceil((cost / (1 - m)) * 2) / 2;   // 0,50 ₺'ye yuvarla
}

/**
 * Aynı belgede aynı malzeme birden çok satırda geçerse tek hareket olur (veritabanı belge × malzeme başına tek giriş/çıkış kabul eder).
 * Miktarlar toplanır; birim maliyet miktar ağırlıklı ortalamadır (biri bilinmiyorsa bilinenlerden hesaplanır).
 */
export function mergeByIngredient<T extends { ingredient_id: string; qty: number; unit_cost?: number | null }>(rows: T[]): T[] {
  const map = new Map<string, { row: T; qty: number; costQty: number; cost: number }>();
  for (const r of rows) {
    const q = Number(r.qty);
    const x = map.get(r.ingredient_id) ?? { row: { ...r }, qty: 0, costQty: 0, cost: 0 };
    x.qty += q;
    if (r.unit_cost != null) { x.costQty += Math.abs(q); x.cost += Math.abs(q) * Number(r.unit_cost); }
    map.set(r.ingredient_id, x);
  }
  return [...map.values()].map(({ row, qty, costQty, cost }) => ({
    ...row,
    qty: Math.round(qty * 10000) / 10000,
    ...('unit_cost' in row || costQty > 0 ? { unit_cost: costQty > 0 ? Math.round((cost / costQty) * 10000) / 10000 : null } : {}),
  })).filter((r) => r.qty !== 0);
}
