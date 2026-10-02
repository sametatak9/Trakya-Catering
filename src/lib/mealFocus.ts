/**
 * Bugün ekranı "şimdiki öğün" (kullanıcı notu H; company_settings.home_*_until, Europe/Istanbul):
 * - kahvaltı: eşik saatine kadar bugünün kahvaltısı, sonra yarının kahvaltısı;
 * - ana öğün: öğle eşiğine kadar bugünün öğlesi, akşam eşiğine kadar bugünün akşamı, sonra yarının öğlesi.
 */
export interface MealThresholds { breakfastUntil?: string | null; lunchUntil?: string | null; dinnerUntil?: string | null }
export interface MealFocus { meal: 'kahvalti' | 'ogle' | 'aksam'; tomorrow: boolean }

const DEF = { breakfastUntil: '07:00', lunchUntil: '11:00', dinnerUntil: '23:59' };
const valid = (s: string | null | undefined, d: string) => (s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : d);

export function mealFocus(hhmm: string, t: MealThresholds = {}): { breakfast: MealFocus; main: MealFocus } {
  const b = valid(t.breakfastUntil, DEF.breakfastUntil), l = valid(t.lunchUntil, DEF.lunchUntil), d = valid(t.dinnerUntil, DEF.dinnerUntil);
  return {
    breakfast: { meal: 'kahvalti', tomorrow: hhmm >= b },
    main: hhmm < l ? { meal: 'ogle', tomorrow: false } : hhmm < d ? { meal: 'aksam', tomorrow: false } : { meal: 'ogle', tomorrow: true },
  };
}

/** İstanbul saatiyle HH:MM */
export function istanbulHHMM(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}
