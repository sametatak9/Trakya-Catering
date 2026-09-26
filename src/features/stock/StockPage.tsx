import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Plus } from 'lucide-react';
import { useCan } from '@/app/session';
import { useInsertRows, useRows, useSaveRow } from '@/lib/crud';
import { addDays, shortDay, todayISO } from '@/lib/dates';
import { INGREDIENT_CATEGORIES } from '@/lib/domain';
import { fmtMoney, fmtNum, parseNum } from '@/lib/format';
import { daysOfCover, stockLevels } from '@/lib/stock';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { FormDrawer } from '@/ui/FormDrawer';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { Button, Drawer, EmptyState, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients } from '../kitchen/api';

export const MOVE_KINDS: Record<string, { label: string; tone: 'ok' | 'wait' | 'stop' | 'info' | 'idle' }> = {
  giris: { label: 'Giriş', tone: 'ok' }, cikis: { label: 'Mutfağa çıkış', tone: 'info' }, sevk: { label: 'Firmaya sevk', tone: 'wait' },
  fire: { label: 'Fire / bozulma', tone: 'stop' }, sayim: { label: 'Sayım farkı', tone: 'idle' },
};
export const MOVE_SOURCES: Record<string, string> = { fatura: 'Alış faturası', hazirlik: 'Günlük hazırlık', sevk: 'Sevk', elle: 'Elle', sayim: 'Sayım', siparis: 'Satınalma siparişi' };

export function useStockMoves(from?: string) {
  return useRows('stock_movements', { key: [from ?? 'all'], order: 'move_date', ascending: false, filter: from ? (q) => q.gte('move_date', from) : undefined });
}

