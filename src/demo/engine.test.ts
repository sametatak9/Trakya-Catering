import { describe, expect, it } from 'vitest';
import { Engine, istanbulToday } from './engine';
import { buildSeed } from './seed';

describe('demo motoru (SQL görünümlerinin JS karşılığı)', () => {
  const db = buildSeed();
  const e = new Engine(db, () => 'a0000000-0000-4000-8000-000000000001');
  const today = istanbulToday();

  it('bugün öğle 850 kişilik karnıyarık hazırlığı kurar', () => {
    const karni = e.vPrepBatchCosts().find((b) => b.prep_date === today && b.meal === 'ogle' && b.dish_name === 'Karnıyarık');
    expect(karni?.portions).toBe(850);
    expect(karni?.cost_per_portion).toBeGreaterThan(30);
  });

  it('reçete maliyeti: brüt = net / (1 − fire) × fiyat', () => {
    const r = e.rows('recipes').find((x) => x.name === 'Karnıyarık')!;
    const lines = e.vRecipeLines().filter((l) => l.recipe_id === r.id);
    const patlican = lines.find((l) => l.ingredient_name === 'Patlıcan (kemer)')!;
    expect(patlican.gross_qty).toBeCloseTo(220 / 0.78, 6);
    expect(patlican.line_cost_last).toBeCloseTo((220 / 0.78 / 1000) * 38, 6);
    const cost = e.vRecipeCosts().find((c) => c.recipe_id === r.id)!;
    expect(cost.cost_last).toBeCloseTo(lines.reduce((s, l) => s + (l.line_cost_last ?? 0), 0), 3);
  });

  it('elle malzemede fiyat zorunlu; stok malzemesinde birim uyumu denetlenir', () => {
    const b = e.rows('prep_batches').find((x) => x.prep_date === today)!;
    expect(() => e.insert('prep_batch_items', { batch_id: b.id, manual_name: 'Nane', qty: 1, unit: 'kg' })).toThrow(/fiyatı zorunlu/);
    const ing = e.rows('ingredients').find((i) => i.stock_unit === 'kg')!;
    expect(() => e.insert('prep_batch_items', { batch_id: b.id, ingredient_id: ing.id, qty: 1, unit: 'lt' })).toThrow(/Birim uyumsuz/);
    const ok = e.insert('prep_batch_items', { batch_id: b.id, ingredient_id: ing.id, qty: 500, unit: 'g' });
    expect(ok.unit_price).toBeCloseTo(ing.last_price / 1000, 4);
  });

  it('onaylanan fatura gider (borç) kaydı açar, silinince kalkar', () => {
    const inv = e.rows('purchase_invoices').find((x) => x.status === 'taslak')!;
    e.patch('purchase_invoices', inv, { status: 'onaylandi' });
    expect(e.rows('finance_entries').some((f) => f.source_id === inv.id && f.status === 'bekliyor')).toBe(true);
    e.remove('purchase_invoices', inv);
    expect(e.rows('finance_entries').some((f) => f.source_id === inv.id)).toBe(false);
  });

  it('hesap bakiyeleri pozitif ve gerçekçi', () => {
    const bank = e.vAccountBalances().find((a) => a.kind === 'banka')!;
    expect(bank.balance).toBeGreaterThan(0);
  });
});
