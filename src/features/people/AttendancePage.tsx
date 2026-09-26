import { useMemo, useRef, useState } from 'react';
import { CalendarCheck2, FileUp, Fingerprint, NotebookPen } from 'lucide-react';
import { useCan } from '@/app/session';
import { useInsertRows, useSaveRow } from '@/lib/crud';
import { monthKey, monthLabel, monthRange, todayISO } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';
import { fillMissingDays, monthPay, parseAttendanceFile, type PunchDay } from '@/lib/payroll';
import { ReportButton, type ReportSpec } from '@/reports/ReportButton';
import { ReportSection, ReportStats } from '@/reports/ReportFrame';
import { MonthNav } from '@/ui/bits';
import { askConfirm } from '@/ui/confirm';
import { Button, Drawer, EmptyState, Field, Loading, ModuleHero, Money, Panel, Pill, cx } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { DAY_STATUS, useAttendance, useEmployees, useLedger, type AttendanceDay, type Employee } from './api';

const minutesBetween = (a: string, b: string) => {
  const [h1, m1] = a.split(':').map(Number); const [h2, m2] = b.split(':').map(Number);
  return Math.max(0, h2 * 60 + m2 - (h1 * 60 + m1));
};

export function AttendancePage() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'muhasebe']);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const { from, to } = monthRange(month);
  const today = todayISO();
  const until = to < today ? to : today;
  const employees = useEmployees();
  const att = useAttendance(from, to);
  const ledger = useLedger();
  const upsert = useInsertRows('attendance_days');
  const saveLedger = useInsertRows('employee_ledger', ['finance']);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ days: PunchDay[]; skipped: number; name: string } | null>(null);
  const [cell, setCell] = useState<{ e: Employee; date: string; rec?: AttendanceDay } | null>(null);

  const emps = (employees.data ?? []).filter((e) => e.active);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
    return out;
  }, [from, to]);
  const recOf = useMemo(() => {
    const m = new Map<string, AttendanceDay>();
    for (const r of att.data ?? []) m.set(`${r.employee_id}|${r.work_date}`, r);
    return m;
  }, [att.data]);

  const payroll = useMemo(() => emps.map((e) => {
    const recs = (att.data ?? []).filter((r) => r.employee_id === e.id && r.work_date <= until);
    const filled = from <= until ? fillMissingDays(recs.map((r) => ({ work_date: r.work_date, status: r.status, worked_minutes: r.worked_minutes })), from, until) : [];
    const pay = monthPay({ pay_type: e.pay_type, monthly_salary: e.monthly_salary, daily_wage: e.daily_wage, daily_hours: Number(e.daily_hours), overtime_rate: Number(e.overtime_rate) }, filled);
    const posted = (ledger.data ?? []).some((l) => l.employee_id === e.id && l.kind === 'hakedis' && l.period === month);
    return { e, pay, posted };
  }), [emps, att.data, ledger.data, from, until, month]);
  const totals = payroll.reduce((s, p) => ({ total: s.total + p.pay.total, ot: s.ot + p.pay.overtimePay, ded: s.ded + p.pay.deduction, absent: s.absent + p.pay.daysAbsent }), { total: 0, ot: 0, ded: 0, absent: 0 });
  const todayCount = emps.filter((e) => recOf.get(`${e.id}|${today}`)?.status === 'var').length;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { toast.error('Excel dosyasını “CSV (virgül ya da noktalı virgülle ayrılmış)” olarak kaydedip yükleyin'); return; }
    const parsed = parseAttendanceFile(await f.text());
    if (parsed.days.length === 0) { toast.error('Dosyada okunabilir giriş-çıkış kaydı bulunamadı'); return; }
    setPreview({ ...parsed, name: f.name });
  };
  const matchOf = (d: PunchDay) => emps.find((e) => e.device_user_id && e.device_user_id.replace(/^0+(?=\d)/, '') === d.deviceId)
    ?? emps.find((e) => d.name && e.full_name.toLocaleLowerCase('tr') === d.name.toLocaleLowerCase('tr'));

  const importDays = async () => {
    if (!preview) return;
    const rows = preview.days.map((d) => ({ d, e: matchOf(d) })).filter((x) => x.e).map(({ d, e }) => ({
      employee_id: e!.id, work_date: d.date, first_in: d.firstIn, last_out: d.lastOut,
      worked_minutes: d.minutes, status: 'var', source: 'zkteco',
    }));
    try {
      const n = await upsert.mutateAsync({ rows, onConflict: 'employee_id,work_date' });
      toast.ok(`${n} günlük yoklama işlendi`); setPreview(null);
    } catch (e) { toast.error(e); }
  };

  const postPayroll = async () => {
    const acc = payroll.filter((p) => !p.posted && p.pay.total > 0);
    if (acc.length === 0) return toast.error('Deftere yazılacak yeni hakediş yok');
    if (!(await askConfirm(`${monthLabel(month)} hakedişi ${acc.length} personelin defterine yazılsın mı? Toplam ${fmtMoney(acc.reduce((s, p) => s + p.pay.total, 0))}`))) return;
    try {
      await saveLedger.mutateAsync({ rows: acc.map((p) => ({
        employee_id: p.e.id, entry_date: until, kind: 'hakedis', amount: p.pay.total, period: month,
        description: `${monthLabel(month)} hakediş · ${p.pay.daysWorked} gün${p.pay.overtimeHours ? ` · ${fmtNum(p.pay.overtimeHours, 1)} sa mesai` : ''}${p.pay.daysAbsent ? ` · ${p.pay.daysAbsent} gün yok` : ''}${p.pay.daysReport ? ` · ${p.pay.daysReport} gün rapor` : ''}`,
      })) });
      toast.ok('Hakedişler personel defterine yazıldı');
    } catch (e) { toast.error(e); }
  };

  const report = (): ReportSpec => ({
    title: 'Puantaj ve Maaş Raporu', subtitle: `${monthLabel(month)} · ${from} – ${until} · günlük ${emps[0]?.daily_hours ?? 10} saat kuralı`,
    summary: payroll.map((p) => ({ label: p.e.full_name, value: `${p.pay.daysWorked} gün · ${fmtMoney(p.pay.total)}` })),
    table: {
      filename: `puantaj-${month}`, header: ['Personel', 'Ücret şekli', 'Çalışılan gün', 'Yok', 'Raporlu', 'İzinli', 'Mesai saat', 'Eksik saat', 'Maaş ₺', 'Mesai ₺', 'Kesinti ₺', 'Hakediş ₺'],
      rows: payroll.map((p) => [p.e.full_name, p.e.pay_type, p.pay.daysWorked, p.pay.daysAbsent, p.pay.daysReport, p.pay.daysLeave, p.pay.overtimeHours, p.pay.missingHours, p.pay.base, p.pay.overtimePay, p.pay.deduction, p.pay.total]),
    },
    body: () => (
      <>
        <ReportStats items={[{ label: 'Personel', value: emps.length }, { label: 'Toplam hakediş', value: fmtMoney(totals.total) }, { label: 'Fazla mesai', value: fmtMoney(totals.ot) }, { label: 'Kesinti', value: fmtMoney(totals.ded) }]} />
        <ReportSection title="Personel bazında">
          <table><thead><tr><th>Personel</th><th className="num">Gün</th><th className="num">Yok</th><th className="num">Rapor</th><th className="num">Mesai sa</th><th className="num">Eksik sa</th><th className="num">Kesinti</th><th className="num">Hakediş</th></tr></thead>
            <tbody>{payroll.map((p) => <tr key={p.e.id}><td>{p.e.full_name}<div style={{ color: '#857B6D' }}>{p.e.pay_type === 'yevmiye' ? `Yevmiye ${fmtMoney(p.e.daily_wage)}` : `Maaş ${fmtMoney(p.e.monthly_salary)}`}</div></td>
              <td className="num">{p.pay.daysWorked}</td><td className="num">{p.pay.daysAbsent}</td><td className="num">{p.pay.daysReport}</td><td className="num">{fmtNum(p.pay.overtimeHours, 1)}</td>
              <td className="num">{fmtNum(p.pay.missingHours, 1)}</td><td className="num">{fmtMoney(p.pay.deduction)}</td><td className="num"><b>{fmtMoney(p.pay.total)}</b></td></tr>)}</tbody></table>
        </ReportSection>
        <p style={{ fontSize: 10.5, color: '#4A443C' }}>Kural: günlük çalışma süresinden eksik saat saatlik ücretten kesilir, fazla saat ×{emps[0]?.overtime_rate ?? 1.5} yazılır. Raporlu gün ücretsizdir; kaydı olmayan iş günü “yok” sayılır; pazar tatildir.</p>
      </>
    ),
  });

  return (
    <>
      <ModuleHero kicker="Personel · Parmak izi" title="Puantaj & Maaş Hesabı"
        description="Parmak izi cihazının (ZKTeco) dışa aktardığı dosyayı yükleyin: her kişinin ilk girişi ve son çıkışı günlük yoklamaya işlenir. Kaydı olmayan gün “yok” sayılır; 10 saatten eksik kesilir, fazlası ×1,5 yazılır."
        actions={<>
          <ReportButton spec={report} label="Puantaj raporu" disabled={emps.length === 0} />
          {canEdit && <>
            <input ref={fileRef} type="file" accept=".csv,.txt,.dat,.xls,.xlsx" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button variant="primary" icon={<Fingerprint className="w-4 h-4" />} onClick={() => fileRef.current?.click()}>Parmak izi dosyası yükle</Button>
          </>}
        </>}
        stats={[
          { label: 'Bugün gelen', value: `${todayCount} / ${emps.length}` },
          { label: `${monthLabel(month)} hakediş`, value: <Money value={totals.total} />, source: report },
          { label: 'Fazla mesai', value: <Money value={totals.ot} />, source: report },
          { label: 'Kesinti (eksik saat, yok, rapor)', value: <Money value={totals.ded} />, tone: totals.ded > 0 ? 'warn' : 'default', source: report },
        ]} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <MonthNav value={month} onChange={setMonth} />
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {Object.entries(DAY_STATUS).map(([k, v]) => <span key={k} className={cx('rounded-md px-1.5 py-0.5 font-semibold', v.cls)}>{v.short} {v.label}</span>)}
        </div>
      </div>

      <Panel pad={false} title="Aylık yoklama" subtitle="Hücreye dokunarak elle düzeltin (rapor, izin, giriş-çıkış saati)">
        {employees.isLoading || att.isLoading ? <Loading /> : emps.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 className="w-5 h-5" />} title="Önce personel ekleyin">Personel kartındaki “parmak izi cihaz no” dosyadaki numarayla eşleşir.</EmptyState>
        ) : (
          <div className="overflow-x-auto tc-scroll">
            <table className="text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 min-w-[150px] border-b border-line">Personel</th>
                  {days.map((d) => {
                    const wd = new Date(d + 'T12:00:00Z').getUTCDay();
                    return <th key={d} className={cx('px-0.5 py-2 font-semibold border-b border-line w-8', wd === 0 ? 'text-stop' : 'text-ink-3', d === today && 'bg-brand-soft')}>{Number(d.slice(8))}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {emps.map((e) => (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-b border-line font-semibold text-ink whitespace-nowrap">{e.full_name}</td>
                    {days.map((d) => {
                      const r = recOf.get(`${e.id}|${d}`);
                      const future = d > today;
                      const sunday = new Date(d + 'T12:00:00Z').getUTCDay() === 0;
                      const st = r?.status ?? (future ? null : sunday ? 'tatil' : 'yok');
                      const hours = r?.status === 'var' && r.worked_minutes != null ? r.worked_minutes / 60 : null;
                      return (
                        <td key={d} className="p-0.5 border-b border-line">
                          <button type="button" disabled={!canEdit || future} onClick={() => setCell({ e, date: d, rec: r })}
                            title={r ? `${DAY_STATUS[r.status]?.label}${r.first_in ? ` · ${r.first_in.slice(0, 5)}–${r.last_out?.slice(0, 5)}` : ''}` : st ? DAY_STATUS[st].label : ''}
                            className={cx('w-8 h-8 rounded-md tc-num text-[10.5px] font-bold', st ? DAY_STATUS[st].cls : 'bg-transparent text-ink-3/40', !r && st === 'yok' && 'opacity-60',
                              hours !== null && hours < Number(e.daily_hours) && 'ring-1 ring-wait', hours !== null && hours > Number(e.daily_hours) && 'ring-1 ring-ok')}>
                            {hours !== null ? fmtNum(hours, 0) : st ? DAY_STATUS[st].short : ''}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-4" pad={false} title={`${monthLabel(month)} maaş hesabı`} subtitle={`${from} – ${until} arası kayıtlarla`}
        action={canEdit && payroll.some((p) => !p.posted && p.pay.total > 0) && (
          <Button size="sm" variant="holo" icon={<NotebookPen className="w-3.5 h-3.5" />} onClick={postPayroll} loading={saveLedger.isPending}>Hakedişleri deftere yaz</Button>
        )}>
        <div className="overflow-x-auto tc-scroll">
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wider text-ink-3 border-b border-line">
              <th className="px-4 py-2.5">Personel</th><th className="px-2 text-right">Gün</th><th className="px-2 text-right">Yok</th><th className="px-2 text-right">Rapor</th>
              <th className="px-2 text-right">Mesai</th><th className="px-2 text-right">Eksik</th><th className="px-2 text-right">Kesinti</th><th className="px-4 text-right">Hakediş</th>
            </tr></thead>
            <tbody>
              {payroll.map((p) => (
                <tr key={p.e.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><div className="font-semibold text-ink">{p.e.full_name}</div><div className="text-[11px] text-ink-3">{p.e.pay_type === 'yevmiye' ? `Yevmiye ${fmtMoney(p.e.daily_wage)}` : `Aylık ${fmtMoney(p.e.monthly_salary)}`}</div></td>
                  <td className="px-2 text-right tc-num">{p.pay.daysWorked}</td>
                  <td className={cx('px-2 text-right tc-num', p.pay.daysAbsent > 0 && 'text-stop font-semibold')}>{p.pay.daysAbsent}</td>
                  <td className="px-2 text-right tc-num">{p.pay.daysReport}</td>
                  <td className="px-2 text-right tc-num text-ok">{fmtNum(p.pay.overtimeHours, 1)} sa</td>
                  <td className="px-2 text-right tc-num text-wait">{fmtNum(p.pay.missingHours, 1)} sa</td>
                  <td className="px-2 text-right"><Money value={p.pay.deduction} /></td>
                  <td className="px-4 text-right"><Money value={p.pay.total} className="font-bold text-ink" />{p.posted && <div><Pill tone="ok">deftere yazıldı</Pill></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {preview && (
        <Drawer open wide onClose={() => setPreview(null)} title="Parmak izi dosyası" subtitle={`${preview.name} · ${preview.days.length} kişi-gün${preview.skipped ? ` · ${preview.skipped} satır okunamadı` : ''}`}
          footer={<>
            <Button onClick={() => setPreview(null)}>Vazgeç</Button>
            <Button variant="holo" icon={<FileUp className="w-4 h-4" />} onClick={importDays} loading={upsert.isPending}
              disabled={!preview.days.some((d) => matchOf(d))}>Yoklamaya işle ({preview.days.filter((d) => matchOf(d)).length})</Button>
          </>}>
          {preview.days.some((d) => !matchOf(d)) && (
            <div className="rounded-xl bg-wait-soft text-wait px-3 py-2 text-xs mb-3">Eşleşmeyen cihaz numaraları var. Personel kartına “parmak izi cihaz no” girin; eşleşmeyen satırlar işlenmez.</div>
          )}
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-ink-3 border-b border-line"><th className="py-2">Tarih</th><th>Cihaz no · ad</th><th>Personel</th><th>Giriş</th><th>Çıkış</th><th className="text-right">Süre</th></tr></thead>
            <tbody>
              {preview.days.map((d) => {
                const e = matchOf(d);
                return (
                  <tr key={`${d.deviceId}${d.date}`} className="border-b border-line">
                    <td className="py-1.5 tc-num">{d.date.slice(8)}.{d.date.slice(5, 7)}</td>
                    <td className="text-ink-3">{d.deviceId} {d.name && `· ${d.name}`}</td>
                    <td>{e ? <span className="font-semibold text-ink">{e.full_name}</span> : <Pill tone="wait">eşleşmedi</Pill>}</td>
                    <td className="tc-num">{d.firstIn}</td><td className="tc-num">{d.punches > 1 ? d.lastOut : '—'}</td>
                    <td className={cx('text-right tc-num', e && d.minutes / 60 < Number(e.daily_hours) && 'text-wait')}>{fmtNum(d.minutes / 60, 1)} sa</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Drawer>
      )}

      {cell && <DayEditor cell={cell} onClose={() => setCell(null)} />}
    </>
  );
}

function DayEditor({ cell, onClose }: { cell: { e: Employee; date: string; rec?: AttendanceDay }; onClose: () => void }) {
  const toast = useToast();
  const save = useSaveRow('attendance_days');
  const r = cell.rec;
  const [status, setStatus] = useState(r?.status ?? 'var');
  const [fin, setFin] = useState(r?.first_in?.slice(0, 5) ?? '07:00');
  const [fout, setFout] = useState(r?.last_out?.slice(0, 5) ?? '17:00');
  const [note, setNote] = useState(r?.note ?? '');
  const submit = async () => {
    const row = {
      employee_id: cell.e.id, work_date: cell.date, status, note: note || null, source: r?.source ?? 'elle',
      first_in: status === 'var' ? fin : null, last_out: status === 'var' ? fout : null,
      worked_minutes: status === 'var' ? minutesBetween(fin, fout) : null,
    };
    try { await save.mutateAsync({ id: r?.id ?? null, row }); toast.ok('Yoklama güncellendi'); onClose(); } catch (e) { toast.error(e); }
  };
  return (
    <Drawer open onClose={onClose} title={cell.e.full_name} subtitle={new Date(cell.date + 'T12:00:00Z').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
      footer={<><Button onClick={onClose}>Vazgeç</Button><Button variant="holo" onClick={submit} loading={save.isPending}>Kaydet</Button></>}>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(DAY_STATUS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setStatus(k)}
            className={cx('rounded-xl px-3 py-3 text-sm font-bold ring-2', status === k ? 'ring-brand ' + v.cls : 'ring-line bg-card text-ink-2')}>{v.short} {v.label}</button>
        ))}
      </div>
      {status === 'var' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="İlk giriş"><input type="time" className="tc-input" value={fin} onChange={(e) => setFin(e.target.value)} /></Field>
          <Field label="Son çıkış"><input type="time" className="tc-input" value={fout} onChange={(e) => setFout(e.target.value)} /></Field>
          <div className="col-span-2 text-sm text-ink-2">Çalışma: <b className="tc-num">{fmtNum(minutesBetween(fin, fout) / 60, 1)} saat</b> (günlük {fmtNum(cell.e.daily_hours, 0)} saat)</div>
        </div>
      )}
      <Field label="Not" className="mt-3"><input className="tc-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Rapor no, izin sebebi…" /></Field>
    </Drawer>
  );
}
