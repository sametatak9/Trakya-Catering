import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Mail, MessageCircle, X } from 'lucide-react';
import { useCan } from '@/app/session';
import { addMonths, monthKey, monthLabel, monthRange, shortDay, todayISO } from '@/lib/dates';
import { MEALS } from '@/lib/domain';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { lastMonthSummary, mailtoUrl, requestText, type RequestLine } from '@/lib/purchasing';
import { supabase, unwrap } from '@/lib/supabase';
import { whatsappUrl } from '@/reports/share';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { MonthNav } from '@/ui/bits';
import { Button, EmptyState, Loading, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients } from '../kitchen/api';
import { orderPeople, useOrders } from '../sales/api';
import { useCompany } from '../settings/api';
import { useStockMoves } from './StockPage';

const MEAL_ORDER = ['kahvalti', 'ogle', 'aksam', 'gece'];

/** Satınalma › Geçen ay: günlük kişi sayısı tablosu, aylık toplam ve tüketilen hammadde (gelecek ayın planına referans) */
export function LastMonthPanel() {
  const [month, setMonth] = useState(() => addMonths(monthKey(todayISO()), -1));
  const { from, to } = monthRange(month);
  const orders = useOrders(from, to);
  const moves = useStockMoves(from);
  const ings = useIngredients();
  const s = useMemo(() => lastMonthSummary(
    (orders.data ?? []).filter((o) => o.status !== 'iptal').map((o) => ({ service_date: o.service_date, meal: o.meal, people: orderPeople(o) })),
    (moves.data ?? []).filter((m) => m.move_date <= to).map((m) => ({ ingredient_id: m.ingredient_id, qty: Number(m.qty), kind: m.kind, unit_cost: m.unit_cost })),
  ), [orders.data, moves.data, to]);
  const meals = MEAL_ORDER.filter((m) => s.byMeal[m]);
  const ing = (id: string) => (ings.data ?? []).find((i) => i.id === id);
  const use = [...s.use.entries()].map(([id, u]) => ({ id, ...u, i: ing(id) })).filter((x) => x.i).sort((a, b) => b.cost - a.cost);
  const cost = use.reduce((t, u) => t + u.cost, 0);

  const report = (): ReportSpec => ({
    title: 'Geçen Ay Özeti', subtitle: `${monthLabel(month)} · kişi sayıları ve tüketilen hammadde`,
    summary: [{ label: 'Toplam kişi-öğün', value: fmtNum(s.total, 0) }, { label: 'Günlük ortalama', value: fmtNum(s.avgPerDay, 0) }, { label: 'Tüketim maliyeti', value: fmtMoney(cost) }],
    table: { filename: `gecen-ay-${month}`, header: ['Stok kartı', 'Tüketim', 'Birim', 'Maliyet ₺', 'Sevk'], rows: use.map((u) => [u.i!.name, Math.round(u.qty * 100) / 100, u.i!.stock_unit, Math.round(u.cost), Math.round(u.sevk * 100) / 100]) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Kişi-öğün', value: fmtNum(s.total, 0) }, { label: 'Gün', value: s.activeDays }, { label: 'Günlük ort.', value: fmtNum(s.avgPerDay, 0) }, { label: 'Tüketim', value: fmtMoney(cost) }]} />
        <ReportSection title="Günlük kişi sayısı">
          <table><thead><tr><th>Gün</th>{meals.map((m) => <th key={m} className="num">{MEALS[m]}</th>)}<th className="num">Toplam</th></tr></thead>
            <tbody>{s.days.map((d) => <tr key={d.date}><td>{shortDay(d.date)}</td>{meals.map((m) => <td key={m} className="num">{fmtNum(d.meals[m] ?? 0, 0)}</td>)}<td className="num"><b>{fmtNum(d.total, 0)}</b></td></tr>)}</tbody></table>
        </ReportSection>
        <ReportSection title="Tüketilen hammadde">
          <table><thead><tr><th>Stok kartı</th><th className="num">Tüketim</th><th className="num">Maliyet</th></tr></thead>
            <tbody>{use.map((u) => <tr key={u.id}><td>{u.i!.name}</td><td className="num">{fmtNum(u.qty, 2)} {u.i!.stock_unit}</td><td className="num">{fmtMoney(u.cost)}</td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  const loading = orders.isLoading || moves.isLoading;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthNav value={month} onChange={setMonth} />
        <span className="ml-auto"><ReportButton size="sm" spec={report} disabled={s.total === 0 && use.length === 0} /></span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[{ l: 'Kişi-öğün', v: fmtNum(s.total, 0) }, { l: 'Servis günü', v: String(s.activeDays) }, { l: 'Günlük ortalama', v: fmtNum(s.avgPerDay, 0) }, { l: 'Tüketim maliyeti', v: fmtMoney(cost) }].map((x) => (
          <div key={x.l} className="tc-card p-3"><div className="text-[11px] text-ink-3">{x.l}</div><div className="text-lg font-bold text-ink tc-num">{x.v}</div></div>
        ))}
      </div>
      {loading ? <Loading /> : (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel pad={false} title="Günlük kişi sayısı" subtitle="İptaller hariç; teslim edilen siparişte teslim adedi">
            {s.days.length === 0 ? <EmptyState title="Bu ay sipariş yok" /> : (
              <div className="overflow-x-auto tc-scroll max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2">Gün</th>{meals.map((m) => <th key={m} className="px-2 py-2 text-right">{MEALS[m]}</th>)}<th className="px-4 py-2 text-right">Toplam</th></tr></thead>
                  <tbody>{s.days.map((d) => (
                    <tr key={d.date} className="border-b border-line last:border-0">
                      <td className="px-4 py-1.5 text-ink-2">{shortDay(d.date)}</td>
                      {meals.map((m) => <td key={m} className="px-2 py-1.5 text-right tc-num">{d.meals[m] ? fmtNum(d.meals[m], 0) : '—'}</td>)}
                      <td className="px-4 py-1.5 text-right tc-num font-semibold">{fmtNum(d.total, 0)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Panel>
          <Panel pad={false} title="Tüketilen hammadde" subtitle="Üretim, hazırlık ve fire çıkışları; firmalara sevk ayrı sütunda">
            {use.length === 0 ? <EmptyState title="Bu ay stok çıkışı yok" /> : (
              <div className="overflow-x-auto tc-scroll max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card"><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                    <th className="px-4 py-2">Stok kartı</th><th className="px-2 py-2 text-right">Tüketim</th><th className="px-2 py-2 text-right">Sevk</th><th className="px-4 py-2 text-right">Maliyet</th></tr></thead>
                  <tbody>{use.map((u) => (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-1.5 text-ink">{u.i!.name}</td>
                      <td className="px-2 py-1.5 text-right tc-num">{fmtNum(u.qty, 2)} {u.i!.stock_unit}</td>
                      <td className="px-2 py-1.5 text-right tc-num text-ink-3">{u.sevk ? fmtNum(u.sevk, 2) : '—'}</td>
                      <td className="px-4 py-1.5 text-right"><Money value={u.cost} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

interface Variance { price_id: string; ingredient_id: string; ingredient_name: string; stock_unit: string; noted_at: string; price: number; prev_price: number; change_pct: number; supplier_name: string | null; decision: string | null; decision_note: string | null }

/** Satınalma › Fiyat sapması: son alıştan %3'ten fazla sapan fiyatlar; kabul/red (onay kaydı + denetim izi) */
export function PriceVariancePanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const canDecide = useCan(['yonetici', 'satinalma', 'muhasebe']);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const q = useQuery({
    queryKey: ['t', 'v_price_variances'],
    queryFn: async () => unwrap(await supabase.from('v_price_variances').select('*').order('noted_at', { ascending: false }).limit(300)) as unknown as Variance[],
  });
  const rows = (q.data ?? []).filter((r) => !onlyOpen || !r.decision);
  const decide = async (r: Variance, decision: 'kabul' | 'red') => {
    const note = decision === 'red' ? window.prompt('Red gerekçesi (iade / fark talebi notu):', '') : null;
    if (decision === 'red' && !note?.trim()) return toast.error('Red için gerekçe yazın');
    try {
      unwrap(await supabase.from('price_variance_decisions').insert({ price_id: r.price_id, decision, note: note?.trim() || null }).select('id'));
      await qc.invalidateQueries({ queryKey: ['t', 'v_price_variances'] });
      toast.ok(decision === 'kabul' ? 'Fiyat kabul edildi' : 'Reddedildi; tedarikçiden fark/iade talep edin');
    } catch (e) { toast.error(e); }
  };
  return (
    <Panel pad={false} title="Düzensiz fiyatlar" subtitle="Son alış fiyatından %3'ten fazla sapan kayıtlar. Kabul ya da red kararı kimin verdiğiyle birlikte kaydedilir."
      action={<label className="flex items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[var(--tc-brand)]" />Yalnız karar bekleyenler</label>}>
      {q.isLoading ? <Loading /> : rows.length === 0 ? <EmptyState title="Düzensiz fiyat yok">Fatura veya elle girilen fiyat son alıştan %3'ten fazla saparsa burada listelenir.</EmptyState> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.price_id} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink">{r.ingredient_name}</div>
                <div className="text-[11px] text-ink-3">{shortDay(r.noted_at.slice(0, 10))}{r.supplier_name ? ` · ${r.supplier_name}` : ''}</div>
              </div>
              <div className="text-right text-sm tc-num">
                <Money value={r.prev_price} precise /> → <Money value={r.price} precise className="font-bold" /> <span className="text-ink-3">/ {r.stock_unit}</span>
              </div>
              <Pill tone={Number(r.change_pct) > 0 ? 'stop' : 'ok'}>{Number(r.change_pct) > 0 ? '+' : ''}{fmtPct(Number(r.change_pct) / 100)}</Pill>
              {r.decision ? <Pill tone={r.decision === 'kabul' ? 'ok' : 'stop'}>{r.decision === 'kabul' ? 'Kabul' : `Red${r.decision_note ? `: ${r.decision_note}` : ''}`}</Pill>
                : canDecide && <span className="flex gap-1.5">
                  <Button size="sm" icon={<Check className="w-3.5 h-3.5" />} onClick={() => decide(r, 'kabul')}>Kabul</Button>
                  <Button size="sm" variant="danger" icon={<X className="w-3.5 h-3.5" />} onClick={() => decide(r, 'red')}>Red</Button>
                </span>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Satınalma siparişini tedarikçiye gönder: WhatsApp / e-posta; her gönderim purchase_requests'e kaydedilir. PDF için Rapor butonu. */
export function RequestActions({ poId, supplier, lines, date, deliveryDate, note }: {
  poId: string; supplier: { id: string; name: string; phone: string | null; email: string | null } | undefined;
  lines: RequestLine[]; date: string; deliveryDate?: string | null; note?: string | null;
}) {
  const toast = useToast();
  const company = useCompany();
  const sent = useQuery({
    queryKey: ['t', 'purchase_requests', poId],
    queryFn: async () => unwrap(await supabase.from('purchase_requests').select('channel, sent_at').eq('po_id', poId).order('sent_at', { ascending: false })),
  });
  if (!supplier) return null;
  const text = requestText({ company: company.data?.short_name ?? 'Trakya Catering', supplier: supplier.name, date: shortDay(date), deliveryDate: deliveryDate ? shortDay(deliveryDate) : null, lines, note });
  const log = async (channel: 'whatsapp' | 'eposta' | 'pdf') => {
    try {
      unwrap(await supabase.from('purchase_requests').insert({ supplier_id: supplier.id, po_id: poId, channel, message: text }).select('id'));
      await sent.refetch();
    } catch (e) { toast.error(e); }
  };
  const pdf = (): ReportSpec => ({
    title: 'Satınalma Siparişi', subtitle: `${supplier.name} · ${shortDay(date)}${deliveryDate ? ` · teslim ${shortDay(deliveryDate)}` : ''}`,
    summary: lines.map((l) => ({ label: l.name, value: `${fmtNum(l.qty, 3)} ${l.unit}` })),
    table: { filename: `siparis-${supplier.name}-${date}`, header: ['Ürün', 'Miktar', 'Birim'], rows: lines.map((l) => [l.name, l.qty, l.unit]) },
    phone: supplier.phone,
    body: () => (
      <ReportSection title="Sipariş kalemleri">
        <table><thead><tr><th>#</th><th>Ürün</th><th className="num">Miktar</th><th>Birim</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={i}><td>{i + 1}</td><td>{l.name}</td><td className="num">{fmtNum(l.qty, 3)}</td><td>{l.unit}</td></tr>)}</tbody></table>
        {note && <p style={{ fontSize: 11 }}>Not: {note}</p>}
      </ReportSection>
    ),
  });
  const last = sent.data?.[0];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <a className={cx('tc-btn-sm inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-line hover:bg-surface-2')}
        href={whatsappUrl(text, supplier.phone)} target="_blank" rel="noopener" onClick={() => log('whatsapp')}>
        <MessageCircle className="w-3.5 h-3.5 text-ok" />WhatsApp
      </a>
      <a className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-line hover:bg-surface-2"
        href={mailtoUrl(supplier.email, `Sipariş · ${shortDay(date)}`, text)} onClick={() => log('eposta')}>
        <Mail className="w-3.5 h-3.5 text-info" />E-posta
      </a>
      <span onClickCapture={() => log('pdf')}><ReportButton size="sm" label="PDF" spec={pdf} /></span>
      {last && <span className="text-[11px] text-ink-3">son gönderim {shortDay(last.sent_at.slice(0, 10))} · {last.channel === 'eposta' ? 'e-posta' : last.channel}</span>}
    </span>
  );
}
