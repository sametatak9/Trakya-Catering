import { describe, expect, it } from 'vitest';
import { customerMealReport, daysOfMonth, gridByCustomerDay, isoDow, standingPreview, standingQty } from './monthGrid';

describe('ay ızgarası', () => {
  it('ayın günleri ve hafta günü', () => {
    expect(daysOfMonth('2026-02').length).toBe(28);
    expect(daysOfMonth('2026-10').length).toBe(31);
    expect(isoDow('2026-10-04')).toBe(7);
    expect(isoDow('2026-10-05')).toBe(1);
  });
  it('aylık şablon: hafta günü istisnası ve atlanan gün', () => {
    const s = { default_qty: 40, weekday_qty: { '6': 20, '7': 0 }, skip_dates: ['2026-10-29'] };
    expect(standingQty(s, '2026-10-05')).toBe(40);
    expect(standingQty(s, '2026-10-03')).toBe(20);
    expect(standingQty(s, '2026-10-04')).toBe(0);
    expect(standingQty(s, '2026-10-29')).toBe(0);
    // Ekim 2026: 31 gün, 4 pazar, 5 cumartesi (3,10,17,24,31), 29 Ekim atlanır (perşembe)
    expect(standingPreview(s, '2026-10')).toEqual({ rows: 26, people: 21 * 40 + 5 * 20 });
  });
  it('gün × müşteri ızgarası ve müşteri × öğün raporu', () => {
    const o = [
      { service_date: '2026-10-05', meal: 'ogle', customer_id: 'a', ordered_qty: 100, delivered_qty: 98, status: 'teslim_edildi' },
      { service_date: '2026-10-05', meal: 'aksam', customer_id: 'a', ordered_qty: 40, delivered_qty: null, status: 'bekliyor' },
      { service_date: '2026-10-06', meal: 'ogle', customer_id: 'b', ordered_qty: 50, delivered_qty: null, status: 'bekliyor' },
      { service_date: '2026-10-06', meal: 'ogle', customer_id: 'b', ordered_qty: 70, delivered_qty: null, status: 'iptal' },
    ];
    const g = gridByCustomerDay(o, 'ogle');
    expect(g.get('a|2026-10-05')).toBe(98);
    expect(g.get('b|2026-10-06')).toBe(50);
    const r = customerMealReport(o);
    expect(r[0]).toEqual({ customer_id: 'a', byMeal: { ogle: 98, aksam: 40 }, total: 138, days: 1 });
    expect(r[1].total).toBe(50);
  });
});
