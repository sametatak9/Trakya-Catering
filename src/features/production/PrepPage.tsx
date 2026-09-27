import { useMemo, useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { BookmarkPlus, ChefHat, PackageMinus, ChevronDown, ChevronRight, ListRestart, Plus, Trash2, Wand2, WandSparkles, X } from 'lucide-react';
import { Link } from '@/app/router';
import { useCan } from '@/app/session';
import { addDays, dayLabel, shortDay, todayISO } from '@/lib/dates';
import { MEALS, PREP_STATUS, ROLES, STOCK_UNITS, unitInfo } from '@/lib/domain';
import { amountOf } from '@/lib/finance';
import { fmtMoney, fmtNum, fmtQty, parseNum } from '@/lib/format';
import { COURSE_LABELS, COURSE_ORDER, STATION_LABELS, perPortionBase, stationOf, type Course, type Station } from '@/lib/prep';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { DateNav, Delta, Hint, SparkBars } from '@/ui/bits';
import { NumCell } from '@/ui/NumCell';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { mergeByIngredient } from '@/lib/stock';
import { useInsertRows, useRows } from '@/lib/crud';
import { askConfirm as confirmStock } from '@/ui/confirm';
import { useEntries } from '../finance/api';
import { useIngredients, useMenuCosts, useRecipeCosts, type Ingredient } from '../kitchen/api';
import { orderPeople, useCustomers, useOrders, type MealOrder } from '../sales/api';
import {
  effectiveMenu, useDeleteBatch, useMenuItemsIndex, useDeleteItem, useFillFromRecipe, useMenuPlans, usePlanPrep, usePrepBatches, usePrepItems,
  useRecipeFromPrep, useSaveBatch, useSaveItem, type PrepBatchCost, type PrepItem,
} from './api';

const TREND_DAYS = 14;

/** Günlük Hazırlık & Maliyet. `fixedMeal` verilirse (ör. Kahvaltı sekmesi) öğün sabitlenir. */
export function PrepPage({ fixedMeal, initialMeal, title, kicker }: { fixedMeal?: string; initialMeal?: string; title?: string; kicker?: string }) {
  const toast = useToast();
  const canEdit = useCan(ROLES.production);
  const isFinance = useCan(ROLES.finance);
  const [date, setDate] = useState(todayISO);
  const [mealState, setMeal] = useState(fixedMeal ?? (initialMeal && initialMeal in MEALS ? initialMeal : 'ogle'));
  const meal = fixedMeal ?? mealState;
  const from = addDays(date, -(TREND_DAYS - 1));

  const batches = usePrepBatches(from, date);
  const orders = useOrders(from, date);
  const plans = useMenuPlans(date);
  const recipes = useRecipeCosts();
  const menus = useMenuCosts();
  const customers = useCustomers();
  const ohFrom = addDays(date, -29);
  const ohEntries = useEntries(ohFrom, date, isFinance);
  const ohOrders = useOrders(ohFrom, date);

  const plan = usePlanPrep();
  const saveBatch = useSaveBatch();
  const fillAll = useFillFromRecipe();
  const allIngredients = useIngredients();
  const stockOut = useInsertRows('stock_movements', ['ingredients']);

  const all = batches.data ?? [];
  const dayBatches = all.filter((b) => b.prep_date === date && b.meal === meal);
  const dayIds = dayBatches.map((b) => b.batch_id!);
  const issued = useRows('stock_movements', { key: ['hazirlik', date, meal, dayIds.join(',')], enabled: dayIds.length > 0, filter: (x) => x.eq('source', 'hazirlik').in('source_id', dayIds) });
  const items = usePrepItems(dayBatches.map((b) => b.batch_id!));
  const itemsBy = useMemo(() => {
    const m = new Map<string, PrepItem[]>();
    for (const it of items.data ?? []) m.set(it.batch_id!, [...(m.get(it.batch_id!) ?? []), it]);
    return m;
  }, [items.data]);

  const allOrders = (orders.data ?? []).filter((o) => o.status !== 'iptal');
  const mealOrders = allOrders.filter((o) => o.service_date === date && o.meal === meal);
  const people = mealOrders.reduce((s, o) => s + orderPeople(o), 0);
  const dayCost = dayBatches.reduce((s, b) => s + Number(b.total_cost ?? 0), 0);
  const perPerson = people > 0 ? dayCost / people : null;

  // 14 gün: kişi başı hazırlık maliyeti (bu öğün)
  const series = Array.from({ length: TREND_DAYS }, (_, i) => addDays(from, i)).map((d) => {
    const cost = all.filter((b) => b.prep_date === d && b.meal === meal).reduce((s, b) => s + Number(b.total_cost ?? 0), 0);
    const ppl = allOrders.filter((o) => o.service_date === d && o.meal === meal).reduce((s, o) => s + orderPeople(o), 0);
    return { d, pp: ppl > 0 ? cost / ppl : 0 };
  });
  const prev = [...series.slice(0, -1)].reverse().find((x) => x.pp > 0);
  const todayPP = series[series.length - 1].pp;

  // Menü başı gerçekleşen maliyet: menüdeki her kabın bugünkü hazırlık porsiyon maliyeti × katsayı
  const menuServed = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of mealOrders) {
      const mid = effectiveMenu(plans.data ?? [], date, meal, o.customer_id, o.menu_id);
      if (mid) m.set(mid, (m.get(mid) ?? 0) + orderPeople(o));
    }
    return [...m.entries()].map(([id, ppl]) => ({ menu: (menus.data ?? []).find((x) => x.menu_id === id), ppl }));
  }, [mealOrders, plans.data, menus.data, date, meal]);
  const byRecipe = new Map(dayBatches.filter((b) => b.recipe_id).map((b) => [b.recipe_id!, b]));
  const menuIndex = useMenuItemsIndex().data;
  const recipesOfMenu = (menuId: string) => menuIndex?.get(menuId) ?? [];

  const overhead = (ohEntries.data ?? []).filter((e) => e.kind === 'gider' && e.category_code !== 'gida_hammadde').reduce((s, e) => s + amountOf(e), 0);
  const ohPeople = (ohOrders.data ?? []).filter((o) => o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0);
  const overheadPP = isFinance && ohPeople > 0 ? overhead / ohPeople : null;

  const [adding, setAdding] = useState(false);
  const planFromOrders = async () => {
    try {
      const n = await plan.mutateAsync({ date, meal });
      toast.ok(n > 0 ? `${n} yemek siparişlerden ve menü planından getirildi` : 'Menüsü belli sipariş bulunamadı — menü planını veya siparişleri kontrol edin');
    } catch (e) { toast.error(e); }
  };

  const grouped = COURSE_ORDER.map((c) => ({ c, list: dayBatches.filter((b) => b.course === c) })).filter((g) => g.list.length > 0);
  const custName = (id: string | null) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '';

  const costReport = (): ReportSpec => ({
    title: `Günlük Maliyet Raporu${fixedMeal ? ' — Kahvaltı' : ''}`,
    subtitle: `${dayLabel(date)} · ${MEALS[meal]} · ${fmtNum(people, 0)} kişi`,
    summary: [
      { label: 'Kişi', value: fmtNum(people, 0) },
      { label: 'Toplam hazırlık', value: fmtMoney(dayCost) },
      { label: 'Kişi başı hammadde', value: perPerson === null ? '—' : fmtMoney(perPerson) },
      ...dayBatches.map((b) => ({ label: b.dish_name ?? '', value: b.cost_per_portion === null ? '—' : `${fmtMoney(b.cost_per_portion)} / porsiyon` })),
    ],
    table: {
      filename: `gunluk-maliyet-${date}-${meal}`,
      header: ['Yemek', 'Kap', 'Porsiyon', 'Toplam ₺', 'Porsiyon ₺', 'Reçeteye göre sapma %'],
      rows: dayBatches.map((b) => [b.dish_name, COURSE_LABELS[b.course as Course], b.portions, b.total_cost, b.cost_per_portion, b.variance_pct]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Kişi', value: fmtNum(people, 0) },
          { label: 'Toplam hazırlık', value: fmtMoney(dayCost) },
          { label: 'Kişi başı hammadde', value: perPerson === null ? '—' : fmtMoney(perPerson) },
          { label: 'Yemek çeşidi', value: dayBatches.length },
        ]} />
        <ReportSection title="Yemekler">
          <table>
            <thead><tr><th>Yemek</th><th>Kap</th><th className="num">Porsiyon</th><th className="num">Toplam</th><th className="num">1 porsiyon</th><th className="num">Sapma</th></tr></thead>
            <tbody>
              {dayBatches.map((b) => (
                <tr key={b.batch_id}><td>{b.dish_name}{b.customer_id ? ` (${custName(b.customer_id)})` : ''}</td><td>{COURSE_LABELS[b.course as Course]}</td>
                  <td className="num">{fmtNum(b.portions, 0)}</td><td className="num">{fmtMoney(b.total_cost)}</td>
                  <td className="num"><b>{fmtMoney(b.cost_per_portion)}</b></td><td className="num">{b.variance_pct === null ? '—' : `${Number(b.variance_pct) > 0 ? '+' : Number(b.variance_pct) < 0 ? '−' : ''}%${fmtNum(Math.abs(Number(b.variance_pct)), 1)}`}</td></tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
        {dayBatches.map((b) => (
          <ReportSection key={b.batch_id} title={`${b.dish_name} — ${fmtNum(b.portions, 0)} porsiyon`}>
            <table>
              <thead><tr><th>Malzeme</th><th className="num">Hazırlanan</th><th className="num">1 porsiyon</th><th className="num">Birim fiyat</th><th className="num">Tutar</th></tr></thead>
              <tbody>
                {(itemsBy.get(b.batch_id!) ?? []).map((it) => (
                  <tr key={it.id}><td>{it.item_name}{it.is_side ? ' (yan)' : ''}</td><td className="num">{fmtNum(it.qty, 3)} {it.unit}</td>
                    <td className="num">{fmtQty(perPortionBase(Number(it.qty), it.unit!, b.portions), it.base_unit)}</td>
                    <td className="num">{fmtMoney(it.unit_price, true)}/{it.unit}</td><td className="num">{fmtMoney(it.line_cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </ReportSection>
        ))}
      </>
    ),
  });

  // Günün malzeme çıkışı: tüm yemeklerdeki aynı malzeme toplanır (depodan çıkış listesi)
  const usage = useMemo(() => {
    const m = new Map<string, { name: string; base: string; qty: number; cost: number; dishes: Set<string>; side: boolean }>();
    for (const b of dayBatches) for (const it of itemsBy.get(b.batch_id!) ?? []) {
      const key = it.ingredient_id ?? `elle:${(it.item_name ?? '').toLowerCase()}|${it.base_unit}`;
      const u = m.get(key) ?? { name: it.item_name ?? '', base: it.base_unit ?? 'g', qty: 0, cost: 0, dishes: new Set<string>(), side: !it.ingredient_id };
      u.qty += Number(it.qty_base ?? 0); u.cost += Number(it.line_cost ?? 0); u.dishes.add(b.dish_name ?? '');
      m.set(key, u);
    }
    return [...m.values()].sort((a, b) => b.cost - a.cost);
  }, [dayBatches, itemsBy]);
  const bigUnit = (qtyBase: number, base: string) => base === 'g' ? `${fmtNum(qtyBase / 1000, 2)} kg` : base === 'ml' ? `${fmtNum(qtyBase / 1000, 2)} lt` : `${fmtNum(qtyBase, 0)} adet`;

  const usageReport = (): ReportSpec => ({
    title: 'Malzeme Çıkış Raporu',
    subtitle: `${dayLabel(date)} · ${MEALS[meal]} · ${fmtNum(people, 0)} kişi · ${dayBatches.length} yemek`,
    summary: usage.slice(0, 25).map((u) => ({ label: u.name, value: bigUnit(u.qty, u.base) })),
    table: {
      filename: `malzeme-cikisi-${date}-${meal}`,
      header: ['Malzeme', 'Miktar', 'Birim', 'Tutar ₺', 'Kullanıldığı yemekler'],
      rows: usage.map((u) => [u.name, u.base === 'adet' ? u.qty : u.qty / 1000, u.base === 'g' ? 'kg' : u.base === 'ml' ? 'lt' : 'adet', Math.round(u.cost * 100) / 100, [...u.dishes].join(', ')]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Malzeme çeşidi', value: usage.length },
          { label: 'Toplam tutar', value: fmtMoney(dayCost) },
          { label: 'Kişi', value: fmtNum(people, 0) },
          { label: 'Kişi başı', value: perPerson === null ? '—' : fmtMoney(perPerson) },
        ]} />
        <ReportSection title="Depodan çıkacak malzemeler (tüm yemekler toplamı)">
          <table>
            <thead><tr><th>Malzeme</th><th className="num">Miktar</th><th className="num">Tutar</th><th>Yemekler</th><th>Teslim</th></tr></thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.name + u.base}><td><b>{u.name}</b>{u.side ? ' (elle)' : ''}</td><td className="num">{bigUnit(u.qty, u.base)}</td>
                  <td className="num">{fmtMoney(u.cost)}</td><td style={{ color: '#4A443C' }}>{[...u.dishes].join(', ')}</td><td>☐</td></tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 28, fontSize: 11 }}>
          <div style={{ borderTop: '1px solid #221F1B', paddingTop: 6 }}>Teslim eden (Depo)</div>
          <div style={{ borderTop: '1px solid #221F1B', paddingTop: 6 }}>Teslim alan (Mutfak)</div>
        </div>
      </>
    ),
  });

  // Hazırlıktaki stok malzemeleri depodan düşülür (aynı yemek ikinci kez düşülmez)
  const issueStock = async () => {
    const done = new Set((issued.data ?? []).map((m) => m.source_id));
    const ingsById = new Map((allIngredients.data ?? []).map((i) => [i.id, i]));
    const rowsOut = dayBatches.filter((b) => !done.has(b.batch_id)).flatMap((b) => mergeByIngredient(((itemsBy.get(b.batch_id!) ?? []).filter((it) => it.ingredient_id).map((it) => {
      const ing = ingsById.get(it.ingredient_id!);
      if (!ing) return null;
      const qty = Number(it.qty) * unitInfo(it.unit!).toBase / unitInfo(ing.stock_unit).toBase;
      return { ingredient_id: ing.id, move_date: date, kind: 'cikis', qty: -Math.round(qty * 1000) / 1000, unit_cost: it.unit_price == null ? null : Number(it.unit_price) * unitInfo(ing.stock_unit).toBase / unitInfo(it.unit!).toBase,
        source: 'hazirlik', source_id: b.batch_id, note: b.dish_name };
    }).filter(Boolean) as Array<{ ingredient_id: string; qty: number; unit_cost: number | null }>))).filter((x) => x.qty < 0) as Record<string, unknown>[];
    if (rowsOut.length === 0) return toast.error('Düşülecek yeni stok malzemesi yok');
    if (!(await confirmStock(`${rowsOut.length} kalem malzeme depodan düşülsün mü?`))) return;
    try { await stockOut.mutateAsync({ rows: rowsOut }); await issued.refetch(); toast.ok('Malzemeler stoktan düşüldü'); } catch (e) { toast.error(e); }
  };
  const allIssued = dayBatches.length > 0 && dayBatches.every((b) => (issued.data ?? []).some((m) => m.source_id === b.batch_id));

  const emptyWithRecipe = dayBatches.filter((b) => b.recipe_id && (b.item_count ?? 0) === 0 && b.portions);
  const fillAllFromRecipes = async () => {
    try {
      let n = 0;
      for (const b of emptyWithRecipe) n += await fillAll.mutateAsync(b.batch_id!);
      toast.ok(`${emptyWithRecipe.length} yemeğe reçeteden ${n} malzeme eklendi — gerçek miktarları düzeltin`);
    } catch (e) { toast.error(e); }
  };

  const orderReport = (): ReportSpec => {
    const stations = (Object.keys(STATION_LABELS) as Station[]).map((st) => ({ st, list: dayBatches.filter((b) => stationOf(b.course!) === st) })).filter((x) => x.list.length);
    return {
      title: 'Üretim Emri',
      subtitle: `${dayLabel(date)} · ${MEALS[meal]} · ${fmtNum(people, 0)} kişi`,
      summary: dayBatches.map((b) => ({ label: b.dish_name ?? '', value: `${fmtNum(b.portions, 0)} porsiyon` })),
      body: () => (
        <>
          <ReportSection title="Firma bazında kişi sayısı">
            <table>
              <thead><tr><th>Firma</th><th>Menü</th><th className="num">Kişi</th></tr></thead>
              <tbody>
                {mealOrders.map((o: MealOrder) => {
                  const mid = effectiveMenu(plans.data ?? [], date, meal, o.customer_id, o.menu_id);
                  return <tr key={o.id}><td>{custName(o.customer_id)}</td><td>{(menus.data ?? []).find((m) => m.menu_id === mid)?.name ?? '—'}</td><td className="num">{fmtNum(orderPeople(o), 0)}</td></tr>;
                })}
              </tbody>
            </table>
          </ReportSection>
          {stations.map(({ st, list }) => (
            <ReportSection key={st} title={STATION_LABELS[st]}>
              {list.map((b) => (
                <div key={b.batch_id} className="mb-3">
                  <div className="font-semibold mb-1">{b.dish_name} — {fmtNum(b.portions, 0)} porsiyon</div>
                  <table>
                    <thead><tr><th>Malzeme</th><th className="num">Çıkılacak miktar</th><th className="num">1 porsiyon</th><th>Kontrol</th></tr></thead>
                    <tbody>
                      {(itemsBy.get(b.batch_id!) ?? []).map((it) => (
                        <tr key={it.id}><td>{it.item_name}</td><td className="num">{fmtNum(it.qty, 3)} {it.unit}</td>
                          <td className="num">{fmtQty(perPortionBase(Number(it.qty), it.unit!, b.portions), it.base_unit)}</td><td>☐</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </ReportSection>
          ))}
        </>
      ),
    };
  };

  return (
    <>
      <ModuleHero
        kicker={kicker ?? 'Mutfak · Günlük hazırlık'}
        title={title ?? 'Günlük Hazırlık & Maliyet'}
        description="Her yemeğe o gün hazırladığınız toplam miktarı girin; siparişlerdeki kişi sayısına bölünerek 1 porsiyonun gramajı ve maliyeti çıkar. Tartım gerekmez."
        actions={<>
          <ReportButton spec={orderReport} label="Üretim emri" disabled={dayBatches.length === 0} />
          <ReportButton spec={usageReport} label="Malzeme çıkışı" disabled={usage.length === 0} />
          <ReportButton spec={costReport} label="Maliyet raporu" disabled={dayBatches.length === 0} />
        </>}
        stats={[
          { label: `${MEALS[meal]} · kişi`, value: fmtNum(people, 0), hint: `${mealOrders.length} sipariş` },
          { label: 'Hazırlık maliyeti', value: <Money value={dayCost} />, hint: `${dayBatches.length} yemek` },
          { label: 'Kişi başı hammadde', value: perPerson === null ? '—' : <Money value={perPerson} />,
            hint: todayPP > 0 && prev ? <Delta pct={((todayPP - prev.pp) / prev.pp) * 100} delta={todayPP - prev.pp} goodWhen="down" /> : 'önceki günle kıyas' },
          isFinance
            ? { label: 'Kişi başı tam maliyet', value: perPerson === null || overheadPP === null ? '—' : <Money value={perPerson + overheadPP} />,
                hint: overheadPP === null ? 'gider kaydı yok' : <>+ genel gider <Money value={overheadPP} /></> }
            : { label: 'Eksik fiyat', value: dayBatches.reduce((s, b) => s + (b.missing_price_count ?? 0), 0) },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
        <DateNav value={date} onChange={setDate} />
        {!fixedMeal && (
          <Tabs value={meal} onChange={setMeal} items={Object.entries(MEALS).filter(([k]) => k !== 'kahvalti').map(([id, label]) => ({
            id, label, count: all.filter((b) => b.prep_date === date && b.meal === id).length || undefined,
          }))} />
        )}
      </div>

      {(recipes.data ?? []).length === 0 && (menus.data ?? []).length === 0 && !recipes.isLoading && (
        <div className="mb-4"><Hint action={<Link to="/menuler/plan" className="text-sm font-semibold text-brand whitespace-nowrap">Menü planı →</Link>}>
          Reçete şart değil: “Yemek ekle” ile başlayıp malzemeleri çalışırken girebilirsiniz. Menü planı ve siparişler varsa yemekler kendiliğinden gelir.
        </Hint></div>
      )}

      <div className="grid xl:grid-cols-[1fr_320px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<ListRestart className="w-4 h-4" />} onClick={planFromOrders} loading={plan.isPending}>Siparişlerden getir</Button>
              <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Yemek ekle</Button>
              {emptyWithRecipe.length > 0 && (
                <Button variant="holo" icon={<WandSparkles className="w-4 h-4" />} onClick={fillAllFromRecipes} loading={fillAll.isPending}
                  title="İçeriği boş ve reçetesi olan yemeklere reçete × porsiyon kadar malzeme önerisi ekler">
                  Boşları reçeteden doldur ({emptyWithRecipe.length})
                </Button>
              )}
              {dayBatches.length > 0 && (allIssued
                ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ok px-2"><PackageMinus className="w-4 h-4" />Stoktan düşüldü</span>
                : <Button icon={<PackageMinus className="w-4 h-4" />} onClick={issueStock} loading={stockOut.isPending} title="Hazırlıktaki stok malzemelerini depodan düşer">Stoktan düş</Button>)}
            </div>
          )}
          {adding && (
            <NewDishForm defaultPortions={people || null} recipes={(recipes.data ?? []).map((r) => ({ id: r.recipe_id!, name: r.name ?? '', category: r.category_code ?? '' }))}
              customers={(customers.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
              onCancel={() => setAdding(false)}
              onSave={async (d) => {
                try {
                  await saveBatch.mutateAsync({ id: null, draft: { prep_date: date, meal, ...d, portions_source: 'elle' } });
                  setAdding(false); toast.ok('Yemek eklendi — şimdi içerik ekleyin');
                } catch (e) { toast.error(e); }
              }} saving={saveBatch.isPending} />
          )}

          {batches.isLoading ? <Loading /> : batches.error ? <ErrorNote>Hazırlık kayıtları yüklenemedi.</ErrorNote>
            : dayBatches.length === 0 ? (
              <div className="tc-card">
                <EmptyState icon={<ChefHat className="w-5 h-5" />} title={`${dayLabel(date)} · ${MEALS[meal]} için hazırlık yok`}
                  action={canEdit && <div className="flex gap-2 justify-center">
                    <Button onClick={planFromOrders} loading={plan.isPending}>Siparişlerden getir</Button>
                    <Button variant="primary" onClick={() => setAdding(true)}>Yemek ekle</Button></div>}>
                  Menü planı ve siparişler girildiyse yemek başlıkları kişi sayılarıyla gelir; değilse elle ekleyin.
                </EmptyState>
              </div>
            ) : grouped.map(({ c, list }) => (
              <section key={c}>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-2">{COURSE_LABELS[c]}</h2>
                <div className="space-y-3">
                  {list.map((b) => <BatchCard key={b.batch_id} b={b} items={itemsBy.get(b.batch_id!) ?? []} canEdit={canEdit} customer={custName(b.customer_id)} people={people} />)}
                </div>
              </section>
            ))}
        </div>

        <aside className="space-y-4">
          <Panel title="Kişi başı hammadde" subtitle={`Son ${TREND_DAYS} gün · ${MEALS[meal]}`}>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="tc-num text-2xl font-bold text-ink">{todayPP > 0 ? <Money value={todayPP} /> : '—'}</div>
                <div className="text-[11px] text-ink-3">{shortDay(date)}</div>
              </div>
              {todayPP > 0 && prev && <Delta pct={((todayPP - prev.pp) / prev.pp) * 100} delta={todayPP - prev.pp} goodWhen="down" />}
            </div>
            <SparkBars series={series.map((x) => x.pp)} labels={series.map((x) => shortDay(x.d))} className="h-16" />
          </Panel>

          <Panel title="Menü başı maliyet" subtitle="Bugün gerçekleşen (hazırlıktan)">
            {menuServed.length === 0 ? <p className="text-sm text-ink-3">Bu öğünde menüsü belli sipariş yok.</p> : (
              <ul className="space-y-3">
                {menuServed.map(({ menu, ppl }) => {
                  const cost = (menu?.menu_id ? recipesOfMenu(menu.menu_id) : []).reduce((s, x) => s + Number(byRecipe.get(x.recipe)?.cost_per_portion ?? 0) * x.factor, 0);
                  return (
                    <li key={menu?.menu_id ?? 'x'}>
                      <div className="flex justify-between text-sm"><span className="font-medium text-ink truncate">{menu?.name ?? 'Menü'}</span><Money value={cost} className="font-semibold" /></div>
                      <div className="flex justify-between text-[11px] text-ink-3 mt-0.5"><span>{fmtNum(ppl, 0)} kişi</span><span>reçeteye göre <Money value={menu?.cost_last} /></span></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {isFinance && overheadPP !== null && (
            <Panel title="Genel gider payı" subtitle="Son 30 gün: hammadde dışı giderler ÷ kişi">
              <div className="flex justify-between text-sm"><span className="text-ink-3">Kişi başı</span><Money value={overheadPP} className="font-semibold" /></div>
              <Link to="/finans" className="block text-xs font-semibold text-brand mt-3">Finans özetinde ayrıntı →</Link>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );

}

// ---------------------------------------------------------------------------- Yeni yemek
function NewDishForm({ defaultPortions, recipes, customers, onSave, onCancel, saving }: {
  defaultPortions: number | null; recipes: Array<{ id: string; name: string; category: string }>; customers: Array<{ id: string; name: string }>;
  onSave: (d: { dish_name: string; recipe_id: string | null; course: string; portions: number | null; customer_id: string | null }) => void;
  onCancel: () => void; saving: boolean;
}) {
  const [name, setName] = useState('');
  const [course, setCourse] = useState<Course>('ana');
  const [portions, setPortions] = useState(defaultPortions ? String(defaultPortions) : '');
  const [customer, setCustomer] = useState('');
  const match = recipes.find((r) => r.name.toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr'));
  return (
    <div className="tc-card p-4">
      <div className="grid sm:grid-cols-[1.6fr_1fr_0.7fr_1fr_auto] gap-2 items-end">
        <label className="block">
          <span className="block text-xs font-semibold text-ink-2 mb-1.5">Yemek adı</span>
          <input className="tc-input" list="tc-recipe-names" value={name} onChange={(e) => setName(e.target.value)} placeholder="Yazın veya listeden seçin" autoFocus />
          <datalist id="tc-recipe-names">{recipes.map((r) => <option key={r.id} value={r.name} />)}</datalist>
          <span className="block text-[11px] mt-1 text-ink-3">{match ? 'Kayıtlı reçeteye bağlanacak' : name.trim() ? 'Yeni yemek — içerik girdikten sonra reçete olarak kaydedebilirsiniz' : ' '}</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ink-2 mb-1.5">Kap</span>
          <select className="tc-input" value={course} onChange={(e) => setCourse(e.target.value as Course)}>
            {COURSE_ORDER.map((c) => <option key={c} value={c}>{COURSE_LABELS[c]}</option>)}
          </select>
          <span className="block text-[11px] mt-1">&nbsp;</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ink-2 mb-1.5">Porsiyon</span>
          <input className="tc-input tc-num" inputMode="numeric" value={portions} onChange={(e) => setPortions(e.target.value)} />
          <span className="block text-[11px] mt-1 text-ink-3">{defaultPortions ? 'siparişlerden' : ' '}</span>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-ink-2 mb-1.5">Firma (ops.)</span>
          <select className="tc-input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Tüm firmalar</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="block text-[11px] mt-1">&nbsp;</span>
        </label>
        <div className="flex gap-2 pb-5">
          <Button onClick={onCancel}>Vazgeç</Button>
          <Button variant="holo" loading={saving} disabled={!name.trim()}
            onClick={() => onSave({ dish_name: name.trim(), recipe_id: match?.id ?? null, course, portions: parseNum(portions), customer_id: customer || null })}>Ekle</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- Yemek kartı
function BatchCard({ b, items, canEdit, customer, people }: { b: PrepBatchCost; items: PrepItem[]; canEdit: boolean; customer: string; people: number }) {
  const toast = useToast();
  const [open, setOpen] = useState(b.status !== 'kapandi');
  const saveBatch = useSaveBatch();
  const delBatch = useDeleteBatch();
  const fill = useFillFromRecipe();
  const toRecipe = useRecipeFromPrep();
  const saveItem = useSaveItem();
  const delItem = useDeleteItem();
  const id = b.batch_id!;
  const variance = b.variance_pct === null ? null : Number(b.variance_pct);

  return (
    <div className="tc-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line">
        <button type="button" onClick={() => setOpen(!open)} className="p-1 -ml-1 text-ink-3 hover:text-ink" aria-label={open ? 'Daralt' : 'Genişlet'}>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink">{b.dish_name}</span>
            {b.recipe_id ? <Link to={`/receteler/${b.recipe_id}`} className="text-[11px] font-semibold text-brand">reçete →</Link> : <Pill tone="accent">reçetesiz</Pill>}
            {customer && <Pill tone="info">{customer}</Pill>}
            {b.portions_source === 'siparis' && <Pill>siparişten</Pill>}
          </div>
          <div className="text-[11px] text-ink-3 mt-0.5">{b.item_count} malzeme · toplam <Money value={b.total_cost} />{Number(b.side_cost) > 0 && <> · yan <Money value={b.side_cost} /></>}</div>
        </div>
        <div className="flex items-center gap-2 ml-7 sm:ml-0">
          <span className="text-[11px] text-ink-3">porsiyon</span>
          <NumCell label="Porsiyon" className="!w-24" value={b.portions} disabled={!canEdit} allowEmpty placeholder={people ? String(people) : '—'}
            onCommit={(v) => saveBatch.mutate({ id, draft: { portions: v, portions_source: 'elle' } }, { onError: toast.error })} />
        </div>
        <div className="text-right min-w-[110px]">
          <div className="text-[10px] text-ink-3">1 porsiyon</div>
          <Money value={b.cost_per_portion} className="text-lg font-bold text-ink" />
          {variance !== null && (
            <div className={cx('text-[10px] font-semibold', Math.abs(variance) <= 5 ? 'text-ok' : variance > 0 ? 'text-stop' : 'text-wait')}>
              reçeteye göre {variance > 0 ? '+' : variance < 0 ? '−' : ''}%{fmtNum(Math.abs(variance), 1)}
            </div>
          )}
        </div>
        {canEdit ? (
          <select className="tc-input !w-auto !py-1.5 text-xs" value={b.status ?? 'taslak'} aria-label="Durum"
            onChange={(e) => saveBatch.mutate({ id, draft: { status: e.target.value } }, { onError: toast.error })}>
            {Object.entries(PREP_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        ) : <Pill tone={PREP_STATUS[b.status ?? 'taslak'].tone}>{PREP_STATUS[b.status ?? 'taslak'].label}</Pill>}
      </div>

      {open && (
        <>
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2 font-semibold">Malzeme</th>
                  <th className="px-2 py-2 font-semibold w-28 text-right">Hazırlanan</th>
                  <th className="px-2 py-2 font-semibold w-24">Birim</th>
                  <th className="px-2 py-2 font-semibold text-right">1 porsiyon</th>
                  <th className="px-2 py-2 font-semibold text-right w-28">Birim fiyat</th>
                  <th className="px-2 py-2 font-semibold text-right">Tutar</th>
                  <th className="px-2 py-2 font-semibold text-center w-12">Yan</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const pp = perPortionBase(Number(it.qty), it.unit!, b.portions);
                  const units = STOCK_UNITS.filter((u) => u.base === unitInfo(it.unit!).base);
                  return (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium text-ink">{it.item_name}</div>
                        <div className="text-[10px] text-ink-3">
                          {it.ingredient_id ? 'stoktan' : 'elle'}
                          {it.planned_qty !== null && <> · reçete önerisi {fmtNum(it.planned_qty, 3)} {it.unit}</>}
                        </div>
                      </td>
                      <td className="px-2 py-2"><NumCell label="Miktar" value={it.qty} disabled={!canEdit}
                        onCommit={(v) => v && v > 0 && saveItem.mutate({ id: it.id!, draft: { qty: v } }, { onError: toast.error })} /></td>
                      <td className="px-2 py-2">
                        <select className="tc-input !py-1.5 !px-2" value={it.unit!} disabled={!canEdit} aria-label="Birim"
                          onChange={(e) => {
                            // Birim değişince fiyat yeniden hesaplansın (stok malzemesinde), miktar aynı büyüklükte kalsın
                            const from = unitInfo(it.unit!), to = unitInfo(e.target.value);
                            const qty = Number(it.qty) * from.toBase / to.toBase;
                            saveItem.mutate({ id: it.id!, draft: { unit: e.target.value, qty, unit_price: it.ingredient_id ? null : Number(it.unit_price) * to.toBase / from.toBase } }, { onError: toast.error });
                          }}>
                          {units.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-right tc-num text-ink-2 whitespace-nowrap">{fmtQty(pp, it.base_unit)}</td>
                      <td className="px-2 py-2">
                        {it.ingredient_id
                          ? <div className="text-right text-xs text-ink-2 whitespace-nowrap">{it.unit_price === null ? <Pill tone="wait">fiyat yok</Pill> : <><Money value={it.unit_price} precise />/{it.unit}</>}</div>
                          : <NumCell label="Birim fiyat" value={it.unit_price} disabled={!canEdit}
                              onCommit={(v) => v !== null && saveItem.mutate({ id: it.id!, draft: { unit_price: v } }, { onError: toast.error })} />}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold whitespace-nowrap"><Money value={it.line_cost} /></td>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={!!it.is_side} disabled={!canEdit} aria-label="Yan malzeme" className="accent-[var(--tc-brand)]"
                          onChange={(e) => saveItem.mutate({ id: it.id!, draft: { is_side: e.target.checked } }, { onError: toast.error })} />
                      </td>
                      <td className="pr-3">
                        {canEdit && <button type="button" className="p-1.5 rounded-lg text-ink-3 hover:text-stop hover:bg-stop-soft" aria-label="Malzemeyi kaldır"
                          onClick={() => delItem.mutate(it.id!, { onError: toast.error })}><X className="w-4 h-4" /></button>}
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-5 text-center text-sm text-ink-3">
                    Henüz içerik yok. {b.recipe_id ? '“Reçeteden doldur” ile öneri alın ya da ' : ''}aşağıdan malzeme ekleyin.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <>
              <AddItemRow batchId={id} />
              <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-line bg-surface-2/50">
                {b.recipe_id && (
                  <Button size="sm" icon={<Wand2 className="w-3.5 h-3.5" />} loading={fill.isPending}
                    onClick={() => fill.mutate(id, { onSuccess: (n) => toast.ok(n ? `${n} malzeme reçeteden geldi` : 'Reçete önerileri güncellendi'), onError: toast.error })}>Reçeteden doldur</Button>
                )}
                {items.some((i) => i.ingredient_id) && b.portions && (
                  <Button size="sm" icon={<BookmarkPlus className="w-3.5 h-3.5" />} loading={toRecipe.isPending}
                    onClick={() => void askConfirm(b.recipe_id
                      ? 'Bağlı reçetenin gramajları bu hazırlığa göre güncellensin mi? (1 porsiyon = hazırlanan ÷ porsiyon)'
                      : `“${b.dish_name}” reçete olarak kaydedilsin mi? (1 porsiyon = hazırlanan ÷ porsiyon)`)
                      .then((ok) => ok && toRecipe.mutate(id, { onSuccess: () => toast.ok('Reçete kaydedildi'), onError: toast.error }))}>
                    {b.recipe_id ? 'Reçeteyi bu hazırlığa göre güncelle' : 'Reçete olarak kaydet'}
                  </Button>
                )}
                <Button size="sm" variant="danger" className="ml-auto" icon={<Trash2 className="w-3.5 h-3.5" />} loading={delBatch.isPending}
                  onClick={() => void askConfirm(`“${b.dish_name}” hazırlığı silinsin mi?`).then((ok) => ok && delBatch.mutate(id, { onSuccess: () => toast.ok('Silindi'), onError: toast.error }))}>Sil</Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AddItemRow({ batchId }: { batchId: string }) {
  const toast = useToast();
  const ingredients = useIngredients();
  const save = useSaveItem();
  const [mode, setMode] = useState<'stok' | 'elle'>('stok');
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [side, setSide] = useState(false);
  const list = (ingredients.data ?? []).filter((i) => i.active);
  const ing: Ingredient | undefined = list.find((i) => i.name.toLocaleLowerCase('tr') === name.trim().toLocaleLowerCase('tr'));
  const units = mode === 'stok' && ing ? STOCK_UNITS.filter((u) => u.base === unitInfo(ing.stock_unit).base) : STOCK_UNITS;

  const add = async () => {
    const q = parseNum(qty);
    if (!name.trim()) return toast.error('Malzeme adı yazın');
    if (q === null || q <= 0) return toast.error('Miktar girin');
    if (mode === 'stok' && !ing) return toast.error('Listede yok — “Elle” seçip fiyatıyla girin veya Hammaddeler’e ekleyin');
    const p = parseNum(price);
    if (mode === 'elle' && (p === null || p < 0)) return toast.error('Elle girilen malzemenin birim fiyatı zorunlu');
    try {
      await save.mutateAsync({ id: null, draft: mode === 'stok'
        ? { batch_id: batchId, ingredient_id: ing!.id, qty: q, unit: units.some((u) => u.code === unit) ? unit : ing!.stock_unit, is_side: side }
        : { batch_id: batchId, manual_name: name.trim(), qty: q, unit, unit_price: p, is_side: side } });
      setName(''); setQty(''); setPrice(''); setSide(false);
    } catch (e) { toast.error(e); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-line">
      <div className="flex p-0.5 rounded-xl bg-surface-2 ring-1 ring-line text-xs font-semibold">
        {(['stok', 'elle'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={cx('px-2.5 py-1.5 rounded-lg', mode === m ? 'bg-card text-ink shadow-sm' : 'text-ink-3')}>{m === 'stok' ? 'Stoktan' : 'Elle'}</button>
        ))}
      </div>
      <input className="tc-input flex-1 min-w-[180px]" list={mode === 'stok' ? `tc-ing-${batchId}` : undefined} value={name}
        placeholder={mode === 'stok' ? 'Malzeme ara (ör. kuşbaşı)…' : 'Malzeme adı (ör. maydanoz demeti)'}
        onChange={(e) => {
          setName(e.target.value);
          const m = list.find((i) => i.name.toLocaleLowerCase('tr') === e.target.value.trim().toLocaleLowerCase('tr'));
          if (m) setUnit(m.stock_unit);
        }} aria-label="Malzeme" />
      {mode === 'stok' && <datalist id={`tc-ing-${batchId}`}>{list.map((i) => <option key={i.id} value={i.name}>{i.stock_unit}{i.last_price ? ` · ${fmtMoney(i.last_price)}` : ''}</option>)}</datalist>}
      <input className="tc-input tc-num !w-24" inputMode="decimal" placeholder="Miktar" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Miktar"
        onKeyDown={(e) => { if (e.key === 'Enter') void add(); }} />
      <select className="tc-input !w-20" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Birim">
        {units.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
      </select>
      {mode === 'elle' && (
        <input className="tc-input tc-num !w-28" inputMode="decimal" placeholder={`₺ / ${unit}`} value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Birim fiyat" />
      )}
      <label className="flex items-center gap-1.5 text-xs text-ink-2">
        <input type="checkbox" checked={side} onChange={(e) => setSide(e.target.checked)} className="accent-[var(--tc-brand)]" /> yan malzeme
      </label>
      <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={add} loading={save.isPending}>İçerik ekle</Button>
    </div>
  );
}
