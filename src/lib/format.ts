export const TZ = 'Europe/Istanbul';

const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tl4 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function fmtMoney(v: number | null | undefined, precise = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return (precise ? tl4 : tl).format(v);
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `%${fmtNum(v, digits)}`;
}

/**
 * Temel birimdeki miktarı okunur hale getirir: 144000 g → "144 kg", 15 ml → "15 ml", 1500 ml → "1,5 lt".
 */
export function fmtQty(value: number | null | undefined, baseUnit: string | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (baseUnit === 'g') return Math.abs(value) >= 1000 ? `${fmtNum(value / 1000, 3)} kg` : `${fmtNum(value, 1)} g`;
  if (baseUnit === 'ml') return Math.abs(value) >= 1000 ? `${fmtNum(value / 1000, 3)} lt` : `${fmtNum(value, 1)} ml`;
  return `${fmtNum(value, 2)} ${baseUnit ?? ''}`.trim();
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Virgüllü Türkçe sayı girişini sayıya çevirir: "1.250,5" → 1250.5, "12,5" → 12.5 */
export function parseNum(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
