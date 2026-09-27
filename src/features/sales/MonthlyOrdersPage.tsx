import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { todayISO } from '@/lib/dates';
import { MEALS, ROLES } from '@/lib/domain';
import { fmtNum } from '@/lib/format';
import { daysOfMonth, gridByCustomerDay, isoDow, standingPreview } from '@/lib/monthGrid';
import { supabase, unwrap } from '@/lib/supabase';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { askConfirm } from '@/ui/confirm';
import { NumCell } from '@/ui/NumCell';
import { Button, EmptyState, Field, Loading, ModuleHero, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useCustomers, useOrders, useSaveOrder } from './api';

const DOW = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const shiftMonth = (p: string, n: number) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); };
const monthLabel = (p: string) => new Date(`${p}-15T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

/** Siparişler › Aylık sipariş (Faz 3D): sürekli sipariş şablonu → ayın siparişleri; gün × firma ızgarasında tek gün düzeltme. */
export function MonthlyOrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const canEdit = useCan(ROLES.orders);
  const [period, setPeriod] = useState(() => shiftMonth(todayISO().slice(0, 7), 1));
  const [meal, setMeal] = useState('ogle');
  const days = daysOfMonth(period);
  const orders = useOrders(days[0], days[days.length - 1]);
  const customers = useCustomers();
  const cms = useRows('customer_menus', { key: ['active'], filter: (q) => q.eq('active', true) });
  const standing = useRows('standing_orders', { key: [period], filter: (q) => q.eq('period', period), order: 'created_at' });
  const saveStanding = useSaveRow('standing_orders');
  const delStanding = useDeleteRow('standing_orders');
  const saveOrder = useSaveOrder();
  const generate = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.rpc('standing_order_generate', { p_id: id })) as number,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['orders'] }), qc.invalidateQueries({ queryKey: ['t', 'standing_orders'] }), qc.invalidateQueries({ queryKey: ['finance'] })]),
  });

  const custName = (id: string) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  const grid = useMemo(() => gridByCustomerDay(orders.data ?? [], meal), [orders.data, meal]);
  const customerIds = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders.data ?? []) if (o.meal === meal && o.status !== 'iptal') s.add(o.customer_id);
    for (const t of standing.data ?? []) if (t.meal === meal) s.add(t.customer_id);
    return [...s].sort((a, b) => custName(a).localeCompare(custName(b), 'tr'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.data, standing.data, meal, customers.data]);

  // ── şablon formu
  const [f, setF] = useState({ customer: '', cm: '', qty: '', wk: ['', '', '', '', '', '', '0'], skip: '' });
  const cmFor = (cid: string) => (cms.data ?? []).filter((c) => c.customer_id === cid && c.meal === meal);
  const addStanding = async () => {
    if (!f.customer) return toast.error('Müşteri seçin');
    const qty = Math.round(Number(f.qty.replace(/\D/g, '')) || 0);
    const weekday: Record<string, number> = {};
    f.wk.forEach((v, i) => { if (v.trim() !== '') weekday[String(i + 1)] = Math.max(0, Math.round(Number(v) || 0)); });
    const skip = f.skip.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => (/^\d{1,2}$/.test(x) ? `${period}-${x.padStart(2, '0')}` : x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
    try {
      await saveStanding.mutateAsync({ row: { customer_id: f.customer, customer_menu_id: f.cm || null, meal, period, default_qty: qty, weekday_qty: weekday, skip_dates: skip } });
      setF({ customer: '', cm: '', qty: '', wk: ['', '', '', '', '', '', '0'], skip: '' });
      toast.ok('Aylık sipariş şablonu eklendi — “Siparişleri üret” ile ayın siparişleri oluşur');
    } catch (e) { toast.error(e); }
  };
  const run = async (id: string, name: string) => {
    if (!(await askConfirm(`${name} · ${monthLabel(period)} için siparişler üretilecek. Var olan siparişler değişmez. Devam edilsin mi?`))) return;
    try { const n = await generate.mutateAsync(id); toast.ok(n ? `${n} gün için sipariş oluştu` : 'Yeni sipariş yok (tüm günler zaten dolu)'); } catch (e) { toast.error(e); }
  };

  // ── ızgarada tek gün düzeltme
  const setCell = async (cid: string, day: string, qty: number | null) => {
    const existing = (orders.data ?? []).filter((o) => o.customer_id === cid && o.service_date === day && o.meal === meal && o.status !== 'iptal');
    try {
      if (existing.length === 1) await saveOrder.mutateAsync({ id: existing[0].id, draft: qty ? { ordered_qty: qty } : { status: 'iptal' } });
      else if (existing.length === 0 && qty) {
        const c = (customers.data ?? []).find((x) => x.id === cid);
        const cm = cmFor(cid).find((x) => x.is_default) ?? null;
        await saveOrder.mutateAsync({ id: null, draft: { service_date: day, meal, customer_id: cid, customer_menu_id: cm?.id ?? null, ordered_qty: qty, unit_price: c?.default_meal_price ?? 0, vat_rate: c?.vat_rate ?? 10, source: 'elle' } });
      } else if (existing.length > 1) toast.error('Bu gün birden çok sipariş var; Günlük sekmesinden düzeltin');
    } catch (e) { toast.error(e); }
  };

  const totalPeople = [...grid.values()].reduce((s, x) => s + x, 0);
  const report = (): ReportSpec => ({
    title: 'Aylık Sipariş Tablosu', subtitle: `${monthLabel(period)} · ${MEALS[meal]}`,
    summary: customerIds.map((cid) => ({ label: custName(cid), value: `${fmtNum(days.reduce((s, d) => s + (grid.get(`${cid}|${d}`) ?? 0), 0), 0)} kişi` })),
    table: { filename: `aylik-siparis-${period}-${meal}`, header: ['Müşteri', ...days.map((d) => d.slice(8)), 'Toplam'],
      rows: customerIds.map((cid) => [custName(cid), ...days.map((d) => grid.get(`${cid}|${d}`) ?? 0), days.reduce((s, d) => s + (grid.get(`${cid}|${d}`) ?? 0), 0)]) },
    body: () => (
      <table>
        <thead><tr><th>Firma</th><th className="num">Gün</th><th className="num">Toplam kişi</th><th className="num">Günlük ort.</th></tr></thead>
        <tbody>{customerIds.map((cid) => {
          const vals = days.map((d) => grid.get(`${cid}|${d}`) ?? 0).filter((x) => x > 0);
          const tot = vals.reduce((a, b) => a + b, 0);
          return <tr key={cid}><td>{custName(cid)}</td><td className="num">{vals.length}</td><td className="num">{fmtNum(tot, 0)}</td><td className="num">{vals.length ? fmtNum(tot / vals.length, 0) : '—'}</td></tr>;
        })}</tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Satış · Aylık sipariş" title="Aylık sipariş"
        description="Her ay aynı sayıda yemek alan firmalar için şablon: varsayılan kişi, hafta günü istisnaları (ör. cumartesi 20, pazar yok) ve atlanacak günler. “Siparişleri üret” ayın tüm günlerine sipariş açar; var olan siparişe dokunmaz. Tek günü ızgarada düzeltin."
        actions={<ReportButton spec={report} disabled={customerIds.length === 0} />}
        stats={[
          { label: 'Şablon', value: (standing.data ?? []).filter((s) => s.meal === meal).length },
          { label: `${MEALS[meal]} · ay toplamı`, value: fmtNum(totalPeople, 0) },
          { label: 'Firma', value: customerIds.length },
        ]} />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-card p-[3px]">
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Önceki ay" onClick={() => setPeriod((p) => shiftMonth(p, -1))}><ChevronLeft className="mx-auto h-4 w-4" /></button>
          <span className="min-w-[128px] px-2 text-center font-display text-[15px] font-bold capitalize">{monthLabel(period)}</span>
          <button type="button" className="h-8 w-8 rounded-lg hover:bg-surface-2" aria-label="Sonraki ay" onClick={() => setPeriod((p) => shiftMonth(p, 1))}><ChevronRight className="mx-auto h-4 w-4" /></button>
        </div>
        <Tabs value={meal} onChange={setMeal} items={Object.entries(MEALS).map(([id, label]) => ({ id, label }))} />
      </div>

      <Panel title="Aylık sipariş şablonları" subtitle={`${monthLabel(period)} · ${MEALS[meal]}`} pad={false}>
        {standing.isLoading ? <Loading /> : (standing.data ?? []).filter((s) => s.meal === meal).length === 0 ? (
          <EmptyState icon={<CalendarPlus className="h-5 w-5" />} title="Şablon yok">Aşağıdan firma ve kişi sayısını girin.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {(standing.data ?? []).filter((s) => s.meal === meal).map((s) => {
              const pv = standingPreview({ default_qty: s.default_qty, weekday_qty: s.weekday_qty as Record<string, number>, skip_dates: s.skip_dates }, period);
              const wk = Object.entries((s.weekday_qty ?? {}) as Record<string, number>).map(([d, q]) => `${DOW[Number(d) - 1]} ${q || 'yok'}`).join(', ');
              const cm = (cms.data ?? []).find((c) => c.id === s.customer_menu_id);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <b className="text-ink">{custName(s.customer_id)}</b>{cm && <span className="text-ink-3"> · {cm.name ?? 'menü tanımı'}</span>}
                    <span className="block text-xs text-ink-3">Günde {s.default_qty} kişi{wk ? ` · ${wk}` : ''}{s.skip_dates?.length ? ` · atla: ${s.skip_dates.map((d) => Number(d.slice(8))).join(', ')}` : ''} · {pv.rows} gün, {fmtNum(pv.people, 0)} kişi</span>
                  </span>
                  {s.status === 'onayli' ? <Pill tone="ok">Üretildi{s.generated_count != null ? ` · ${s.generated_count}` : ''}</Pill> : <Pill>Taslak</Pill>}
                  {canEdit && <Button size="sm" variant="primary" onClick={() => run(s.id, custName(s.customer_id))} loading={generate.isPending}>Siparişleri üret</Button>}
                  {canEdit && <button type="button" className="rounded-lg p-1.5 text-ink-3 hover:bg-stop-soft hover:text-stop" aria-label="Şablonu sil"
                    onClick={async () => { if (await askConfirm('Şablon silinsin mi? Üretilmiş siparişler kalır.')) delStanding.mutate({ id: s.id }, { onError: toast.error }); }}><Trash2 className="h-4 w-4" /></button>}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && (
          <div className="border-t border-line bg-surface-2/60 p-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1.2fr_0.6fr]">
              <Field label="Müşteri"><select className="tc-input" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value, cm: cmFor(e.target.value).find((c) => c.is_default)?.id ?? '' })}>
                <option value="">Seçin…</option>{(customers.data ?? []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
              <Field label="Menü tanımı"><select className="tc-input" value={f.cm} onChange={(e) => setF({ ...f, cm: e.target.value })} disabled={!f.customer}>
                <option value="">Kart fiyatı</option>{cmFor(f.customer).map((c) => <option key={c.id} value={c.id}>{c.name ?? c.menu_type_code ?? 'Menü'}</option>)}</select></Field>
              <Field label="Günlük kişi"><input className="tc-input tc-num" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
            </div>
            <div className="mt-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Hafta günü istisnası (boş = günlük kişi, 0 = yok)</div>
              <div className="grid grid-cols-7 gap-1.5">
                {DOW.map((d, i) => <label key={d} className="text-center text-xs text-ink-3">{d}
                  <input className="tc-input tc-num mt-0.5 !px-1 text-center" inputMode="numeric" value={f.wk[i]} aria-label={`${d} kişi`}
                    onChange={(e) => { const wk = [...f.wk]; wk[i] = e.target.value.replace(/\D/g, ''); setF({ ...f, wk }); }} /></label>)}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Field label="Atlanacak günler" className="min-w-[220px] flex-1" hint="Ör. 29 veya 2026-10-29, virgülle"><input className="tc-input" value={f.skip} onChange={(e) => setF({ ...f, skip: e.target.value })} placeholder="29, 30" /></Field>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={addStanding} loading={saveStanding.isPending}>Şablon ekle</Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel className="mt-4" pad={false} title="Gün × firma" subtitle="Hücreye yazıp Enter: o günün siparişi değişir (0 = iptal). Kesim kuralı portal için geçerlidir; personel düzeltebilir.">
        {orders.isLoading ? <Loading /> : customerIds.length === 0 ? <p className="px-4 py-6 text-sm text-ink-3">Bu ay ve öğün için sipariş yok.</p> : (
          <div className="overflow-x-auto tc-scroll">
            <table className="text-xs">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-semibold">Firma</th>
                  {days.map((d) => <th key={d} className={cx('px-1 py-2 text-center font-semibold', isoDow(d) >= 6 && 'text-ink-3/70')}>{Number(d.slice(8))}<div className="font-normal">{DOW[isoDow(d) - 1]}</div></th>)}
                  <th className="px-3 py-2 text-right font-semibold">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {customerIds.map((cid) => (
                  <tr key={cid} className="border-b border-line">
                    <td className="sticky left-0 z-10 max-w-[180px] truncate bg-card px-3 py-1.5 font-semibold text-ink">{custName(cid)}</td>
                    {days.map((d) => (
                      <td key={d} className={cx('px-0.5 py-1', isoDow(d) === 7 && 'bg-surface-2/60')}>
                        <div className="w-12"><NumCell label={`${custName(cid)} ${d}`} value={grid.get(`${cid}|${d}`) ?? null} allowEmpty disabled={!canEdit}
                          onCommit={(v) => { const q = v == null ? 0 : Math.round(v); if (q !== (grid.get(`${cid}|${d}`) ?? 0)) void setCell(cid, d, q); }} /></div>
                      </td>
                    ))}
                    <td className="px-3 text-right font-semibold tc-num">{fmtNum(days.reduce((s, d) => s + (grid.get(`${cid}|${d}`) ?? 0), 0), 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
