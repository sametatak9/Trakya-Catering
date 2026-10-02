import { describe, expect, it } from 'vitest';
import { cardNameFromLine, lastMonthSummary, mailtoUrl, matchTone, requestText } from './purchasing';

describe('purchasing', () => {
  it('eşleşme rengi', () => {
    expect(matchTone(1)).toBe('yesil');
    expect(matchTone(0.95)).toBe('yesil');
    expect(matchTone(0.7)).toBe('sari');
    expect(matchTone(0.2)).toBe('kirmizi');
    expect(matchTone(null)).toBe('kirmizi');
  });
  it('fatura satırından kart adı', () => {
    expect(cardNameFromLine('DANA KUŞBAŞI 1.SINIF KG')).toBe('Dana Kuşbaşı');
    expect(cardNameFromLine('AYÇİÇEK YAĞI 18 LT TENEKE')).toBe('Ayçiçek Yağı');
    expect(cardNameFromLine('SALÇALIK DOMATES (RIO) KASA')).toBe('Salçalık Domates');
  });
  it('talep metni', () => {
    const t = requestText({ company: 'Trakya Catering', supplier: 'Kasap Ali', date: '02.10.2026', lines: [{ name: 'Dana Kuşbaşı', qty: 12.5, unit: 'kg' }] });
    expect(t).toContain('Merhaba Kasap Ali,');
    expect(t).toContain('1. Dana Kuşbaşı — 12,5 kg');
    expect(mailtoUrl('a@b.com', 'Sipariş', 'x y')).toBe('mailto:a%40b.com?subject=Sipari%C5%9F&body=x%20y');
  });
  it('geçen ay özeti', () => {
    const s = lastMonthSummary(
      [{ service_date: '2026-09-01', meal: 'ogle', people: 100 }, { service_date: '2026-09-01', meal: 'aksam', people: 50 }, { service_date: '2026-09-02', meal: 'ogle', people: 110 }],
      [{ ingredient_id: 'a', qty: -10, kind: 'cikis', unit_cost: 5 }, { ingredient_id: 'a', qty: -2, kind: 'fire', unit_cost: 5 }, { ingredient_id: 'a', qty: -3, kind: 'sevk' }, { ingredient_id: 'a', qty: 20, kind: 'giris' }],
    );
    expect(s.total).toBe(260);
    expect(s.byMeal).toEqual({ ogle: 210, aksam: 50 });
    expect(s.avgPerDay).toBe(130);
    expect(s.use.get('a')).toEqual({ qty: 12, cost: 60, sevk: 3 });
  });
});
