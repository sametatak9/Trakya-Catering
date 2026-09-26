import { describe, expect, it } from 'vitest';
import { fmtQty, parseNum } from './format';

describe('biçimlendirme', () => {
  it('miktarı uygun birimle gösterir', () => {
    expect(fmtQty(144000, 'g')).toBe('144 kg');
    expect(fmtQty(120, 'g')).toBe('120 g');
    expect(fmtQty(1500, 'ml')).toBe('1,5 lt');
    expect(fmtQty(3, 'adet')).toBe('3 adet');
  });
  it('Türkçe sayı girişini çözer', () => {
    expect(parseNum('12,5')).toBe(12.5);
    expect(parseNum('1.250,75')).toBe(1250.75);
    expect(parseNum('40')).toBe(40);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});
