import { describe, expect, it } from 'vitest';
import { normTr, trigramSimilarity } from './normTr';

describe('normTr (public.norm_tr eşleniği)', () => {
  it('veritabanıyla aynı sonuçlar', () => {
    expect(normTr('DANA KUŞBAŞI 1.SINIF KG')).toBe('dana kusbasi');
    expect(normTr('Dana kuşbaşı')).toBe('dana kusbasi');
    expect(normTr('SALÇALIK DOMATES (RIO) 20 KG KASA')).toBe('salcalik domates rio');
    expect(normTr('Ayçiçek Yağı 18 LT Teneke')).toBe('aycicek yagi');
    expect(normTr('ŞEKER TOZ 50KG ÇUVAL')).toBe('seker toz');
    expect(normTr('3 Gözlü Tabla')).toBe('gozlu tabla');
    expect(normTr('İçli Köfte')).toBe('icli kofte');
    expect(normTr('IRMAK')).toBe('irmak');
    expect(normTr('B12 Vitamin')).toBe('b12 vitamin');
    expect(normTr('KG KG')).toBeNull();
    expect(normTr('')).toBeNull();
    expect(normTr(null)).toBeNull();
  });
  it('benzerlik', () => {
    expect(trigramSimilarity('dana kusbasi', 'dana kusbasi')).toBe(1);
    expect(trigramSimilarity('dana kusbasi', 'dana kiyma')).toBeGreaterThan(0.2);
    expect(trigramSimilarity('dana kusbasi', 'seker toz')).toBeLessThan(0.1);
  });
});
