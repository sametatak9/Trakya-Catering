import { describe, expect, it } from 'vitest';
import { istanbulHHMM, mealFocus } from './mealFocus';

describe('mealFocus', () => {
  it('varsayılan eşikler', () => {
    expect(mealFocus('06:30')).toEqual({ breakfast: { meal: 'kahvalti', tomorrow: false }, main: { meal: 'ogle', tomorrow: false } });
    expect(mealFocus('07:00').breakfast.tomorrow).toBe(true);
    expect(mealFocus('11:00').main).toEqual({ meal: 'aksam', tomorrow: false });
    expect(mealFocus('23:59').main).toEqual({ meal: 'ogle', tomorrow: true });
  });
  it('şirket eşikleri ve geçersiz değer', () => {
    expect(mealFocus('20:00', { dinnerUntil: '19:30' }).main).toEqual({ meal: 'ogle', tomorrow: true });
    expect(mealFocus('10:00', { lunchUntil: 'xx' }).main.meal).toBe('ogle');
  });
  it('İstanbul saati UTC+3', () => {
    expect(istanbulHHMM(new Date('2026-10-02T05:15:00Z'))).toBe('08:15');
  });
});
