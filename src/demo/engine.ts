/* eslint-disable @typescript-eslint/no-explicit-any */
import { demoEmail } from './users';

// DEMO MOTORU — tarayıcı içinde çalışan küçük bir "Postgres + PostgREST" taklidi.
// Tablolar localStorage'da tutulur; görünümler (v_*), tetikleyiciler ve RPC'ler
// supabase/migrations içindeki SQL'in birebir JS karşılığıdır. Böylece demodaki
// maliyet hesapları gerçek sistemle aynı sonucu verir.

export type Row = Record<string, any>;
export interface DemoDb { version: number; seededOn: string; t: Record<string, Row[]> }

export class DemoError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

const PK: Record<string, string> = {
  supplier_categories: 'supplier_key', recipe_categories: 'code', finance_categories: 'code',
  team_members: 'user_id', units: 'code',
};
export const pkOf = (table: string) => PK[table] ?? 'id';

let counter = 0;
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  counter += 1;
  return `d0000000-0000-4000-8000-${(Date.now() % 1e8).toString(16).padStart(8, '0')}${counter.toString(16).padStart(4, '0')}`;
}

export const UNITS: Row[] = [
  { code: 'g', name: 'Gram', dimension: 'kutle', to_base: 1 },
  { code: 'kg', name: 'Kilogram', dimension: 'kutle', to_base: 1000 },
  { code: 'ml', name: 'Mililitre', dimension: 'hacim', to_base: 1 },
  { code: 'lt', name: 'Litre', dimension: 'hacim', to_base: 1000 },
  { code: 'adet', name: 'Adet', dimension: 'adet', to_base: 1 },
];
const unit = (code: string) => UNITS.find((u) => u.code === code)!;
const baseUnit = (dim: string) => (dim === 'kutle' ? 'g' : dim === 'hacim' ? 'ml' : 'adet');
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const nowIso = () => new Date().toISOString();

