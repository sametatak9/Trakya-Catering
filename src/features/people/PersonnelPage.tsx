import { useState } from 'react';
import { Contact, Copy, MessageCircle, Plus, UsersRound } from 'lucide-react';
import { hrefFor } from '@/app/router';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { fmtMoney, fmtNum } from '@/lib/format';
import { ledgerBalance } from '@/lib/payroll';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { whatsappUrl } from '@/reports/share';
import { FormDrawer, type FieldDef } from '@/ui/FormDrawer';
import { ListToolbar, matches } from '@/ui/ListToolbar';
import { Button, EmptyState, ErrorNote, Loading, ModuleHero, Money, Panel, Pill, Tabs, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { DEPARTMENTS, PAY_TYPES, REQUEST_KINDS, slugify, useEmployees, useLedger, type Employee, type EmployeeRequest } from './api';

export const cardUrl = (slug: string) => `${window.location.origin}${window.location.pathname}${hrefFor(`/kart/${slug}`)}`;

const FIELDS: FieldDef[] = [
  { key: 'full_name', label: 'Ad soyad', required: true, span: 2 },
  { key: 'title', label: 'Görevi', placeholder: 'Aşçı, şoför, bulaşıkçı…' },
  { key: 'department', label: 'Bölüm', type: 'select', required: true, options: Object.entries(DEPARTMENTS).map(([value, label]) => ({ value, label })) },
  { key: 'phone', label: 'Telefon', type: 'tel' },
  { key: 'email', label: 'E-posta', type: 'email' },
  { key: 'pay_type', label: 'Ücret şekli', type: 'select', required: true, options: Object.entries(PAY_TYPES).map(([value, label]) => ({ value, label })) },
  { key: 'monthly_salary', label: 'Aylık net maaş ₺', type: 'money', show: (v) => v.pay_type === 'aylik' },
  { key: 'daily_wage', label: 'Günlük yevmiye ₺', type: 'money', show: (v) => v.pay_type === 'yevmiye' },
  { key: 'daily_hours', label: 'Günlük çalışma saati', type: 'number', hint: 'Eksik saat kesilir, fazlası mesai' },
  { key: 'overtime_rate', label: 'Mesai katsayısı', type: 'number', hint: 'Genelde 1,5' },
  { key: 'device_user_id', label: 'Parmak izi cihaz no', hint: 'ZKTeco cihazındaki kullanıcı numarası' },
  { key: 'start_date', label: 'İşe giriş', type: 'date' },
  { key: 'iban', label: 'IBAN', span: 2 },
  { key: 'card_slug', label: 'Kartvizit adresi', hint: 'Boş bırakılırsa addan üretilir (ör. ahmet-yildiz)' },
  { key: 'card_public', label: 'Kartvizit herkese açık', type: 'checkbox' },
  { key: 'active', label: 'Çalışıyor', type: 'checkbox' },
  { key: 'notes', label: 'Not', type: 'textarea' },
];

export function PersonnelPage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'muhasebe']);
  const canSeePay = useCan(['yonetici', 'muhasebe']);
  const employees = useEmployees(canSeePay);
  const ledger = useLedger();
  const requests = useRows('employee_requests', { order: 'created_at', ascending: false });
  const save = useSaveRow('employees');
  const del = useDeleteRow('employees');
  const saveReq = useSaveRow('employee_requests');
  const [tab, setTab] = useState<'liste' | 'talepler'>('liste');
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [showPassive, setShowPassive] = useState(false);
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);

  const all = employees.data ?? [];
  const list = all.filter((e) => (showPassive || e.active) && (!dept || e.department === dept) && matches(q, e.full_name, e.title, e.phone, e.device_user_id));
  const active = all.filter((e) => e.active);
  const monthlyCost = active.reduce((s, e) => s + (e.pay_type === 'aylik' ? Number(e.monthly_salary ?? 0) : Number(e.daily_wage ?? 0) * 26), 0);
  const balanceOf = (id: string) => ledgerBalance((ledger.data ?? []).filter((l) => l.employee_id === id).map((l) => ({ kind: l.kind, amount: Number(l.amount) })));
  const totalOwed = active.reduce((s, e) => s + balanceOf(e.id), 0);
  const pendingReq = (requests.data ?? []).filter((r) => r.status === 'bekliyor');
  const empName = (id: string) => all.find((e) => e.id === id)?.full_name ?? '—';

  const onSave = async (v: Record<string, unknown>) => {
    const row = { ...v, card_slug: (v.card_slug as string | null) || slugify(String(v.full_name)) };
    await save.mutateAsync({ id: editing && editing !== 'new' ? editing.id : null, row });
    toast.ok('Personel kaydedildi'); setEditing(null);
  };

  const report = (): ReportSpec => ({
    title: 'Personel Listesi', subtitle: `${active.length} aktif personel`,
    summary: list.map((e) => ({ label: e.full_name, value: `${e.title ?? DEPARTMENTS[e.department]} · ${e.phone ?? ''}` })),
    table: {
      filename: 'personel', header: ['Ad soyad', 'Görev', 'Bölüm', 'Telefon', 'Ücret şekli', 'Maaş/yevmiye ₺', 'Cihaz no', 'Giriş', 'Bakiye ₺'],
      rows: list.map((e) => [e.full_name, e.title, DEPARTMENTS[e.department], e.phone, PAY_TYPES[e.pay_type], e.pay_type === 'aylik' ? e.monthly_salary : e.daily_wage, e.device_user_id, e.start_date, canSeePay ? balanceOf(e.id) : '']),
    },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Aktif personel', value: active.length }, ...(canSeePay ? [{ label: 'Aylık ücret yükü', value: fmtMoney(monthlyCost) }, { label: 'Personele borç', value: fmtMoney(totalOwed) }] : [])]} />
        <ReportSection title="Personel">
          <table><thead><tr><th>Ad soyad</th><th>Görev / bölüm</th><th>Telefon</th><th>Ücret</th>{canSeePay && <th className="num">Bakiye</th>}</tr></thead>
            <tbody>{list.map((e) => <tr key={e.id}><td>{e.full_name}</td><td>{e.title ?? '—'} · {DEPARTMENTS[e.department]}</td><td>{e.phone ?? '—'}</td>
              <td>{PAY_TYPES[e.pay_type]} {fmtMoney(e.pay_type === 'aylik' ? e.monthly_salary : e.daily_wage)}</td>{canSeePay && <td className="num">{fmtMoney(balanceOf(e.id))}</td>}</tr>)}</tbody></table>
        </ReportSection>
      </>
    ),
  });

  const decide = async (r: EmployeeRequest, status: 'onaylandi' | 'reddedildi') => {
    try { await saveReq.mutateAsync({ id: r.id, row: { status } }); toast.ok(status === 'onaylandi' ? 'Talep onaylandı' : 'Talep reddedildi'); } catch (e) { toast.error(e); }
  };

  return (
    <>
      <ModuleHero kicker="Personel" title="Personel"
        description="Çalışan kartları: ücret şekli (aylık / yevmiye), günlük çalışma saati, parmak izi cihaz numarası ve dijital kartvizit."
        actions={<>
          <ReportButton spec={report} disabled={list.length === 0} />
          {canEdit && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Yeni personel</Button>}
        </>}
        stats={[
          { label: 'Aktif personel', value: active.length, source: report },
          { label: 'Yevmiyeli / aylıkçı', value: `${active.filter((e) => e.pay_type === 'yevmiye').length} / ${active.filter((e) => e.pay_type === 'aylik').length}` },
          ...(canSeePay ? [
            { label: 'Aylık ücret yükü', value: <Money value={monthlyCost} />, hint: 'yevmiye × 26 gün dahil', source: report },
            { label: 'Personele borç (bakiye)', value: <Money value={totalOwed} />, tone: totalOwed > 0 ? 'warn' as const : 'default' as const, hint: 'hakediş − avans − ödeme' },
          ] : [{ label: 'Bekleyen talep', value: pendingReq.length }]),
        ]} />

      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'liste', label: 'Personel listesi', count: active.length }, { id: 'talepler', label: 'İzin / avans talepleri', count: pendingReq.length }]} /></div>

      {tab === 'liste' ? (
        <Panel pad={false}>
          <ListToolbar search={q} onSearch={setQ} placeholder="Ad, görev, telefon, cihaz no…"
            filters={<>
              <select className="tc-input !w-auto" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Bölüm">
                <option value="">Tüm bölümler</option>{Object.entries(DEPARTMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-ink-2"><input type="checkbox" checked={showPassive} onChange={(e) => setShowPassive(e.target.checked)} /> Ayrılanları göster</label>
            </>} />
          {employees.isLoading ? <Loading /> : employees.error ? <div className="p-4"><ErrorNote>Personel listesi yüklenemedi.</ErrorNote></div>
            : list.length === 0 ? (
              <EmptyState icon={<UsersRound className="w-5 h-5" />} title={all.length ? 'Aramaya uyan personel yok' : 'Henüz personel eklenmedi'}
                action={canEdit && !all.length && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setEditing('new')}>Personel ekle</Button>}>
                Personel kartında parmak izi cihaz numarasını girerseniz puantaj dosyası otomatik eşleşir.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((e) => {
                  const bal = canSeePay ? balanceOf(e.id) : null;
                  return (
                    <li key={e.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/60', !e.active && 'opacity-60')}>
                      <button type="button" onClick={() => setEditing(e)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                        <span className="w-10 h-10 rounded-xl bg-accent-soft text-accent-strong grid place-items-center text-sm font-bold shrink-0">
                          {e.full_name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink truncate">{e.full_name}</span>
                          <span className="block text-xs text-ink-3 truncate">{e.title ?? '—'} · {DEPARTMENTS[e.department]}{e.phone ? ` · ${e.phone}` : ''}</span>
                        </span>
                      </button>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill tone={e.pay_type === 'yevmiye' ? 'accent' : 'info'}>{e.pay_type === 'yevmiye' ? 'Yevmiye' : 'Aylık'}</Pill>
                        {e.device_user_id ? <Pill tone="ok">cihaz {e.device_user_id}</Pill> : <Pill tone="wait">cihaz no yok</Pill>}
                        {bal !== null && <span className={cx('tc-num text-sm font-semibold w-28 text-right', bal > 0 ? 'text-wait' : 'text-ink-2')}>{fmtMoney(bal)}</span>}
                        {e.card_slug && (
                          <>
                            <a href={cardUrl(e.card_slug)} target="_blank" rel="noreferrer" className="p-2 rounded-lg text-ink-3 hover:text-brand hover:bg-brand-soft" title="Kartviziti aç"><Contact className="w-4 h-4" /></a>
                            <button type="button" className="p-2 rounded-lg text-ink-3 hover:text-brand hover:bg-brand-soft" title="Kartvizit linkini kopyala"
                              onClick={() => void navigator.clipboard?.writeText(cardUrl(e.card_slug!)).then(() => toast.ok('Kartvizit linki kopyalandı'), () => toast.error('Kopyalanamadı'))}><Copy className="w-4 h-4" /></button>
                            <a href={whatsappUrl(`${e.full_name} — Trakya Catering kartvizit: ${cardUrl(e.card_slug)}`, null)} target="_blank" rel="noreferrer"
                              className="p-2 rounded-lg text-ink-3 hover:text-[#1a9e4a] hover:bg-ok-soft" title="WhatsApp ile gönder"><MessageCircle className="w-4 h-4" /></a>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
        </Panel>
      ) : (
        <Panel pad={false} title="İzin, avans ve mesai talepleri" subtitle="Onaylanan avans, Personel Bakiyeleri ekranından ödenir">
          {(requests.data ?? []).length === 0 ? <EmptyState title="Talep yok">Personel kendi hesabından veya yönetici adına talep açılabilir.</EmptyState> : (
            <ul className="divide-y divide-line">
              {(requests.data ?? []).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink">{empName(r.employee_id)} · {REQUEST_KINDS[r.kind]}</div>
                    <div className="text-xs text-ink-3">{[r.start_date, r.end_date].filter(Boolean).join(' → ')}{r.amount ? ` · ${fmtMoney(r.amount)}` : ''}{r.note ? ` · ${r.note}` : ''}</div>
                  </div>
                  {r.status === 'bekliyor' && canEdit ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r, 'reddedildi')}>Reddet</Button>
                      <Button size="sm" variant="holo" onClick={() => decide(r, 'onaylandi')}>Onayla</Button>
                    </div>
                  ) : <Pill tone={r.status === 'onaylandi' ? 'ok' : r.status === 'reddedildi' ? 'stop' : 'wait'}>{r.status === 'onaylandi' ? 'Onaylandı' : r.status === 'reddedildi' ? 'Reddedildi' : 'Bekliyor'}</Pill>}
                </li>
              ))}
            </ul>
          )}
          {canEdit && <NewRequest employees={active} />}
        </Panel>
      )}

      {editing && (
        <FormDrawer open title={editing === 'new' ? 'Yeni personel' : editing.full_name} subtitle="Kartvizit ve puantaj bu karttan beslenir"
          fields={FIELDS} readOnly={!canEdit}
          initial={editing === 'new' ? { pay_type: 'aylik', department: 'mutfak', daily_hours: 10, overtime_rate: 1.5, active: true, card_public: true } : editing}
          onClose={() => setEditing(null)} onSave={onSave} saving={save.isPending}
          onDelete={editing !== 'new' ? async () => { await del.mutateAsync({ id: editing.id }); toast.ok('Silindi'); setEditing(null); } : undefined}
          deleting={del.isPending} deleteLabel="Personel kartı (puantaj ve defter kayıtlarıyla birlikte)"
          extra={editing !== 'new' && canSeePay ? <div className="text-sm text-ink-2">Güncel bakiye: <b className="tc-num">{fmtMoney(balanceOf(editing.id))}</b> · Günlük {fmtNum(editing.daily_hours, 1)} saat</div> : undefined} />
      )}
    </>
  );
}

function NewRequest({ employees }: { employees: Employee[] }) {
  const toast = useToast();
  const save = useSaveRow('employee_requests');
  const [open, setOpen] = useState(false);
  if (!open) return <div className="p-4 border-t border-line"><Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setOpen(true)}>Talep ekle</Button></div>;
  return (
    <FormDrawer open title="Yeni talep" onClose={() => setOpen(false)} saving={save.isPending}
      fields={[
        { key: 'employee_id', label: 'Personel', type: 'select', required: true, options: employees.map((e) => ({ value: e.id, label: e.full_name })), span: 2 },
        { key: 'kind', label: 'Tür', type: 'select', required: true, options: Object.entries(REQUEST_KINDS).map(([value, label]) => ({ value, label })) },
        { key: 'amount', label: 'Tutar ₺ (avans)', type: 'money' },
        { key: 'start_date', label: 'Başlangıç', type: 'date' },
        { key: 'end_date', label: 'Bitiş', type: 'date' },
        { key: 'note', label: 'Açıklama', type: 'textarea' },
      ]}
      initial={{ kind: 'izin' }}
      onSave={async (v) => { await save.mutateAsync({ row: v }); toast.ok('Talep eklendi'); setOpen(false); }} />
  );
}
