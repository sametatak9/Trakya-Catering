import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [tab, setTab] = useState<'ihtiyac' | 'fiyat' | 'siparis'>('ihtiyac');
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
  const insertMoves = useInsertRows('stock_movements', ['ingredients']);
  const saveQuote = useSaveRow('supplier_quotes');
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
    if (bySup.size === 0) return toast.error('Tedarikçi fiyatı olan kalem yok. “En uygun fiyat” sekmesinden fiyat kaydı girin.');
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
      // Tek kapı: bu siparişe bağlı fatura malı zaten stoğa soktuysa o kalemler tekrar girmez
      const invs = unwrap(await supabase.from('purchase_invoices').select('id').eq('purchase_order_id', po.id));
      const viaInvoice = invs.length ? unwrap(await supabase.from('stock_movements').select('ingredient_id').eq('source', 'fatura').in('source_id', invs.map((x) => x.id))) : [];
      const skip = new Set(viaInvoice.map((m) => m.ingredient_id));
      const rows = mergeByIngredient(lines.map((l) => ({ ingredient_id: l.ingredient_id, qty: Number(l.qty), unit_cost: l.unit_price })))
        .filter((l) => !skip.has(l.ingredient_id))
        .map((l) => ({ ...l, move_date: today, kind: 'giris', source: 'siparis', source_id: po.id, supplier_id: po.supplier_id, note: supName(po.supplier_id) }));
      if (rows.length) await insertMoves.mutateAsync({ rows });
      await savePo.mutateAsync({ id: po.id, row: { status: 'teslim', delivery_date: today } });
      toast.ok(skip.size ? `Stoğa girdi (${skip.size} kalem faturayla zaten girmişti)` : 'Stoğa girdi; fatura gelince Gelen Faturalar’da bu siparişe bağlayın');
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
          {canEdit && tab === 'ihtiyac' && <Button variant="primary" icon={<ShoppingCart className="w-4 h-4" />} onClick={createOrders} loading={insertPos.isPending}>Sipariş taslağı oluştur</Button>}
        </>}
        stats={[
          { label: 'Alınacak tutar', value: <Money value={buyTotal} />, source: report },
          { label: 'Kişi-öğün (plan)', value: fmtNum(people, 0), hint: `${shortDay(from)} – ${shortDay(to)}` },
          { label: 'En uygun seçimle tasarruf', value: <Money value={saving} />, tone: saving > 0 ? 'good' : 'default' },
          { label: 'Açık sipariş', value: (pos.data ?? []).filter((p) => p.status === 'taslak' || p.status === 'verildi').length },
        ]} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Tabs value={tab} onChange={setTab} items={[{ id: 'ihtiyac', label: 'Aylık ihtiyaç' }, { id: 'fiyat', label: 'En uygun fiyat' }, { id: 'siparis', label: 'Siparişler', count: (pos.data ?? []).length }]} />
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

      {tab === 'fiyat' && (
        <Panel pad={false} title="Tedarikçi fiyatları (son 60 gün)" subtitle="Her kalemde en düşük fiyat kupa ile işaretli; tedarikçi logları buradan izlenir"
          action={canEdit && <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddingQuote(true)}>Fiyat kaydı</Button>}>
          {(quotes.data ?? []).length === 0 ? <EmptyState title="Fiyat kaydı yok">Tedarikçiden aldığınız teklifleri, telefon fiyatlarını veya fatura fiyatlarını girin; en uygun olanı sistem seçer.</EmptyState> : (
            <ul className="divide-y divide-line">
              {[...best.entries()].filter(([id]) => ing(id) && matches(q, ing(id)!.name)).map(([id, b]) => (
                <li key={id} className="px-4 py-3">
                  <div className="font-semibold text-ink">{ing(id)!.name} <span className="text-xs text-ink-3 font-normal">/ {ing(id)!.stock_unit}</span></div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {(quotes.data ?? []).filter((x) => x.ingredient_id === id).sort((a, c) => Number(a.price) - Number(c.price)).slice(0, 6).map((x) => (
                      <span key={x.id} className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ring-1', x.supplier_id === b.best.supplier_id && Number(x.price) === Number(b.best.price) ? 'ring-accent bg-accent-soft font-semibold' : 'ring-line')}>
                        {x.supplier_id === b.best.supplier_id && Number(x.price) === Number(b.best.price) && <Trophy className="w-3 h-3 text-accent-strong" />}
                        {supName(x.supplier_id)} · <Money value={x.price} precise /> · {shortDay(x.quoted_at)}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

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
