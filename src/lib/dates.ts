// Tarih yardımcıları — tüm iş günleri İstanbul saatine göre. Tarihler 'YYYY-MM-DD' metni olarak taşınır.
export const TZ = 'Europe/Istanbul';

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function monthKey(iso: string): string { return iso.slice(0, 7); }

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** Ayın ilk ve son günü (dahil) */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: addDays(`${addMonths(month, 1)}-01`, -1) };
}

/** Son n ay (eskiden yeniye), `month` dahil */
export function lastMonths(month: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(month, i - (n - 1)));
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export function monthLabel(month: string, short = false): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return short ? name.slice(0, 3) : `${name} ${y}`;
}

export function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('tr-TR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
}

export function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

/** Ertesi günün siparişleri için kesim (16:00 İstanbul) — kalan dakika; geçtiyse 0 */
export function minutesToCutoff(now = new Date(), cutoffHour = 16): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now).split(':').map(Number);
  const mins = parts[0] * 60 + parts[1];
  return Math.max(0, cutoffHour * 60 - mins);
}
