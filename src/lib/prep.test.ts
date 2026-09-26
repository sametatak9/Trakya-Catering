import { describe, expect, it } from 'vitest';
import { perPortionBase, priceForUnit, recipeNetFromPrep, stationOf, summarize } from './prep';
import { buildSummaryText, normalizeTrPhone, whatsappUrl } from '../reports/share';

describe('günlük hazırlık matematiği (SQL testiyle aynı senaryo)', () => {
  const lines = [
    { qty: 144, unit: 'kg', unitPrice: 600, plannedQty: 160 },   // et: reçete 160 önerdi, aşçı 144 kullandı
    { qty: 6, unit: 'kg', unitPrice: 10, plannedQty: 6 },        // tuz
  ];
  it('1.200 kişi: porsiyon maliyeti 72,05 ₺, sapma %-10', () => {
    const s = summarize(lines, 1200);
    expect(s.perPortion).toBeCloseTo(72.05, 4);
    expect(s.variancePct).toBe(-10);
  });
  it('elle yan malzeme maliyete girer; fiyatsız satır sayılır ama toplanmaz', () => {
    const s = summarize([...lines, { qty: 30, unit: 'adet', unitPrice: 15, isSide: true }, { qty: 1, unit: 'kg', unitPrice: null }], 1200);
    expect(s.perPortion).toBeCloseTo(72.425, 4);
    expect(s.side).toBe(450);
    expect(s.missingPrice).toBe(1);
  });
  it('porsiyon başı gramaj: 144 kg / 1200 = 120 g', () => {
    expect(perPortionBase(144, 'kg', 1200)).toBeCloseTo(120);
    expect(perPortionBase(3, 'lt', 100)).toBeCloseTo(30);
    expect(perPortionBase(1, 'kg', null)).toBeNull();
  });
  it('fiyat birim dönüşümü', () => {
    expect(priceForUnit(600, 'kg', 'g')).toBeCloseTo(0.6);
    expect(priceForUnit(80, 'lt', 'ml')).toBeCloseTo(0.08);
    expect(priceForUnit(600, 'kg', 'lt')).toBeNull();
    expect(priceForUnit(null, 'kg', 'kg')).toBeNull();
  });
  it('hazırlıktan reçete: 144 kg / 1200 × (1 − %10) = 108 g net', () => {
    expect(recipeNetFromPrep(144, 'kg', 1200, 10)).toBeCloseTo(108);
  });
  it('kap türü → mutfak istasyonu', () => {
    expect(stationOf('corba')).toBe('sicak');
    expect(stationOf('meze')).toBe('soguk');
    expect(stationOf('kahvalti')).toBe('kahvalti');
    expect(stationOf('ekmek')).toBe('servis');
  });
});

describe('WhatsApp paylaşımı', () => {
  it('telefon numarasını normalleştirir', () => {
    expect(normalizeTrPhone('0532 111 22 33')).toBe('905321112233');
    expect(normalizeTrPhone('+90 (532) 111-22-33')).toBe('905321112233');
    expect(normalizeTrPhone('5321112233')).toBe('905321112233');
    expect(normalizeTrPhone('123')).toBeNull();
  });
  it('özet metni ve bağlantıyı üretir', () => {
    const t = buildSummaryText('Günlük Maliyet', '26 Eylül · Öğle', [{ label: 'Kişi', value: '1.200' }, { label: 'Porsiyon', value: '₺72,05' }], 'Trakya Catering');
    expect(t).toContain('*Günlük Maliyet*');
    expect(t).toContain('• Porsiyon: ₺72,05');
    const url = whatsappUrl(t, '0532 111 22 33');
    expect(url.startsWith('https://wa.me/905321112233?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(t);
    expect(whatsappUrl('x')).toBe('https://wa.me/?text=x');
  });
});
