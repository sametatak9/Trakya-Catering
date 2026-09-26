import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Landmark, Plus, Wallet } from 'lucide-react';
import { useCan } from '@/app/session';
import { addMonths, monthKey, monthLabel, monthRange, shortDay, todayISO } from '@/lib/dates';
import { ROLES } from '@/lib/domain';
import { amountOf } from '@/lib/finance';
import { Delta, MonthNav } from '@/ui/bits';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { fmtMoney } from '@/lib/format';
import { useAccounts, useCashMovements, useEntries, useFinanceCategories, useOpenItems, useSaveEntry, type FinanceEntry } from './api';
import { EntryDrawer } from './EntryDrawer';

const cashDate = (e: FinanceEntry) => e.paid_at ?? e.entry_date;
const total = (e: FinanceEntry) => Number(e.total_amount ?? Number(e.net_amount) + Number(e.vat_amount));

export function CashPage() {
  const toast = useToast();
  const canEdit = useCan(ROLES.finance);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const [editing, setEditing] = useState<{ entry: FinanceEntry | null; kind: 'gelir' | 'gider' } | null>(null);
  const today = todayISO();
  const { from, to } = monthRange(month);
  const accounts = useAccounts();
  const moves = useCashMovements(from);
  const open = useOpenItems();
  const cats = useFinanceCategories();
  const accrual = useEntries(monthRange(addMonths(month, -1)).from, to);
  const save = useSaveEntry();
  const catName = (code: string) => (cats.data ?? []).find((c) => c.code === code)?.name ?? code;

  const balances = accounts.data ?? [];
  const totalBalance = balances.reduce((s, a) => s + Number(a.balance ?? 0), 0);
  const [payAccount, setPayAccount] = useState<string>('');
  const acc = payAccount || balances[0]?.id || '';

  // Ay içi nakit hareketleri, günlere göre; ay başı bakiyesi = bugünkü bakiye − ay başından bugüne net hareket
  const all = moves.data ?? [];
  const inMonth = all.filter((e) => cashDate(e) >= from && cashDate(e) <= to);
  const afterMonth = all.filter((e) => cashDate(e) > to);
  const net = (xs: FinanceEntry[]) => xs.reduce((s, e) => s + (e.kind === 'gelir' ? total(e) : -total(e)), 0);
  const monthEnd = totalBalance - net(afterMonth);
  const monthStart = monthEnd - net(inMonth);
  const days = useMemo(() => {
    const map = new Map<string, FinanceEntry[]>();
    for (const e of inMonth) { const d = cashDate(e); map.set(d, [...(map.get(d) ?? []), e]); }
    let bal = monthStart;
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, items]) => {
      const inn = items.filter((e) => e.kind === 'gelir').reduce((s, e) => s + total(e), 0);
      const out = items.filter((e) => e.kind === 'gider').reduce((s, e) => s + total(e), 0);
      bal += inn - out;
      return { d, items, inn, out, bal };
    }).reverse();
  }, [inMonth, monthStart]);

  const openItems = open.data ?? [];
  const receivables = openItems.filter((e) => e.kind === 'gelir');
  const payables = openItems.filter((e) => e.kind === 'gider');
  const overdue = (e: FinanceEntry) => (e.due_date ?? e.entry_date) < today;

  const accRows = accrual.data ?? [];
  const incomeThis = accRows.filter((e) => e.kind === 'gelir' && monthKey(e.entry_date) === month).reduce((s, e) => s + amountOf(e), 0);
  const incomePrev = accRows.filter((e) => e.kind === 'gelir' && monthKey(e.entry_date) === addMonths(month, -1)).reduce((s, e) => s + amountOf(e), 0);

  const settle = (e: FinanceEntry) => {
    if (!acc) return toast.error('Önce bir hesap tanımlı olmalı');
    save.mutate({ id: e.id, draft: { status: 'odendi', account_id: acc, paid_at: today } },
      { onSuccess: () => toast.ok(e.kind === 'gelir' ? 'Tahsilat kaydedildi' : 'Ödeme kaydedildi'), onError: toast.error });
  };

  const report = (): ReportSpec => ({
    title: 'Kasa Hareketleri',
    subtitle: `${monthLabel(month)} · ay başı ${fmtMoney(monthStart)} → ay sonu ${fmtMoney(monthEnd)}`,
    summary: [
      ...balances.map((a) => ({ label: a.name ?? '', value: fmtMoney(a.balance) })),
      { label: 'Tahsil edilecek', value: fmtMoney(receivables.reduce((s, e) => s + total(e), 0)) },
      { label: 'Ödenecek', value: fmtMoney(payables.reduce((s, e) => s + total(e), 0)) },
    ],
    table: {
      filename: `kasa-${month}`,
      header: ['Tarih', 'Tür', 'Karşı taraf', 'Kalem', 'Tutar ₺ (KDV dahil)'],
      rows: [...inMonth].sort((a, b) => cashDate(a).localeCompare(cashDate(b)))
        .map((e) => [cashDate(e), e.kind === 'gelir' ? 'Giriş' : 'Çıkış', e.counterparty, catName(e.category_code), e.kind === 'gelir' ? total(e) : -total(e)]),
    },
    body: () => (
      <>
        <ReportStats items={[
          { label: 'Ay başı', value: fmtMoney(monthStart) },
          { label: 'Giriş', value: fmtMoney(inMonth.filter((e) => e.kind === 'gelir').reduce((s, e) => s + total(e), 0)) },
          { label: 'Çıkış', value: fmtMoney(inMonth.filter((e) => e.kind === 'gider').reduce((s, e) => s + total(e), 0)) },
          { label: 'Ay sonu', value: fmtMoney(monthEnd) },
        ]} />
        <ReportSection title="Günlük hareketler">
          <table>
            <thead><tr><th>Tarih</th><th>Tür</th><th>Karşı taraf · kalem</th><th className="num">Tutar</th><th className="num">Gün sonu bakiye</th></tr></thead>
            <tbody>
              {[...days].reverse().flatMap((day) => day.items.map((e, i) => (
                <tr key={e.id}><td>{i === 0 ? shortDay(day.d) : ''}</td><td>{e.kind === 'gelir' ? 'Giriş' : 'Çıkış'}</td>
                  <td>{[e.counterparty, catName(e.category_code)].filter(Boolean).join(' · ')}</td>
                  <td className="num">{e.kind === 'gelir' ? '+' : '−'}{fmtMoney(total(e))}</td><td className="num">{i === day.items.length - 1 ? fmtMoney(day.bal) : ''}</td></tr>
              )))}
            </tbody>
          </table>
        </ReportSection>
      </>
    ),
  });

  const OpenList = ({ items, kind }: { items: FinanceEntry[]; kind: 'gelir' | 'gider' }) => (
    items.length === 0 ? <p className="text-sm text-ink-3">{kind === 'gelir' ? 'Bekleyen alacak yok.' : 'Bekleyen borç yok.'}</p> : (
      <ul className="divide-y divide-line -my-2">
        {items.slice(0, 12).map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing({ entry: e, kind })}>
              <div className="text-sm font-medium text-ink truncate">{e.counterparty ?? catName(e.category_code)}</div>
              <div className={cx('text-[11px]', overdue(e) ? 'text-stop font-semibold' : 'text-ink-3')}>
                {overdue(e) ? 'Vadesi geçti · ' : 'Vade '}{shortDay(e.due_date ?? e.entry_date)} · {catName(e.category_code)}
              </div>
            </div>
            <Money value={total(e)} className="text-sm font-semibold text-ink whitespace-nowrap" />
            {canEdit && <Button size="sm" variant={kind === 'gelir' ? 'ghost' : 'ghost'} onClick={() => settle(e)} disabled={save.isPending}>
              {kind === 'gelir' ? 'Tahsil et' : 'Öde'}</Button>}
          </li>
        ))}
        {items.length > 12 && <li className="py-2 text-xs text-ink-3">+{items.length - 12} kayıt daha</li>}
      </ul>
    )
  );

  return (
    <>
      <ModuleHero
        kicker="Finans · Nakit akışı"
        title="Kasa & Gelirler"
        description="Kasadaki ve bankadaki para, tahsil edilecek alacaklar ve ödenecek borçlar. Her girdi bakiyeyi anında artırır veya azaltır."
        actions={<>
          <ReportButton spec={report} />
          {canEdit && <><Button icon={<ArrowUpRight className="w-4 h-4" />} onClick={() => setEditing({ entry: null, kind: 'gider' })}>Gider / ödeme</Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing({ entry: null, kind: 'gelir' })}>Gelir ekle</Button></>}
        </>}
        stats={[
          { label: 'Toplam bakiye', value: <Money value={totalBalance} />, tone: totalBalance < 0 ? 'warn' : 'default' },
          { label: `${monthLabel(month)} gelir`, value: <Money value={incomeThis} />, hint: <Delta pct={incomePrev ? ((incomeThis - incomePrev) / incomePrev) * 100 : null} delta={incomeThis - incomePrev} goodWhen="up" /> },
          { label: 'Tahsil edilecek', value: <Money value={receivables.reduce((s, e) => s + total(e), 0)} />, hint: `${receivables.filter(overdue).length} vadesi geçmiş` },
          { label: 'Ödenecek', value: <Money value={payables.reduce((s, e) => s + total(e), 0)} />, tone: payables.some(overdue) ? 'warn' : 'default', hint: `${payables.filter(overdue).length} vadesi geçmiş` },
        ]}
      />

      {accounts.isLoading ? <Loading /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {balances.map((a) => (
            <button key={a.id} type="button" onClick={() => setPayAccount(a.id!)}
              className={cx('tc-card p-4 text-left', acc === a.id && 'ring-2 ring-brand')}>
              <div className="flex items-center gap-2 text-xs font-semibold text-ink-3">
                {a.kind === 'kasa' ? <Wallet className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}{a.name}
              </div>
              <Money value={a.balance} className={cx('text-xl font-bold mt-1 block', Number(a.balance) < 0 ? 'text-stop' : 'text-ink')} />
              {acc === a.id && <div className="text-[10px] text-brand font-semibold mt-1">Tahsilat/ödeme bu hesaba</div>}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-5">
        <Panel title={<span className="inline-flex items-center gap-2"><ArrowDownLeft className="w-4 h-4 text-ok" />Tahsil edilecekler</span>} subtitle="Müşteri alacakları (teslim edilen siparişler, organizasyonlar)">
          {open.isLoading ? <Loading /> : <OpenList items={receivables} kind="gelir" />}
        </Panel>
        <Panel title={<span className="inline-flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-stop" />Ödenecekler</span>} subtitle="Onaylanan faturalar ve bekleyen giderler">
          {open.isLoading ? <Loading /> : <OpenList items={payables} kind="gider" />}
        </Panel>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-ink">Günlük hareketler</h2>
        <MonthNav value={month} onChange={setMonth} />
      </div>
      <Panel pad={false}>
        {moves.isLoading ? <Loading /> : moves.error ? <div className="p-4"><ErrorNote>Hareketler yüklenemedi.</ErrorNote></div>
          : days.length === 0 ? (
            <EmptyState icon={<Wallet className="w-5 h-5" />} title="Bu ay nakit hareketi yok">
              Tahsilat, ödeme veya elle gelir/gider girdiğinizde günlük bakiye burada oluşur.
            </EmptyState>
          ) : (
            <div className="divide-y divide-line">
              <div className="flex justify-between px-4 sm:px-5 py-2.5 text-xs text-ink-3 bg-surface-2/60 rounded-t-[18px]">
                <span>Ay sonu bakiyesi</span><Money value={monthEnd} className="font-semibold text-ink" />
              </div>
              {days.map((day) => (
                <div key={day.d} className="px-4 sm:px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">{shortDay(day.d)}</div>
                    <div className="flex items-center gap-3 text-xs tc-num">
                      {day.inn > 0 && <span className="text-ok">+<Money value={day.inn} /></span>}
                      {day.out > 0 && <span className="text-stop">−<Money value={day.out} /></span>}
                      <span className="text-ink-3">bakiye <Money value={day.bal} className="text-ink font-semibold" /></span>
                    </div>
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {day.items.map((e) => (
                      <li key={e.id} onClick={() => canEdit && setEditing({ entry: e, kind: e.kind as 'gelir' | 'gider' })}
                        className="flex items-center justify-between gap-3 text-sm cursor-pointer rounded-lg px-2 py-1 -mx-2 hover:bg-surface-2">
                        <span className="min-w-0 truncate text-ink-2">
                          <Pill tone={e.kind === 'gelir' ? 'ok' : 'brand'} className="mr-2">{e.kind === 'gelir' ? 'Giriş' : 'Çıkış'}</Pill>
                          {e.counterparty ? `${e.counterparty} · ` : ''}{catName(e.category_code)}
                        </span>
                        <span className={cx('tc-num whitespace-nowrap', e.kind === 'gelir' ? 'text-ok' : 'text-ink')}>
                          {e.kind === 'gelir' ? '+' : '−'}<Money value={total(e)} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex justify-between px-4 sm:px-5 py-2.5 text-xs text-ink-3 bg-surface-2/60 rounded-b-[18px]">
                <span>Ay başı bakiyesi</span><Money value={monthStart} className="font-semibold text-ink" />
              </div>
            </div>
          )}
      </Panel>

      {editing && <EntryDrawer entry={editing.entry} defaultKind={editing.kind} onClose={() => setEditing(null)} />}
    </>
  );
}
