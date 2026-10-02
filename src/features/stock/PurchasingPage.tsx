import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Plus, ShoppingCart, Trophy } from 'lucide-react';
import { useCan } from '@/app/session';
import { useInsertRows, useRows, useSaveRow } from '@/lib/crud';
import { addDays, monthKey, monthLabel, monthRange, shortDay, todayISO } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';
import { bestQuotes, mergeByIngredient, needsFromPlan, stockLevels, type PlanSlot } from '@/lib/stock';
import { supabase, unwrap } from '@/lib/supabase';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { MonthNav } from '@/ui/bits';
import { askConfirm } from '@/ui/confirm';
import { FormDrawer } from '@/ui/FormDrawer';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { Button, EmptyState, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients } from '../kitchen/api';
import { effectiveMenu, useMenuItemsIndex, useMenuPlans } from '../production/api';
import { orderPeople, useCustomers, useOrders } from '../sales/api';
import { useStockMoves } from './StockPage';
import { LastMonthPanel, PriceVariancePanel, RequestActions } from './purchasingPanels';

interface Line { ingredient_id: string; qty: number; unit_price: number }
const PO_STATUS: Record<string, { label: string; tone: 'idle' | 'info' | 'ok' | 'stop' }> = {
  taslak: { label: 'Taslak', tone: 'idle' }, verildi: { label: 'Sipariş verildi', tone: 'info' }, teslim: { label: 'Teslim alındı', tone: 'ok' }, iptal: { label: 'İptal', tone: 'stop' },
};

/**
 * Satınalma: menü planı belli olduğu için neyden ne kadar alınacağı da bellidir.
 * İhtiyaç = Σ (gün × öğün × firma: kişi × menüdeki yemek katsayısı × reçete brüt miktarı) − eldeki stok.
 */
