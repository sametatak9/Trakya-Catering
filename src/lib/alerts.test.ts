import { describe, expect, it } from 'vitest';
import { assistantSummary, buildAlerts, type AlertInput } from './alerts';

const base: AlertInput = {
  today: '2026-09-26', minutesToCutoff: 60, staleDays: 14,
  ingredients: [
    { id: 'p', name: 'Patlıcan', active: true, last_price: 38, price_updated_at: '2026-09-24T10:00:00Z', stock_unit: 'kg' },
    { id: 'k', name: 'Kimyon', active: true, last_price: null, price_updated_at: null, stock_unit: 'kg' },
    { id: 'b', name: 'Bezelye', active: true, last_price: 70, price_updated_at: '2026-08-05T10:00:00Z', stock_unit: 'kg' },
  ],
  prices: [
    { ingredient_id: 'p', price: 33, noted_at: '2026-09-01T10:00:00Z' },
    { ingredient_id: 'p', price: 38, noted_at: '2026-09-24T10:00:00Z' },
  ],
  menus: [{ menu_id: 'm', name: 'Pahalı Menü', active: true, target_price: 100, cost_last: 62 }],
  openItems: [
    { id: 'a1', kind: 'gelir', counterparty: 'Keşan Lojistik', due_date: '2026-09-10', total_amount: 10000 },
    { id: 'a2', kind: 'gelir', counterparty: 'Keşan Lojistik', due_date: '2026-09-20', total_amount: 5000 },
    { id: 'b1', kind: 'gider', counterparty: 'Trakya Gaz', due_date: '2026-09-30', total_amount: 20880 },
    { id: 'b2', kind: 'gider', counterparty: 'Uzak', due_date: '2026-11-30', total_amount: 1 },
  ],
  customers: [{ id: 'c1', name: 'OSB', active: true }, { id: 'c2', name: 'Şantiye', active: true }],
  tomorrowOrders: [{ customer_id: 'c1', meal: 'ogle', status: 'bekliyor' }],
  todayBatches: [{ batch_id: 'x', dish_name: 'Sütlaç', item_count: 0, missing_price_count: 0, status: 'taslak' }],
  draftInvoices: 2,
};

describe('asistan uyarıları', () => {
  const alerts = buildAlerts(base);
  const find = (kind: string) => alerts.filter((a) => a.kind === kind);

  it('fiyat artışını yüzdesiyle yakalar (%15,2)', () => {
    const rise = find('fiyat').find((a) => a.title.startsWith('Patlıcan'))!;
    expect(rise.title).toContain('+%15,2');
    expect(rise.tone).toBe('stop');
  });
  it('fiyatı olmayan ve eski fiyatlı malzemeleri bildirir', () => {
    expect(find('fiyat').some((a) => a.title === '1 stok kartının fiyatı yok')).toBe(true);
    expect(find('fiyat').some((a) => a.body.includes('Bezelye'))).toBe(true);
  });
  it('vadesi geçen alacağı firma bazında toplar', () => {
    const r = find('alacak');
    expect(r).toHaveLength(1);
    expect(r[0].amount).toBe(15000);
    expect(r[0].body).toContain('16 gün');
  });
  it('7 gün içindeki ödemeleri alır, uzaktakini almaz', () => {
    expect(find('borc')[0].amount).toBe(20880);
  });
  it('yarın sayısı gelmeyen firmayı, boş yemeği, pahalı menüyü ve faturaları bildirir', () => {
    expect(find('siparis')[0].title).toBe('1 firmanın yarınki sayısı gelmedi');
    expect(find('mutfak')[0].body).toContain('Sütlaç');
    expect(find('maliyet')[0].tone).toBe('stop');
    expect(find('fatura')[0].title).toBe('2 e-fatura onay bekliyor');
  });
  it('önem sırasına göre sıralar: alacak en üstte', () => {
    expect(alerts[0].kind).toBe('alacak');
  });
  it('özet cümlesi kurar', () => {
    const s = assistantSummary(alerts, { people: 850, perPerson: 74.43, name: 'Selin' });
    expect(s).toMatch(/^Selin, Bugün 850 kişilik üretim var/);
    expect(s).toContain('Vadesi geçmiş alacak');
  });
  it('fiyatsız siparişi durdurucu uyarı olarak bildirir, iptal ve fiyatlıyı saymaz', () => {
    const a = buildAlerts({ ...base, upcomingOrders: [
      { customer_id: 'c1', service_date: '2026-09-27', status: 'bekliyor', unit_price: 0, ordered_qty: 120 },
      { customer_id: 'c2', service_date: '2026-09-27', status: 'iptal', unit_price: 0, ordered_qty: 50 },
      { customer_id: 'c2', service_date: '2026-09-27', status: 'bekliyor', unit_price: 150, ordered_qty: 50 },
    ] }).find((x) => x.id.startsWith('fiyatsiz'));
    expect(a?.title).toBe('1 siparişte kişi başı fiyat yok');
    expect(a?.tone).toBe('stop');
    expect(a?.body).toContain('OSB');
  });
  it('portaldan gelen yeni şikâyeti kırmızı, beğeniyi yeşil bildirir', () => {
    const a = buildAlerts({ ...base, feedback: [
      { id: 'f1', customer_id: 'c1', kind: 'sikayet', rating: 2, text: 'Pilav soğuktu', menu_date: '2026-09-25', source: 'portal' },
      { id: 'f2', customer_id: 'c2', kind: 'begeni', rating: 5, text: null, menu_date: '2026-09-25', source: 'portal' },
    ] });
    const f1 = a.find((x) => x.id === 'geri:f1')!;
    expect(f1.tone).toBe('stop');
    expect(f1.title).toBe('OSB: şikâyet');
    expect(a.find((x) => x.id === 'geri:f2')!.tone).toBe('ok');
  });
});
