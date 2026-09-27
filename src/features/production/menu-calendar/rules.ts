/**
 * Aylık menü takvimi kuralları (EK-1 / Not 1, 3, 14). Saf fonksiyonlar: takvim, ekran ve kural motoru aynı kuralı kullanır.
 * Veritabanındaki monthly_menu_violations yayında son sözü söyler; buradaki kontrol kaydetmeden önce uyarmak içindir.
 */

export type CalMeal = 'kahvalti' | 'ogle' | 'aksam';
export const CAL_MEALS: CalMeal[] = ['kahvalti', 'ogle', 'aksam'];
export const CAL_MEAL_LABELS: Record<CalMeal, string> = { kahvalti: 'Kahvaltı', ogle: 'Öğle', aksam: 'Akşam' };

export type CalCourse = 'corba' | 'ana' | 'yardimci' | 'salata' | 'meze' | 'tatli' | 'icecek' | 'ekmek' | 'kahvalti';

/** Reçete kategorisi → takvim kap sırası */
export function courseOfCategory(category: string | null | undefined): CalCourse {
  switch (category) {
    case 'corba': return 'corba';
    case 'ana_yemek': case 'sebze': return 'ana';
    case 'pilav_makarna': return 'yardimci';
    case 'salata_meze': return 'salata';
    case 'tatli': return 'tatli';
    case 'icecek': return 'icecek';
    case 'ekmek': return 'ekmek';
    case 'kahvalti': return 'kahvalti';
    default: return 'ana';
  }
}

export interface Dish { recipeId: string; name: string; course: CalCourse; override?: string | null }
/** 'YYYY-MM-DD|meal' → yemekler (sıra = position) */
export type Plan = Record<string, Dish[]>;

export interface DishInfo { name: string; course: CalCourse; tags: string[]; cost: number | null }
export type DishIndex = Map<string, DishInfo>;

export type RuleKind = 'yasak_etiket' | 'yasak_yemek' | 'tercih_etiket' | 'gun_yasak' | 'haftalik_en_fazla' | 'haftalik_en_az';
export interface CustomerRule { rule: RuleKind; tag?: string | null; recipe_id?: string | null; weekday?: number | null; qty?: number | null; note?: string | null; active?: boolean | null }

export const slotKey = (day: string, meal: CalMeal) => `${day}|${meal}`;
export const parseSlot = (key: string) => { const [day, meal] = key.split('|'); return { day, meal: meal as CalMeal }; };

/** ISO hafta günü (1 = Pazartesi … 7 = Pazar), saat diliminden bağımsız */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function addDaysISO(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dayDiff = (a: string, b: string) => {
  const [ya, ma, da] = a.split('-').map(Number); const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)) / 864e5);
};

/** Pazartesi başlangıçlı ay ızgarası: her hücre bir gün; ay dışı günler `inMonth=false` (35 veya 42 hücre) */
export function monthCells(period: string): Array<{ day: string; inMonth: boolean }> {
  const [y, m] = period.split('-').map(Number);
  const first = `${period}-01`;
  const lead = isoWeekday(first) - 1;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const day = addDaysISO(first, i - lead);
    return { day, inMonth: day.slice(0, 7) === period };
  });
}

/** Ayın haftaları (Pzt–Paz), yalnız ay içindeki günlerle — mobil ajanda şeridi için */
export function monthWeeks(period: string): string[][] {
  const cells = monthCells(period);
  const weeks: string[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const w = cells.slice(i, i + 7).filter((c) => c.inMonth).map((c) => c.day);
    if (w.length) weeks.push(w);
  }
  return weeks;
}

export interface ChipFlag { repeat: boolean; banned: boolean; reasons: string[] }

