// Rapor paylaşımı: WhatsApp metni ve bağlantısı (telefonun WhatsApp'ı; ek hesap gerekmez).

/** Türkiye numarasını wa.me biçimine çevirir: "0532 111 22 33" → "905321112233". Geçersizse null. */
export function normalizeTrPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `90${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('5')) d = `90${d}`;
  return /^90\d{10}$/.test(d) ? d : null;
}

export function whatsappUrl(text: string, phone?: string | null): string {
  const p = normalizeTrPhone(phone ?? null);
  return `https://wa.me/${p ?? ''}?text=${encodeURIComponent(text)}`;
}

export interface SummaryLine { label: string; value: string }

/** WhatsApp'ta okunaklı kısa rapor özeti (kalın başlık, madde satırları) */
export function buildSummaryText(title: string, subtitle: string, lines: SummaryLine[], footer?: string): string {
  const body = lines.map((l) => `• ${l.label}: ${l.value}`).join('\n');
  return [`*${title}*`, subtitle, '', body, footer ? `\n_${footer}_` : ''].filter((x, i) => x !== '' || i === 2).join('\n').trim();
}
