import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('Excel CSV', () => {
  it('BOM, noktalı virgül, ondalık virgül ve kaçış', () => {
    const csv = toCsv(['Yemek', 'Porsiyon', 'Not'], [['Orman Kebabı', 72.05, 'a;b'], ['Pilav "tereyağlı"', 1200, null]]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Yemek;Porsiyon;Not');
    expect(lines[1]).toBe('Orman Kebabı;72,05;"a;b"');
    expect(lines[2]).toBe('"Pilav ""tereyağlı""";1200;');
  });
});
