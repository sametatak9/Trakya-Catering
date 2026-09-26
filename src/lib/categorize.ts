// Gelen faturanın gider kategorisini tahmin eder.
// Sıra: 1) Bu tedarikçi daha önce hangi kategoriye işlendiyse o  2) Unvan + kalem adlarında anahtar kelime  3) Diğer gider

export interface CategoryRule { code: string; name: string; kind: string; keywords: string[]; active?: boolean }
export interface SupplierMemory { supplier_key: string; category_code: string }
export interface Suggestion { code: string; reason: string; confidence: 'hafiza' | 'anahtar_kelime' | 'varsayilan' }

export function normalizeTr(s: string): string {
  return s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
}

export function supplierKey(taxNo: string | null | undefined, name: string): string {
  return taxNo && taxNo.trim() ? taxNo.trim() : name.toLocaleLowerCase('tr');
}

export function suggestCategory(
  input: { supplierName: string; supplierTaxNo?: string | null; lineNames?: string[] },
  rules: CategoryRule[],
  memory: SupplierMemory[],
  fallback = 'diger_gider',
): Suggestion {
  const key = supplierKey(input.supplierTaxNo, input.supplierName);
  const hit = memory.find((m) => m.supplier_key === key);
  if (hit && rules.some((r) => r.code === hit.category_code)) {
    return { code: hit.category_code, reason: 'Bu tedarikçinin önceki faturaları', confidence: 'hafiza' };
  }
  const nameText = ` ${normalizeTr(input.supplierName)} `;
  const linesText = ` ${normalizeTr((input.lineNames ?? []).join(' | '))} `;
  let best: { code: string; score: number; word: string } | null = null;
  for (const r of rules) {
    if (r.kind !== 'gider' || r.active === false) continue;
    for (const raw of r.keywords) {
      const w = normalizeTr(raw);
      if (!w) continue;
      // Kısa kelimeler (et, su, un…) yalnızca tam kelime olarak eşleşir
      const re = new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}($|[^\\p{L}])`, 'u');
      const inName = w.length <= 3 ? re.test(nameText) : nameText.includes(w);
      const inLines = w.length <= 3 ? re.test(linesText) : linesText.includes(w);
      // Unvandaki eşleşme kalemdekinden, uzun kelime kısadan daha güçlü
      const score = (inName ? 3 : 0) + (inLines ? 1 : 0) + (inName || inLines ? Math.min(w.length, 12) / 12 : 0);
      if (score > 0 && (!best || score > best.score)) best = { code: r.code, score, word: raw };
    }
  }
  if (best) return { code: best.code, reason: `“${best.word}” ifadesi`, confidence: 'anahtar_kelime' };
  return { code: fallback, reason: 'Eşleşme bulunamadı', confidence: 'varsayilan' };
}
