import { describe, expect, it } from 'vitest';
import { bestQuotes, daysOfCover, mergeByIngredient, needsFromPlan, quotePrice, stockLevels } from './stock';

describe('stok', () => {
  const moves = [
    { ingredient_id: 'a', qty: 100, kind: 'giris', move_date: '2026-09-01' },
    { ingredient_id: 'a', qty: -30, kind: 'cikis', move_date: '2026-09-20' },
    { ingredient_id: 'a', qty: -12, kind: 'sevk', move_date: '2026-09-21', customer_id: 'c' },
    { ingredient_id: 'a', qty: -2, kind: 'sayim', move_date: '2026-09-22' },
  ];
  it('eldeki miktar', () => { expect(stockLevels(moves).get('a')).toBe(56); });
  it('kaç gün yeter (son 14 gün tüketimi, sayım hariç)', () => { expect(daysOfCover(moves, 'a', 56, '2026-09-26')).toBeCloseTo(56 / (42 / 14), 1); });
});

it('menü planından aylık ihtiyaç: 850 kişi karnıyarık → patlıcan kg', () => {
  const need = needsFromPlan(
    [{ date: '2026-09-26', meal: 'ogle', menu_id: 'm', people: 850 }, { date: '2026-09-27', meal: 'ogle', menu_id: 'm', people: 100 }],
    [{ menu_id: 'm', recipe_id: 'r', portion_factor: 1 }],
    [{ recipe_id: 'r', ingredient_id: 'patlican', gross_stock_qty: 0.282 }],
  );
  expect(need.get('patlican')).toBeCloseTo(950 * 0.282, 3);
});

it('en uygun tedarikçi: son fiyatlar içinde en düşük', () => {
  const b = bestQuotes([
    { supplier_id: 's1', ingredient_id: 'x', price: 40, quoted_at: '2026-09-01' },
    { supplier_id: 's1', ingredient_id: 'x', price: 36, quoted_at: '2026-09-20' },
    { supplier_id: 's2', ingredient_id: 'x', price: 38, quoted_at: '2026-09-18' },
    { supplier_id: 's3', ingredient_id: 'x', price: 20, quoted_at: '2026-05-01' },   // eski
  ], '2026-09-26').get('x')!;
  expect(b.best.supplier_id).toBe('s1');
  expect(b.best.price).toBe(36);
  expect(b.runnerUp?.price).toBe(38);
  expect(b.count).toBe(2);
});

it('teklif fiyatı: (maliyet) / (1 − marj), 0,50 ₺ yukarı', () => {
  expect(quotePrice(82, 18, 20)).toBe(125);
  expect(quotePrice(80.1, 0, 0)).toBe(80.5);
});

describe('tek kapı stok: belge × malzeme birleştirme', () => {
  it('aynı malzemeyi tek harekete birleştirir (miktar toplamı, ağırlıklı maliyet)', () => {
    const out = mergeByIngredient([
      { ingredient_id: 'et', qty: 10, unit_cost: 400 },
      { ingredient_id: 'tuz', qty: 2, unit_cost: 10 },
      { ingredient_id: 'et', qty: 30, unit_cost: 440 },
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.ingredient_id === 'et')).toMatchObject({ qty: 40, unit_cost: 430 });
  });
  it('çıkışta negatif miktarları toplar, maliyeti bilinmeyeni boş bırakır', () => {
    const out = mergeByIngredient([
      { ingredient_id: 'et', qty: -4, unit_cost: null },
      { ingredient_id: 'et', qty: -6, unit_cost: null },
    ]);
    expect(out).toEqual([{ ingredient_id: 'et', qty: -10, unit_cost: null }]);
  });
  it('toplamı sıfır olan satır düşer', () => {
    expect(mergeByIngredient([{ ingredient_id: 'a', qty: 1 }, { ingredient_id: 'a', qty: -1 }])).toEqual([]);
  });
});
