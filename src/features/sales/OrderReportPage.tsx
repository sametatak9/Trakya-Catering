import { useMemo, useState } from 'react';
import { addDays, todayISO, shortDay } from '@/lib/dates';
import { MEALS } from '@/lib/domain';
import { fmtNum } from '@/lib/format';
import { customerMealReport, REPORT_MEALS } from '@/lib/monthGrid';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { Loading, ModuleHero, Panel } from '@/ui/primitives';
import { useCustomers, useOrders } from './api';

/** Siparişler › Müşteri × öğün raporu (rakip analizi MUST, YemekPRO): tarih aralığında her firma için kahvaltı/öğle/akşam/gece adetleri */
export function OrderReportPage() {
  const [from, setFrom] = useState(() => `${todayISO().slice(0, 7)}-01`);
  const [to, setTo] = useState(() => todayISO());
  const orders = useOrders(from, to);
  const customers = useCustomers();
  const rows = useMemo(() => customerMealReport(orders.data ?? []), [orders.data]);
  const name = (id: string) => (customers.data ?? []).find((c) => c.id === id)?.name ?? '—';
  const totals = REPORT_MEALS.map((m) => rows.reduce((s, r) => s + (r.byMeal[m] ?? 0), 0));
  const grand = totals.reduce((s, x) => s + x, 0);

  const report = (): ReportSpec => ({
    title: 'Müşteri × Öğün Adet Raporu', subtitle: `${shortDay(from)} – ${shortDay(to)} · iptaller hariç, teslim edilen varsa teslim adedi`,
    summary: rows.slice(0, 15).map((r) => ({ label: name(r.customer_id), value: `${fmtNum(r.total, 0)} öğün` })),
    table: { filename: `musteri-ogun-${from}-${to}`, header: ['Müşteri', ...REPORT_MEALS.map((m) => MEALS[m]), 'Toplam', 'Gün'],
      rows: [...rows.map((r) => [name(r.customer_id), ...REPORT_MEALS.map((m) => r.byMeal[m] ?? 0), r.total, r.days]), ['TOPLAM', ...totals, grand, '']] },
    body: () => (
      <table>
        <thead><tr><th>Müşteri</th>{REPORT_MEALS.map((m) => <th key={m} className="num">{MEALS[m]}</th>)}<th className="num">Toplam</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.customer_id}><td>{name(r.customer_id)}</td>{REPORT_MEALS.map((m) => <td key={m} className="num">{fmtNum(r.byMeal[m] ?? 0, 0)}</td>)}<td className="num"><b>{fmtNum(r.total, 0)}</b></td></tr>)}
          <tr><td><b>Toplam</b></td>{totals.map((t, i) => <td key={i} className="num"><b>{fmtNum(t, 0)}</b></td>)}<td className="num"><b>{fmtNum(grand, 0)}</b></td></tr>
        </tbody>
      </table>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Satış · Rapor" title="Müşteri × öğün raporu"
        description="Seçilen tarih aralığında her firmaya kahvaltı, öğle, akşam ve gece kaç öğün verildiği. Teslim edilmiş siparişte teslim adedi, diğerlerinde sipariş adedi sayılır; iptaller hariç. Excel'e aktarılabilir."
        actions={<ReportButton spec={report} disabled={rows.length === 0} />}
        stats={REPORT_MEALS.map((m, i) => ({ label: MEALS[m], value: fmtNum(totals[i], 0) }))} />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-ink-3">Başlangıç<input type="date" className="tc-input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs font-semibold text-ink-3">Bitiş<input type="date" className="tc-input mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button type="button" className="tc-input !w-auto font-semibold" onClick={() => { setFrom(addDays(todayISO(), -6)); setTo(todayISO()); }}>Son 7 gün</button>
      </div>
      <Panel pad={false}>
        {orders.isLoading ? <Loading /> : rows.length === 0 ? <p className="px-4 py-6 text-sm text-ink-3">Bu aralıkta sipariş yok.</p> : (
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-ink-3">
                <th className="px-4 py-2.5">Müşteri</th>{REPORT_MEALS.map((m) => <th key={m} className="px-3 py-2.5 text-right">{MEALS[m]}</th>)}<th className="px-4 py-2.5 text-right">Toplam</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customer_id} className="border-b border-line">
                    <td className="px-4 py-2 font-semibold text-ink">{name(r.customer_id)}<div className="text-[11px] font-normal text-ink-3">{r.days} gün</div></td>
                    {REPORT_MEALS.map((m) => <td key={m} className="px-3 py-2 text-right tc-num">{r.byMeal[m] ? fmtNum(r.byMeal[m], 0) : '—'}</td>)}
                    <td className="px-4 py-2 text-right font-semibold tc-num">{fmtNum(r.total, 0)}</td>
                  </tr>
                ))}
                <tr className="bg-surface-2/60 font-semibold"><td className="px-4 py-2">Toplam</td>{totals.map((t, i) => <td key={i} className="px-3 py-2 text-right tc-num">{fmtNum(t, 0)}</td>)}<td className="px-4 py-2 text-right tc-num">{fmtNum(grand, 0)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
