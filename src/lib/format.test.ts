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
  it.each([
    ['1.250', 1250], ['1,25', 1.25], ['1.250,5', 1250.5], ['12.500.000', 12500000], ['12.500.000,75', 12500000.75],
    ['1.25', 1.25], ['0.5', 0.5], ['0,5', 0.5], [',5', 0.5], ['12,', 12], ['-3,5', -3.5], ['1 250,50 ₺', 1250.5], ['%18', 18],
    ['250', 250], ['1250', 1250], ['1.2345', 1.2345], ['1.250.5', null], ['1,2,3', null], ['1,250.5', null], ['12.34,5', null],
    ['1e5', null], ['abc', null], ['', null], ['  ', null],
  ])('parseNum(%j) = %j', (input, expected) => {
    expect(parseNum(input as string)).toBe(expected);
  });
  it('alan küsurat bekliyorsa belirsiz 1.250 ondalık okunur', () => {
    expect(parseNum('1.250', { dotDecimal: true })).toBe(1.25);
    expect(parseNum('1.250,5', { dotDecimal: true })).toBe(1250.5);
    expect(parseNum('12.500.000', { dotDecimal: true })).toBe(12500000);
  });
});
