import { describe, expect, it } from 'vitest';
import { foodCostPct, grossQty, lineCost, recipeCost } from './cost';

describe('reçete maliyet motoru', () => {
  it('brüt miktarı fireye göre hesaplar', () => {
    expect(grossQty(120, 10)).toBeCloseTo(133.333, 3);
    expect(grossQty(30, 0)).toBe(30);
    expect(() => grossQty(10, 100)).toThrow();
  });

  it('1.200 porsiyon Orman Kebabı: 144 kg net → 160 kg brüt kuşbaşı', () => {
    const r = lineCost({ netQty: 120 * 1200, wastePct: 10, unitToBase: 1000, price: 600 });
    expect(r.grossStock).toBeCloseTo(160, 6);
    expect(r.cost).toBeCloseTo(96_000, 4);
  });

  it('porsiyon maliyeti veritabanı testiyle aynı sonucu verir (83,9912 ₺)', () => {
    const { total, missingPrice } = recipeCost([
      { netQty: 120, wastePct: 10, unitToBase: 1000, price: 600 }, // kuşbaşı
      { netQty: 40, wastePct: 15, unitToBase: 1000, price: 20 },   // havuç
      { netQty: 30, wastePct: 0, unitToBase: 1000, price: 60 },    // bezelye
      { netQty: 15, wastePct: 0, unitToBase: 1000, price: 80 },    // yağ (ml / lt)
      { netQty: 5, wastePct: 0, unitToBase: 1000, price: 10 },     // tuz
    ]);
    expect(total).toBeCloseTo(83.9912, 4);
    expect(missingPrice).toBe(0);
  });

  it('fiyatı olmayan satırları sayar, toplama katmaz', () => {
    const r = recipeCost([
      { netQty: 100, wastePct: 0, unitToBase: 1000, price: 50 },
      { netQty: 2, wastePct: 0, unitToBase: 1, price: null },
    ]);
    expect(r.total).toBeCloseTo(5);
    expect(r.missingPrice).toBe(1);
  });

  it('food cost yüzdesi', () => {
    expect(foodCostPct(84, 200)).toBeCloseTo(42);
    expect(foodCostPct(84, null)).toBeNull();
  });
});
