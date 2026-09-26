import { describe, expect, it } from 'vitest';
import { presetRange } from './DateRange';

describe('tarih aralığı ön ayarları', () => {
  const today = '2026-09-26'; // Cumartesi
  it('bu hafta pazartesi–pazar', () => expect(presetRange('bu_hafta', today)).toEqual({ from: '2026-09-21', to: '2026-09-27' }));
  it('geçen ay', () => expect(presetRange('gecen_ay', today)).toEqual({ from: '2026-08-01', to: '2026-08-31' }));
  it('son 30 gün', () => expect(presetRange('son_30', today)).toEqual({ from: '2026-08-28', to: '2026-09-26' }));
  it('dün', () => expect(presetRange('dun', today)).toEqual({ from: '2026-09-25', to: '2026-09-25' }));
});
