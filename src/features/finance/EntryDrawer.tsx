import { useState } from 'react';
import { askConfirm } from '@/ui/confirm';
import { Trash2 } from 'lucide-react';
import { todayISO } from '@/lib/dates';
import { parseNum } from '@/lib/format';
import { Button, Drawer, ErrorNote, Field, Tabs } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useAccounts, useDeleteEntry, useFinanceCategories, useSaveEntry, type FinanceEntry } from './api';

export function CategorySelect({ kind, value, onChange }: { kind: string; value: string; onChange: (v: string) => void }) {
  const cats = useFinanceCategories();
  const list = (cats.data ?? []).filter((c) => c.kind === kind && (c.active || c.code === value));
  const groups = Array.from(new Set(list.map((c) => c.group_name)));
  return (
    <select className="tc-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Kategori">
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {list.filter((c) => c.group_name === g).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/** Gelir veya gider kaydı (manuel). Faturadan/siparişten gelen kayıtlarda yalnızca ödeme bilgisi değiştirilebilir. */
export function EntryDrawer({ entry, defaultKind = 'gider', defaultCategory, onClose }: {
  entry: FinanceEntry | null; defaultKind?: 'gelir' | 'gider'; defaultCategory?: string; onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveEntry();
  const del = useDeleteEntry();
  const accounts = useAccounts();
  const linked = entry ? entry.source !== 'manuel' : false;
  const [kind, setKind] = useState<'gelir' | 'gider'>((entry?.kind as 'gelir' | 'gider') ?? defaultKind);
  const [f, setF] = useState({
    date: entry?.entry_date ?? todayISO(),
    category: entry?.category_code ?? defaultCategory ?? (defaultKind === 'gelir' ? 'organizasyon' : 'diger_gider'),
    description: entry?.description ?? '',
    counterparty: entry?.counterparty ?? '',
    net: entry ? String(entry.net_amount).replace('.', ',') : '',
    vatPct: entry && Number(entry.net_amount) > 0 ? String(Math.round((Number(entry.vat_amount) / Number(entry.net_amount)) * 100)) : '20',
    paid: entry ? entry.status === 'odendi' : true,
    account: entry?.account_id ?? '',
    due: entry?.due_date ?? '',
    paidAt: entry?.paid_at ?? todayISO(),
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const firstAccount = (accounts.data ?? [])[0]?.id ?? '';

  const submit = async () => {
    setErr(null);
    const net = parseNum(f.net);
    const vatPct = parseNum(f.vatPct) ?? 0;
    const account = f.account || firstAccount;
    if (!linked) {
      if (!f.description.trim()) return setErr('Açıklama zorunlu.');
      if (net === null || net < 0) return setErr('Tutar geçersiz.');
    }
    if (f.paid && !account) return setErr('Ödendiyse hangi hesaptan (kasa/banka) seçin.');
    const payment = f.paid
      ? { status: 'odendi', account_id: account, paid_at: f.paidAt || todayISO() }
      : { status: 'bekliyor', account_id: null, paid_at: null, due_date: f.due || null };
    try {
      await save.mutateAsync({
        id: entry?.id ?? null,
        draft: linked ? payment : {
          entry_date: f.date, kind, category_code: f.category, description: f.description.trim(),
          counterparty: f.counterparty.trim() || null, net_amount: net!, vat_amount: Math.round(net! * vatPct) / 100,
          ...payment,
        },
      });
      toast.ok('Kaydedildi');
      onClose();
    } catch (e) { toast.error(e); }
  };

  const remove = async () => {
    if (!entry || !await askConfirm('Kayıt silinsin mi?')) return;
    try { await del.mutateAsync(entry.id); toast.ok('Silindi'); onClose(); } catch (e) { toast.error(e); }
  };

  const net = parseNum(f.net) ?? 0;
  const vat = Math.round(net * (parseNum(f.vatPct) ?? 0)) / 100;

  return (
    <Drawer open onClose={onClose}
      title={entry ? (kind === 'gelir' ? 'Gelir kaydı' : 'Gider kaydı') : kind === 'gelir' ? 'Gelir ekle' : 'Gider ekle'}
      subtitle={linked ? (entry?.source === 'gelen_fatura' ? 'Gelen faturadan oluştu — tutar faturadan gelir' : 'Siparişten oluştu — tutar siparişten gelir') : 'Tutarlar KDV hariç girilir; KDV ayrıca hesaplanır'}
      footer={<>
        {entry && !linked && <Button variant="danger" className="mr-auto" icon={<Trash2 className="w-4 h-4" />} onClick={remove} loading={del.isPending}>Sil</Button>}
        <Button onClick={onClose}>Vazgeç</Button>
        <Button variant="holo" onClick={submit} loading={save.isPending}>Kaydet</Button>
      </>}>
      <div className="space-y-4">
        {!entry && (
          <Tabs value={kind} onChange={(k) => { setKind(k); set({ category: k === 'gelir' ? 'organizasyon' : 'diger_gider' }); }}
            items={[{ id: 'gider', label: 'Gider' }, { id: 'gelir', label: 'Gelir' }]} />
        )}
        <fieldset disabled={linked} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tarih"><input type="date" className="tc-input tc-num" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="Kategori"><CategorySelect kind={kind} value={f.category} onChange={(v) => set({ category: v })} /></Field>
          </div>
          <Field label="Açıklama">
            <input className="tc-input" value={f.description} onChange={(e) => set({ description: e.target.value })}
              placeholder={kind === 'gelir' ? 'Mevlüt yemeği — 200 kişi' : 'Ağustos elektrik faturası'} />
          </Field>
          <Field label={kind === 'gelir' ? 'Kimden (müşteri)' : 'Kime (tedarikçi / kurum)'}>
            <input className="tc-input" value={f.counterparty} onChange={(e) => set({ counterparty: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tutar ₺ (KDV hariç)" className="col-span-2"><input className="tc-input tc-num" inputMode="decimal" value={f.net} onChange={(e) => set({ net: e.target.value })} placeholder="0,00" /></Field>
            <Field label="KDV %"><input className="tc-input tc-num" inputMode="decimal" value={f.vatPct} onChange={(e) => set({ vatPct: e.target.value })} /></Field>
          </div>
          {!linked && net > 0 && <p className="text-xs text-ink-3 -mt-2">KDV {vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ · Toplam {(net + vat).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</p>}
        </fieldset>

        <div className="rounded-2xl ring-1 ring-line bg-card p-4 space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => set({ paid: true })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${f.paid ? 'bg-ok-soft text-ok ring-ok' : 'ring-line text-ink-3'}`}>
              {kind === 'gelir' ? 'Tahsil edildi' : 'Ödendi'}
            </button>
            <button type="button" onClick={() => set({ paid: false })}
              className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ${!f.paid ? 'bg-wait-soft text-wait ring-wait' : 'ring-line text-ink-3'}`}>
              {kind === 'gelir' ? 'Alacak (bekliyor)' : 'Borç (bekliyor)'}
            </button>
          </div>
          {f.paid ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hesap">
                <select className="tc-input" value={f.account || firstAccount} onChange={(e) => set({ account: e.target.value })}>
                  {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id!}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Ödeme tarihi"><input type="date" className="tc-input tc-num" value={f.paidAt} onChange={(e) => set({ paidAt: e.target.value })} /></Field>
            </div>
          ) : (
            <Field label="Vade tarihi"><input type="date" className="tc-input tc-num" value={f.due} onChange={(e) => set({ due: e.target.value })} /></Field>
          )}
        </div>
        {err && <ErrorNote>{err}</ErrorNote>}
      </div>
    </Drawer>
  );
}
