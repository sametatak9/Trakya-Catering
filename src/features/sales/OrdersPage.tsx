import { useMemo, useState } from 'react';
import { CheckCheck, ClipboardList, Copy, Plus, Trash2 } from 'lucide-react';
import { Link } from '@/app/router';
import { useCan } from '@/app/session';
import { addDays, minutesToCutoff, todayISO } from '@/lib/dates';
import { MEALS, ORDER_KINDS, ORDER_STATUS, ROLES } from '@/lib/domain';
import { fmtNum, parseNum } from '@/lib/format';
import { DateNav, Hint } from '@/ui/bits';
import { NumCell } from '@/ui/NumCell';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useMenuCosts } from '../kitchen/api';
import { effectiveMenu, useMenuPlans } from '../production/api';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportStats } from '@/reports/ReportFrame';
import { dayLabel } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { orderPeople, useBulkOrders, useCustomers, useDeleteOrder, useOrders, useSaveOrder, useUpdateOrders } from './api';

export function OrdersPage() {
  const toast = useToast();
  const canEdit = useCan(ROLES.orders);
  const [date, setDate] = useState(() => addDays(todayISO(), 1));
  const [meal, setMeal] = useState('ogle');
  const orders = useOrders(addDays(date, -1), date);
  const customers = useCustomers();
  const menus = useMenuCosts();
  const plans = useMenuPlans(date);
  const save = useSaveOrder();
  const bulk = useBulkOrders();
  const updateMany = useUpdateOrders();
  const del = useDeleteOrder();

  const all = orders.data ?? [];
  const dayOrders = all.filter((o) => o.service_date === date);
  const rows = dayOrders.filter((o) => o.meal === meal);
  const prevRows = all.filter((o) => o.service_date === addDays(date, -1) && o.meal === meal && o.status !== 'iptal');
  const active = rows.filter((o) => o.status !== 'iptal');
  const people = active.reduce((s, o) => s + orderPeople(o), 0);
  const amount = active.reduce((s, o) => s + orderPeople(o) * Number(o.unit_price), 0);
  const delivered = rows.filter((o) => o.status === 'teslim_edildi').length;
  const custById = useMemo(() => new Map((customers.data ?? []).map((c) => [c.id, c])), [customers.data]);

  const isTomorrow = date === addDays(todayISO(), 1);
  const cutoff = minutesToCutoff();
  const mealCounts = Object.keys(MEALS).map((k) => ({
    id: k, label: MEALS[k], count: dayOrders.filter((o) => o.meal === k && o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0),
  }));

  // Yeni satır
  const [nc, setNc] = useState('');
  const [nm, setNm] = useState('');
  const [nq, setNq] = useState('');
  const [np, setNp] = useState('');
  const [nk, setNk] = useState('sozlesmeli');
  const pickCustomer = (id: string) => {
    setNc(id);
    const c = custById.get(id);
    if (c?.default_meal_price != null) setNp(String(c.default_meal_price).replace('.', ','));
  };
  const add = async () => {
    const qty = parseNum(nq);
    const price = parseNum(np) ?? 0;
    if (!nc) return toast.error('Müşteri seçin');
    if (qty === null || qty < 0 || !Number.isInteger(qty)) return toast.error('Kişi sayısı tam sayı olmalı');
    try {
      await save.mutateAsync({ id: null, draft: {
        service_date: date, meal, customer_id: nc, menu_id: nm || null, kind: nk, ordered_qty: qty, unit_price: price,
        vat_rate: custById.get(nc)?.vat_rate ?? 10,
      } });
      setNc(''); setNm(''); setNq(''); setNp(''); setNk('sozlesmeli');
      toast.ok('Sipariş eklendi');
    } catch (e) { toast.error(e); }
  };

  const copyPrev = async () => {
    const existing = new Set(rows.filter((o) => o.status !== 'iptal').map((o) => `${o.customer_id}|${o.menu_id ?? ''}`));
    const toCopy = prevRows.filter((o) => !existing.has(`${o.customer_id}|${o.menu_id ?? ''}`));
    if (toCopy.length === 0) return toast.error('Kopyalanacak yeni satır yok');
    try {
      const n = await bulk.mutateAsync(toCopy.map((o) => ({
        service_date: date, meal, customer_id: o.customer_id, menu_id: o.menu_id, kind: o.kind,
        ordered_qty: o.delivered_qty ?? o.ordered_qty, unit_price: o.unit_price, vat_rate: o.vat_rate,
      })));
      toast.ok(`${n} sipariş önceki günden kopyalandı`);
    } catch (e) { toast.error(e); }
  };

  const deliverAll = async () => {
    const items = rows.filter((o) => o.status === 'bekliyor' || o.status === 'onaylandi')
      .map((o) => ({ id: o.id, patch: { status: 'teslim_edildi', delivered_qty: o.delivered_qty ?? o.ordered_qty } }));
    if (items.length === 0) return;
    if (!window.confirm(`${items.length} sipariş "teslim edildi" yapılsın mı? Teslim edilen tutarlar gelir (alacak) olarak kaydedilir.`)) return;
    try { await updateMany.mutateAsync(items); toast.ok('Teslimler kaydedildi'); } catch (e) { toast.error(e); }
  };

  const report = (): ReportSpec => ({
    title: 'Sipariş Listesi',
    subtitle: `${dayLabel(date)} · ${MEALS[meal]}`,
    summary: [
      ...active.map((o) => ({ label: custById.get(o.customer_id)?.name ?? '', value: `${fmtNum(orderPeople(o), 0)} kişi` })),
      { label: 'Toplam', value: `${fmtNum(people, 0)} kişi · ${fmtMoney(amount)}` },
    ],
    table: {
      filename: `siparisler-${date}-${meal}`,
      header: ['Müşteri', 'Menü', 'Tür', 'Sipariş', 'Teslim', 'Kişi başı ₺', 'Tutar ₺', 'Durum'],
      rows: rows.map((o) => [custById.get(o.customer_id)?.name, (menus.data ?? []).find((m) => m.menu_id === effectiveMenu(plans.data ?? [], date, meal, o.customer_id, o.menu_id))?.name,
        ORDER_KINDS[o.kind], o.ordered_qty, o.delivered_qty, o.unit_price, orderPeople(o) * Number(o.unit_price), ORDER_STATUS[o.status]?.label]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Kişi', value: fmtNum(people, 0) },
          { label: 'Tutar (KDV hariç)', value: fmtMoney(amount) },
          { label: 'Müşteri', value: new Set(active.map((o) => o.customer_id)).size },
          { label: 'Teslim edilen', value: `${delivered} / ${rows.length}` },
        ]} />
        <table>
          <thead><tr><th>Müşteri</th><th>Menü</th><th className="num">Sipariş</th><th className="num">Teslim</th><th className="num">Kişi başı</th><th className="num">Tutar</th><th>Durum</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}><td>{custById.get(o.customer_id)?.name}</td>
                <td>{(menus.data ?? []).find((m) => m.menu_id === effectiveMenu(plans.data ?? [], date, meal, o.customer_id, o.menu_id))?.name ?? '—'}</td>
                <td className="num">{fmtNum(o.ordered_qty, 0)}</td><td className="num">{o.delivered_qty ?? '—'}</td>
                <td className="num">{fmtMoney(o.unit_price)}</td><td className="num">{fmtMoney(orderPeople(o) * Number(o.unit_price))}</td><td>{ORDER_STATUS[o.status]?.label}</td></tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  });

  const patch = (id: string, p: Parameters<typeof save.mutate>[0]['draft']) =>
    save.mutate({ id, draft: p }, { onError: toast.error });

  return (
    <>
      <ModuleHero
        kicker="Satış · Günlük yemek sayıları"
        title="Siparişler"
        description="Her müşterinin gün ve öğün bazında kaç kişi yiyeceği. Menü seçilmezse menü planından gelir; teslim edilen siparişler otomatik olarak gelir (alacak) kaydına dönüşür."
        actions={<ReportButton spec={report} disabled={rows.length === 0} />}
        stats={[
          { label: `${MEALS[meal]} · toplam kişi`, value: fmtNum(people, 0) },
          { label: 'Tutar (KDV hariç)', value: <Money value={amount} /> },
          { label: 'Teslim edilen', value: `${delivered} / ${rows.length}`, tone: rows.length && delivered === rows.length ? 'good' : 'default' },
          isTomorrow
            ? { label: 'Yarın için kesim (16:00)', value: cutoff > 0 ? `${Math.floor(cutoff / 60)} sa ${cutoff % 60} dk` : 'Kapandı', tone: cutoff > 0 ? 'default' : 'warn' }
            : { label: 'Müşteri sayısı', value: new Set(active.map((o) => o.customer_id)).size },
        ]}
      />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between mb-4">
        <DateNav value={date} onChange={setDate} />
        <Tabs value={meal} onChange={setMeal} items={mealCounts} />
      </div>

      {(customers.data ?? []).length === 0 && !customers.isLoading && (
        <div className="mb-4"><Hint action={<Link to="/musteriler" className="text-sm font-semibold text-brand whitespace-nowrap">Müşteri ekle →</Link>}>
          Sipariş girebilmek için önce müşteri (firma) kartı açın; kişi başı fiyat ve vade oradan gelir.
        </Hint></div>
      )}

      <Panel pad={false}
        title={`${MEALS[meal]} siparişleri`}
        action={canEdit && (
          <div className="flex gap-2">
            {prevRows.length > 0 && <Button size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={copyPrev} loading={bulk.isPending}>Önceki günü kopyala</Button>}
            {rows.some((o) => o.status === 'bekliyor' || o.status === 'onaylandi') &&
              <Button size="sm" variant="primary" icon={<CheckCheck className="w-3.5 h-3.5" />} onClick={deliverAll} loading={updateMany.isPending}>Tümü teslim edildi</Button>}
          </div>
        )}>
        {orders.isLoading ? <Loading /> : orders.error ? <div className="p-4"><ErrorNote>Siparişler yüklenemedi.</ErrorNote></div> : (
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">Müşteri</th>
                  <th className="px-2 py-2.5 font-semibold">Menü</th>
                  <th className="px-2 py-2.5 font-semibold w-24 text-right">Sipariş</th>
                  <th className="px-2 py-2.5 font-semibold w-24 text-right">Teslim</th>
                  <th className="px-2 py-2.5 font-semibold w-28 text-right">Kişi başı ₺</th>
                  <th className="px-2 py-2.5 font-semibold text-right">Tutar</th>
                  <th className="px-2 py-2.5 font-semibold">Durum</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const c = custById.get(o.customer_id);
                  const locked = !canEdit;
                  return (
                    <tr key={o.id} className={cx('border-b border-line', o.status === 'iptal' && 'opacity-50')}>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-ink">{c?.name ?? '—'}</div>
                        <div className="text-[11px] text-ink-3">{ORDER_KINDS[o.kind]}{o.note ? ` · ${o.note}` : ''}</div>
                      </td>
                      <td className="px-2 py-2">
                        <select className="tc-input !py-1.5" value={o.menu_id ?? ''} disabled={locked}
                          onChange={(e) => patch(o.id, { menu_id: e.target.value || null })} aria-label="Menü">
                          <option value="">{(() => { const pm = effectiveMenu(plans.data ?? [], date, meal, o.customer_id, null); return pm ? `↳ plandan: ${(menus.data ?? []).find((m) => m.menu_id === pm)?.name ?? ''}` : '— menü seçilmedi —'; })()}</option>
                          {(menus.data ?? []).filter((m) => m.active || m.menu_id === o.menu_id).map((m) => <option key={m.menu_id} value={m.menu_id!}>{m.name}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2"><NumCell label="Sipariş adedi" value={o.ordered_qty} disabled={locked} onCommit={(v) => patch(o.id, { ordered_qty: Math.round(v ?? 0) })} /></td>
                      <td className="px-2 py-2"><NumCell label="Teslim adedi" value={o.delivered_qty} allowEmpty placeholder={String(o.ordered_qty)} disabled={locked}
                        onCommit={(v) => patch(o.id, { delivered_qty: v === null ? null : Math.round(v) })} /></td>
                      <td className="px-2 py-2"><NumCell label="Kişi başı fiyat" value={o.unit_price} disabled={locked} onCommit={(v) => patch(o.id, { unit_price: v ?? 0 })} /></td>
                      <td className="px-2 py-2 text-right font-semibold"><Money value={orderPeople(o) * Number(o.unit_price)} /></td>
                      <td className="px-2 py-2">
                        {locked ? <Pill tone={ORDER_STATUS[o.status]?.tone}>{ORDER_STATUS[o.status]?.label}</Pill> : (
                          <select className="tc-input !py-1.5" value={o.status} aria-label="Durum"
                            onChange={(e) => patch(o.id, { status: e.target.value, ...(e.target.value === 'teslim_edildi' && o.delivered_qty === null ? { delivered_qty: o.ordered_qty } : {}) })}>
                            {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="pr-3">
                        {canEdit && (
                          <button type="button" className="p-1.5 rounded-lg text-ink-3 hover:text-stop hover:bg-stop-soft" aria-label="Siparişi sil"
                            onClick={() => window.confirm('Sipariş silinsin mi?') && del.mutate(o.id, { onSuccess: () => toast.ok('Silindi'), onError: toast.error })}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8}>
                    <EmptyState icon={<ClipboardList className="w-5 h-5" />} title="Bu öğün için sipariş yok">
                      {prevRows.length > 0 ? 'Önceki günün siparişlerini tek tuşla kopyalayabilir ya da aşağıdan ekleyebilirsiniz.' : 'Aşağıdan müşteri seçip kişi sayısını girin.'}
                    </EmptyState>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && (customers.data ?? []).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1.2fr_0.8fr_0.7fr_0.8fr_auto] gap-2 p-4 border-t border-line bg-surface-2/60 rounded-b-[18px]">
            <select className="tc-input col-span-2 md:col-span-1" value={nc} onChange={(e) => pickCustomer(e.target.value)} aria-label="Müşteri">
              <option value="">Müşteri seç…</option>
              {(customers.data ?? []).filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="tc-input col-span-2 md:col-span-1" value={nm} onChange={(e) => setNm(e.target.value)} aria-label="Menü">
              <option value="">Menü (ops.)</option>
              {(menus.data ?? []).filter((m) => m.active).map((m) => <option key={m.menu_id} value={m.menu_id!}>{m.name}</option>)}
            </select>
            <select className="tc-input" value={nk} onChange={(e) => setNk(e.target.value)} aria-label="Tür">
              {Object.entries(ORDER_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="tc-input tc-num" inputMode="numeric" placeholder="Kişi" value={nq} onChange={(e) => setNq(e.target.value)} aria-label="Kişi sayısı" />
            <input className="tc-input tc-num" inputMode="decimal" placeholder="₺ / kişi" value={np} onChange={(e) => setNp(e.target.value)} aria-label="Kişi başı fiyat" />
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={add} loading={save.isPending}>Ekle</Button>
          </div>
        )}
      </Panel>
    </>
  );
}
