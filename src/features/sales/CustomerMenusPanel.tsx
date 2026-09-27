import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import { Plus, Trash2 } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { todayISO } from '@/lib/dates';
import { MEALS } from '@/lib/domain';
import { fmtMoney, parseNum } from '@/lib/format';
import { askConfirm } from '@/ui/confirm';
import { Button, EmptyState, Field, Loading, Pill } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useMenuCosts } from '../kitchen/api';
import type { Customer } from './api';

export const CUSTOMER_MENU_ROLES = ['yonetici', 'asci_basi', 'diyetisyen', 'muhasebe', 'pazarlamaci'] as const;

/** Müşteri kartı › Menü tanımları (Faz 3D): öğün × menü tipi × sunum şekli × fiyat; siparişte seçilince fiyat/sunum buradan gelir. */
export function CustomerMenusPanel({ customer }: { customer: Customer }) {
  const toast = useToast();
  const canEdit = useCan([...CUSTOMER_MENU_ROLES]);
  const list = useRows('customer_menus', { key: [customer.id], order: 'meal', filter: (q) => q.eq('customer_id', customer.id) });
  const types = useRows('menu_types', { order: 'sort' });
  const styles = useRows('service_styles', { order: 'sort' });
  const costs = useQuery({ queryKey: ['t', 'v_service_style_costs'], queryFn: async () => unwrap(await supabase.from('v_service_style_costs').select('*')) });
  const menus = useMenuCosts();
  const save = useSaveRow('customer_menus');
  const del = useDeleteRow('customer_menus');
  const empty = { meal: 'ogle', name: '', menu_type_code: '4_cesit', service_style: 'tabla_3goz', menu_id: '', price: customer.default_meal_price != null ? String(customer.default_meal_price).replace('.', ',') : '', vat: String(customer.vat_rate ?? 10), from: todayISO(), to: '', is_default: true };
  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const submit = async () => {
    const price = f.price.trim() ? parseNum(f.price) : null;
    if (f.price.trim() && (price === null || price < 0)) return toast.error('Kişi başı fiyat geçersiz');
    if (f.to && f.to < f.from) return toast.error('Bitiş tarihi başlangıçtan önce olamaz');
    try {
      await save.mutateAsync({ id: editing, row: {
        customer_id: customer.id, meal: f.meal, name: f.name.trim() || null, menu_type_code: f.menu_type_code || null, service_style: f.service_style,
        menu_id: f.menu_id || null, unit_price: price, vat_rate: parseNum(f.vat) ?? 10, valid_from: f.from, valid_to: f.to || null, is_default: f.is_default, active: true,
      } });
      toast.ok(editing ? 'Menü tanımı güncellendi' : 'Menü tanımı eklendi');
      setF(empty); setEditing(null);
    } catch (e) { toast.error(e); }
  };
  const packCost = (code: string) => (costs.data ?? []).find((c) => c.code === code)?.pack_cost_per_person;

  if (list.isLoading) return <Loading />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">Bu müşteriye hangi öğünde hangi menüyü, hangi sunumla ve kaç liraya verdiğinizi tanımlayın. Siparişte menü tanımı seçilince fiyat, KDV ve sunum şekli buradan gelir; müşteri portalda yalnız bu menüleri görür.</p>
      {(list.data ?? []).length === 0 ? (
        <EmptyState title="Menü tanımı yok">Tanım yoksa sipariş müşteri kartındaki kişi başı fiyatla ve 3 gözlü tablayla girilir.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {(list.data ?? []).map((m) => {
            const type = (types.data ?? []).find((t) => t.code === m.menu_type_code)?.name;
            const style = (styles.data ?? []).find((s) => s.code === m.service_style)?.name;
            const pc = packCost(m.service_style);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <b className="text-ink">{m.name || type || 'Menü'}</b>
                  <span className="block text-xs text-ink-3">{MEALS[m.meal]} · {type ?? 'tip yok'} · {style}{pc ? ` (ambalaj ${fmtMoney(pc)}/kişi)` : ''} · {m.valid_from}{m.valid_to ? ` → ${m.valid_to}` : ' →'}</span>
                </span>
                {m.is_default && <Pill tone="info">Varsayılan</Pill>}
                {!m.active && <Pill>Pasif</Pill>}
                <b className="tc-num">{m.unit_price != null ? fmtMoney(m.unit_price) : 'kart fiyatı'}</b>
                {canEdit && <>
                  <Button size="sm" onClick={() => { setEditing(m.id); setF({ meal: m.meal, name: m.name ?? '', menu_type_code: m.menu_type_code ?? '', service_style: m.service_style, menu_id: m.menu_id ?? '', price: m.unit_price != null ? String(m.unit_price).replace('.', ',') : '', vat: String(m.vat_rate ?? customer.vat_rate ?? 10), from: m.valid_from, to: m.valid_to ?? '', is_default: m.is_default }); }}>Düzenle</Button>
                  <button type="button" className="rounded-lg p-1.5 text-ink-3 hover:bg-stop-soft hover:text-stop" aria-label="Menü tanımını sil"
                    onClick={async () => { if (await askConfirm('Menü tanımı silinsin mi? Geçmiş siparişlerdeki fiyat değişmez.')) del.mutate({ id: m.id }, { onError: toast.error, onSuccess: () => toast.ok('Silindi') }); }}><Trash2 className="h-4 w-4" /></button>
                </>}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <div className="rounded-2xl ring-1 ring-line bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-ink">{editing ? 'Menü tanımını düzenle' : 'Yeni menü tanımı'}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Öğün"><select className="tc-input" value={f.meal} onChange={(e) => set({ meal: e.target.value })}>{Object.entries(MEALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="Ad (ops.)"><input className="tc-input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Öğle 4 çeşit" /></Field>
            <Field label="Menü tipi"><select className="tc-input" value={f.menu_type_code} onChange={(e) => set({ menu_type_code: e.target.value })}><option value="">—</option>{(types.data ?? []).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</select></Field>
            <Field label="Sunum şekli"><select className="tc-input" value={f.service_style} onChange={(e) => set({ service_style: e.target.value })}>{(styles.data ?? []).filter((s) => s.active).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></Field>
            <Field label="Sabit menü kartı (ops.)" className="col-span-2" hint="Boşsa günlük menü planından gelir">
              <select className="tc-input" value={f.menu_id} onChange={(e) => set({ menu_id: e.target.value })}><option value="">Menü planından</option>{(menus.data ?? []).filter((m) => m.active).map((m) => <option key={m.menu_id} value={m.menu_id!}>{m.name}</option>)}</select>
            </Field>
            <Field label="Kişi başı fiyat ₺" hint="KDV hariç; boşsa müşteri kartı"><input className="tc-input tc-num" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} /></Field>
            <Field label="KDV %"><input className="tc-input tc-num" inputMode="decimal" value={f.vat} onChange={(e) => set({ vat: e.target.value })} /></Field>
            <Field label="Geçerlilik başlangıcı"><input className="tc-input" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} /></Field>
            <Field label="Bitiş (ops.)"><input className="tc-input" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} /></Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" checked={f.is_default} onChange={(e) => set({ is_default: e.target.checked })} className="accent-[var(--tc-brand)]" /> Bu öğünün varsayılan menüsü</label>
          <div className="mt-3 flex justify-end gap-2">
            {editing && <Button onClick={() => { setEditing(null); setF(empty); }}>Vazgeç</Button>}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={submit} loading={save.isPending}>{editing ? 'Kaydet' : 'Ekle'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
