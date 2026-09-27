import { useState } from 'react';
import { Check, Inbox, ShieldCheck, X } from 'lucide-react';
import { useMember } from '@/app/session';
import { useRows } from '@/lib/crud';
import { shortDay } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { useLiveTables } from '@/lib/live';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection } from '@/reports/ReportFrame';
import { Button, EmptyState, Loading, ModuleHero, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useAccounts } from '../finance/api';
import { APPROVAL_STATUS, useApprovals, useDecide, type ApprovalRequest } from './api';

/**
 * Onaylar (yönetici son onay mercii). Talep eden kendi talebini onaylayamaz; red için not zorunlu;
 * her karar değiştirilemez olay kaydına yazılır. Liste canlıdır: yeni talep gelince kendiliğinden güncellenir.
 */
export function ApprovalsPanel() {
  const me = useMember();
  const pending = useApprovals('bekliyor');
  const history = useApprovals();
  const policies = useRows('approval_policies', { key: ['all'] });
  useLiveTables(['approval_requests']);
  const policyName = (code: string) => (policies.data ?? []).find((p) => p.code === code)?.name ?? code;
  const mine = (a: ApprovalRequest) => a.requested_by === me.userId;
  const toDecide = (pending.data ?? []).filter((a) => !mine(a));
  const myPending = (pending.data ?? []).filter(mine);
  const decided = (history.data ?? []).filter((a) => a.status !== 'bekliyor').sort((a, b) => (b.decided_at ?? '').localeCompare(a.decided_at ?? ''));

  const report = (): ReportSpec => ({
    title: 'Onay Kayıtları', subtitle: `${decided.length} karar · kaynak: onay merkezi (değiştirilemez kayıt)`,
    summary: decided.slice(0, 20).map((a) => ({ label: a.title, value: `${APPROVAL_STATUS[a.status].label}${a.decided_at ? ` · ${shortDay(a.decided_at.slice(0, 10))}` : ''}` })),
    table: { filename: 'onaylar', header: ['Talep tarihi', 'Tür', 'Başlık', 'Tutar ₺', 'Durum', 'Karar tarihi', 'Not'],
      rows: decided.map((a) => [a.requested_at.slice(0, 10), policyName(a.policy_code), a.title, a.amount, APPROVAL_STATUS[a.status].label, a.decided_at?.slice(0, 10), a.decision_note]) },
    body: () => (
      <ReportSection title="Kararlar">
        <table><thead><tr><th>Talep</th><th>Tür</th><th>Başlık</th><th className="num">Tutar</th><th>Durum</th><th>Not</th></tr></thead>
          <tbody>{decided.map((a) => <tr key={a.id}><td>{shortDay(a.requested_at.slice(0, 10))}</td><td>{policyName(a.policy_code)}</td><td>{a.title}</td>
            <td className="num">{a.amount ? fmtMoney(a.amount) : '—'}</td><td>{APPROVAL_STATUS[a.status].label}</td><td>{a.decision_note ?? ''}</td></tr>)}</tbody></table>
      </ReportSection>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Bugün · Son onay" title="Onaylar"
        description="Avans, izin, eşik üstü gider ve ödeme gibi işler burada karara bağlanır. Talep eden kendi talebini onaylayamaz; her karar değiştirilemez kayda yazılır. Onaylanan avans seçtiğiniz kasadan ödenir ve personel bakiyesi anında değişir."
        actions={<ReportButton spec={report} disabled={decided.length === 0} />}
        stats={[
          { label: 'Karar bekleyen', value: toDecide.length, tone: toDecide.length ? 'warn' : 'default' },
          { label: 'Benim açtığım', value: myPending.length },
          { label: 'Son kararlar', value: decided.length, source: report },
        ]} />

      <Panel pad={false} title="Karar bekleyenler" subtitle="Eskiden yeniye">
        {pending.isLoading ? <Loading /> : toDecide.length === 0 ? (
          <EmptyState icon={<Inbox className="w-5 h-5" />} title="Bekleyen onay yok">Personel avans veya izin istediğinde burada görünür.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">{toDecide.map((a) => <DecisionRow key={a.id} a={a} policy={policyName(a.policy_code)} />)}</ul>
        )}
      </Panel>

      {myPending.length > 0 && (
        <Panel className="mt-4" pad={false} title="Benim açtığım talepler" subtitle="Kendi talebinizi başka bir yetkili onaylar">
          <ul className="divide-y divide-line">{myPending.map((a) => <MineRow key={a.id} a={a} policy={policyName(a.policy_code)} />)}</ul>
        </Panel>
      )}

      <Panel className="mt-4" pad={false} title="Son kararlar" subtitle="Değiştirilemez; hash zinciriyle mühürlü">
        {decided.length === 0 ? <p className="px-4 py-6 text-sm text-ink-3">Henüz karar yok.</p> : (
          <ul className="divide-y divide-line">
            {decided.slice(0, 20).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <ShieldCheck className="w-4 h-4 text-ink-3 shrink-0" />
                <span className="flex-1 min-w-0 truncate"><b className="text-ink">{a.title}</b> <span className="text-ink-3">· {policyName(a.policy_code)}{a.amount ? ` · ${fmtMoney(a.amount)}` : ''}{a.decision_note ? ` · “${a.decision_note}”` : ''}</span></span>
                <span className="text-xs text-ink-3">{a.decided_at ? shortDay(a.decided_at.slice(0, 10)) : ''}</span>
                <Pill tone={APPROVAL_STATUS[a.status].tone}>{APPROVAL_STATUS[a.status].label}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function RowInfo({ a, policy }: { a: ApprovalRequest; policy: string }) {
  const p = (a.payload ?? {}) as Record<string, unknown>;
  const dates = [p.start_date, p.end_date].filter(Boolean).map((d) => shortDay(String(d))).join(' – ');
  return (
    <span className="basis-full sm:basis-0 flex-1 min-w-0">
      <span className="block font-semibold text-ink">{a.title}</span>
      <span className="block text-xs text-ink-3">
        {policy}{a.amount ? ` · ${fmtMoney(a.amount)}` : ''}{dates ? ` · ${dates}` : ''}{p.note ? ` · ${String(p.note)}` : ''} · talep {shortDay(a.requested_at.slice(0, 10))}
      </span>
    </span>
  );
}

export function DecisionRow({ a, policy }: { a: ApprovalRequest; policy: string }) {
  const toast = useToast();
  const decide = useDecide();
  const accounts = useAccounts();
  const needsAccount = a.subject_table === 'employee_requests' && a.policy_code === 'avans' && Number(a.amount) > 0;
  const [account, setAccount] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const approve = async () => {
    if (needsAccount && !account) return toast.error('Avansın ödeneceği kasa/banka hesabını seçin');
    try {
      await decide.mutateAsync({ id: a.id, decision: 'onaylandi', extra: needsAccount ? { account_id: account } : {} });
      toast.ok(needsAccount ? 'Onaylandı; avans ödendi, personel bakiyesi güncellendi' : 'Onaylandı');
    } catch (e) { toast.error(e); }
  };
  const reject = async () => {
    if (!note.trim()) return toast.error('Reddetme nedenini yazın');
    try { await decide.mutateAsync({ id: a.id, decision: 'reddedildi', note }); toast.ok('Reddedildi'); } catch (e) { toast.error(e); }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <RowInfo a={a} policy={policy} />
        {needsAccount && (
          <select className="tc-input !py-1.5 !w-auto" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Ödeme hesabı">
            <option value="">Ödeme hesabı…</option>
            {(accounts.data ?? []).map((x) => <option key={x.id ?? ''} value={x.id ?? ''}>{x.name}</option>)}
          </select>
        )}
        <Button size="sm" icon={<X className="w-3.5 h-3.5" />} onClick={() => setRejecting((v) => !v)}>Reddet</Button>
        <Button size="sm" variant="holo" icon={<Check className="w-3.5 h-3.5" />} onClick={approve} loading={decide.isPending}>Onayla</Button>
      </div>
      {rejecting && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input className={cx('tc-input flex-1 min-w-[200px]')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reddetme nedeni (zorunlu)" aria-label="Reddetme nedeni" />
          <Button size="sm" variant="danger" onClick={reject} loading={decide.isPending}>Reddi kaydet</Button>
        </div>
      )}
    </li>
  );
}

function MineRow({ a, policy }: { a: ApprovalRequest; policy: string }) {
  const toast = useToast();
  const decide = useDecide();
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <RowInfo a={a} policy={policy} />
      <Pill tone="wait">Bekliyor</Pill>
      <Button size="sm" onClick={async () => {
        try { await decide.mutateAsync({ id: a.id, decision: 'iptal' }); toast.ok('Talep iptal edildi'); } catch (e) { toast.error(e); }
      }}>İptal et</Button>
    </li>
  );
}

/** Bekleyen onay sayısı (canlı): başlık rozetleri ve sekme sayacı için */
export function usePendingApprovalCount() {
  const me = useMember();
  const pending = useApprovals('bekliyor');
  useLiveTables(['approval_requests']);
  return (pending.data ?? []).filter((a) => a.requested_by !== me.userId).length;
}
