import { describe, expect, it } from 'vitest';
import {
  chipFlags, copyWeek, isoWeekday, monthCells, monthWeeks, moveDish, planToRows, planViolations, rowsToPlan, shiftFromPreviousMonth,
  slotKey, suggestPlan, type CustomerRule, type DishIndex, type Plan,
} from './rules';
import { historyInit, historyPush, historyRedo, historyUndo } from './useCalendarHistory';

const index: DishIndex = new Map([
  ['mer', { name: 'Mercimek çorbası', course: 'corba', tags: ['bakliyat'], cost: 8 }],
  ['ezo', { name: 'Ezogelin çorbası', course: 'corba', tags: ['bakliyat'], cost: 7 }],
  ['kar', { name: 'Karnıyarık', course: 'ana', tags: ['patlican', 'kirmizi_et'], cost: 40 }],
  ['tav', { name: 'Tavuk sote', course: 'ana', tags: ['tavuk'], cost: 35 }],
  ['ham', { name: 'Hamsi tava', course: 'ana', tags: ['balik'], cost: 30 }],
  ['kof', { name: 'İzmir köfte', course: 'ana', tags: ['kirmizi_et'], cost: 45 }],
  ['pil', { name: 'Pirinç pilavı', course: 'yardimci', tags: [], cost: 6 }],
  ['sut', { name: 'Sütlaç', course: 'tatli', tags: ['tatli'], cost: 9 }],
]);
const dish = (id: string) => ({ recipeId: id, name: index.get(id)!.name, course: index.get(id)!.course });

describe('takvim ızgarası', () => {
  it('Ekim 2026: 1 Ekim perşembe, Pazartesi başlangıçlı 35 hücre', () => {
    expect(isoWeekday('2026-10-01')).toBe(4);
    const cells = monthCells('2026-10');
    expect(cells.length).toBe(35);
    expect(cells[0]).toEqual({ day: '2026-09-28', inMonth: false });
    expect(cells.filter((c) => c.inMonth).length).toBe(31);
  });
  it('haftalar yalnız ay içi günler', () => {
    const w = monthWeeks('2026-10');
    expect(w[0]).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(w.flat().length).toBe(31);
  });
});

describe('kurallar', () => {
  const rules: CustomerRule[] = [
    { rule: 'yasak_etiket', tag: 'patlican', note: 'Patlıcan yok' },
    { rule: 'gun_yasak', tag: 'balik', weekday: 5, note: 'Cuma balık yok' },
    { rule: 'haftalik_en_fazla', tag: 'kirmizi_et', qty: 1 },
  ];
  const plan: Plan = {
    [slotKey('2026-10-05', 'ogle')]: [dish('mer'), dish('kar')],
    [slotKey('2026-10-07', 'ogle')]: [dish('mer'), dish('kof')],
    [slotKey('2026-10-09', 'ogle')]: [dish('ezo'), dish('ham')],
    [slotKey('2026-10-12', 'ogle')]: [dish('mer'), dish('tav')],
  };
  it('yasak etiket, gün yasağı ve 7 gün tekrarı', () => {
    const f = chipFlags(plan, index, rules);
    expect(f.get('2026-10-05|ogle|1')?.banned).toBe(true);
    expect(f.get('2026-10-09|ogle|1')?.banned).toBe(true);   // cuma balık
    expect(f.get('2026-10-07|ogle|0')?.repeat).toBe(true);   // mercimek 2 gün sonra
    expect(f.get('2026-10-12|ogle|0')?.repeat).toBe(true);   // 5 gün sonra
    expect(f.get('2026-10-05|ogle|0')?.repeat).toBe(false);
  });
  it('yayın ihlalleri: gerekçesiz yasak + haftalık en fazla', () => {
    const v = planViolations(plan, index, rules);
    expect(v.filter((x) => x.rule === 'yasak').length).toBe(2);
    expect(v.some((x) => x.rule === 'haftalik_en_fazla' && x.key === '2026-10-05')).toBe(true);
    const withReason: Plan = { ...plan, [slotKey('2026-10-05', 'ogle')]: [dish('mer'), { ...dish('kar'), override: 'müşteri onayladı' }] };
    expect(planViolations(withReason, index, rules).filter((x) => x.rule === 'yasak').length).toBe(1);
  });
});