export function PurchasingPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'satinalma']);
  const today = todayISO();
  const [month, setMonth] = useState(() => monthKey(today));
  const { from: mFrom, to } = monthRange(month);
  const from = mFrom < today ? today : mFrom;
  const [tab, setTab] = useState<'ihtiyac' | 'gecen' | 'siparis' | 'sapma'>('ihtiyac');
  const [q, setQ] = useState('');

  const ingredients = useIngredients();
  const plans = useMenuPlans(from, to);
  const index = useMenuItemsIndex();
  const customers = useCustomers();
  const orders = useOrders(addDays(today, -28), to);
  const moves = useStockMoves();
  const suppliers = useRows('suppliers', { order: 'name' });
  const quotes = useRows('supplier_quotes', { key: ['recent'], filter: (x) => x.gte('quoted_at', addDays(today, -60)) });
  const pos = useRows('purchase_orders', { order: 'order_date', ascending: false });
  const recipeLines = useQuery({
    queryKey: ['recipe_lines', 'all'],
    queryFn: async () => unwrap(await supabase.from('v_recipe_lines').select('recipe_id, ingredient_id, gross_stock_qty')),
  });
  const savePo = useSaveRow('purchase_orders');
  const insertPos = useInsertRows('purchase_orders');
    const saveQuote = useSaveRow('supplier_quotes');
  const qc = useQueryClient();
  const [addingQuote, setAddingQuote] = useState(false);

  const ings = (ingredients.data ?? []).filter((i) => i.active);
  const ing = (id: string) => ings.find((i) => i.id === id);
  const supName = (id: string) => (suppliers.data ?? []).find((s) => s.id === id)?.name ?? '—';

  // Beklenen kişi: o güne sipariş varsa sipariş, yoksa firmanın son 4 haftalık aynı öğün ortalaması
  const slots = useMemo<PlanSlot[]>(() => {
    const out: PlanSlot[] = [];
    const ords = (orders.data ?? []).filter((o) => o.status !== 'iptal');
    const past = ords.filter((o) => o.service_date < today);
    const custs = (customers.data ?? []).filter((c) => c.active);
    const meals = [...new Set((plans.data ?? []).map((p) => p.meal))];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      for (const meal of meals) {
        for (const c of custs) {
          const order = ords.find((o) => o.service_date === d && o.meal === meal && o.customer_id === c.id);
          let people = order ? orderPeople(order) : 0;
          if (!order) {
            const hist = past.filter((o) => o.customer_id === c.id && o.meal === meal);
            const days = new Set(hist.map((o) => o.service_date)).size;
            people = days ? Math.round(hist.reduce((s, o) => s + orderPeople(o), 0) / days) : 0;
          }
          if (people <= 0) continue;
          const menu = effectiveMenu(plans.data ?? [], d, meal, c.id, order?.menu_id ?? null);
          if (menu) out.push({ date: d, meal, menu_id: menu, people });
        }
      }
    }
    return out;
  }, [orders.data, customers.data, plans.data, from, to, today]);

  const menuLines = useMemo(() => [...(index.data?.entries() ?? [])].flatMap(([menu_id, items]) => items.map((it) => ({ menu_id, recipe_id: it.recipe, portion_factor: it.factor }))), [index.data]);
  const need = useMemo(() => needsFromPlan(slots, menuLines, (recipeLines.data ?? []).map((r) => ({ recipe_id: r.recipe_id!, ingredient_id: r.ingredient_id!, gross_stock_qty: Number(r.gross_stock_qty ?? 0) }))), [slots, menuLines, recipeLines.data]);
  const levels = useMemo(() => stockLevels((moves.data ?? []).map((m) => ({ ...m, qty: Number(m.qty) }))), [moves.data]);
  const best = useMemo(() => bestQuotes((quotes.data ?? []).map((x) => ({ ...x, price: Number(x.price) })), today), [quotes.data, today]);

  const rows = [...need.entries()].map(([id, qty]) => {
    const i = ing(id); const onHand = Math.max(levels.get(id) ?? 0, 0);
    const toBuy = Math.max(0, qty - onHand);
    const b = best.get(id);
    const price = b ? Number(b.best.price) : Number(i?.last_price ?? 0);
    return { id, i, qty, onHand, toBuy, price, supplier: b?.best.supplier_id ?? null, saving: b?.runnerUp ? (Number(b.runnerUp.price) - price) * toBuy : 0 };
  }).filter((r) => r.i && matches(q, r.i.name)).sort((a, b) => b.toBuy * b.price - a.toBuy * a.price);
  const buyTotal = rows.reduce((s, r) => s + r.toBuy * r.price, 0);
  const people = slots.reduce((s, x) => s + x.people, 0);
  const saving = rows.reduce((s, r) => s + r.saving, 0);

  const createOrders = async () => {
    const bySup = new Map<string, Line[]>();
    for (const r of rows.filter((x) => x.toBuy > 0 && x.supplier)) bySup.set(r.supplier!, [...(bySup.get(r.supplier!) ?? []), { ingredient_id: r.id, qty: Math.ceil(r.toBuy * 10) / 10, unit_price: r.price }]);
    const noSupplier = rows.filter((x) => x.toBuy > 0 && !x.supplier).length;
    if (bySup.size === 0) return toast.error('Tedarikçi fiyatı olan kalem yok. “Teklif / fiyat kaydı” ile tedarikçi fiyatı girin.');
    if (!(await askConfirm(`${bySup.size} tedarikçiye taslak satınalma siparişi oluşturulsun mu?${noSupplier ? ` (${noSupplier} kalemin tedarikçi fiyatı yok, dışarıda kalır)` : ''}`))) return;
    try {
      await insertPos.mutateAsync({ rows: [...bySup.entries()].map(([supplier_id, lines]) => ({
        supplier_id, order_date: today, status: 'taslak', lines, total: Math.round(lines.reduce((s, l) => s + l.qty * l.unit_price, 0) * 100) / 100,
        note: `${monthLabel(month)} menü planına göre ihtiyaç`,
      })) });
      toast.ok('Taslak siparişler oluşturuldu'); setTab('siparis');
    } catch (e) { toast.error(e); }
  };

  const receive = async (po: NonNullable<typeof pos.data>[number]) => {
    const lines = (po.lines as unknown as Line[]) ?? [];
    if (!(await askConfirm(`${supName(po.supplier_id)} siparişi teslim alındı mı? ${lines.length} kalem stoğa girer.`))) return;
    try {
      // Tek kapı (Faz 3E): her kalem receive_stock ile partiye girer; faturayla zaten girmişse veritabanı eşleştirir, ikinci kez stok eklemez
      let matched = 0;
      for (const l of mergeByIngredient(lines.map((x) => ({ ingredient_id: x.ingredient_id, qty: Number(x.qty), unit_cost: x.unit_price })))) {
        const r = unwrap(await supabase.rpc('receive_stock', { p_ingredient: l.ingredient_id, p_qty: l.qty, p_unit_cost: l.unit_cost ?? undefined, p_source: 'siparis', p_source_id: po.id, p_supplier: po.supplier_id, p_date: today, p_note: supName(po.supplier_id) })) as { durum?: string } | null;
        if (r?.durum === 'eslesti') matched++;
      }
      await Promise.all([qc.invalidateQueries({ queryKey: ['ingredients'] }), qc.invalidateQueries({ queryKey: ['t'] })]);
      await savePo.mutateAsync({ id: po.id, row: { status: 'teslim', delivery_date: today } });
      toast.ok(matched ? `Stoğa girdi (${matched} kalem faturayla zaten girmişti; partiye bağlandı)` : 'Stoğa girdi (tedarikçi etiketli parti açıldı); fatura gelince Gelen Faturalar’da bu siparişe bağlayın');
    } catch (e) { toast.error(e); }
  };

  const report = (): ReportSpec => ({
    title: 'Satınalma İhtiyaç Listesi', subtitle: `${shortDay(from)} – ${shortDay(to)} · menü planı × ${fmtNum(people, 0)} kişi-öğün`,
    summary: rows.filter((r) => r.toBuy > 0).slice(0, 30).map((r) => ({ label: r.i!.name, value: `${fmtNum(r.toBuy, 1)} ${r.i!.stock_unit}${r.supplier ? ` · ${supName(r.supplier)}` : ''}` })),
    table: { filename: `satinalma-${month}`, header: ['Stok kartı', 'İhtiyaç', 'Stokta', 'Alınacak', 'Birim', 'Birim fiyat ₺', 'Tutar ₺', 'En uygun tedarikçi'],
      rows: rows.map((r) => [r.i!.name, Math.round(r.qty * 10) / 10, r.onHand, Math.round(r.toBuy * 10) / 10, r.i!.stock_unit, r.price, Math.round(r.toBuy * r.price), r.supplier ? supName(r.supplier) : '']) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Alınacak tutar', value: fmtMoney(buyTotal) }, { label: 'Kişi-öğün', value: fmtNum(people, 0) }, { label: 'Kalem', value: rows.filter((r) => r.toBuy > 0).length }, { label: 'En uygun seçimle tasarruf', value: fmtMoney(saving) }]} />
        <ReportSection title="Alınacaklar (menü planına göre)">
          <table><thead><tr><th>Stok kartı</th><th className="num">İhtiyaç</th><th className="num">Stokta</th><th className="num">Alınacak</th><th className="num">Tutar</th><th>Tedarikçi</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.id}><td>{r.i!.name}</td><td className="num">{fmtNum(r.qty, 1)} {r.i!.stock_unit}</td><td className="num">{fmtNum(r.onHand, 1)}</td>
              <td className="num"><b>{fmtNum(r.toBuy, 1)}</b></td><td className="num">{fmtMoney(r.toBuy * r.price)}</td><td>{r.supplier ? supName(r.supplier) : '—'}</td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  const loading = ingredients.isLoading || plans.isLoading || index.isLoading || recipeLines.isLoading;

  return (
    <>
      <ModuleHero kicker="Depo · Satınalma" title="Satınalma"
        description="Menü planı ve beklenen kişi sayısından neyden ne kadar alınacağını hesaplar, eldeki stoğu düşer ve her kalem için en uygun tedarikçiyi önerir."
        actions={<>
          <ReportButton spec={report} disabled={rows.length === 0} />
          {canEdit && <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAddingQuote(true)}>Teklif / fiyat kaydı</Button>}
          {canEdit && tab === 'ihtiyac' && <Button variant="primary" icon={<ShoppingCart className="w-4 h-4" />} onClick={createOrders} loading={insertPos.isPending}>Sipariş taslağı oluştur</Button>}
        </>}
        stats={[
          { label: 'Alınacak tutar', value: <Money value={buyTotal} />, source: report },
          { label: 'Kişi-öğün (plan)', value: fmtNum(people, 0), hint: `${shortDay(from)} – ${shortDay(to)}` },
          { label: 'En uygun seçimle tasarruf', value: <Money value={saving} />, tone: saving > 0 ? 'good' : 'default' },
          { label: 'Açık sipariş', value: (pos.data ?? []).filter((p) => p.status === 'taslak' || p.status === 'verildi').length },
        ]} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onChange={setTab} items={[{ id: 'ihtiyac', label: 'Bu ay ihtiyaç' }, { id: 'gecen', label: 'Geçen ay' }, { id: 'siparis', label: 'Talepler & siparişler', count: (pos.data ?? []).length }, { id: 'sapma', label: 'Fiyat sapması' }]} />
        {tab === 'ihtiyac' && <MonthNav value={month} onChange={setMonth} />}
      </div>

      {tab === 'ihtiyac' && (
        <Panel pad={false}>
          <ListToolbar search={q} onSearch={setQ} placeholder="Stok kartı ara…" />
          {loading ? <Loading /> : rows.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="w-5 h-5" />} title="Hesaplanacak ihtiyaç yok">Menü Planı’na menüleri, menülere reçeteleri girin; müşteri siparişleri ya da geçmiş sayılar varsa ihtiyaç kendiliğinden çıkar.</EmptyState>
          ) : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[720px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2.5">Stok kartı</th><th className="px-2 text-right">İhtiyaç</th><th className="px-2 text-right">Stokta</th><th className="px-2 text-right">Alınacak</th><th className="px-2 text-right">Tutar</th><th className="px-4">En uygun</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-ink">{r.i!.name}</td>
                      <td className="px-2 text-right tc-num">{fmtNum(r.qty, 1)} {r.i!.stock_unit}</td>
                      <td className="px-2 text-right tc-num text-ink-3">{fmtNum(r.onHand, 1)}</td>
                      <td className={cx('px-2 text-right tc-num font-bold', r.toBuy > 0 ? 'text-ink' : 'text-ok')}>{r.toBuy > 0 ? fmtNum(r.toBuy, 1) : 'yeterli'}</td>
                      <td className="px-2 text-right"><Money value={r.toBuy * r.price} /></td>
                      <td className="px-4">{r.supplier ? <span className="inline-flex items-center gap-1 text-xs"><Trophy className="w-3.5 h-3.5 text-accent-strong" />{supName(r.supplier)} · <Money value={r.price} precise /></span> : <span className="text-xs text-ink-3">son alış <Money value={r.price} precise /></span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'gecen' && <LastMonthPanel />}
      {tab === 'sapma' && <PriceVariancePanel />}

      {tab === 'siparis' && (
        <Panel pad={false} title="Satınalma siparişleri">
          {(pos.data ?? []).length === 0 ? <EmptyState title="Sipariş yok">“Aylık ihtiyaç” sekmesinden taslak oluşturun.</EmptyState> : (
            <ul className="divide-y divide-line">
              {(pos.data ?? []).map((po) => {
                const lines = (po.lines as unknown as Line[]) ?? [];
                return (
                  <li key={po.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{supName(po.supplier_id)}</span>
                      <Pill tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Pill>
                      <span className="text-xs text-ink-3">{shortDay(po.order_date)} · {lines.length} kalem</span>
                      <Money value={po.total} className="ml-auto font-bold" />
                    </div>
                    <div className="text-xs text-ink-2 mt-1">{lines.map((l) => `${ing(l.ingredient_id)?.name ?? '?'} ${fmtNum(l.qty, 1)} ${ing(l.ingredient_id)?.stock_unit ?? ''}`).join(' · ')}</div>
                    {canEdit && (po.status === 'taslak' || po.status === 'verildi') && (
                      <div className="mt-2">
                        <RequestActions poId={po.id} supplier={(suppliers.data ?? []).find((x) => x.id === po.supplier_id)} date={po.order_date} deliveryDate={po.delivery_date} note={po.note}
                          lines={lines.map((l) => ({ name: ing(l.ingredient_id)?.name ?? '?', qty: Number(l.qty), unit: ing(l.ingredient_id)?.stock_unit ?? '' }))} />
                      </div>
                    )}
                    {canEdit && po.status !== 'teslim' && po.status !== 'iptal' && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {po.status === 'taslak' && <Button size="sm" onClick={() => savePo.mutate({ id: po.id, row: { status: 'verildi' } }, { onError: toast.error })}>Sipariş verildi</Button>}
                        <Button size="sm" variant="holo" icon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => receive(po)}>Teslim alındı → stoğa gir</Button>
                        <Button size="sm" onClick={() => savePo.mutate({ id: po.id, row: { status: 'iptal' } }, { onError: toast.error })}>İptal</Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {addingQuote && (
        <FormDrawer open title="Tedarikçi fiyat kaydı" onClose={() => setAddingQuote(false)} saving={saveQuote.isPending}
          fields={[
            { key: 'supplier_id', label: 'Tedarikçi', type: 'select', required: true, span: 2, options: (suppliers.data ?? []).filter((s) => s.active).map((s) => ({ value: s.id, label: s.name })), hint: 'Listede yoksa Tedarikçiler ekranından ekleyin' },
            { key: 'ingredient_id', label: 'Stok kartı', type: 'select', required: true, span: 2, options: ings.map((i) => ({ value: i.id, label: `${i.name} (${i.stock_unit})` })) },
            { key: 'price', label: 'Fiyat ₺ (stok birimi başına, KDV hariç)', type: 'money', required: true },
            { key: 'quoted_at', label: 'Tarih', type: 'date', required: true },
            { key: 'source', label: 'Kaynak', type: 'select', required: true, options: [{ value: 'teklif', label: 'Yazılı teklif' }, { value: 'telefon', label: 'Telefon' }, { value: 'fatura', label: 'Fatura' }, { value: 'web', label: 'İnternet' }] },
            { key: 'note', label: 'Not' },
          ]}
          initial={{ quoted_at: today, source: 'teklif' }}
          onSave={async (v) => { await saveQuote.mutateAsync({ row: v }); toast.ok('Fiyat kaydedildi'); setAddingQuote(false); }} />
      )}
    </>
  );
}