export function istanbulToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}
export function addDaysIso(s: string, n: number): string {
  const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Varsayılanlar (SQL "default" karşılıkları)
// ---------------------------------------------------------------------
const DEFAULTS: Record<string, () => Row> = {
  ingredients: () => ({ code: null, category: 'diger', waste_pct: 0, last_price: null, avg_cost: null, price_updated_at: null, vat_rate: 1, allergens: [], min_stock: 0, active: true, notes: null }),
  ingredient_prices: () => ({ source: 'manuel', supplier_name: null, noted_at: nowIso(), created_by: null }),
  recipes: () => ({ code: null, portion_label: null, portion_served_g: null, instructions: null, active: true }),
  recipe_ingredients: () => ({ waste_pct_override: null, note: null, sort: 0 }),
  menus: () => ({ code: null, kind: 'standart', meal: 'ogle', target_price: null, notes: null, active: true, customer_id: null }),
  menu_items: () => ({ portion_factor: 1, sort: 0, course: 'ana' }),
  customers: () => ({ kind: 'kurum', tax_no: null, tax_office: null, address: null, city: null, district: null, contact_name: null, phone: null, email: null, default_meal_price: null, vat_rate: 10, payment_term_days: 30, e_invoice: false, notes: null, active: true }),
  meal_orders: () => ({ meal: 'ogle', menu_id: null, kind: 'sozlesmeli', delivered_qty: null, unit_price: 0, vat_rate: 10, status: 'bekliyor', note: null, created_by: null }),
  finance_accounts: () => ({ opening_balance: 0, active: true }),
  finance_categories: () => ({ keywords: [], sort: 100, active: true }),
  finance_entries: () => ({ vat_amount: 0, counterparty: null, customer_id: null, status: 'odendi', account_id: null, due_date: null, paid_at: null, source: 'manuel', source_id: null, created_by: null }),
  purchase_invoices: () => ({ supplier_tax_no: null, ettn: null, kind: 'gider', vat_amount: 0, due_date: null, status: 'taslak', source: 'manuel', lines: [], note: null, created_by: null }),
  menu_plans: () => ({ meal: 'ogle', customer_id: null, note: null, created_by: null }),
  prep_batches: () => ({ meal: 'ogle', recipe_id: null, menu_id: null, course: 'ana', customer_id: null, portions: null, portions_source: 'elle', status: 'taslak', note: null, created_by: null }),
  prep_batch_items: () => ({ ingredient_id: null, manual_name: null, unit_price: null, planned_qty: null, is_side: false, sort: 0 }),
  team_members: () => ({ customer_id: null, active: true }),
  chat_messages: () => ({ channel: 'genel', author_id: null }),
  recipe_cost_snapshots: () => ({ note: null, created_by: null, noted_at: nowIso() }),
};

// ---------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------
export class Engine {
  seeding = false;
  constructor(public db: DemoDb, public userId: () => string | null = () => null) {}

  rows(table: string): Row[] {
    if (!this.db.t[table]) this.db.t[table] = [];
    return this.db.t[table];
  }

  // --- yazma yolları (tetikleyicilerle birlikte)
  insert(table: string, input: Row, opts: { upsert?: boolean; onConflict?: string[] } = {}): Row {
    const pk = pkOf(table);
    const row: Row = { ...(DEFAULTS[table]?.() ?? {}), ...stripUndefined(input) };
    if (row[pk] == null && pk === 'id' && table !== 'company_settings') row.id = uuid();
    if (!('created_at' in row) || row.created_at == null) row.created_at = nowIso();
    if (table !== 'recipe_categories' && table !== 'finance_categories' && table !== 'finance_accounts') row.updated_at = nowIso();
    if ('created_by' in row && row.created_by == null) row.created_by = this.userId();
    if (table === 'chat_messages') {
      // chat_set_author tetikleyicisi: yazar adı ekip kaydından
      // Seed kendi yazarını verir; istemciden gelen istekte yazar her zaman oturumdaki kişidir
      if (!input.author_id || !this.seeding) row.author_id = this.userId();
      row.author_name = this.rows('team_members').find((m) => m.user_id === row.author_id)?.full_name ?? 'Bilinmeyen';
      if (!input.created_at) row.created_at = nowIso();
    }
    this.beforeWrite(table, row, null);

    const list = this.rows(table);
    const conflictCols = opts.onConflict ?? [pk];
    const existing = list.find((x) => conflictCols.every((c) => x[c] === row[c]));
    if (existing) {
      if (!opts.upsert) throw new DemoError('23505', 'Aynı kayıt zaten var.', 409);
      return this.patch(table, existing, input);
    }
    this.checkUnique(table, row, null);
    list.push(row);
    this.afterWrite(table, 'INSERT', row, null);
    return row;
  }

  patch(table: string, target: Row, patch: Row): Row {
    const old = { ...target };
    const next = { ...target, ...stripUndefined(patch) };
    if ('updated_at' in target) next.updated_at = nowIso();
    this.beforeWrite(table, next, old);
    this.checkUnique(table, next, target);
    Object.assign(target, next);
    this.afterWrite(table, 'UPDATE', target, old);
    return target;
  }

  remove(table: string, target: Row): Row {
    this.beforeDelete(table, target);
    const list = this.rows(table);
    const i = list.indexOf(target);
    if (i >= 0) list.splice(i, 1);
    this.afterWrite(table, 'DELETE', null, target);
    return target;
  }

  private checkUnique(table: string, row: Row, self: Row | null) {
    const others = this.rows(table).filter((x) => x !== self);
    const clash = (keys: string[], norm: (x: Row, k: string) => unknown = (x, k) => x[k] ?? null) =>
      others.some((x) => keys.every((k) => norm(x, k) === norm(row, k)));
    const lower = (x: Row, k: string) => (k === 'dish_name' || k === 'name' ? String(x[k] ?? '').trim().toLowerCase() : x[k] ?? null);
    if (table === 'prep_batches' && clash(['prep_date', 'meal', 'dish_name', 'customer_id'], lower))
      throw new DemoError('23505', 'Bu öğünde aynı isimli yemek zaten var.', 409);
    if (table === 'menu_plans' && clash(['plan_date', 'meal', 'customer_id'])) throw new DemoError('23505', 'Bu gün/öğün için plan zaten var.', 409);
    if (table === 'customers' && clash(['name'], lower)) throw new DemoError('23505', 'Aynı isimli müşteri var.', 409);
    if (table === 'recipe_ingredients' && clash(['recipe_id', 'ingredient_id'])) throw new DemoError('23505', 'Malzeme reçetede zaten var.', 409);
    if (table === 'menu_items' && clash(['menu_id', 'recipe_id'])) throw new DemoError('23505', 'Yemek menüde zaten var.', 409);
    if (table === 'purchase_invoices' && row.ettn && clash(['ettn'])) throw new DemoError('23505', 'Bu fatura (ETTN) zaten kayıtlı.', 409);
    if (table === 'meal_orders' && row.status !== 'iptal'
      && others.some((x) => x.status !== 'iptal' && x.service_date === row.service_date && x.meal === row.meal && x.customer_id === row.customer_id && (x.menu_id ?? null) === (row.menu_id ?? null)))
      throw new DemoError('23505', 'Bu müşterinin aynı gün/öğün siparişi zaten var.', 409);
  }

  private beforeWrite(table: string, row: Row, _old: Row | null) {
    if (table === 'finance_entries') {
      row.total_amount = r2(Number(row.net_amount) + Number(row.vat_amount ?? 0));
      if (row.status === 'odendi' && !row.account_id) throw new DemoError('23514', 'Ödenen kayıt için hesap (kasa/banka) seçin.');
    }
    if (table === 'prep_batch_items') this.fillPrepItemPrice(row);
    if (table === 'recipe_ingredients' && !(Number(row.net_qty) > 0)) throw new DemoError('23514', 'Miktar sıfırdan büyük olmalı.');
    if (table === 'prep_batch_items' && !(Number(row.qty) > 0)) throw new DemoError('23514', 'Miktar sıfırdan büyük olmalı.');
    if (table === 'prep_batches' && !String(row.dish_name ?? '').trim()) throw new DemoError('23514', 'Yemek adı zorunlu.');
  }

  private beforeDelete(table: string, row: Row) {
    const used = (t: string, col: string) => this.rows(t).some((x) => x[col] === row[pkOf(table)]);
    if (table === 'ingredients' && (used('recipe_ingredients', 'ingredient_id') || used('prep_batch_items', 'ingredient_id')))
      throw new DemoError('23503', 'Kullanımda');
    if (table === 'recipes' && used('menu_items', 'recipe_id')) throw new DemoError('23503', 'Kullanımda');
    if (table === 'customers' && used('meal_orders', 'customer_id')) throw new DemoError('23503', 'Kullanımda');
  }

  private afterWrite(table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', row: Row | null, old: Row | null) {
    const cascade = (t: string, col: string, id: unknown) => { this.db.t[t] = this.rows(t).filter((x) => x[col] !== id); };
    const setNull = (t: string, col: string, id: unknown) => this.rows(t).forEach((x) => { if (x[col] === id) x[col] = null; });
    if (op === 'DELETE' && old) {
      if (table === 'prep_batches') cascade('prep_batch_items', 'batch_id', old.id);
      if (table === 'recipes') { cascade('recipe_ingredients', 'recipe_id', old.id); cascade('recipe_cost_snapshots', 'recipe_id', old.id); setNull('prep_batches', 'recipe_id', old.id); }
      if (table === 'menus') { cascade('menu_items', 'menu_id', old.id); cascade('menu_plans', 'menu_id', old.id); setNull('meal_orders', 'menu_id', old.id); setNull('prep_batches', 'menu_id', old.id); }
      if (table === 'ingredients') cascade('ingredient_prices', 'ingredient_id', old.id);
    }
    if (table === 'ingredient_prices' && op === 'INSERT' && row) {
      const ing = this.rows('ingredients').find((i) => i.id === row.ingredient_id);
      if (ing && (ing.price_updated_at == null || ing.price_updated_at <= row.noted_at)) {
        ing.last_price = Number(row.price);
        ing.price_updated_at = row.noted_at;
        ing.avg_cost = ing.avg_cost ?? Number(row.price);
      }
    }
    if (table === 'purchase_invoices') this.syncInvoiceEntry(op, row, old);
    if (table === 'meal_orders') this.syncOrderEntry(op, row, old);
  }

  // prep_batch_items fiyat tetikleyicisi (fill_prep_item_price)
  private fillPrepItemPrice(row: Row) {
    const iu = unit(row.unit);
    if (!iu) throw new DemoError('23503', 'Geçersiz birim');
    if (row.ingredient_id) {
      const ing = this.rows('ingredients').find((i) => i.id === row.ingredient_id);
      if (!ing) throw new DemoError('23503', 'Malzeme bulunamadı');
      const su = unit(ing.stock_unit);
      if (su.dimension !== iu.dimension)
        throw new DemoError('23514', `Birim uyumsuz: malzemenin stok birimi ${ing.stock_unit}, girilen birim ${row.unit}`);
      if (row.unit_price == null && ing.last_price != null) row.unit_price = r4(ing.last_price * iu.to_base / su.to_base);
      row.manual_name = null;
    } else if (row.unit_price == null) {
      throw new DemoError('23514', 'Elle yazılan malzemenin birim fiyatı zorunlu');
    }
  }

  private upsertSourceEntry(source: string, sourceId: string, values: Row) {
    const e = this.rows('finance_entries').find((x) => x.source === source && x.source_id === sourceId);
    if (e) this.patch('finance_entries', e, values);
    else this.insert('finance_entries', { ...values, source, source_id: sourceId, status: 'bekliyor' });
  }
  private dropPendingSource(source: string, sourceId: string) {
    this.db.t.finance_entries = this.rows('finance_entries').filter((x) => !(x.source === source && x.source_id === sourceId && x.status === 'bekliyor'));
  }

  private syncInvoiceEntry(op: string, row: Row | null, old: Row | null) {
    if (op === 'DELETE') { this.dropPendingSource('gelen_fatura', old!.id); return; }
    const n = row!;
    if (n.status === 'onaylandi') {
      this.upsertSourceEntry('gelen_fatura', n.id, {
        entry_date: n.invoice_date, kind: 'gider', category_code: n.category_code, description: `Fatura ${n.invoice_no}`,
        net_amount: Number(n.net_amount), vat_amount: Math.max(Number(n.total_amount) - Number(n.net_amount), 0),
        counterparty: n.supplier_name, due_date: n.due_date ?? n.invoice_date,
      });
      const key = (n.supplier_tax_no || '').trim() || String(n.supplier_name).toLowerCase();
      const sc = this.rows('supplier_categories').find((x) => x.supplier_key === key);
      if (sc) Object.assign(sc, { category_code: n.category_code, supplier_name: n.supplier_name, updated_at: nowIso() });
      else this.rows('supplier_categories').push({ supplier_key: key, supplier_name: n.supplier_name, category_code: n.category_code, updated_at: nowIso() });
    } else this.dropPendingSource('gelen_fatura', n.id);
  }

  private syncOrderEntry(op: string, row: Row | null, old: Row | null) {
    if (op === 'DELETE') { this.dropPendingSource('siparis', old!.id); return; }
    const n = row!;
    const qty = n.delivered_qty ?? n.ordered_qty;
    if (n.status === 'teslim_edildi' && qty > 0 && n.unit_price > 0) {
      const c = this.rows('customers').find((x) => x.id === n.customer_id);
      this.upsertSourceEntry('siparis', n.id, {
        entry_date: n.service_date, kind: 'gelir', category_code: n.kind === 'organizasyon' ? 'organizasyon' : 'tabldot_satis',
        description: `${qty} kişi × ${n.unit_price} ₺`, net_amount: r2(qty * n.unit_price), vat_amount: r2(qty * n.unit_price * n.vat_rate / 100),
        counterparty: c?.name ?? null, customer_id: n.customer_id, due_date: addDaysIso(n.service_date, c?.payment_term_days ?? 30),
      });
    } else this.dropPendingSource('siparis', n.id);
  }

  // -------------------------------------------------------------------
  // Görünümler
  // -------------------------------------------------------------------
  view(name: string): Row[] | null {
    switch (name) {
      case 'v_recipe_lines': return this.vRecipeLines();
      case 'v_recipe_costs': return this.vRecipeCosts();
      case 'v_menu_costs': return this.vMenuCosts();
      case 'v_prep_items': return this.vPrepItems();
      case 'v_prep_batch_costs': return this.vPrepBatchCosts();
      case 'v_account_balances': return this.vAccountBalances();
      default: return null;
    }
  }

  vRecipeLines(): Row[] {
    const ings = new Map(this.rows('ingredients').map((i) => [i.id, i]));
    return this.rows('recipe_ingredients').flatMap((ri) => {
      const i = ings.get(ri.ingredient_id); if (!i) return [];
      const u = unit(i.stock_unit);
      const waste = ri.waste_pct_override ?? i.waste_pct;
      const gross = Number(ri.net_qty) / (1 - Number(waste) / 100);
      const gs = gross / u.to_base;
      const avg = i.avg_cost ?? i.last_price;
      return [{
        id: ri.id, recipe_id: ri.recipe_id, ingredient_id: ri.ingredient_id, sort: ri.sort, note: ri.note,
        ingredient_name: i.name, stock_unit: i.stock_unit, base_unit: baseUnit(u.dimension), net_qty: Number(ri.net_qty),
        waste_pct: Number(waste), waste_pct_override: ri.waste_pct_override, gross_qty: gross, gross_stock_qty: gs,
        last_price: i.last_price, avg_cost: avg,
        line_cost_last: i.last_price == null ? null : gs * i.last_price, line_cost_avg: avg == null ? null : gs * avg,
        allergens: i.allergens ?? [],
      }];
    });
  }

  vRecipeCosts(): Row[] {
    const lines = this.vRecipeLines();
    return this.rows('recipes').map((r) => {
      const ls = lines.filter((l) => l.recipe_id === r.id);
      return {
        recipe_id: r.id, code: r.code, name: r.name, category_code: r.category_code, active: r.active,
        line_count: ls.length,
        cost_last: r4(ls.reduce((s, l) => s + (l.line_cost_last ?? 0), 0)),
        cost_avg: r4(ls.reduce((s, l) => s + (l.line_cost_avg ?? 0), 0)),
        missing_price_count: ls.filter((l) => l.last_price == null).length,
        total_net_g: r2(ls.filter((l) => l.base_unit === 'g').reduce((s, l) => s + l.net_qty, 0)),
        allergens: [...new Set(ls.flatMap((l) => l.allergens as string[]))].sort(),
      };
    });
  }

  vMenuCosts(): Row[] {
    const rc = new Map(this.vRecipeCosts().map((r) => [r.recipe_id, r]));
    return this.rows('menus').map((m) => {
      const items = this.rows('menu_items').filter((mi) => mi.menu_id === m.id);
      const sum = (f: (c: Row) => number) => items.reduce((s, mi) => { const c = rc.get(mi.recipe_id); return s + (c ? f(c) * Number(mi.portion_factor) : 0); }, 0);
      const last = r4(sum((c) => c.cost_last));
      return {
        menu_id: m.id, code: m.code, name: m.name, kind: m.kind, meal: m.meal, target_price: m.target_price, active: m.active,
        item_count: items.length, cost_last: last, cost_avg: r4(sum((c) => c.cost_avg)),
        missing_price_count: items.reduce((s, mi) => s + (rc.get(mi.recipe_id)?.missing_price_count ?? 0), 0),
        food_margin_pct: m.target_price > 0 ? r2((m.target_price - last) / m.target_price * 100) : null,
        customer_id: m.customer_id,
      };
    });
  }

  vPrepItems(): Row[] {
    const ings = new Map(this.rows('ingredients').map((i) => [i.id, i]));
    return this.rows('prep_batch_items').map((it) => {
      const u = unit(it.unit); const i = it.ingredient_id ? ings.get(it.ingredient_id) : null;
      return {
        ...it, item_name: i?.name ?? it.manual_name, dimension: u.dimension, base_unit: baseUnit(u.dimension),
        qty_base: Number(it.qty) * u.to_base, planned_qty_base: it.planned_qty == null ? null : Number(it.planned_qty) * u.to_base,
        line_cost: it.unit_price == null ? null : Number(it.qty) * Number(it.unit_price),
        planned_cost: it.unit_price == null || it.planned_qty == null ? null : Number(it.planned_qty) * Number(it.unit_price),
        allergens: i?.allergens ?? [],
      };
    });
  }

  vPrepBatchCosts(): Row[] {
    const items = this.vPrepItems();
    const byBatch = new Map<string, Row[]>();
    for (const it of items) { const a = byBatch.get(it.batch_id) ?? []; a.push(it); byBatch.set(it.batch_id, a); }
    return this.rows('prep_batches').map((b) => {
      const its = byBatch.get(b.id) ?? [];
      const total = its.reduce((s, x) => s + (x.line_cost ?? 0), 0);
      const planned = its.reduce((s, x) => s + (x.planned_cost ?? 0), 0);
      const actualOfPlanned = its.filter((x) => x.planned_qty != null).reduce((s, x) => s + (x.line_cost ?? 0), 0);
      return {
        batch_id: b.id, prep_date: b.prep_date, meal: b.meal, dish_name: b.dish_name, recipe_id: b.recipe_id, menu_id: b.menu_id,
        course: b.course, customer_id: b.customer_id, portions: b.portions, portions_source: b.portions_source, status: b.status,
        item_count: its.length, missing_price_count: its.filter((x) => x.unit_price == null).length,
        total_cost: r4(total), side_cost: r4(its.filter((x) => x.is_side).reduce((s, x) => s + (x.line_cost ?? 0), 0)),
        cost_per_portion: b.portions > 0 ? r4(total / b.portions) : null,
        planned_cost: r4(planned),
        variance_pct: planned > 0 ? Math.round((actualOfPlanned - planned) / planned * 1000) / 10 : null,
        total_g: r2(its.filter((x) => x.base_unit === 'g').reduce((s, x) => s + x.qty_base, 0)),
      };
    });
  }

  vAccountBalances(): Row[] {
    return this.rows('finance_accounts').filter((a) => a.active).map((a) => {
      const es = this.rows('finance_entries').filter((e) => e.account_id === a.id && e.status === 'odendi');
      const bal = Number(a.opening_balance) + es.reduce((s, e) => s + (e.kind === 'gelir' ? 1 : -1) * Number(e.total_amount), 0);
      return { id: a.id, name: a.name, kind: a.kind, opening_balance: a.opening_balance, balance: r2(bal) };
    });
  }

  // -------------------------------------------------------------------
  // RPC'ler
  // -------------------------------------------------------------------
  effectiveMenu(date: string, meal: string, customer: string | null, orderMenu: string | null): string | null {
    if (orderMenu) return orderMenu;
    const plans = this.rows('menu_plans');
    return plans.find((p) => p.plan_date === date && p.meal === meal && p.customer_id === customer)?.menu_id
      ?? plans.find((p) => p.plan_date === date && p.meal === meal && p.customer_id == null)?.menu_id ?? null;
  }

  planPrepFromOrders(date: string, meal: string): number {
    const orders = this.rows('meal_orders').filter((o) => o.service_date === date && o.meal === meal && o.status !== 'iptal');
    const agg = new Map<string, { recipe_id: string; name: string; course: string; portions: number; menu_id: string }>();
    for (const o of orders) {
      const menuId = this.effectiveMenu(o.service_date, o.meal, o.customer_id, o.menu_id);
      if (!menuId) continue;
      const people = o.delivered_qty ?? o.ordered_qty;
      for (const mi of this.rows('menu_items').filter((x) => x.menu_id === menuId)) {
        const rec = this.rows('recipes').find((r) => r.id === mi.recipe_id); if (!rec) continue;
        const key = `${mi.recipe_id}|${mi.course}`;
        const a = agg.get(key) ?? { recipe_id: mi.recipe_id, name: rec.name, course: mi.course, portions: 0, menu_id: menuId };
        a.portions += people * Number(mi.portion_factor);
        if (menuId < a.menu_id) a.menu_id = menuId;
        agg.set(key, a);
      }
    }
    let n = 0;
    for (const a of agg.values()) {
      if (!(a.portions > 0)) continue;
      const existing = this.rows('prep_batches').find((b) => b.prep_date === date && b.meal === meal && b.customer_id == null
        && String(b.dish_name).trim().toLowerCase() === a.name.trim().toLowerCase());
      if (existing) {
        if (existing.portions_source === 'siparis') this.patch('prep_batches', existing, { portions: r2(a.portions), recipe_id: existing.recipe_id ?? a.recipe_id });
      } else {
        this.insert('prep_batches', { prep_date: date, meal, dish_name: a.name, recipe_id: a.recipe_id, menu_id: a.menu_id, course: a.course, portions: r2(a.portions), portions_source: 'siparis' });
      }
      n += 1;
    }
    return n;
  }

  prepFillFromRecipe(batchId: string): number {
    const b = this.rows('prep_batches').find((x) => x.id === batchId);
    if (!b) throw new DemoError('42501', 'Hazırlık bulunamadı');
    if (!b.recipe_id) throw new DemoError('23514', 'Bu yemeğe bağlı reçete yok');
    if (b.portions == null) throw new DemoError('23514', 'Önce kişi/porsiyon sayısını girin');
    const lines = this.vRecipeLines().filter((l) => l.recipe_id === b.recipe_id);
    const items = this.rows('prep_batch_items').filter((x) => x.batch_id === batchId);
    let n = 0;
    for (const l of lines) {
      const have = items.find((x) => x.ingredient_id === l.ingredient_id);
      const q = r3(l.gross_stock_qty * b.portions);
      if (!have) { this.insert('prep_batch_items', { batch_id: batchId, ingredient_id: l.ingredient_id, qty: q, unit: l.stock_unit, planned_qty: q, sort: l.sort }); n += 1; }
      else have.planned_qty = r3(l.gross_stock_qty * b.portions * unit(l.stock_unit).to_base / unit(have.unit).to_base);
    }
    return n;
  }

  recipeFromPrep(batchId: string, category: string | null): string {
    const b = this.rows('prep_batches').find((x) => x.id === batchId);
    if (!b) throw new DemoError('42501', 'Hazırlık bulunamadı');
    if (b.portions == null) throw new DemoError('23514', 'Porsiyon sayısı olmadan reçete türetilemez');
    const COURSE_CAT: Record<string, string> = { corba: 'corba', ana: 'ana_yemek', yardimci: 'pilav_makarna', salata: 'salata_meze', meze: 'salata_meze', tatli: 'tatli', icecek: 'icecek', ekmek: 'ekmek', kahvalti: 'kahvalti' };
    const cat = category ?? COURSE_CAT[b.course] ?? 'ana_yemek';
    let rid: string | null = b.recipe_id;
    if (!rid) rid = this.rows('recipes').find((r) => r.name.toLowerCase() === String(b.dish_name).trim().toLowerCase())?.id ?? null;
    if (!rid) rid = this.insert('recipes', { name: String(b.dish_name).trim(), category_code: cat }).id as string;
    this.db.t.recipe_ingredients = this.rows('recipe_ingredients').filter((x) => x.recipe_id !== rid);
    const groups = new Map<string, { base: number; sort: number; qty: number }>();
    for (const it of this.rows('prep_batch_items').filter((x) => x.batch_id === batchId && x.ingredient_id)) {
      const g = groups.get(it.ingredient_id) ?? { base: 0, sort: it.sort, qty: 0 };
      g.base += Number(it.qty) * unit(it.unit).to_base; g.qty += Number(it.qty); g.sort = Math.min(g.sort, it.sort);
      groups.set(it.ingredient_id, g);
    }
    for (const [ingId, g] of groups) {
      if (!(g.qty > 0)) continue;
      const ing = this.rows('ingredients').find((i) => i.id === ingId)!;
      this.insert('recipe_ingredients', { recipe_id: rid, ingredient_id: ingId, net_qty: r3(g.base / b.portions * (1 - ing.waste_pct / 100)), sort: g.sort, note: 'Hazırlıktan türetildi' });
    }
    b.recipe_id = rid;
    return rid!;
  }

  saveRecipe(id: string | null, h: Row, lines: Row[]): string {
    if (!String(h.name ?? '').trim()) throw new DemoError('23514', 'Reçete adı zorunlu');
    const header = {
      code: String(h.code ?? '').trim() || null, name: String(h.name).trim(), category_code: h.category_code,
      portion_label: String(h.portion_label ?? '').trim() || null, portion_served_g: h.portion_served_g == null || h.portion_served_g === '' ? null : Number(h.portion_served_g),
      instructions: h.instructions || null, active: h.active ?? true,
    };
    let rid = id;
    if (!rid) rid = this.insert('recipes', header).id as string;
    else { const r = this.rows('recipes').find((x) => x.id === rid); if (!r) throw new DemoError('42501', 'Reçete bulunamadı'); this.patch('recipes', r, header); }
    const keep = new Set(lines.map((l) => l.ingredient_id));
    this.db.t.recipe_ingredients = this.rows('recipe_ingredients').filter((x) => x.recipe_id !== rid || keep.has(x.ingredient_id));
    lines.forEach((l, k) => {
      const vals = { net_qty: Number(l.net_qty), waste_pct_override: l.waste_pct_override == null || l.waste_pct_override === '' ? null : Number(l.waste_pct_override), note: l.note || null, sort: k + 1 };
      const ex = this.rows('recipe_ingredients').find((x) => x.recipe_id === rid && x.ingredient_id === l.ingredient_id);
      if (ex) this.patch('recipe_ingredients', ex, vals); else this.insert('recipe_ingredients', { recipe_id: rid, ingredient_id: l.ingredient_id, ...vals });
    });
    return rid!;
  }

  saveMenu(id: string | null, h: Row, items: Row[]): string {
    if (!String(h.name ?? '').trim()) throw new DemoError('23514', 'Menü adı zorunlu');
    const header = {
      code: String(h.code ?? '').trim() || null, name: String(h.name).trim(), kind: h.kind ?? 'standart', meal: h.meal ?? 'ogle',
      target_price: h.target_price == null || h.target_price === '' ? null : Number(h.target_price), notes: h.notes || null,
      active: h.active ?? true, customer_id: h.customer_id || null,
    };
    let mid = id;
    if (!mid) mid = this.insert('menus', header).id as string;
    else { const m = this.rows('menus').find((x) => x.id === mid); if (!m) throw new DemoError('42501', 'Menü bulunamadı'); this.patch('menus', m, header); }
    const keep = new Set(items.map((i) => i.recipe_id));
    this.db.t.menu_items = this.rows('menu_items').filter((x) => x.menu_id !== mid || keep.has(x.recipe_id));
    items.forEach((it, k) => {
      const vals = { portion_factor: Number(it.portion_factor ?? 1), course: it.course ?? 'ana', sort: k + 1 };
      const ex = this.rows('menu_items').find((x) => x.menu_id === mid && x.recipe_id === it.recipe_id);
      if (ex) Object.assign(ex, vals); else this.insert('menu_items', { menu_id: mid, recipe_id: it.recipe_id, ...vals });
    });
    return mid!;
  }

  rpc(name: string, args: Row): unknown {
    switch (name) {
      case 'needs_bootstrap': return false;
      case 'order_is_open': return true;
      case 'effective_menu': return this.effectiveMenu(args.p_date, args.p_meal, args.p_customer ?? null, args.p_order_menu ?? null);
      case 'plan_prep_from_orders': return this.planPrepFromOrders(args.p_date, args.p_meal);
      case 'prep_fill_from_recipe': return this.prepFillFromRecipe(args.p_batch_id);
      case 'recipe_from_prep': return this.recipeFromPrep(args.p_batch_id, args.p_category ?? null);
      case 'save_recipe': return this.saveRecipe(args.p_id ?? null, args.p_header ?? {}, args.p_lines ?? []);
      case 'save_menu': return this.saveMenu(args.p_id ?? null, args.p_header ?? {}, args.p_items ?? []);
      case 'list_team': return this.rows('team_members').map((m) => ({ ...m, email: demoEmail(m.role) }));
      case 'list_pending_users': return [{ user_id: 'b0000000-0000-4000-8000-00000000aa01', email: 'yeni.personel@ornek.test', full_name: 'Yeni Personel (onay bekliyor)', created_at: nowIso() }];
      case 'recipe_scale': {
        return this.vRecipeLines().filter((l) => l.recipe_id === args.p_recipe_id).map((l) => ({
          ingredient_id: l.ingredient_id, ingredient_name: l.ingredient_name, stock_unit: l.stock_unit, base_unit: l.base_unit,
          net_total: l.net_qty * args.p_portions, gross_total: l.gross_qty * args.p_portions, gross_stock_total: l.gross_stock_qty * args.p_portions,
          cost_last: (l.line_cost_last ?? 0) * args.p_portions,
        }));
      }
      default: throw new DemoError('PGRST202', `Demo'da bu işlem yok: ${name}`, 404);
    }
  }
}


function stripUndefined(o: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}
