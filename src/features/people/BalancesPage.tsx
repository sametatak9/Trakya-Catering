import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HandCoins, Plus, Wallet } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useInsertRows, useSaveRow } from '@/lib/crud';
import { shortDay, todayISO } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { ledgerBalance } from '@/lib/payroll';
import { DEMO, supabase } from '@/lib/supabase';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { askConfirm } from '@/ui/confirm';
import { FormDrawer } from '@/ui/FormDrawer';
import { BulkBar, SelectBox, useSelection } from '@/ui/Selection';
import { Button, Drawer, EmptyState, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useAccounts } from '../finance/api';
import { LEDGER_KINDS, useEmployees, useLedger, type Employee } from './api';

/** Personel bakiyeleri: hakediş (+), prim (+), avans (−), kesinti (−), ödeme (−). Avans ve ödeme kasadan/bankadan gider olarak düşer. */
export function BalancesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const canEdit = useCan(['yonetici', 'muhasebe']);
  const employees = useEmployees();
  const ledger = useLedger();
  const accounts = useAccounts();
  const insert = useInsertRows('employee_ledger', ['finance']);
  const [open, setOpen] = useState<Employee | null>(null);
  const [payAcc, setPayAcc] = useState('');

  // Canlı: başka biri avans/ödeme girince ekran kendiliğinden tazelenir
  useEffect(() => {
    if (DEMO) return;
    const ch = supabase.channel(`employee_ledger:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_ledger' }, () => void qc.invalidateQueries({ queryKey: ['t', 'employee_ledger'] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const emps = (employees.data ?? []).filter((e) => e.active);
  const rows = useMemo(() => emps.map((e) => {
    const l = (ledger.data ?? []).filter((x) => x.employee_id === e.id);
    const sum = (k: string) => l.filter((x) => x.kind === k).reduce((s, x) => s + Number(x.amount), 0);
    return { e, hakedis: sum('hakedis') + sum('prim'), avans: sum('avans'), kesinti: sum('kesinti'), odeme: sum('odeme'),
      balance: ledgerBalance(l.map((x) => ({ kind: x.kind, amount: Number(x.amount) }))), last: l[0]?.entry_date };
  }), [emps, ledger.data]);
  const owed = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);
  const advances = rows.reduce((s, r) => s + r.avans, 0);
  const sel = useSelection(canEdit ? rows.filter((r) => r.balance > 0).map((r) => r.e.id) : []);
  const bankId = payAcc || (accounts.data ?? []).find((a) => a.kind === 'banka')?.id || (accounts.data ?? [])[0]?.id || '';

  const payAll = async () => {
    const targets = rows.filter((r) => sel.has(r.e.id) && r.balance > 0);
    const acc = (accounts.data ?? []).find((a) => a.id === bankId);
    if (!acc) return toast.error('Ödeme hesabı seçin');
    const total = targets.reduce((s, r) => s + r.balance, 0);
    if (!(await askConfirm(`${targets.length} personele toplam ${fmtMoney(total)} “${acc.name}” hesabından ödensin mi? Gider olarak kasaya işlenir.`))) return;
    try {
      await insert.mutateAsync({ rows: targets.map((r) => ({ employee_id: r.e.id, entry_date: todayISO(), kind: 'odeme', amount: Math.round(r.balance * 100) / 100, account_id: acc.id, description: 'Maaş / hakediş ödemesi' })) });
      toast.ok(`${targets.length} ödeme yapıldı`); sel.clear();
    } catch (e) { toast.error(e); }
  };

  const report = (): ReportSpec => ({
    title: 'Personel Bakiyeleri', subtitle: `${shortDay(todayISO())} · hakediş − avans − kesinti − ödeme`,
    summary: rows.map((r) => ({ label: r.e.full_name, value: fmtMoney(r.balance) })),
    table: { filename: 'personel-bakiye', header: ['Personel', 'Hakediş+prim ₺', 'Avans ₺', 'Kesinti ₺', 'Ödeme ₺', 'Bakiye ₺'],
      rows: rows.map((r) => [r.e.full_name, r.hakedis, r.avans, r.kesinti, r.odeme, r.balance]) },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Personele borç', value: fmtMoney(owed) }, { label: 'Verilen avans', value: fmtMoney(advances) }, { label: 'Personel', value: rows.length }]} />
        <ReportSection title="Personel bazında">
          <table><thead><tr><th>Personel</th><th className="num">Hakediş+prim</th><th className="num">Avans</th><th className="num">Kesinti</th><th className="num">Ödeme</th><th className="num">Bakiye</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.e.id}><td>{r.e.full_name}</td><td className="num">{fmtMoney(r.hakedis)}</td><td className="num">{fmtMoney(r.avans)}</td>
              <td className="num">{fmtMoney(r.kesinti)}</td><td className="num">{fmtMoney(r.odeme)}</td><td className="num"><b>{fmtMoney(r.balance)}</b></td></tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Personel · Canlı hesap" title="Personel Bakiyeleri"
        description="Her personelin güncel alacağı: puantajdan gelen hakediş ve prim artırır; avans, kesinti ve ödeme azaltır. Avans ve maaş ödemeleri seçtiğiniz kasa ya da bankadan gider olarak düşer."
        actions={<ReportButton spec={report} disabled={rows.length === 0} />}
        stats={[
          { label: 'Personele borç', value: <Money value={owed} />, tone: owed > 0 ? 'warn' : 'good', source: report },
          { label: 'Verilen avans (toplam)', value: <Money value={advances} />, source: report },
          { label: 'Ödenecek personel', value: rows.filter((r) => r.balance > 0).length },
          { label: 'Personel', value: rows.length },
        ]} />

      <Panel pad={false} title="Bakiyeler" subtitle="Satıra dokunun: hesap ekstresi, avans, prim, kesinti, ödeme">
        {employees.isLoading || ledger.isLoading ? <Loading /> : rows.length === 0 ? (
          <EmptyState icon={<Wallet className="w-5 h-5" />} title="Personel yok">Önce Personel ekranından çalışanları ekleyin.</EmptyState>
        ) : (
          <div className="overflow-x-auto tc-scroll">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
                {canEdit && <th className="pl-4 w-8"><SelectBox label="Tümünü seç" checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} /></th>}
                <th className="px-4 py-2.5">Personel</th><th className="px-2 text-right">Hakediş+prim</th><th className="px-2 text-right">Avans</th><th className="px-2 text-right">Ödeme</th><th className="px-4 text-right">Bakiye</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.e.id} onClick={() => setOpen(r.e)} className={cx('border-b border-line last:border-0 cursor-pointer hover:bg-surface-2', sel.has(r.e.id) && 'bg-brand-soft/40')}>
                    {canEdit && <td className="pl-4" onClick={(ev) => ev.stopPropagation()}>{r.balance > 0 && <SelectBox label="Seç" checked={sel.has(r.e.id)} onChange={() => sel.toggle(r.e.id)} />}</td>}
                    <td className="px-4 py-2.5"><div className="font-semibold text-ink">{r.e.full_name}</div><div className="text-[11px] text-ink-3">{r.last ? `son hareket ${shortDay(r.last)}` : 'hareket yok'}</div></td>
                    <td className="px-2 text-right"><Money value={r.hakedis} /></td>
                    <td className="px-2 text-right text-wait"><Money value={r.avans} /></td>
                    <td className="px-2 text-right"><Money value={r.odeme} /></td>
                    <td className={cx('px-4 text-right font-bold tc-num', r.balance > 0 ? 'text-wait' : r.balance < 0 ? 'text-info' : 'text-ink-3')}>{fmtMoney(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <BulkBar count={sel.count} onClear={sel.clear} noun="personel">
        <select className="tc-input !w-auto !py-1.5 text-xs" value={bankId} onChange={(e) => setPayAcc(e.target.value)} aria-label="Ödeme hesabı">
          {(accounts.data ?? []).map((a) => <option key={a.id!} value={a.id!}>{a.name}</option>)}
        </select>
        <Button size="sm" variant="holo" icon={<HandCoins className="w-3.5 h-3.5" />} onClick={payAll} loading={insert.isPending}>Bakiyeyi öde</Button>
      </BulkBar>

      {open && <EmployeeLedger employee={open} onClose={() => setOpen(null)} canEdit={canEdit} />}
    </>
  );
}

function EmployeeLedger({ employee, onClose, canEdit }: { employee: Employee; onClose: () => void; canEdit: boolean }) {
  const toast = useToast();
  const ledger = useLedger(employee.id);
  const accounts = useAccounts();
  const save = useSaveRow('employee_ledger', ['finance']);
  const del = useDeleteRow('employee_ledger', ['finance']);
  const [adding, setAdding] = useState(false);
  const rows = ledger.data ?? [];
  const balance = ledgerBalance(rows.map((x) => ({ kind: x.kind, amount: Number(x.amount) })));
  const accName = (id: string | null) => (accounts.data ?? []).find((a) => a.id === id)?.name ?? '';

  const statement = (): ReportSpec => ({
    title: 'Personel Hesap Ekstresi', subtitle: `${employee.full_name} · bakiye ${fmtMoney(balance)}`, phone: employee.phone,
    summary: [{ label: 'Güncel bakiye', value: fmtMoney(balance) }, ...rows.slice(0, 8).map((r) => ({ label: `${shortDay(r.entry_date)} ${LEDGER_KINDS[r.kind].label}`, value: fmtMoney(r.amount) }))],
    table: { filename: `ekstre-${employee.full_name}`, header: ['Tarih', 'Tür', 'Açıklama', 'Tutar ₺', 'Hesap'],
      rows: rows.map((r) => [r.entry_date, LEDGER_KINDS[r.kind].label, r.description, LEDGER_KINDS[r.kind].sign * Number(r.amount), accName(r.account_id)]) },
    body: () => (
      <ReportSection title={`Bakiye: ${fmtMoney(balance)}`}>
        <table><thead><tr><th>Tarih</th><th>Tür</th><th>Açıklama</th><th className="num">Tutar</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td>{shortDay(r.entry_date)}</td><td>{LEDGER_KINDS[r.kind].label}</td><td>{r.description ?? ''}{r.account_id ? ` (${accName(r.account_id)})` : ''}</td>
            <td className="num">{LEDGER_KINDS[r.kind].sign > 0 ? '+' : '−'}{fmtMoney(r.amount)}</td></tr>)}</tbody></table>
      </ReportSection>
    ),
  });

  return (
    <Drawer open wide onClose={onClose} title={employee.full_name} subtitle={`Güncel bakiye ${fmtMoney(balance)} ${balance > 0 ? '(personele borç)' : balance < 0 ? '(personelden alacak)' : ''}`}
      footer={<>
        <ReportButton spec={statement} label="Ekstre" />
        {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>Hareket ekle</Button>}
      </>}>
      {ledger.isLoading ? <Loading /> : rows.length === 0 ? <EmptyState title="Hareket yok">Puantajdan hakediş yazın ya da avans / prim ekleyin.</EmptyState> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <Pill tone={LEDGER_KINDS[r.kind].tone}>{LEDGER_KINDS[r.kind].label}</Pill>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{r.description ?? LEDGER_KINDS[r.kind].label}</div>
                <div className="text-[11px] text-ink-3">{shortDay(r.entry_date)}{r.account_id ? ` · ${accName(r.account_id)}` : ''}{r.period ? ` · dönem ${r.period}` : ''}</div>
              </div>
              <span className={cx('tc-num font-semibold', LEDGER_KINDS[r.kind].sign > 0 ? 'text-ok' : 'text-ink')}>{LEDGER_KINDS[r.kind].sign > 0 ? '+' : '−'}{fmtMoney(r.amount)}</span>
              {canEdit && (
                <button type="button" className="text-xs text-ink-3 hover:text-stop" onClick={async () => {
                  if (!(await askConfirm('Hareket silinsin mi? Bağlı kasa gideri de kalkar.'))) return;
                  try { await del.mutateAsync({ id: r.id }); toast.ok('Silindi'); } catch (e) { toast.error(e); }
                }}>sil</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <FormDrawer open title="Hareket ekle" subtitle={employee.full_name} onClose={() => setAdding(false)} saving={save.isPending}
          fields={[
            { key: 'kind', label: 'Tür', type: 'select', required: true, options: Object.entries(LEDGER_KINDS).map(([value, v]) => ({ value, label: v.label })) },
            { key: 'amount', label: 'Tutar ₺', type: 'money', required: true },
            { key: 'entry_date', label: 'Tarih', type: 'date', required: true },
            { key: 'account_id', label: 'Kasa / banka', type: 'select', show: (v) => v.kind === 'avans' || v.kind === 'odeme',
              options: (accounts.data ?? []).map((a) => ({ value: a.id!, label: a.name! })), hint: 'Avans ve ödeme bu hesaptan gider olarak düşer' },
            { key: 'description', label: 'Açıklama', span: 2, placeholder: 'ör. bayram primi, yemek kartı kesintisi' },
          ]}
          initial={{ kind: 'avans', entry_date: todayISO(), account_id: (accounts.data ?? []).find((a) => a.kind === 'kasa')?.id ?? '' }}
          onSave={async (v) => {
            if ((v.kind === 'avans' || v.kind === 'odeme') && !v.account_id) throw new Error('Avans ve ödeme için kasa/banka seçin');
            if (!(Number(v.amount) > 0)) throw new Error('Tutar sıfırdan büyük olmalı');
            await save.mutateAsync({ row: { ...v, employee_id: employee.id, account_id: v.kind === 'avans' || v.kind === 'odeme' ? v.account_id : null } });
            toast.ok('Hareket eklendi'); setAdding(false);
          }} />
      )}
    </Drawer>
  );
}