describe('düzenleme', () => {
  const p: Plan = { [slotKey('2026-10-05', 'ogle')]: [dish('mer'), dish('tav')] };
  it('taşı ve kopyala', () => {
    const moved = moveDish(p, '2026-10-05|ogle', 1, '2026-10-06|ogle', false);
    expect(moved['2026-10-05|ogle'].length).toBe(1);
    expect(moved['2026-10-06|ogle'][0].recipeId).toBe('tav');
    const copied = moveDish(p, '2026-10-05|ogle', 1, '2026-10-06|ogle', true);
    expect(copied['2026-10-05|ogle'].length).toBe(2);
    expect(copied['2026-10-06|ogle'].length).toBe(1);
  });
  it('hafta kopyası ay dışına taşmaz', () => {
    const w = copyWeek(p, '2026-10-05', '2026-10-26', '2026-10');
    expect(w['2026-10-26|ogle'].length).toBe(2);
    expect(Object.keys(w).every((k) => k.startsWith('2026-10'))).toBe(true);
  });
  it('geçen aydan başlat: n. pazartesi → n. pazartesi', () => {
    const prev: Plan = { [slotKey('2026-09-07', 'ogle')]: [dish('mer')] };   // Eylül'ün 1. pazartesisi (1 Eylül salı)
    const next = shiftFromPreviousMonth(prev, '2026-09', '2026-10');
    expect(next['2026-10-05|ogle'][0].recipeId).toBe('mer');                  // Ekim'in 1. pazartesisi
  });
  it('satırlara dönüşüm gidiş-dönüş', () => {
    const rows = planToRows(p, 'm1');
    expect(rows.map((r) => r.position)).toEqual([1, 2]);
    expect(rowsToPlan(rows, index)).toEqual({ '2026-10-05|ogle': [{ ...dish('mer'), override: null }, { ...dish('tav'), override: null }] });
  });
});

describe('kural motoru önerisi', () => {
  it('yasaklara ve 7 gün tekrarına uyar, pazar boş kalır', () => {
    const rules: CustomerRule[] = [{ rule: 'yasak_etiket', tag: 'patlican' }];
    const s = suggestPlan({ period: '2026-10', meals: ['ogle'], courses: ['corba', 'ana', 'yardimci'], index, rules, repeatDays: 3 });
    const flags = chipFlags(s, index, rules, 3);
    expect([...flags.values()].some((f) => f.banned)).toBe(false);
    expect(s['2026-10-04|ogle']).toBeUndefined();                           // pazar
    expect(s['2026-10-05|ogle'].map((d) => d.course)).toEqual(['corba', 'ana', 'yardimci']);
  });
  it('dolu hücreler korunur', () => {
    const existing: Plan = { '2026-10-05|ogle': [dish('sut')] };
    const s = suggestPlan({ period: '2026-10', meals: ['ogle'], courses: ['corba'], index, rules: [], existing });
    expect(s['2026-10-05|ogle']).toEqual(existing['2026-10-05|ogle']);
  });
});

describe('geri al yığını', () => {
  it('50+ adım, geri al ve yinele', () => {
    let h = historyInit(0);
    for (let i = 1; i <= 60; i++) h = historyPush(h, i);
    expect(h.past.length).toBe(60);
    for (let i = 0; i < 55; i++) h = historyUndo(h);
    expect(h.present).toBe(5);
    h = historyRedo(h);
    expect(h.present).toBe(6);
    h = historyPush(h, 99);
    expect(h.future.length).toBe(0);
  });
  it('sınır aşılınca en eski adım düşer', () => {
    let h = historyInit(0);
    for (let i = 1; i <= 120; i++) h = historyPush(h, i, 100);
    expect(h.past.length).toBe(100);
    expect(h.past[0]).toBe(20);
  });
});