/** Çip bazında bayraklar: 7 gün içinde tekrar (yalnız çorba ve ana) ve müşteri yasağı */
export function chipFlags(plan: Plan, index: DishIndex, rules: CustomerRule[], repeatDays = 7): Map<string, ChipFlag> {
  const out = new Map<string, ChipFlag>();
  const last = new Map<string, string>();
  const active = rules.filter((r) => r.active !== false);
  const keys = Object.keys(plan).sort((a, b) => {
    const pa = parseSlot(a), pb = parseSlot(b);
    return pa.day === pb.day ? CAL_MEALS.indexOf(pa.meal) - CAL_MEALS.indexOf(pb.meal) : pa.day.localeCompare(pb.day);
  });
  for (const key of keys) {
    const { day } = parseSlot(key);
    plan[key].forEach((d, i) => {
      const f: ChipFlag = { repeat: false, banned: false, reasons: [] };
      const info = index.get(d.recipeId);
      const tags = info?.tags ?? [];
      if (d.course === 'corba' || d.course === 'ana') {
        const prev = last.get(d.recipeId);
        if (prev && prev !== day && dayDiff(day, prev) < repeatDays) { f.repeat = true; f.reasons.push(`${repeatDays} gün içinde tekrar`); }
        last.set(d.recipeId, day);
      }
      for (const r of active) {
        if (r.rule === 'yasak_yemek' && r.recipe_id === d.recipeId) { f.banned = true; f.reasons.push(r.note || 'Müşteri bu yemeği istemiyor'); }
        if (r.rule === 'yasak_etiket' && r.tag && tags.includes(r.tag)) { f.banned = true; f.reasons.push(r.note || `Yasak: ${r.tag}`); }
        if (r.rule === 'gun_yasak' && r.weekday === isoWeekday(day) && ((r.recipe_id && r.recipe_id === d.recipeId) || (r.tag && tags.includes(r.tag)))) {
          f.banned = true; f.reasons.push(r.note || `Bu gün yasak: ${r.tag ?? 'yemek'}`);
        }
      }
      out.set(`${key}|${i}`, f);
    });
  }
  return out;
}

export interface Violation { key: string; index: number | null; rule: string; message: string }

