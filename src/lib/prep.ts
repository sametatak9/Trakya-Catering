// Günlük hazırlık matematiği — veritabanındaki v_prep_items / v_prep_batch_costs ile aynı formüller.
// Aşçı toplam hazırlık miktarını girer; kişi sayısına bölünerek 1 porsiyon bulunur.
import { unitInfo } from './domain';

export type Course = 'corba' | 'ana' | 'yardimci' | 'salata' | 'meze' | 'tatli' | 'icecek' | 'ekmek' | 'kahvalti';
export type Station = 'sicak' | 'soguk' | 'tatli' | 'kahvalti' | 'servis';

export const COURSE_LABELS: Record<Course, string> = {
  corba: 'Çorba', ana: 'Ana yemek', yardimci: 'Pilav / makarna / yardımcı', salata: 'Salata', meze: 'Soğuk meze',
  tatli: 'Tatlı', icecek: 'İçecek', ekmek: 'Ekmek', kahvalti: 'Kahvaltılık',
};
export const COURSE_ORDER: Course[] = ['kahvalti', 'corba', 'ana', 'yardimci', 'salata', 'meze', 'tatli', 'icecek', 'ekmek'];

export const STATION_LABELS: Record<Station, string> = {
  sicak: 'Sıcak mutfak', soguk: 'Soğuk / salata', tatli: 'Tatlı', kahvalti: 'Kahvaltı', servis: 'Servis / hazır',
};
export function stationOf(course: string): Station {
  switch (course) {
    case 'corba': case 'ana': case 'yardimci': return 'sicak';
    case 'salata': case 'meze': return 'soguk';
    case 'tatli': return 'tatli';
    case 'kahvalti': return 'kahvalti';
    default: return 'servis';
  }
}

/** Girilen miktarı temel birime (g / ml / adet) çevirir */
export function toBase(qty: number, unit: string): number {
  return qty * unitInfo(unit).toBase;
}

/** Stok birimi fiyatını girilen birimin fiyatına çevirir (kg fiyatı → g fiyatı). Boyut uyuşmazsa null. */
export function priceForUnit(stockPrice: number | null, stockUnit: string, unit: string): number | null {
  if (stockPrice === null) return null;
  const s = unitInfo(stockUnit), u = unitInfo(unit);
  if (s.base !== u.base) return null;
  return stockPrice * (u.toBase / s.toBase);
}

export interface PrepLine {
  qty: number;
  unit: string;
  unitPrice: number | null;
  plannedQty?: number | null;
  isSide?: boolean;
}

export interface PrepSummary {
  total: number;
  side: number;
  perPortion: number | null;
  planned: number;
  variancePct: number | null;
  missingPrice: number;
}

export function summarize(lines: PrepLine[], portions: number | null): PrepSummary {
  let total = 0, side = 0, planned = 0, actualOfPlanned = 0, missing = 0;
  for (const l of lines) {
    if (l.unitPrice === null) { missing++; continue; }
    const c = l.qty * l.unitPrice;
    total += c;
    if (l.isSide) side += c;
    if (l.plannedQty !== null && l.plannedQty !== undefined) {
      planned += l.plannedQty * l.unitPrice;
      actualOfPlanned += c;
    }
  }
  return {
    total, side, planned, missingPrice: missing,
    perPortion: portions && portions > 0 ? total / portions : null,
    variancePct: planned > 0 ? Math.round(((actualOfPlanned - planned) / planned) * 1000) / 10 : null,
  };
}

/** Porsiyon başı miktar (temel birimde): 144 kg / 1200 kişi → 120 g */
export function perPortionBase(qty: number, unit: string, portions: number | null): number | null {
  if (!portions || portions <= 0) return null;
  return toBase(qty, unit) / portions;
}

/** Hazırlıktan reçete: net = brüt/porsiyon × (1 − fire%) — reçete motoru aynı brütü geri üretir */
export function recipeNetFromPrep(qty: number, unit: string, portions: number, wastePct: number): number {
  return (toBase(qty, unit) / portions) * (1 - wastePct / 100);
}
