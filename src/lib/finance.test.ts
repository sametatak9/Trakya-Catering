import { describe, expect, it } from 'vitest';
import { addDays, addMonths, lastMonths, minutesToCutoff, monthRange, todayISO } from './dates';
import { monthlyByCategory, monthlyTotals, perPersonBreakdown, runningBalance, trend, type LedgerRow } from './finance';

const row = (entry_date: string, kind: string, category_code: string, net: number, status = 'odendi'): LedgerRow =>
  ({ entry_date, kind, category_code, net_amount: net, vat_amount: net * 0.2, status });

describe('tarihler', () => {
  it('gün/ay aritmetiği', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(lastMonths('2026-03', 3)).toEqual(['2026-01', '2026-02', '2026-03']);
  });
  it('İstanbul saatine göre bugün ve 16:00 kesimi', () => {
    // 2026-09-26 22:30 UTC = 27 Eylül 01:30 İstanbul
    expect(todayISO(new Date('2026-09-26T22:30:00Z'))).toBe('2026-09-27');
    // 12:00 UTC = 15:00 İstanbul → 60 dk kaldı
    expect(minutesToCutoff(new Date('2026-09-26T12:00:00Z'))).toBe(60);
    expect(minutesToCutoff(new Date('2026-09-26T14:00:00Z'))).toBe(0);
  });
});

describe('gider analizi', () => {
  const rows = [
    row('2026-08-10', 'gider', 'elektrik', 10000),
    row('2026-09-10', 'gider', 'elektrik', 12000),
    row('2026-09-15', 'gider', 'akaryakit', 5000, 'bekliyor'),
    row('2026-09-20', 'gelir', 'organizasyon', 30000),
  ];
  it('ay × kategori toplamı KDV hariç tutarla yapılır', () => {
    const m = monthlyByCategory(rows, 'gider');
    expect(m['2026-09']).toEqual({ elektrik: 12000, akaryakit: 5000 });
    expect(m['2026-08']).toEqual({ elektrik: 10000 });
  });
  it('bu ay / geçen ay artış yüzdesi ve 6 aylık seri', () => {
    const t = trend({ '2026-08': 10000, '2026-09': 12000 }, '2026-09', 6);
    expect(t.current).toBe(12000);
    expect(t.delta).toBe(2000);
    expect(t.pct).toBeCloseTo(20);
    expect(t.series).toEqual([0, 0, 0, 0, 10000, 12000]);
    expect(trend({ '2026-09': 5 }, '2026-09').pct).toBeNull();
  });
  it('aylık toplam (ödenmemiş dahil — tahakkuk esası)', () => {
    expect(monthlyTotals(rows, 'gider')['2026-09']).toBe(17000);
    expect(monthlyTotals(rows, 'gelir')['2026-09']).toBe(30000);
  });
  it('kişi başı maliyet ayrışımı', () => {
    const b = perPersonBreakdown({ Hammadde: 80000, Personel: 40000, 'İşletme': 20000, Boş: 0 }, 1000);
    expect(b.map((x) => x.group)).toEqual(['Hammadde', 'Personel', 'İşletme']);
    expect(b[0].perPerson).toBe(80);
    expect(b.reduce((s, x) => s + x.share, 0)).toBeCloseTo(100);
    expect(perPersonBreakdown({ a: 1 }, 0)).toEqual([]);
  });
  it('yürüyen kasa bakiyesi', () => {
    const r = runningBalance(1000, [{ kind: 'gelir', total: 500 }, { kind: 'gider', total: 300 }]);
    expect(r.map((x) => x.balance)).toEqual([1500, 1200]);
  });
});
