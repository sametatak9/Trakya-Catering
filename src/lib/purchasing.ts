/** Faz 3E satınalma yardımcıları: fatura eşleşme rengi, talep metni, geçen ay özeti (saf fonksiyonlar). */

export type MatchTone = 'yesil' | 'sari' | 'kirmizi';

/**
 * Fatura satırı eşleşme güveni (match_invoice_line puanı):
 * yeşil = satıcı kodu / tedarikçi adı / birebir ad / genel takma ad (≥ 0,95) → otomatik;
 * sarı = benzerlik (≥ 0,45) → onay ister; kırmızı = aday yok ya da zayıf → yeni kart veya elle seçim.
 */
export function matchTone(score: number | null | undefined): MatchTone {
  if (score == null) return 'kirmizi';
  if (score >= 0.95) return 'yesil';
  if (score >= 0.45) return 'sari';
  return 'kirmizi';
}

/** Fatura satırı adından yeni stok kartı adı önerisi: birim/ambalaj/sayı gürültüsü atılır, Türkçe baş harf büyük. */
export function cardNameFromLine(raw: string): string {
  const cleaned = raw
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(kg|gr|g|lt|l|ml|cl|adet|ad)\b/gi, ' ')
    .replace(/\b(kg|gr|lt|adet|koli|kasa|paket|pkt|kutu|çuval|cuval|bidon|teneke|1\.?\s?sınıf|1\.?\s?sinif|ekstra|extra)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('tr');
  return cleaned.split(' ').filter(Boolean).map((w) => w.charAt(0).toLocaleUpperCase('tr') + w.slice(1)).join(' ');
}

export interface RequestLine { name: string; qty: number; unit: string }

/** Tedarikçiye gönderilecek sipariş/talep metni (WhatsApp ve e-posta ortak) */
export function requestText(o: { company: string; supplier: string; date: string; deliveryDate?: string | null; lines: RequestLine[]; note?: string | null }): string {
  const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
  return [
    `Merhaba ${o.supplier},`,
    `${o.company} olarak aşağıdaki ürünleri sipariş etmek istiyoruz (${o.date}${o.deliveryDate ? `, teslim: ${o.deliveryDate}` : ''}):`,
    '',
    ...o.lines.map((l, i) => `${i + 1}. ${l.name} — ${fmt(l.qty)} ${l.unit}`),
    '',
    o.note ? `Not: ${o.note}` : '',
    'Fiyat ve teslim teyidinizi rica ederiz. Teşekkürler.',
  ].filter((x, i, a) => x !== '' || (i > 0 && a[i - 1] !== '')).join('\n').trim();
}

export function mailtoUrl(to: string | null | undefined, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface DayOrder { service_date: string; meal: string; people: number }
export interface UseMove { ingredient_id: string; qty: number; kind: string; unit_cost?: number | null }

/** Geçen ay: gün × öğün kişi tablosu, aylık toplam ve tüketilen hammadde (üretim/hazırlık çıkışı + fire; sevk ayrı) */
export function lastMonthSummary(orders: DayOrder[], moves: UseMove[]) {
  const days = new Map<string, Record<string, number>>();
  for (const o of orders) {
    const d = days.get(o.service_date) ?? {};
    d[o.meal] = (d[o.meal] ?? 0) + o.people;
    days.set(o.service_date, d);
  }
  const byMeal: Record<string, number> = {};
  for (const d of days.values()) for (const [m, n] of Object.entries(d)) byMeal[m] = (byMeal[m] ?? 0) + n;
  const total = Object.values(byMeal).reduce((s, n) => s + n, 0);
  const use = new Map<string, { qty: number; cost: number; sevk: number }>();
  for (const m of moves) {
    if (m.qty >= 0 || !['cikis', 'fire', 'sevk'].includes(m.kind)) continue;
    const u = use.get(m.ingredient_id) ?? { qty: 0, cost: 0, sevk: 0 };
    if (m.kind === 'sevk') u.sevk += -m.qty; else { u.qty += -m.qty; u.cost += -m.qty * Number(m.unit_cost ?? 0); }
    use.set(m.ingredient_id, u);
  }
  return {
    days: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, meals]) => ({ date, meals, total: Object.values(meals).reduce((s, n) => s + n, 0) })),
    byMeal, total, use,
    activeDays: days.size,
    avgPerDay: days.size ? Math.round(total / days.size) : 0,
  };
}