export function StockPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'depo', 'asci_basi', 'satinalma']);
  const ingredients = useIngredients();
  const moves = useStockMoves();
  const save = useSaveRow('stock_movements', ['ingredients']);
  const insert = useInsertRows('stock_movements', ['ingredients']);
  const [tab, setTab] = useState<'durum' | 'hareket' | 'sayim'>('durum');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [adding, setAdding] = useState<'giris' | 'cikis' | 'fire' | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const today = todayISO();

  const ings = (ingredients.data ?? []).filter((i) => i.active && i.category !== 'temizlik_sarf' || true);
  const all = moves.data ?? [];
  const levels = useMemo(() => stockLevels(all.map((m) => ({ ...m, qty: Number(m.qty) }))), [all]);
  const rows = ings.map((i) => {
    const onHand = levels.get(i.id) ?? 0;
    const cost = Number(i.avg_cost ?? i.last_price ?? 0);
    return { i, onHand, value: onHand * cost, cost, cover: daysOfCover(all.map((m) => ({ ...m, qty: Number(m.qty) })), i.id, onHand, today), low: Number(i.min_stock) > 0 && onHand < Number(i.min_stock) };
  });
  const shown = rows.filter((r) => (!cat || r.i.category === cat) && (!onlyLow || r.low || r.onHand < 0) && matches(q, r.i.name, r.i.code));
  const totalValue = rows.reduce((s, r) => s + Math.max(r.value, 0), 0);
  const lowCount = rows.filter((r) => r.low).length;
  const monthOut = all.filter((m) => m.move_date >= addDays(today, -30) && Number(m.qty) < 0 && m.kind !== 'sayim').reduce((s, m) => {
    const i = ings.find((x) => x.id === m.ingredient_id); return s + -Number(m.qty) * Number(m.unit_cost ?? i?.avg_cost ?? i?.last_price ?? 0);
  }, 0);
  const ingName = (id: string) => ings.find((x) => x.id === id)?.name ?? '—';
  const unitOf = (id: string) => ings.find((x) => x.id === id)?.stock_unit ?? '';

  const report = (): ReportSpec => ({
    title: 'Stok Durum Raporu', subtitle: `${shortDay(today)} · ${shown.length} kalem · değer ${fmtMoney(totalValue)}`,
    summary: shown.filter((r) => r.onHand !== 0 || r.low).slice(0, 30).map((r) => ({ label: r.i.name, value: `${fmtNum(r.onHand, 2)} ${r.i.stock_unit}${r.low ? ' (kritik)' : ''}` })),
    table: { filename: `stok-${today}`, header: ['Hammadde', 'Kategori', 'Eldeki', 'Birim', 'Kritik seviye', 'Ort. maliyet ₺', 'Değer ₺', 'Kaç gün yeter'],
      rows: shown.map((r) => [r.i.name, INGREDIENT_CATEGORIES[r.i.category], r.onHand, r.i.stock_unit, r.i.min_stock, r.cost, Math.round(r.value * 100) / 100, r.cover]) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Stok değeri', value: fmtMoney(totalValue) }, { label: 'Kalem', value: shown.length }, { label: 'Kritik seviyede', value: lowCount }, { label: 'Son 30 gün çıkış', value: fmtMoney(monthOut) }]} />
        <ReportSection title="Stok durumu">
          <table><thead><tr><th>Hammadde</th><th className="num">Eldeki</th><th className="num">Kritik</th><th className="num">Ort. maliyet</th><th className="num">Değer</th><th className="num">Yeter</th></tr></thead>
            <tbody>{shown.map((r) => <tr key={r.i.id}><td>{r.i.name}{r.low ? ' ⚠' : ''}</td><td className="num">{fmtNum(r.onHand, 2)} {r.i.stock_unit}</td><td className="num">{fmtNum(r.i.min_stock, 0)}</td>
              <td className="num">{fmtMoney(r.cost, true)}</td><td className="num">{fmtMoney(r.value)}</td><td className="num">{r.cover === null ? '—' : `${fmtNum(r.cover, 0)} gün`}</td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  const saveCounts = async () => {
    const out = Object.entries(counts).map(([id, v]) => {
      const counted = parseNum(v); if (counted === null) return null;
      const diff = Math.round((counted - (levels.get(id) ?? 0)) * 1000) / 1000;
      return diff === 0 ? null : { ingredient_id: id, move_date: today, kind: 'sayim', qty: diff, source: 'sayim', note: `Sayım: ${counted}` };
    }).filter(Boolean) as Record<string, unknown>[];
    if (out.length === 0) return toast.error('Fark çıkan sayım yok');
    try { await insert.mutateAsync({ rows: out }); toast.ok(`${out.length} kalemde sayım farkı işlendi`); setCounts({}); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <ModuleHero kicker="Depo" title="Stok & Depo"
        description="Eldeki miktar hareketlerden hesaplanır: alış faturası girişi, mutfağa çıkış (günlük hazırlıktan), firmalara sevk, fire ve sayım farkı. Girişte ortalama maliyet kendiliğinden güncellenir."
        actions={<>
          <ReportButton spec={report} disabled={rows.length === 0} />
          {canEdit && <>
            <Button icon={<ArrowUpFromLine className="w-4 h-4" />} onClick={() => setAdding('cikis')}>Çıkış</Button>
            <Button variant="primary" icon={<ArrowDownToLine className="w-4 h-4" />} onClick={() => setAdding('giris')}>Giriş</Button>
          </>}
        </>}
        stats={[
          { label: 'Stok değeri', value: <Money value={totalValue} />, source: report },
          { label: 'Kritik seviyede', value: lowCount, tone: lowCount ? 'warn' : 'good', hint: 'kritik seviye hammadde kartında' },
          { label: 'Son 30 gün çıkış', value: <Money value={monthOut} /> },
          { label: 'Hareket (toplam)', value: fmtNum(all.length, 0) },
        ]} />

      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'durum', label: 'Stok durumu' }, { id: 'hareket', label: 'Hareketler', count: all.length }, { id: 'sayim', label: 'Sayım' }]} /></div>

      {tab === 'durum' && (
        <Panel pad={false}>
          <ListToolbar search={q} onSearch={setQ} placeholder="Hammadde ara…" filters={<>
            <select className="tc-input !w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori"><option value="">Tüm kategoriler</option>
              {Object.entries(INGREDIENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <label className="flex items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Yalnız kritik</label>
          </>} />
          {ingredients.isLoading || moves.isLoading ? <Loading /> : shown.length === 0 ? (
            <EmptyState icon={<Boxes className="w-5 h-5" />} title="Kayıt yok">Hammaddeler ekranından malzeme ekleyin; alış faturasındaki “Fiyat ve stoğa işle” ile stok kendiliğinden girer.</EmptyState>
          ) : (
            <div className="overflow-x-auto tc-scroll">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="px-4 py-2.5">Hammadde</th><th className="px-2 text-right">Eldeki</th><th className="px-2 text-right">Ort. maliyet</th><th className="px-2 text-right">Değer</th><th className="px-4 text-right">Kaç gün yeter</th>
                </tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.i.id} onClick={() => setDetail(r.i.id)} className="border-b border-line last:border-0 cursor-pointer hover:bg-surface-2">
                      <td className="px-4 py-2.5"><div className="font-semibold text-ink">{r.i.name}</div><div className="text-[11px] text-ink-3">{INGREDIENT_CATEGORIES[r.i.category]}{Number(r.i.min_stock) > 0 ? ` · kritik ${fmtNum(r.i.min_stock, 0)} ${r.i.stock_unit}` : ''}</div></td>
                      <td className={cx('px-2 text-right tc-num font-semibold', r.onHand < 0 ? 'text-stop' : r.low ? 'text-wait' : 'text-ink')}>{fmtNum(r.onHand, 2)} {r.i.stock_unit}{r.low && <div><Pill tone="wait">kritik</Pill></div>}</td>
                      <td className="px-2 text-right"><Money value={r.cost} precise /></td>
                      <td className="px-2 text-right"><Money value={r.value} /></td>
                      <td className={cx('px-4 text-right tc-num', r.cover !== null && r.cover < 3 && 'text-stop font-semibold')}>{r.cover === null ? '—' : `${fmtNum(r.cover, 0)} gün`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === 'hareket' && (
        <Panel pad={false} title="Son hareketler">
          {all.length === 0 ? <EmptyState title="Hareket yok" /> : (
            <ul className="divide-y divide-line">
              {all.slice(0, 200).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-16 text-xs text-ink-3 tc-num">{shortDay(m.move_date)}</span>
                  <Pill tone={MOVE_KINDS[m.kind].tone}>{MOVE_KINDS[m.kind].label}</Pill>
                  <span className="flex-1 min-w-0"><span className="font-medium text-ink">{ingName(m.ingredient_id)}</span><span className="block text-[11px] text-ink-3 truncate">{MOVE_SOURCES[m.source]}{m.note ? ` · ${m.note}` : ''}</span></span>
                  <span className={cx('tc-num font-semibold', Number(m.qty) > 0 ? 'text-ok' : 'text-ink')}>{Number(m.qty) > 0 ? '+' : ''}{fmtNum(m.qty, 3)} {unitOf(m.ingredient_id)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'sayim' && (
        <Panel pad={false} title="Sayım" subtitle="Depoda saydığınız miktarı yazın; fark “sayım farkı” olarak işlenir"
          action={canEdit && <Button size="sm" variant="holo" icon={<ClipboardCheck className="w-3.5 h-3.5" />} onClick={saveCounts} loading={insert.isPending}>Sayımı işle</Button>}>
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line"><th className="px-4 py-2.5">Hammadde</th><th className="px-2 text-right">Sistemde</th><th className="px-2 w-40">Sayılan</th><th className="px-4 text-right">Fark</th></tr></thead>
              <tbody>
                {rows.filter((r) => matches(q, r.i.name)).map((r) => {
                  const c = parseNum(counts[r.i.id] ?? ''); const diff = c === null ? null : c - r.onHand;
                  return (
                    <tr key={r.i.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2 font-medium text-ink">{r.i.name}</td>
                      <td className="px-2 text-right tc-num">{fmtNum(r.onHand, 2)} {r.i.stock_unit}</td>
                      <td className="px-2"><input className="tc-input tc-num !py-1.5 text-right" inputMode="decimal" value={counts[r.i.id] ?? ''} disabled={!canEdit}
                        onChange={(e) => setCounts({ ...counts, [r.i.id]: e.target.value })} aria-label={`${r.i.name} sayılan`} /></td>
                      <td className={cx('px-4 text-right tc-num', diff !== null && diff < 0 ? 'text-stop' : 'text-ok')}>{diff === null || diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmtNum(diff, 3)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {adding && (
        <FormDrawer open title={adding === 'giris' ? 'Stok girişi' : adding === 'cikis' ? 'Mutfağa çıkış' : 'Fire / bozulma'} onClose={() => setAdding(null)} saving={save.isPending}
          fields={[
            { key: 'ingredient_id', label: 'Hammadde', type: 'select', required: true, span: 2, options: ings.map((i) => ({ value: i.id, label: `${i.name} (${i.stock_unit})` })) },
            { key: 'kind', label: 'Hareket', type: 'select', required: true, options: [{ value: 'giris', label: 'Giriş' }, { value: 'cikis', label: 'Mutfağa çıkış' }, { value: 'fire', label: 'Fire / bozulma' }] },
            { key: 'qty', label: 'Miktar (stok biriminde)', type: 'number', required: true },
            { key: 'unit_cost', label: 'Birim maliyet ₺ (giriş)', type: 'money', show: (v) => v.kind === 'giris', hint: 'Boşsa son alış fiyatı' },
            { key: 'move_date', label: 'Tarih', type: 'date', required: true },
            { key: 'note', label: 'Not', span: 2 },
          ]}
          initial={{ kind: adding, move_date: today }}
          onSave={async (v) => {
            const qty = Math.abs(Number(v.qty));
            if (!(qty > 0)) throw new Error('Miktar sıfırdan büyük olmalı');
            const ing = ings.find((i) => i.id === v.ingredient_id);
            await save.mutateAsync({ row: { ...v, qty: v.kind === 'giris' ? qty : -qty, unit_cost: v.unit_cost ?? ing?.last_price ?? null, source: 'elle' } });
            toast.ok('Stok hareketi kaydedildi'); setAdding(null);
          }} />
      )}

      {detail && (
        <Drawer open onClose={() => setDetail(null)} title={ingName(detail)} subtitle={`Eldeki ${fmtNum(levels.get(detail) ?? 0, 3)} ${unitOf(detail)}`}
          footer={canEdit && <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setDetail(null); setAdding('giris'); }}>Hareket ekle</Button>}>
          <ul className="divide-y divide-line">
            {all.filter((m) => m.ingredient_id === detail).map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-14 text-xs text-ink-3">{shortDay(m.move_date)}</span>
                <Pill tone={MOVE_KINDS[m.kind].tone}>{MOVE_KINDS[m.kind].label}</Pill>
                <span className="flex-1 text-xs text-ink-3 truncate">{m.note ?? MOVE_SOURCES[m.source]}</span>
                <span className="tc-num font-semibold">{Number(m.qty) > 0 ? '+' : ''}{fmtNum(m.qty, 3)}</span>
              </li>
            ))}
            {all.filter((m) => m.ingredient_id === detail).length === 0 && <li className="py-4 text-sm text-ink-3">Hareket yok.</li>}
          </ul>
        </Drawer>
      )}
    </>
  );
}
