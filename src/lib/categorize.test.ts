import { describe, expect, it } from 'vitest';
import { suggestCategory, type CategoryRule } from './categorize';

const rules: CategoryRule[] = [
  { code: 'gida_hammadde', name: 'Gıda', kind: 'gider', keywords: ['kasap', 'et', 'manav', 'pirinç'] },
  { code: 'elektrik', name: 'Elektrik', kind: 'gider', keywords: ['elektrik', 'enerjisa', 'kwh'] },
  { code: 'su', name: 'Su', kind: 'gider', keywords: ['su idaresi', 'iski', 'm3'] },
  { code: 'akaryakit', name: 'Akaryakıt', kind: 'gider', keywords: ['motorin', 'opet', 'shell'] },
  { code: 'tabldot_satis', name: 'Satış', kind: 'gelir', keywords: ['elektrik'] },
];

describe('fatura kategori tahmini', () => {
  it('unvandan elektrik faturasını bulur', () => {
    const s = suggestCategory({ supplierName: 'Trakya Elektrik Perakende Satış A.Ş.' }, rules, []);
    expect(s.code).toBe('elektrik');
    expect(s.confidence).toBe('anahtar_kelime');
  });
  it('kalem adlarından akaryakıtı bulur', () => {
    const s = suggestCategory({ supplierName: 'Keşan Petrol Ltd.', lineNames: ['Motorin (Euro Diesel) 120 LT'] }, rules, []);
    expect(s.code).toBe('akaryakit');
  });
  it('kısa kelimeler kelime içinde yanlış eşleşmez (et ≠ "ticaret")', () => {
    const s = suggestCategory({ supplierName: 'Yıldız Ticaret Ltd.' }, rules, []);
    expect(s.code).toBe('diger_gider');
    expect(suggestCategory({ supplierName: 'Uzunköprü Et Ürünleri' }, rules, []).code).toBe('gida_hammadde');
  });
  it('tedarikçi hafızası anahtar kelimeden önce gelir', () => {
    const s = suggestCategory({ supplierName: 'Trakya Elektrik', supplierTaxNo: '1234567890' }, rules,
      [{ supplier_key: '1234567890', category_code: 'akaryakit' }]);
    expect(s.code).toBe('akaryakit');
    expect(s.confidence).toBe('hafiza');
  });
  it('gelir kategorileri gider tahmininde kullanılmaz', () => {
    expect(suggestCategory({ supplierName: 'xyz' }, rules.filter((r) => r.kind === 'gelir'), []).code).toBe('diger_gider');
  });
});
