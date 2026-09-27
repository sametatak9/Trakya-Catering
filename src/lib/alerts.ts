// Asistan: patron dostu hatırlatmalar. Saf fonksiyon — veriyi alır, uyarı listesi üretir (testli).
// Yapay zekâ çağrısı yok; kurallar açık ve denetlenebilir. İleride LLM özetleyici bu listenin üstüne eklenir.

export type AlertTone = 'stop' | 'wait' | 'info' | 'ok';
export type AlertKind = 'fiyat' | 'alacak' | 'borc' | 'siparis' | 'mutfak' | 'maliyet' | 'fatura';
export interface Alert {
  id: string;
  kind: AlertKind;
  tone: AlertTone;
  title: string;
  body: string;
  to: string;
  /** Sıralama için önem (büyük = üstte) */
  weight: number;
  amount?: number;
}

export interface AlertInput {
  today: string;
  minutesToCutoff: number;
  ingredients: Array<{ id: string; name: string; active: boolean; last_price: number | null; price_updated_at: string | null; stock_unit: string }>;
  /** Son ~120 günün fiyat kayıtları (herhangi bir sırada) */
  prices: Array<{ ingredient_id: string; price: number; noted_at: string }>;
  menus: Array<{ menu_id: string | null; name: string | null; active: boolean | null; target_price: number | null; cost_last: number | null }>;
  /** Açık (bekleyen) finans kalemleri; finans yetkisi yoksa boş */
  openItems: Array<{ id: string; kind: string; counterparty: string | null; due_date: string | null; total_amount: number | null }>;
  customers: Array<{ id: string; name: string; active: boolean }>;
  tomorrowOrders: Array<{ customer_id: string; meal: string; status: string }>;
  /** Bugün/yarın siparişleri: kişi başı fiyatı 0 olanlar teslimde gelir yazamaz (veritabanı reddeder) */
  upcomingOrders?: Array<{ customer_id: string; service_date: string; status: string; unit_price: number | null; ordered_qty: number }>;
  todayBatches: Array<{ batch_id: string | null; dish_name: string | null; item_count: number | null; missing_price_count: number | null; status: string | null }>;
  draftInvoices: number;
  staleDays: number;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
const money = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `%${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(n)}`;

export function buildAlerts(x: AlertInput): Alert[] {
  const out: Alert[] = [];

  // 1) Fiyat artışları: son 14 günde gelen fiyat, bir öncekine göre %5+ artış
  const byIng = new Map<string, Array<{ price: number; noted_at: string }>>();
  for (const p of x.prices) byIng.set(p.ingredient_id, [...(byIng.get(p.ingredient_id) ?? []), p]);
  const ingName = new Map(x.ingredients.map((i) => [i.id, i]));
  for (const [id, list] of byIng) {
    const sorted = [...list].sort((a, b) => b.noted_at.localeCompare(a.noted_at));
    const [last, prev] = sorted;
    if (!last || !prev || prev.price <= 0 || days(last.noted_at, x.today) > 14) continue;
    const change = ((last.price - prev.price) / prev.price) * 100;
    const ing = ingName.get(id);
    if (!ing || Math.abs(change) < 5) continue;
    out.push({
      id: `fiyat:${id}:${last.noted_at.slice(0, 10)}`, kind: 'fiyat', tone: change > 0 ? (change >= 10 ? 'stop' : 'wait') : 'ok',
      title: `${ing.name} ${change > 0 ? 'zamlandı' : 'ucuzladı'} ${change > 0 ? '+' : '−'}${pct(Math.abs(change))}`,
      body: `${money(prev.price)} → ${money(last.price)} / ${ing.stock_unit}. Bu malzemeyi kullanan reçetelerin maliyeti ${change > 0 ? 'arttı' : 'düştü'}.`,
      to: '/stok/kartlar', weight: 60 + Math.min(Math.abs(change), 30),
    });
  }

  // 2) Eksik / eski fiyat
  const missing = x.ingredients.filter((i) => i.active && i.last_price == null);
  if (missing.length) out.push({
    id: `fiyat-yok:${missing.map((m) => m.id).sort().join(',')}`, kind: 'fiyat', tone: 'wait',
    title: `${missing.length} stok kartının fiyatı yok`, body: `${missing.slice(0, 3).map((m) => m.name).join(', ')}${missing.length > 3 ? '…' : ''} — maliyet eksik hesaplanır.`,
    to: '/stok/kartlar', weight: 40,
  });
  const stale = x.ingredients.filter((i) => i.active && i.last_price != null && i.price_updated_at && days(i.price_updated_at, x.today) > x.staleDays);
  if (stale.length) out.push({
    id: `fiyat-eski:${x.today}`, kind: 'fiyat', tone: 'info',
    title: `${stale.length} stok kartının fiyatı ${x.staleDays} günden eski`, body: `${stale.slice(0, 3).map((m) => m.name).join(', ')} — son faturayla güncelleyin.`,
    to: '/stok/kartlar', weight: 25,
  });

  // 3) Alacaklar ve borçlar (finans yetkisi varsa)
  const overdue = x.openItems.filter((e) => e.kind === 'gelir' && e.due_date && e.due_date < x.today);
  const byParty = new Map<string, { sum: number; oldest: string }>();
  for (const e of overdue) {
    const k = e.counterparty ?? 'Bilinmeyen';
    const cur = byParty.get(k) ?? { sum: 0, oldest: e.due_date! };
    cur.sum += Number(e.total_amount ?? 0); if (e.due_date! < cur.oldest) cur.oldest = e.due_date!;
    byParty.set(k, cur);
  }
  for (const [party, v] of byParty) out.push({
    id: `alacak:${party}:${x.today}`, kind: 'alacak', tone: 'stop', amount: v.sum,
    title: `${party}: ${money(v.sum)} vadesi geçmiş alacak`, body: `En eski vade ${days(v.oldest, x.today)} gün önce doldu. Tahsilat için arayın.`,
    to: '/kasa', weight: 80 + Math.min(v.sum / 50000, 15),
  });
  const payables = x.openItems.filter((e) => e.kind === 'gider' && e.due_date && days(x.today, e.due_date) <= 7);
  if (payables.length) {
    const sum = payables.reduce((s, e) => s + Number(e.total_amount ?? 0), 0);
    const late = payables.filter((e) => e.due_date! < x.today).length;
    out.push({
      id: `borc:${x.today}:${payables.length}`, kind: 'borc', tone: late ? 'stop' : 'wait', amount: sum,
      title: `${payables.length} ödeme 7 gün içinde: ${money(sum)}`, body: late ? `${late} tanesinin vadesi geçti.` : `En yakın: ${payables.map((e) => e.counterparty).filter(Boolean).slice(0, 2).join(', ')}.`,
      to: '/kasa', weight: late ? 75 : 50,
    });
  }

  // 4) Yarın için sayısı gelmeyen firmalar (16:00 kesim)
  const withOrder = new Set(x.tomorrowOrders.filter((o) => o.status !== 'iptal').map((o) => o.customer_id));
  const missingOrders = x.customers.filter((c) => c.active && !withOrder.has(c.id));
  if (missingOrders.length) out.push({
    id: `siparis:${x.today}:${missingOrders.length}`, kind: 'siparis', tone: x.minutesToCutoff > 0 && x.minutesToCutoff < 120 ? 'stop' : 'wait',
    title: `${missingOrders.length} firmanın yarınki sayısı gelmedi`,
    body: `${missingOrders.slice(0, 3).map((c) => c.name).join(', ')}${missingOrders.length > 3 ? '…' : ''}. ${x.minutesToCutoff > 0 ? `Kesime ${Math.floor(x.minutesToCutoff / 60)} sa ${x.minutesToCutoff % 60} dk var.` : 'Kesim saati geçti; operatör girebilir.'}`,
    to: '/siparisler', weight: 70,
  });

  // 4b) Fiyatsız sipariş: teslim işaretlenemez, gelir oluşmaz
  const unpriced = (x.upcomingOrders ?? []).filter((o) => o.status !== 'iptal' && o.ordered_qty > 0 && !(Number(o.unit_price) > 0));
  if (unpriced.length) {
    const names = [...new Set(unpriced.map((o) => x.customers.find((c) => c.id === o.customer_id)?.name ?? 'Firma'))];
    out.push({
      id: `fiyatsiz:${x.today}:${unpriced.length}`, kind: 'siparis', tone: 'stop',
      title: `${unpriced.length} siparişte kişi başı fiyat yok`,
      body: `${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}. Fiyat girilmeden teslim edilemez; müşteri kartına veya siparişe fiyat yazın.`,
      to: '/siparisler', weight: 78,
    });
  }

  // 5) Bugünün mutfağı
  const empty = x.todayBatches.filter((b) => (b.item_count ?? 0) === 0);
  if (empty.length) out.push({
    id: `mutfak-bos:${x.today}:${empty.map((b) => b.batch_id).join(',')}`, kind: 'mutfak', tone: 'wait',
    title: `${empty.length} yemeğin malzemesi girilmedi`, body: `${empty.map((b) => b.dish_name).join(', ')} — porsiyon maliyeti çıkmaz. “Reçeteden doldur” ile başlayın.`,
    to: '/uretim', weight: 55,
  });
  const noPrice = x.todayBatches.filter((b) => (b.missing_price_count ?? 0) > 0);
  if (noPrice.length) out.push({
    id: `mutfak-fiyat:${x.today}`, kind: 'mutfak', tone: 'info', title: `${noPrice.length} yemekte fiyatsız malzeme var`,
    body: noPrice.map((b) => b.dish_name).join(', '), to: '/uretim', weight: 35,
  });

  // 6) Menü yemek maliyeti satış fiyatının %50'sini aşıyorsa
  for (const m of x.menus) {
    if (!m.active || !m.target_price || !m.cost_last) continue;
    const ratio = (m.cost_last / m.target_price) * 100;
    if (ratio < 50) continue;
    out.push({
      id: `maliyet:${m.menu_id}:${Math.round(ratio)}`, kind: 'maliyet', tone: ratio >= 60 ? 'stop' : 'wait',
      title: `${m.name}: yemek maliyeti fiyatın ${pct(ratio)}'i`,
      body: `Kişi başı ${money(m.cost_last)} / satış ${money(m.target_price)}. Gramaj veya fiyatı gözden geçirin.`, to: '/menuler', weight: 45 + ratio / 10,
    });
  }

  if (x.draftInvoices > 0) out.push({
    id: `fatura:${x.today}:${x.draftInvoices}`, kind: 'fatura', tone: 'info', title: `${x.draftInvoices} e-fatura onay bekliyor`,
    body: 'Gider kategorisi otomatik önerildi; onaylayınca giderlere ve borçlara işlenir.', to: '/finans/faturalar', weight: 42,
  });

  return out.sort((a, b) => b.weight - a.weight);
}

/** Asistanın tek paragraflık günlük özeti */
export function assistantSummary(alerts: Alert[], ctx: { people: number; perPerson: number | null; name: string }): string {
  const parts: string[] = [];
  parts.push(ctx.people > 0
    ? `Bugün ${new Intl.NumberFormat('tr-TR').format(ctx.people)} kişilik üretim var${ctx.perPerson ? `, kişi başı malzeme ${money(ctx.perPerson)}` : ''}.`
    : 'Bugün için sipariş görünmüyor.');
  const rises = alerts.filter((a) => a.kind === 'fiyat' && a.title.includes('zamlandı'));
  if (rises.length) parts.push(`${rises.length} stok kartında zam var; en büyüğü ${rises[0].title.replace(' zamlandı', '')}.`);
  const receivable = alerts.filter((a) => a.kind === 'alacak').reduce((s, a) => s + (a.amount ?? 0), 0);
  if (receivable > 0) parts.push(`Vadesi geçmiş alacak ${money(receivable)}.`);
  const pay = alerts.find((a) => a.kind === 'borc');
  if (pay) parts.push(`Bu hafta ${money(pay.amount ?? 0)} ödeme var.`);
  const ord = alerts.find((a) => a.kind === 'siparis');
  if (ord) parts.push(ord.title + '.');
  if (alerts.length === 0) parts.push('Her şey yolunda görünüyor.');
  return `${ctx.name}, ${parts.join(' ')}`;
}