/** Yayından önce ihlaller: gerekçesiz yasaklar + haftalık limitler (en fazla / en az) */
export function planViolations(plan: Plan, index: DishIndex, rules: CustomerRule[], repeatDays = 7): Violation[] {
  const flags = chipFlags(plan, index, rules, repeatDays);
  const out: Violation[] = [];
  for (const [k, f] of flags) {
    if (!f.banned) continue;
    const [day, meal, i] = k.split('|');
    const dish = plan[`${day}|${meal}`][Number(i)];
    if (dish.override && dish.override.trim().length >= 3) continue;
    out.push({ key: `${day}|${meal}`, index: Number(i), rule: 'yasak', message: `${day} ${CAL_MEAL_LABELS[meal as CalMeal]}: ${dish.name} — ${f.reasons.join(', ')}` });
  }
  const weekly = rules.filter((r) => r.active !== false && (r.rule === 'haftalik_en_fazla' || r.rule === 'haftalik_en_az') && r.tag && r.qty != null);
  if (weekly.length) {
    const byWeek = new Map<string, Map<string, number>>();
    for (const key of Object.keys(plan)) {
      const { day } = parseSlot(key);
      const wk = addDaysISO(day, 1 - isoWeekday(day));
      const counts = byWeek.get(wk) ?? new Map<string, number>();
      for (const d of plan[key]) for (const t of index.get(d.recipeId)?.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
      byWeek.set(wk, counts);
    }
    for (const [wk, counts] of byWeek) {
      for (const r of weekly) {
        const n = counts.get(r.tag!) ?? 0;
        if (r.rule === 'haftalik_en_fazla' && n > r.qty!) out.push({ key: wk, index: null, rule: r.rule, message: `${wk} haftası: ${r.tag} ${n} kez (en fazla ${r.qty})` });
        if (r.rule === 'haftalik_en_az' && n < r.qty!) out.push({ key: wk, index: null, rule: r.rule, message: `${wk} haftası: ${r.tag} ${n} kez (en az ${r.qty})` });
      }
    }
  }
  return out;
}

/** Öğün başı gıda maliyeti (1 kişi): yemek maliyetleri toplamı; fiyatı olmayan yemek null sayılmaz, eksik işaretlenir */
export function slotCost(dishes: Dish[], index: DishIndex): { cost: number; missing: number } {
  let cost = 0, missing = 0;
  for (const d of dishes) {
    const c = index.get(d.recipeId)?.cost;
    if (c == null) missing++; else cost += c;
  }
  return { cost, missing };
}

// ── Düzenleme işlemleri (saf; undo yığını bu sonuçları saklar) ──────────────────────────
export function addDish(plan: Plan, key: string, dish: Dish): Plan {
  return { ...plan, [key]: [...(plan[key] ?? []), dish] };
}
export function removeDish(plan: Plan, key: string, i: number): Plan {
  const arr = [...(plan[key] ?? [])]; arr.splice(i, 1);
  const next = { ...plan, [key]: arr };
  if (!arr.length) delete next[key];
  return next;
}
export function moveDish(plan: Plan, from: string, i: number, to: string, copy: boolean): Plan {
  const dish = plan[from]?.[i];
  if (!dish || (from === to && !copy)) return plan;
  const next = copy ? plan : removeDish(plan, from, i);
  return addDish(next, to, { ...dish });
}
/** Bir günün (veya tek öğünün) içeriğini başka güne kopyalar; hedefteki mevcut içerik değiştirilir */
export function copyDay(plan: Plan, from: string, to: string, meals: CalMeal[] = CAL_MEALS): Plan {
  const next = { ...plan };
  for (const m of meals) {
    const src = plan[slotKey(from, m)];
    if (src?.length) next[slotKey(to, m)] = src.map((d) => ({ ...d }));
  }
  return next;
}
/** Haftayı (Pzt başlangıçlı) hedef haftaya kopyalar; ay dışına düşen günler atlanır */
export function copyWeek(plan: Plan, fromMonday: string, toMonday: string, period: string, meals: CalMeal[] = CAL_MEALS): Plan {
  let next = plan;
  for (let i = 0; i < 7; i++) {
    const to = addDaysISO(toMonday, i);
    if (to.slice(0, 7) !== period) continue;
    next = copyDay(next, addDaysISO(fromMonday, i), to, meals);
  }
  return next;
}
/** Geçen ayın planını bu aya taşır: aynı hafta günü eşleşmesi (ayın n. pazartesisi → n. pazartesi) */
export function shiftFromPreviousMonth(prev: Plan, prevPeriod: string, period: string): Plan {
  const out: Plan = {};
  const prevDays = monthCells(prevPeriod).filter((c) => c.inMonth).map((c) => c.day);
  const days = monthCells(period).filter((c) => c.inMonth).map((c) => c.day);
  const ordinal = (d: string, list: string[]) => list.filter((x) => isoWeekday(x) === isoWeekday(d) && x <= d).length;
  for (const d of days) {
    const src = prevDays.find((p) => isoWeekday(p) === isoWeekday(d) && ordinal(p, prevDays) === ordinal(d, days));
    if (!src) continue;
    for (const m of CAL_MEALS) {
      const arr = prev[slotKey(src, m)];
      if (arr?.length) out[slotKey(d, m)] = arr.map((x) => ({ ...x, override: null }));
    }
  }
  return out;
}

// ── Kural motoru önerisi (AI anahtarı yoksa yedek; deterministik) ──────────────────────
export interface SuggestOptions {
  period: string;
  meals: CalMeal[];
  courses: CalCourse[];                 // öğün başı kaplar, sırayla (ör. çorba, ana, yardımcı, tatlı)
  index: DishIndex;
  rules: CustomerRule[];
  maxCostPerMeal?: number | null;      // kişi başı öğün gıda maliyet sınırı
  skipSunday?: boolean;
  repeatDays?: number;
  existing?: Plan;                     // dolu hücreler korunur
}

/** Açgözlü seçim: her kap için yasak olmayan, son `repeatDays` gün içinde kullanılmamış, etiketi en az kullanılan ve maliyeti sınırı aşmayan yemek */
export function suggestPlan(o: SuggestOptions): Plan {
  const repeatDays = o.repeatDays ?? 7;
  const plan: Plan = { ...(o.existing ?? {}) };
  const lastUsed = new Map<string, string>();
  const tagUse = new Map<string, number>();
  const pool = new Map<CalCourse, string[]>();
  for (const [id, info] of o.index) {
    const l = pool.get(info.course) ?? []; l.push(id); pool.set(info.course, l);
  }
  for (const l of pool.values()) l.sort((a, b) => (o.index.get(a)!.name).localeCompare(o.index.get(b)!.name, 'tr'));
  const days = monthCells(o.period).filter((c) => c.inMonth).map((c) => c.day);
  for (const day of days) {
    if (o.skipSunday !== false && isoWeekday(day) === 7) continue;
    for (const meal of o.meals) {
      const key = slotKey(day, meal);
      if (plan[key]?.length) { for (const d of plan[key]) lastUsed.set(d.recipeId, day); continue; }
      const chosen: Dish[] = [];
      let spent = 0;
      for (const course of o.courses) {
        const candidates = (pool.get(course) ?? []).filter((id) => {
          if (chosen.some((c) => c.recipeId === id)) return false;
          const prev = lastUsed.get(id);
          if (prev && dayDiff(day, prev) < repeatDays) return false;
          const f = chipFlags({ [key]: [{ recipeId: id, name: '', course }] }, o.index, o.rules, repeatDays).get(`${key}|0`);
          return !f?.banned;
        });
        const remaining = o.maxCostPerMeal != null ? o.maxCostPerMeal - spent : Infinity;
        const score = (id: string) => (o.index.get(id)!.tags.reduce((s, t) => s + (tagUse.get(t) ?? 0), 0));
        const pick = [...candidates]
          .sort((a, b) => score(a) - score(b) || ((lastUsed.get(a) ?? '') < (lastUsed.get(b) ?? '') ? -1 : 1))
          .find((id) => (o.index.get(id)!.cost ?? 0) <= remaining) ?? candidates[0];
        if (!pick) continue;
        const info = o.index.get(pick)!;
        chosen.push({ recipeId: pick, name: info.name, course });
        spent += info.cost ?? 0;
        lastUsed.set(pick, day);
        for (const t of info.tags) tagUse.set(t, (tagUse.get(t) ?? 0) + 1);
      }
      if (chosen.length) plan[key] = chosen;
    }
  }
  return plan;
}

/** Kısa öneri notları (AI kartı): aynı hafta içinde en sık tekrar eden etiketler */
export function planHints(plan: Plan, index: DishIndex): string[] {
  const byWeek = new Map<string, Map<string, number>>();
  for (const key of Object.keys(plan)) {
    const { day } = parseSlot(key);
    const wk = addDaysISO(day, 1 - isoWeekday(day));
    const m = byWeek.get(wk) ?? new Map<string, number>();
    for (const d of plan[key]) for (const t of index.get(d.recipeId)?.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1);
    byWeek.set(wk, m);
  }
  const hints: string[] = [];
  for (const [wk, m] of [...byWeek].sort()) {
    for (const [t, n] of m) if (n >= 3 && ['tavuk', 'kirmizi_et', 'kizartma', 'bakliyat', 'balik', 'hamur'].includes(t)) hints.push(`${wk} haftasında ${n} kez ${t.replace('_', ' ')} var; birini başka bir yemekle değiştirmeyi düşünün.`);
  }
  return hints.slice(0, 5);
}

/** Plan ↔ monthly_menu_days satırları */
export function planToRows(plan: Plan, monthlyMenuId: string) {
  const rows: Array<{ monthly_menu_id: string; day: string; meal: CalMeal; position: number; recipe_id: string; course: CalCourse; override_reason: string | null }> = [];
  for (const key of Object.keys(plan)) {
    const { day, meal } = parseSlot(key);
    plan[key].slice(0, 20).forEach((d, i) => rows.push({ monthly_menu_id: monthlyMenuId, day, meal, position: i + 1, recipe_id: d.recipeId, course: d.course, override_reason: d.override?.trim() || null }));
  }
  return rows;
}

export function rowsToPlan(rows: Array<{ day: string; meal: string; position: number; recipe_id: string; course: string | null; override_reason: string | null }>, index: DishIndex): Plan {
  const plan: Plan = {};
  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    const key = slotKey(r.day, r.meal as CalMeal);
    const info = index.get(r.recipe_id);
    (plan[key] ??= []).push({ recipeId: r.recipe_id, name: info?.name ?? 'Silinmiş yemek', course: (r.course as CalCourse) ?? info?.course ?? 'ana', override: r.override_reason });
  }
  return plan;
}
