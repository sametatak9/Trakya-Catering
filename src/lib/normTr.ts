/**
 * Türkçe ad normalleştirme — veritabanındaki public.norm_tr ile birebir aynı kural (Faz 3E).
 * Fatura satırı ile stok kartı eşleştirmesinde kullanılır: "DANA KUŞBAŞI 1.SINIF KG" → "dana kusbasi".
 */
const FROM = 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû';
const TO = 'cgiiosuaiucgiosuaiu';
const NOISE = 'birinci sinif|sinif|ekstra|extra|kg|kilo|gr|g|lt|l|ml|cl|adet|ad|ade|koli|kasa|pkt|paket|kutu|cuval|bidon|teneke|demet|rulo|kova|li|lu|luk';

export function normTr(s: string | null | undefined): string | null {
  let t = '';
  for (const ch of s ?? '') { const i = FROM.indexOf(ch); t += i >= 0 ? TO[i] : ch; }
  t = t.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(^| )1 ?sinif(?= |$)/g, ' ')
    .replace(/(^| )[0-9]+(kg|gr|g|lt|l|ml|cl|li|lu|luk)?(?= |$)/g, ' ')
    .replace(new RegExp(`(^| )(${NOISE})(?= |$)`, 'g'), ' ')
    .replace(/ +/g, ' ')
    .trim();
  return t || null;
}

/** Trigram benzerliği (pg_trgm similarity eşleniği; istemci tarafı ön sıralama için) */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const set = new Set<string>();
    for (const w of s.split(' ').filter(Boolean)) { const p = `  ${w} `; for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3)); }
    return set;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}
