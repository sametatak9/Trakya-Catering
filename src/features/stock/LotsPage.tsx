import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Layers, Route } from 'lucide-react';
import { addDays, shortDay, todayISO } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection } from '@/reports/ReportFrame';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { EmptyState, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';

interface BySupplier { ingredient_id: string; ingredient_name: string; stock_unit: string; supplier_id: string | null; supplier_name: string | null; lot_count: number; qty_remaining: number; value: number; nearest_expiry: string | null; oldest_received: string | null }
interface Trace { lot_id: string; ingredient_name: string; supplier_name: string | null; lot_no: string | null; received_on: string; expiry_date: string | null; qty: number; move_date: string; kind: string; source: string; customer_name: string | null; note: string | null }

const KIND: Record<string, string> = { cikis: 'Üretim / hazırlık', fire: 'Fire / imha', sevk: 'Firmaya sevk', sayim: 'Sayım' };

/** Stok › Partiler & izleme (Faz 3E): kalem × tedarikçi kalan, SKT yaklaşanlar, lot geri izleme, partisiz çıkışlar */
export function LotsPage() {
  const today = todayISO();
  const [tab, setTab] = useState<'kalan' | 'skt' | 'izleme' | 'partisiz'>('kalan');
  const [q, setQ] = useState('');
  const by = useQuery({ queryKey: ['t', 'v_stock_by_supplier'], queryFn: async () => unwrap(await supabase.from('v_stock_by_supplier').select('*').order('ingredient_name')) as unknown as BySupplier[] });
  const lots = useQuery({
    queryKey: ['t', 'stock_lots', 'acik'],
    queryFn: async () => unwrap(await supabase.from('stock_lots').select('id, ingredient_id, supplier_id, lot_no, received_on, expiry_date, qty_remaining, unit_cost').eq('status', 'acik').gt('qty_remaining', 0).not('expiry_date', 'is', null).order('expiry_date')),
  });
  const term = q.trim().replace(/[,()%*\\]/g, ' ').trim();
  const trace = useQuery({
    queryKey: ['t', 'v_lot_trace', term], enabled: tab === 'izleme' && term.length >= 2,
    queryFn: async () => unwrap(await supabase.from('v_lot_trace').select('*').or(`ingredient_name.ilike.%${term}%,lot_no.ilike.%${term}%,supplier_name.ilike.%${term}%`).order('move_date', { ascending: false }).limit(200)) as unknown as Trace[],
  });
  const unlot = useQuery({
    queryKey: ['t', 'stock_lot_allocations', 'partisiz'], enabled: tab === 'partisiz',
    queryFn: async () => unwrap(await supabase.from('stock_lot_allocations').select('id, ingredient_id, qty, created_at, ingredients(name, stock_unit)').is('lot_id', null).order('created_at', { ascending: false }).limit(200)),
  });
  const rows = (by.data ?? []).filter((r) => matches(q, `${r.ingredient_name} ${r.supplier_name ?? ''}`));
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  const nameOf = useMemo(() => new Map((by.data ?? []).map((r) => [r.ingredient_id, r])), [by.data]);
  const soon = (lots.data ?? []).filter((l) => l.expiry_date! <= addDays(today, 7));

  const report = (): ReportSpec => ({
    title: 'Stok Partileri · Tedarikçi Bazında Kalan', subtitle: `${shortDay(today)} · açık partiler`,
    summary: [{ label: 'Stok değeri', value: fmtMoney(total) }, { label: '7 gün içinde SKT', value: `${soon.length} parti` }],
    table: { filename: `partiler-${today}`, header: ['Stok kartı', 'Tedarikçi', 'Kalan', 'Birim', 'Değer ₺', 'Parti', 'En yakın SKT'],
      rows: rows.map((r) => [r.ingredient_name, r.supplier_name ?? 'Açılış / elle', Number(r.qty_remaining), r.stock_unit, Number(r.value), r.lot_count, r.nearest_expiry ?? '']) },
    body: () => (
      <ReportSection title="Kalem × tedarikçi">
        <table><thead><tr><th>Stok kartı</th><th>Tedarikçi</th><th className="num">Kalan</th><th className="num">Değer</th><th>SKT</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={`${r.ingredient_id}${r.supplier_id}`}><td>{r.ingredient_name}</td><td>{r.supplier_name ?? 'Açılış / elle'}</td><td className="num">{fmtNum(Number(r.qty_remaining), 2)} {r.stock_unit}</td><td className="num">{fmtMoney(Number(r.value))}</td><td>{r.nearest_expiry ? shortDay(r.nearest_expiry) : '—'}</td></tr>)}</tbody></table>
      </ReportSection>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Depo · Partiler" title="Partiler ve izleme"
        description="Her stok girişi tedarikçi etiketli bir parti açar; çıkışlar son kullanma tarihi en yakın partiden düşer. Hangi tedarikçinin malının nerede ve hangi firmaya gittiği buradan izlenir."
        actions={<ReportButton spec={report} disabled={rows.length === 0} />}
        stats={[
          { label: 'Stok değeri (partiler)', value: <Money value={total} /> },
          { label: 'Açık parti', value: rows.reduce((s, r) => s + Number(r.lot_count), 0) },
          { label: '7 gün içinde SKT', value: soon.length, tone: soon.length ? 'warn' : 'good' },
        ]} />
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'kalan', label: 'Tedarikçi bazında kalan' }, { id: 'skt', label: 'SKT yaklaşan', count: soon.length }, { id: 'izleme', label: 'Lot geri izleme' }, { id: 'partisiz', label: 'Partisiz çıkışlar' }]} /></div>

      {tab === 'kalan' && (
        <Panel pad={false}>
          <ListToolbar search={q} onSearch={setQ} placeholder="Stok kartı veya tedarikçi ara…" />
          {by.isLoading ? <Loading /> : rows.length === 0 ? <EmptyState icon={<Layers className="w-5 h-5" />} title="Açık parti yok">Fatura, sipariş teslimi veya elle stok girişi yapıldıkça partiler burada görünür.</EmptyState> : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2.5">Stok kartı</th><th className="px-2">Tedarikçi</th><th className="px-2 text-right">Kalan</th><th className="px-2 text-right">Değer</th><th className="px-4">En yakın SKT</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={`${r.ingredient_id}${r.supplier_id}`} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-semibold text-ink">{r.ingredient_name}<div className="text-[11px] font-normal text-ink-3">{r.lot_count} parti · ilk giriş {r.oldest_received ? shortDay(r.oldest_received) : '—'}</div></td>
                    <td className="px-2 text-ink-2">{r.supplier_name ?? <span className="text-ink-3">Açılış / elle</span>}</td>
                    <td className="px-2 text-right tc-num">{fmtNum(Number(r.qty_remaining), 2)} {r.stock_unit}</td>
                    <td className="px-2 text-right"><Money value={r.value} /></td>
                    <td className="px-4">{r.nearest_expiry ? <Pill tone={r.nearest_expiry < today ? 'stop' : r.nearest_expiry <= addDays(today, 7) ? 'info' : 'idle'}>{shortDay(r.nearest_expiry)}</Pill> : <span className="text-ink-3">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'skt' && (
        <Panel pad={false} title="Son kullanma tarihi yaklaşan partiler" subtitle="7 gün içinde ya da geçmiş; önce bunlar kullanılır. İmha gerekiyorsa Stok durumu › fire kaydı (nedenli) ile düşün.">
          {lots.isLoading ? <Loading /> : soon.length === 0 ? <EmptyState title="Yaklaşan SKT yok" /> : (
            <ul className="divide-y divide-line">
              {soon.map((l) => {
                const r = nameOf.get(l.ingredient_id);
                const past = l.expiry_date! < today;
                return (
                  <li key={l.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2">
                    <AlertTriangle className={cx('w-4 h-4', past ? 'text-stop' : 'text-wait')} />
                    <span className="font-semibold text-ink">{r?.ingredient_name ?? '—'}</span>
                    {l.lot_no && <span className="text-xs text-ink-3">lot {l.lot_no}</span>}
                    <span className="text-xs text-ink-3">giriş {shortDay(l.received_on)}</span>
                    <span className="ml-auto tc-num text-sm">{fmtNum(Number(l.qty_remaining), 2)} {r?.stock_unit}</span>
                    <Pill tone={past ? 'stop' : 'info'}>{past ? 'SKT geçti' : `SKT ${shortDay(l.expiry_date!)}`}</Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'izleme' && (
        <Panel pad={false} title="Lot geri izleme" subtitle="Tedarikçi partisi → üretim / sevk → firma. Geri çağırma durumunda hangi firmalara gittiği görünür.">
          <ListToolbar search={q} onSearch={setQ} placeholder="Stok kartı, lot no veya tedarikçi (en az 2 harf)…" />
          {q.trim().length < 2 ? <EmptyState icon={<Route className="w-5 h-5" />} title="Aramak için yazın" /> : trace.isLoading ? <Loading /> : (trace.data ?? []).length === 0 ? <EmptyState title="Kayıt yok" /> : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[680px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2.5">Parti</th><th className="px-2">Çıkış</th><th className="px-2 text-right">Miktar</th><th className="px-4">Nereye</th></tr></thead>
                <tbody>{(trace.data ?? []).map((t, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-4 py-2"><div className="font-semibold text-ink">{t.ingredient_name}</div><div className="text-[11px] text-ink-3">{t.supplier_name ?? 'Açılış / elle'} · giriş {shortDay(t.received_on)}{t.lot_no ? ` · lot ${t.lot_no}` : ''}</div></td>
                    <td className="px-2 text-ink-2">{shortDay(t.move_date)} · {KIND[t.kind] ?? t.kind}</td>
                    <td className="px-2 text-right tc-num">{fmtNum(Number(t.qty), 2)}</td>
                    <td className="px-4 text-ink-2">{t.customer_name ?? t.note ?? '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'partisiz' && (
        <Panel pad={false} title="Partisiz çıkışlar" subtitle="Stokta yeterli parti yokken yapılan çıkışlar (negatif stok). Eksik giriş veya sayım farkı olabilir; kontrol edin.">
          {unlot.isLoading ? <Loading /> : (unlot.data ?? []).length === 0 ? <EmptyState title="Partisiz çıkış yok" /> : (
            <ul className="divide-y divide-line">
              {(unlot.data ?? []).map((u) => {
                const ing = u.ingredients as unknown as { name: string; stock_unit: string } | null;
                return (
                  <li key={u.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-wait" />
                    <span className="font-semibold text-ink">{ing?.name ?? '—'}</span>
                    <span className="text-xs text-ink-3">{shortDay(u.created_at.slice(0, 10))}</span>
                    <span className="ml-auto tc-num">{fmtNum(Number(u.qty), 2)} {ing?.stock_unit}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </>
  );
}
