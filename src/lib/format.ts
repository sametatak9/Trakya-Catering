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
/**
 * Türkçe sayı girişini çözer. Kurallar:
 * - Virgül ondalık ayracıdır, nokta binlik ayracıdır: `1.250,5` → 1250,5 · `12,5` → 12,5.
 * - Yalnız nokta varsa ve 3'lü gruplar hâlindeyse binliktir: `1.250` → 1250, `12.500.000` → 12500000.
 * - Yalnız bir nokta var ve ardından 3 hane yoksa ondalıktır (klavye alışkanlığı): `1.25` → 1,25, `0.5` → 0,5.
 * - Belirsiz `1.250` için varsayılan binliktir; alan küsurat bekliyorsa `{ dotDecimal: true }` ile 1,25 okunur.
 * - Boşluk, ₺, TL, % ve birim ekleri yok sayılır; iki virgül veya virgülden sonra nokta geçersizdir.
 */
export function parseNum(input: string, opts: { dotDecimal?: boolean } = {}): number | null {
  let s = String(input ?? '').trim().replace(/\s|₺|tl$|%/gi, '');
  if (!s) return null;
  if (/^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(s)) return null;
  const neg = s.startsWith('-');
  s = s.replace(/^[+-]/, '');
  if (!/^[\d.,]+$/.test(s)) return null;
  const commas = (s.match(/,/g) ?? []).length;
  let normalized: string;
  if (commas > 1) return null;
  if (commas === 1) {
    const [int, dec] = s.split(',');
    if (dec.includes('.') || (int.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(int))) return null;
    normalized = `${int.replace(/\./g, '')}.${dec}`;
  } else if (s.includes('.')) {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      normalized = s.replace(/\./g, '');
    } else {
      normalized = /^\d{1,3}\.\d{3}$/.test(s) && !opts.dotDecimal ? s.replace('.', '') : s;
    }
  } else normalized = s;
  if (normalized.startsWith('.') || normalized.endsWith('.')) normalized = normalized.replace(/^\./, '0.').replace(/\.$/, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
