// Gelir/gider analiz matematiği (defter satırlarından). Ekranlar bu fonksiyonları kullanır; testleri finance.test.ts.
import { lastMonths, monthKey } from './dates';

export interface LedgerRow {
  entry_date: string;
  kind: string;            // 'gelir' | 'gider'
  category_code: string;
  net_amount: number;
  vat_amount: number;
  status: string;          // 'odendi' | 'bekliyor'
}

/** Analizde KDV hariç tutar esas alınır (KDV devlete geçer, işletme gideri/geliri değildir). */
export const amountOf = (r: Pick<LedgerRow, 'net_amount'>) => Number(r.net_amount) || 0;

export function sumWhere(rows: LedgerRow[], pred: (r: LedgerRow) => boolean): number {
  let s = 0;
  for (const r of rows) if (pred(r)) s += amountOf(r);
  return s;
}

/** Ay × kategori toplamları: { '2026-09': { elektrik: 1200, ... } } */
export function monthlyByCategory(rows: LedgerRow[], kind: 'gelir' | 'gider'): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    if (r.kind !== kind) continue;
    const m = monthKey(r.entry_date);
    out[m] ??= {};
    out[m][r.category_code] = (out[m][r.category_code] ?? 0) + amountOf(r);
  }
  return out;
}

export interface Trend { current: number; previous: number; delta: number; pct: number | null; series: number[] }

/** Bir değerin bu ay / geçen ay karşılaştırması ve son n aylık seri */
export function trend(byMonth: Record<string, number>, month: string, n = 6): Trend {
  const months = lastMonths(month, n);
  const series = months.map((m) => byMonth[m] ?? 0);
  const current = series[series.length - 1];
  const previous = series[series.length - 2] ?? 0;
  return { current, previous, delta: current - previous, pct: previous > 0 ? ((current - previous) / previous) * 100 : null, series };
}

export function monthlyTotals(rows: LedgerRow[], kind: 'gelir' | 'gider', pred: (r: LedgerRow) => boolean = () => true): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.kind !== kind || !pred(r)) continue;
    const m = monthKey(r.entry_date);
    out[m] = (out[m] ?? 0) + amountOf(r);
  }
  return out;
}

/**
 * Kişi başı (öğün başı) tam maliyet ayrışımı.
 * Gider grupları kişi sayısına bölünür; hammadde için reçeteden hesaplanan (teorik) veya faturadan gelen (gerçek) tutar kullanılabilir.
 */
export function perPersonBreakdown(groupTotals: Record<string, number>, people: number): Array<{ group: string; perPerson: number; share: number }> {
  const total = Object.values(groupTotals).reduce((a, b) => a + b, 0);
  if (people <= 0) return [];
  return Object.entries(groupTotals)
    .filter(([, v]) => v > 0)
    .map(([group, v]) => ({ group, perPerson: v / people, share: total > 0 ? (v / total) * 100 : 0 }))
    .sort((a, b) => b.perPerson - a.perPerson);
}

/** Tarih sıralı hareketlerde yürüyen bakiye (kasa defteri görünümü) */
export function runningBalance<T extends { kind: string; total: number }>(opening: number, rows: T[]): Array<T & { balance: number }> {
  let bal = opening;
  return rows.map((r) => {
    bal += r.kind === 'gelir' ? r.total : -r.total;
    return { ...r, balance: bal };
  });
}
