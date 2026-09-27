import { useState } from 'react';
import { AlertTriangle, MessageSquareWarning, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { shortDay, todayISO } from '@/lib/dates';
import { ALLERGENS, MEALS } from '@/lib/domain';
import { useLiveTables } from '@/lib/live';
import { askConfirm } from '@/ui/confirm';
import { Button, EmptyState, Field, Loading, Pill } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { DISH_TAGS, tagLabel } from '../kitchen/RecipeTags';
import type { Customer } from './api';

export const NOTE_KINDS: Record<string, string> = { alerji: 'Alerji', hassasiyet: 'Hassasiyet', dikkat: 'Dikkat', tercih: 'Tercih' };
export const COMPLAINT_CATEGORIES: Record<string, string> = {
  lezzet: 'Lezzet', gramaj: 'Gramaj / porsiyon', hijyen: 'Hijyen', sicaklik: 'Sıcaklık', gec_teslim: 'Geç teslim', eksik: 'Eksik ürün',
  yabanci_madde: 'Yabancı madde', servis: 'Servis', diger: 'Diğer',
};
export const FEEDBACK_KINDS: Record<string, string> = { sikayet: 'Şikâyet', revizyon: 'Değişiklik isteği', oneri: 'Öneri', begeni: 'Beğeni' };
const SEVERITY: Record<string, { label: string; tone: 'idle' | 'wait' | 'stop' }> = { dusuk: { label: 'Düşük', tone: 'idle' }, orta: { label: 'Orta', tone: 'wait' }, yuksek: { label: 'Yüksek', tone: 'stop' } };
const FB_STATUS: Record<string, { label: string; tone: 'wait' | 'info' | 'ok' }> = { yeni: { label: 'Yeni', tone: 'wait' }, incelendi: { label: 'İnceleniyor', tone: 'info' }, cozuldu: { label: 'Çözüldü', tone: 'ok' } };
const RULE_LABELS: Record<string, string> = { yasak_etiket: 'İstemiyor (etiket)', gun_yasak: 'Şu gün istemiyor', haftalik_en_fazla: 'Haftada en fazla', haftalik_en_az: 'Haftada en az', tercih_etiket: 'Tercih ediyor' };
const WEEKDAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Müşteri kartı › Hassasiyet & şikâyet (Faz 3D, istek #18.2 + EK-1 / Not 3, 7) */
export function CustomerCarePanel({ customer }: { customer: Customer }) {
  useLiveTables(['customer_feedback', 'customer_notes']);
  return (
    <div className="space-y-6">
      <NotesSection customer={customer} />
      <RulesSection customer={customer} />
      <FeedbackSection customer={customer} />
    </div>
  );
}

function NotesSection({ customer }: { customer: Customer }) {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'asci_basi', 'diyetisyen', 'pazarlamaci', 'muhasebe']);
  const notes = useRows('customer_notes', { key: [customer.id], filter: (q) => q.eq('customer_id', customer.id).eq('active', true), order: 'created_at' });
  const save = useSaveRow('customer_notes');
  const [f, setF] = useState({ kind: 'alerji', allergen: 'gluten', text: '', people: '' });
  const add = async () => {
    if (f.text.trim().length < 2) return toast.error('Kısa bir açıklama yazın');
    try {
      await save.mutateAsync({ row: { customer_id: customer.id, kind: f.kind, allergen: f.kind === 'alerji' ? f.allergen : null, text: f.text.trim(), people: f.people ? Number(f.people) : null } });
      setF({ ...f, text: '', people: '' }); toast.ok('Not eklendi');
    } catch (e) { toast.error(e); }
  };
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><ShieldAlert className="h-4 w-4 text-[var(--tc-stop)]" /> Alerji ve hassasiyetler</h3>
      <p className="mb-2 text-xs text-ink-3">Alerji kaydı, menüdeki yemeğin malzemesinde aynı alerjen varsa üretim emrinde kırmızı uyarı üretir; sipariş ve üretim ekranında ⚠ rozeti çıkar.</p>
      {notes.isLoading ? <Loading /> : (notes.data ?? []).length === 0 ? <p className="text-sm text-ink-3">Kayıtlı hassasiyet yok.</p> : (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {(notes.data ?? []).map((n) => (
            <li key={n.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Pill tone={n.kind === 'alerji' ? 'stop' : n.kind === 'hassasiyet' ? 'wait' : 'idle'}>{NOTE_KINDS[n.kind]}{n.allergen ? ` · ${ALLERGENS[n.allergen] ?? n.allergen}` : ''}</Pill>
              <span className="min-w-0 flex-1 truncate">{n.text}{n.people ? <span className="text-ink-3"> · {n.people} kişi</span> : null}</span>
              {canEdit && <button type="button" className="rounded-lg p-1.5 text-ink-3 hover:bg-stop-soft hover:text-stop" aria-label="Notu kaldır"
                onClick={() => save.mutate({ id: n.id, row: { active: false } }, { onError: toast.error })}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_1fr_80px_auto]">
          <select className="tc-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Tür">{Object.entries(NOTE_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {f.kind === 'alerji' ? <select className="tc-input" value={f.allergen} onChange={(e) => setF({ ...f, allergen: e.target.value })} aria-label="Alerjen">{Object.entries(ALLERGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <span className="hidden sm:block" />}
          <input className="tc-input col-span-2 sm:col-span-1" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Açıklama (ör. 3 çalışanda çölyak)" aria-label="Açıklama" />
          <input className="tc-input tc-num" inputMode="numeric" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value.replace(/\D/g, '') })} placeholder="Kişi" aria-label="Kişi sayısı" />
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add} loading={save.isPending}>Ekle</Button>
        </div>
      )}
    </section>
  );
}

function RulesSection({ customer }: { customer: Customer }) {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'asci_basi', 'diyetisyen']);
  const rules = useRows('customer_dish_rules', { key: [customer.id], filter: (q) => q.eq('customer_id', customer.id), order: 'created_at' });
  const save = useSaveRow('customer_dish_rules');
  const del = useDeleteRow('customer_dish_rules');
  const [f, setF] = useState({ rule: 'yasak_etiket', tag: 'patlican', weekday: 5, qty: 2, note: '' });
  const add = async () => {
    try {
      await save.mutateAsync({ row: { customer_id: customer.id, rule: f.rule, tag: f.tag, weekday: f.rule === 'gun_yasak' ? f.weekday : null,
        qty: f.rule.startsWith('haftalik') ? f.qty : null, note: f.note.trim() || null, active: true } });
      setF({ ...f, note: '' }); toast.ok('Kural eklendi');
    } catch (e) { toast.error(e); }
  };
  const describe = (r: { rule: string; tag: string | null; weekday: number | null; qty: number | null }) =>
    r.rule === 'gun_yasak' ? `${WEEKDAYS[(r.weekday ?? 1) - 1]} ${tagLabel(r.tag ?? '')} yok`
      : r.rule.startsWith('haftalik') ? `${RULE_LABELS[r.rule]} ${r.qty} kez ${tagLabel(r.tag ?? '')}` : `${RULE_LABELS[r.rule] ?? r.rule}: ${tagLabel(r.tag ?? '')}`;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><AlertTriangle className="h-4 w-4 text-[var(--tc-wait)]" /> Yemek kuralları</h3>
      <p className="mb-2 text-xs text-ink-3">Aylık menü takviminde kurala takılan yemek kırmızı görünür; gerekçesiz yayınlanamaz. Etiketler reçete kartında işaretlenir.</p>
      {(rules.data ?? []).length === 0 ? <p className="text-sm text-ink-3">Kural yok.</p> : (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {(rules.data ?? []).map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">{describe(r)}{r.note ? <span className="text-ink-3"> · {r.note}</span> : null}</span>
              {!r.active && <Pill>Pasif</Pill>}
              {canEdit && <button type="button" className="rounded-lg p-1.5 text-ink-3 hover:bg-stop-soft hover:text-stop" aria-label="Kuralı sil"
                onClick={async () => { if (await askConfirm('Kural silinsin mi?')) del.mutate({ id: r.id }, { onError: toast.error }); }}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="mt-2 flex flex-wrap gap-2">
          <select className="tc-input !w-auto" value={f.rule} onChange={(e) => setF({ ...f, rule: e.target.value })} aria-label="Kural">{Object.entries(RULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {f.rule === 'gun_yasak' && <select className="tc-input !w-auto" value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })} aria-label="Gün">{WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>}
          {f.rule.startsWith('haftalik') && <input className="tc-input tc-num !w-20" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Adet" />}
          <select className="tc-input !w-auto" value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} aria-label="Etiket">{Object.entries(DISH_TAGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input className="tc-input min-w-[160px] flex-1" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Not (ör. müşteri talebi)" aria-label="Not" />
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add} loading={save.isPending}>Ekle</Button>
        </div>
      )}
    </section>
  );
}

function FeedbackSection({ customer }: { customer: Customer }) {
  const toast = useToast();
  const canHandle = useCan(['yonetici', 'asci_basi']);
  const canAdd = useCan(['yonetici', 'asci_basi', 'diyetisyen', 'pazarlamaci', 'muhasebe', 'sofor', 'depo', 'satinalma']);
  const fb = useRows('customer_feedback', { key: [customer.id], filter: (q) => q.eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(50) });
  const save = useSaveRow('customer_feedback');
  const [f, setF] = useState({ kind: 'sikayet', category: 'lezzet', severity: 'orta', date: todayISO(), meal: 'ogle', text: '' });
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const add = async () => {
    if (f.text.trim().length < 3) return toast.error('Açıklama yazın');
    try {
      await save.mutateAsync({ row: { customer_id: customer.id, kind: f.kind, category: f.kind === 'sikayet' ? f.category : null, severity: f.kind === 'sikayet' ? f.severity : null,
        menu_date: f.date, meal: f.meal, text: f.text.trim(), source: 'personel' } });
      setF({ ...f, text: '' }); toast.ok('Kayıt eklendi');
    } catch (e) { toast.error(e); }
  };
  const resolve = async (id: string) => {
    if (resolution.trim().length < 3) return toast.error('Çözümü yazın');
    try { await save.mutateAsync({ id, row: { status: 'cozuldu', resolution: resolution.trim(), handled_at: new Date().toISOString() } }); setResolving(null); setResolution(''); toast.ok('Çözüldü olarak kapatıldı'); } catch (e) { toast.error(e); }
  };
  const list = fb.data ?? [];
  const ratings = list.filter((x) => x.rating != null);
  const avg = ratings.length ? ratings.reduce((s, x) => s + Number(x.rating), 0) / ratings.length : null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><MessageSquareWarning className="h-4 w-4 text-brand" /> Şikâyet ve geri bildirimler
        {avg != null && <span className="ml-auto text-xs font-semibold text-ink-3">Ortalama puan {avg.toFixed(1).replace('.', ',')} / 5 ({ratings.length})</span>}</h3>
      {fb.isLoading ? <Loading /> : list.length === 0 ? <EmptyState title="Kayıt yok">Portal veya personel tarafından girilen şikâyet, öneri ve puanlar burada toplanır.</EmptyState> : (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {list.map((x) => (
            <li key={x.id} className="px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={x.kind === 'sikayet' ? 'stop' : x.kind === 'begeni' ? 'ok' : 'info'}>{FEEDBACK_KINDS[x.kind] ?? x.kind}</Pill>
                {x.severity && <Pill tone={SEVERITY[x.severity]?.tone}>{SEVERITY[x.severity]?.label}</Pill>}
                {x.category && <span className="text-xs text-ink-3">{COMPLAINT_CATEGORIES[x.category] ?? x.category}</span>}
                <span className="text-xs text-ink-3">{shortDay(x.menu_date)} · {MEALS[x.meal] ?? x.meal}{x.rating ? ` · ${'★'.repeat(x.rating)}` : ''} · {x.source === 'portal' ? 'portaldan' : 'personel'}</span>
                <span className="ml-auto"><Pill tone={FB_STATUS[x.status]?.tone}>{FB_STATUS[x.status]?.label}</Pill></span>
              </div>
              {x.text && <div className="mt-1 text-ink-2">{x.text}</div>}
              {x.resolution && <div className="mt-1 text-xs text-[var(--tc-ok)]">Çözüm: {x.resolution}</div>}
              {canHandle && x.status !== 'cozuldu' && (
                resolving === x.id ? (
                  <div className="mt-2 flex gap-2"><input className="tc-input flex-1" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Ne yapıldı? (zorunlu)" aria-label="Çözüm" />
                    <Button size="sm" variant="primary" onClick={() => resolve(x.id)}>Kapat</Button><Button size="sm" onClick={() => setResolving(null)}>Vazgeç</Button></div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    {x.status === 'yeni' && <Button size="sm" onClick={() => save.mutate({ id: x.id, row: { status: 'incelendi' } }, { onError: toast.error })}>İncelemeye al</Button>}
                    <Button size="sm" onClick={() => { setResolving(x.id); setResolution(''); }}>Çözüldü olarak kapat</Button>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd && (
        <div className="mt-3 rounded-2xl ring-1 ring-line bg-card p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Field label="Tür"><select className="tc-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(FEEDBACK_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            {f.kind === 'sikayet' && <Field label="Kategori"><select className="tc-input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(COMPLAINT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>}
            {f.kind === 'sikayet' && <Field label="Önem"><select className="tc-input" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>}
            <Field label="Tarih"><input className="tc-input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Öğün"><select className="tc-input" value={f.meal} onChange={(e) => setF({ ...f, meal: e.target.value })}>{Object.entries(MEALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          </div>
          <div className="mt-2 flex gap-2">
            <input className="tc-input flex-1" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Ne oldu? (ör. pilav soğuk geldi)" aria-label="Açıklama" />
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add} loading={save.isPending}>Ekle</Button>
          </div>
        </div>
      )}
    </section>
  );
}
