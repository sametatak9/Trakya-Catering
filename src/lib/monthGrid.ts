/** Ay ızgarası yardımcıları (Siparişler › Aylık sipariş, müşteri × öğün raporu). Saf fonksiyonlar. */

export function daysOfMonth(period: string): string[] {
  const [y, m] = period.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`);
}

export function isoDow(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export interface StandingLike { default_qty: number; weekday_qty: Record<string, number> | null; skip_dates: string[] | null }

/** Aylık şablonun o gün için vereceği kişi sayısı (veritabanındaki standing_order_generate ile aynı kural) */
export function standingQty(s: StandingLike, day: string): number {
  if ((s.skip_dates ?? []).includes(day)) return 0;
  const w = s.weekday_qty?.[String(isoDow(day))];
  return Math.max(0, w ?? s.default_qty ?? 0);
}

/** Şablonun ay boyunca üreteceği satır sayısı ve toplam kişi */
export function standingPreview(s: StandingLike, period: string): { rows: number; people: number } {
  let rows = 0, people = 0;
  for (const d of daysOfMonth(period)) { const q = standingQty(s, d); if (q > 0) { rows++; people += q; } }
  return { rows, people };
}

export interface OrderLike { service_date: string; meal: string; customer_id: string; ordered_qty: number; delivered_qty: number | null; status: string }
const people = (o: OrderLike) => o.delivered_qty ?? o.ordered_qty;

/** Gün × müşteri ızgarası (seçilen öğün): key `${customer}|${day}` → kişi */
export function gridByCustomerDay(orders: OrderLike[], meal: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'iptal' || o.meal !== meal) continue;
    const k = `${o.customer_id}|${o.service_date}`;
    m.set(k, (m.get(k) ?? 0) + people(o));
  }
  return m;
}

export const REPORT_MEALS = ['kahvalti', 'ogle', 'aksam', 'gece'] as const;

/** Müşteri × öğün adet raporu (YemekPRO benzeri): tarih aralığında her müşteri için öğün toplamları */
export function customerMealReport(orders: OrderLike[]): Array<{ customer_id: string; byMeal: Record<string, number>; total: number; days: number }> {
  const acc = new Map<string, { byMeal: Record<string, number>; days: Set<string> }>();
  for (const o of orders) {
    if (o.status === 'iptal') continue;
    const r = acc.get(o.customer_id) ?? { byMeal: {}, days: new Set<string>() };
    r.byMeal[o.meal] = (r.byMeal[o.meal] ?? 0) + people(o);
    r.days.add(o.service_date);
    acc.set(o.customer_id, r);
  }
  return [...acc].map(([customer_id, r]) => ({
    customer_id, byMeal: r.byMeal, total: Object.values(r.byMeal).reduce((s, x) => s + x, 0), days: r.days.size,
  })).sort((a, b) => b.total - a.total);
}
