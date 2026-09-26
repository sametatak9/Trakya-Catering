import { useMemo, useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { FolderPlus, Plus, TrendingDown } from 'lucide-react';
import { addMonths, lastMonths, monthLabel, monthRange, todayISO, monthKey, shortDay } from '@/lib/dates';
import { monthlyByCategory, trend } from '@/lib/finance';
import { fmtNum } from '@/lib/format';
import { Delta, Meter, MonthNav, SparkBars } from '@/ui/bits';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { fmtMoney, fmtPct } from '@/lib/format';
import { orderPeople, useOrders } from '../sales/api';
import { useToast } from '@/ui/toast';
import { BulkBar, SelectBox, useSelection } from '@/ui/Selection';
import { useAccounts, useDeleteEntry, useEntries, useFinanceCategories, useSaveEntry, type FinanceEntry } from './api';
import { CategoryDrawer } from './CategoryDrawer';
import { EntryDrawer } from './EntryDrawer';

/** Veri olmasa da her zaman görünen ana kalemler */
const PINNED = ['gida_hammadde', 'elektrik', 'su', 'dogalgaz', 'kira', 'akaryakit', 'arac_bakim', 'personel_maas'];

export const SOURCE_LABEL: Record<string, string> = { manuel: 'Elle', gelen_fatura: 'Fatura', siparis: 'Sipariş', maas: 'Maaş' };

export function ExpensesPage() {
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<FinanceEntry | 'new' | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');
  const months = lastMonths(month, 6);
  const range = { from: monthRange(months[0]).from, to: monthRange(month).to };
  const entries = useEntries(range.from, range.to);
  const cats = useFinanceCategories();
  const { from, to } = monthRange(month);
  const orders = useOrders(from, to);

  const rows = entries.data ?? [];
  const byCat = useMemo(() => monthlyByCategory(rows, 'gider'), [rows]);
  const catList = (cats.data ?? []).filter((c) => c.kind === 'gider');
  const catName = (code: string) => catList.find((c) => c.code === code)?.name ?? code;

  const cards = catList
    .filter((c) => PINNED.includes(c.code) || months.some((m) => (byCat[m]?.[c.code] ?? 0) > 0))
    .map((c) => {
      const perMonth = Object.fromEntries(months.map((m) => [m, byCat[m]?.[c.code] ?? 0]));
      return { c, t: trend(perMonth, month, 6) };
    });
  const monthTotal = Object.values(byCat[month] ?? {}).reduce((a, b) => a + b, 0);
  const prevTotal = Object.values(byCat[addMonths(month, -1)] ?? {}).reduce((a, b) => a + b, 0);
  const people = (orders.data ?? []).filter((o) => o.status !== 'iptal').reduce((s, o) => s + orderPeople(o), 0);
  const monthRows = rows.filter((r) => r.kind === 'gider' && monthKey(r.entry_date) === month && (!selected || r.category_code === selected)
    && (!statusF || r.status === statusF) && matches(q, r.description, r.counterparty, catList.find((c) => c.code === r.category_code)?.name));
  const unpaid = rows.filter((r) => r.kind === 'gider' && monthKey(r.entry_date) === month && r.status === 'bekliyor').reduce((s, r) => s + Number(r.net_amount), 0);
  const biggestRise = [...cards].filter((x) => x.t.delta > 0).sort((a, b) => b.t.delta - a.t.delta)[0];
  const groups = Array.from(new Set(cards.map((x) => x.c.group_name)));

  // Çoklu seçim: toplu ödendi / sil
  const toast = useToast();
  const accounts = useAccounts();
  const saveEntry = useSaveEntry();
  const delEntry = useDeleteEntry();
  const [payAccount, setPayAccount] = useState('');
  const sel = useSelection(monthRows.map((r) => r.id));
  const selectedRows = monthRows.filter((r) => sel.has(r.id));
  const bulkPay = async () => {
    const acc = payAccount || accounts.data?.find((a) => a.kind === 'banka')?.id || accounts.data?.[0]?.id;
    const targets = selectedRows.filter((r) => r.status === 'bekliyor');
    if (!acc || targets.length === 0) return toast.error('Seçilenlerde bekleyen ödeme yok');
    try {
      for (const r of targets) await saveEntry.mutateAsync({ id: r.id, draft: { status: 'odendi', account_id: acc, paid_at: todayISO() } });
      toast.ok(`${targets.length} gider ödendi olarak işaretlendi`); sel.clear();
    } catch (e) { toast.error(e); }
  };
  const bulkDelete = async () => {
    const own = selectedRows.filter((r) => r.source === 'manuel');
    if (own.length === 0) return toast.error('Yalnız elle girilen kayıtlar silinebilir; fatura kayıtları faturadan yönetilir');
    if (!await askConfirm(`${own.length} elle girilmiş gider silinsin mi?`)) return;
    try { for (const r of own) await delEntry.mutateAsync(r.id); toast.ok(`${own.length} kayıt silindi`); sel.clear(); } catch (e) { toast.error(e); }
  };

  const report = (): ReportSpec => ({
    title: 'Gider Analizi',
    subtitle: `${monthLabel(month)} · bu ay / geçen ay karşılaştırmalı`,
    summary: [
      { label: 'Toplam gider', value: `${fmtMoney(monthTotal)} (geçen ay ${fmtMoney(prevTotal)})` },
      ...cards.filter((x) => x.t.current > 0).sort((a, b) => b.t.current - a.t.current).slice(0, 10)
        .map((x) => ({ label: x.c.name, value: `${fmtMoney(x.t.current)}${x.t.pct !== null ? ` (${x.t.delta >= 0 ? '▲' : '▼'} %${fmtNum(Math.abs(x.t.pct), 0)})` : ''}` })),
    ],
    table: {
      filename: `giderler-${month}`,
      header: ['Tarih', 'Kalem', 'Açıklama', 'Kime', 'Durum', 'Tutar ₺ (KDV hariç)', 'KDV ₺'],
      rows: monthRows.map((r) => [r.entry_date, catName(r.category_code), r.description, r.counterparty, r.status === 'odendi' ? 'Ödendi' : 'Bekliyor', r.net_amount, r.vat_amount]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Toplam gider', value: fmtMoney(monthTotal) },
          { label: 'Geçen ay', value: fmtMoney(prevTotal) },
          { label: 'Değişim', value: prevTotal ? fmtPct(((monthTotal - prevTotal) / prevTotal) * 100) : '—' },
          { label: 'Kişi başı gider', value: people ? fmtMoney(monthTotal / people) : '—' },
        ]} />
        <ReportSection title="Kalem bazında">
          <table>
            <thead><tr><th>Grup</th><th>Kalem</th><th className="num">Bu ay</th><th className="num">Geçen ay</th><th className="num">Değişim</th><th className="num">Pay</th></tr></thead>
            <tbody>
              {cards.filter((x) => x.t.current > 0 || x.t.previous > 0).map((x) => (
                <tr key={x.c.code}><td>{x.c.group_name}</td><td>{x.c.name}</td><td className="num">{fmtMoney(x.t.current)}</td><td className="num">{fmtMoney(x.t.previous)}</td>
                  <td className="num" style={{ color: x.t.delta > 0 ? '#C2261F' : x.t.delta < 0 ? '#0F766E' : undefined }}>{x.t.pct === null ? '—' : `${x.t.delta >= 0 ? '▲' : '▼'} %${fmtNum(Math.abs(x.t.pct), 0)}`}</td>
                  <td className="num">{monthTotal ? `%${fmtNum((x.t.current / monthTotal) * 100, 0)}` : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </ReportSection>
      </>
    ),
  });

  return (
    <>
      <ModuleHero
        kicker="Finans · Gider analizi"
        title="Giderler"
        description="Her kalem bu ayı geçen ayla karşılaştırır: kırmızı ok artış, yeşil ok azalış. Onaylanan faturalar buraya kendiliğinden düşer; faturası olmayan giderleri elle ekleyin."
        actions={<>
          <ReportButton spec={report} />
          <Button icon={<FolderPlus className="w-4 h-4" />} onClick={() => setCatOpen(true)}>Kategori ekle</Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Gider ekle</Button>
        </>}
        stats={[
          { label: `${monthLabel(month)} toplam`, value: <Money value={monthTotal} />, hint: <Delta pct={prevTotal ? ((monthTotal - prevTotal) / prevTotal) * 100 : null} delta={monthTotal - prevTotal} goodWhen="down" /> },
          { label: 'Kişi başı gider', value: people ? <Money value={monthTotal / people} /> : '—', hint: people ? `${fmtNum(people, 0)} kişiye göre` : 'bu ay sipariş yok' },
          { label: 'Ödenmemiş', value: <Money value={unpaid} />, tone: unpaid > 0 ? 'warn' : 'default' },
          { label: 'En çok artan', value: biggestRise ? biggestRise.c.name : '—', hint: biggestRise ? <Delta pct={biggestRise.t.pct} delta={biggestRise.t.delta} goodWhen="down" /> : 'artış yok' },
        ]}
      />

      <div className="flex items-center justify-between gap-3 mb-4">
        <MonthNav value={month} onChange={(m) => { setMonth(m); setSelected(null); }} />
        {selected && <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-brand">Filtreyi kaldır ✕</button>}
      </div>

      {entries.isLoading ? <Loading /> : entries.error ? <ErrorNote>Giderler yüklenemedi.</ErrorNote> : (
        <div className="space-y-5 mb-6">
          {groups.map((g) => (
            <section key={g}>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-2">{g}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
                {cards.filter((x) => x.c.group_name === g).map(({ c, t }) => (
                  <button key={c.code} type="button" onClick={() => setSelected(selected === c.code ? null : c.code)}
                    className={cx('tc-card p-4 text-left transition hover:ring-2 hover:ring-brand-soft', selected === c.code && 'ring-2 ring-brand')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-ink truncate">{c.name}</div>
                      <Delta pct={t.pct} delta={t.delta} goodWhen="down" />
                    </div>
                    <div className="flex items-end justify-between gap-3 mt-2">
                      <div>
                        <Money value={t.current} className="text-xl font-bold text-ink" />
                        <div className="text-[11px] text-ink-3 mt-0.5">geçen ay <Money value={t.previous} /></div>
                      </div>
                      <SparkBars series={t.series} labels={months.map((m) => monthLabel(m, true))} className="w-28 h-10" />
                    </div>
                    <div className="mt-3"><Meter value={t.current} max={monthTotal} tone="brand" /></div>
                    <div className="text-[10px] text-ink-3 mt-1">{monthTotal > 0 ? `Ay giderinin %${fmtNum((t.current / monthTotal) * 100, 0)}'i` : 'Bu ay kayıt yok'}</div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Panel pad={false} title={selected ? `${catName(selected)} · ${monthLabel(month)}` : `${monthLabel(month)} gider kayıtları`}
        subtitle="Satıra tıklayarak ödeme durumunu güncelleyin">
        <ListToolbar search={q} onSearch={setQ} placeholder="Açıklama, tedarikçi, kalem ara…"
          filters={<select className="tc-input !w-auto" value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Durum">
            <option value="">Tüm durumlar</option><option value="odendi">Ödendi</option><option value="bekliyor">Bekliyor</option>
          </select>} />
        {monthRows.length === 0 ? (
          <EmptyState icon={<TrendingDown className="w-5 h-5" />} title="Kayıt yok"
            action={<Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Gider ekle</Button>}>
            Gelen e-faturaları yükleyin ya da faturasız giderleri (mazot fişi, tamir, bahşiş…) elle girin.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                  <th className="pl-4 w-8"><SelectBox label="Tümünü seç" checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} /></th>
                  <th className="px-4 py-2.5 font-semibold">Tarih</th>
                  <th className="px-3 py-2.5 font-semibold">Kalem</th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Kime</th>
                  <th className="px-3 py-2.5 font-semibold">Durum</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => (
                  <tr key={r.id} onClick={() => setEditing(r)} className={cx('border-b border-line last:border-0 cursor-pointer hover:bg-surface-2', sel.has(r.id) && 'bg-brand-soft/40')}>
                    <td className="pl-4" onClick={(e) => e.stopPropagation()}><SelectBox label="Seç" checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} /></td>
                    <td className="px-4 py-2.5 tc-num text-ink-2 whitespace-nowrap">{shortDay(r.entry_date)}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-ink">{catName(r.category_code)}</div>
                      <div className="text-[11px] text-ink-3">{r.description} · {SOURCE_LABEL[r.source]}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-ink-2">{r.counterparty ?? '—'}</td>
                    <td className="px-3 py-2.5">{r.status === 'odendi' ? <Pill tone="ok">Ödendi</Pill> : <Pill tone="wait">Bekliyor</Pill>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Money value={r.net_amount} className="font-semibold text-ink" />
                      {Number(r.vat_amount) > 0 && <div className="text-[10px] text-ink-3">+KDV <Money value={r.vat_amount} /></div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <BulkBar count={sel.count} onClear={sel.clear} noun="gider">
        <span className="text-xs text-ink-3 tc-num">Toplam <Money value={selectedRows.reduce((t, r) => t + Number(r.total_amount ?? 0), 0)} className="font-semibold text-ink" /></span>
        <select className="tc-input !w-auto !py-1.5 text-xs" value={payAccount} onChange={(e) => setPayAccount(e.target.value)} aria-label="Ödeme hesabı">
          <option value="">Banka</option>
          {(accounts.data ?? []).map((a) => <option key={a.id!} value={a.id!}>{a.name}</option>)}
        </select>
        <Button size="sm" variant="holo" onClick={bulkPay} loading={saveEntry.isPending}>Ödendi yap</Button>
        <Button size="sm" variant="danger" onClick={bulkDelete} loading={delEntry.isPending}>Sil</Button>
      </BulkBar>
      {editing && <EntryDrawer entry={editing === 'new' ? null : editing} defaultKind="gider" defaultCategory={selected ?? undefined} onClose={() => setEditing(null)} />}
      {catOpen && <CategoryDrawer onClose={() => setCatOpen(false)} />}
    </>
  );
}
