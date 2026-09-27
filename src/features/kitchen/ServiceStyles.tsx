import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useCan } from '@/app/session';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { fmtMoney, parseNum } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { Button, Panel, Pill } from '@/ui/primitives';
import { useToast } from '@/ui/toast';
import { useIngredients } from './api';

export interface StyleCost { code: string | null; name: string | null; pack_mode: string | null; people_per_container: number | null; pack_cost_per_person: number | null; unpriced_count: number | null }

/** Sunum şekli başına kişi başı ambalaj maliyeti (tabla, küvet, sefer tası) */
export function useStyleCosts() {
  return useQuery({
    queryKey: ['t', 'v_service_style_costs'],
    queryFn: async () => unwrap(await supabase.from('v_service_style_costs').select('*')) as StyleCost[],
  });
}

/** Menüler › Sunum şekilleri ve ambalaj: 3 gözlü tabla kişi başı 1 tabla + 1 kapak; küvet 25 kişilik kapta 1 küvet + 1 kapak… */
export function ServiceStylesPanel() {
  const toast = useToast();
  const canEdit = useCan(['yonetici', 'satinalma']);
  const styles = useRows('service_styles', { order: 'sort' });
  const items = useRows('service_style_items');
  const costs = useStyleCosts();
  const ings = useIngredients();
  const save = useSaveRow('service_style_items', ['t']);
  const del = useDeleteRow('service_style_items', ['t']);
  const [f, setF] = useState<Record<string, { ing: string; qty: string }>>({});
  const isPack = (c: string) => ['ambalaj', 'temizlik_sarf', 'mutfak_sarf'].includes(c);
  const packIngs = [...(ings.data ?? [])].sort((a, b) => Number(isPack(b.category)) - Number(isPack(a.category)) || a.name.localeCompare(b.name, 'tr'));

  const add = async (code: string, mode: string) => {
    const d = f[code];
    const qty = d?.qty ? parseNum(d.qty) : null;
    if (!d?.ing || qty === null || qty <= 0) return toast.error('Ambalaj kalemi ve miktar girin');
    try {
      await save.mutateAsync({ row: { style_code: code, ingredient_id: d.ing, qty_per_person: mode === 'kisi_basi' ? qty : null, qty_per_container: mode === 'kap_basi' ? qty : null } });
      setF({ ...f, [code]: { ing: '', qty: '' } });
    } catch (e) { toast.error(e); }
  };

  return (
    <Panel className="mt-4" title={<span className="inline-flex items-center gap-2"><Package className="h-4 w-4 text-brand" />Sunum şekilleri ve ambalaj</span>}
      subtitle="Kişi başı ambalaj maliyeti menü kartlarında “gıda + ambalaj” olarak görünür. Kalemler Stok kartlarındaki ambalaj kategorisinden seçilir.">
      <div className="grid gap-3 md:grid-cols-3">
        {(styles.data ?? []).filter((s) => s.active).map((s) => {
          const c = (costs.data ?? []).find((x) => x.code === s.code);
          const list = (items.data ?? []).filter((i) => i.style_code === s.code);
          return (
            <div key={s.code} className="rounded-2xl ring-1 ring-line bg-card p-3">
              <div className="flex items-center gap-2">
                <b className="text-sm text-ink">{s.name}</b>
                <span className="text-[11px] text-ink-3">{s.pack_mode === 'kap_basi' ? `kap başı · ${s.people_per_container} kişilik` : 'kişi başı'}</span>
                <span className="ml-auto"><Pill tone={c?.pack_cost_per_person ? 'info' : 'idle'}>{c?.pack_cost_per_person ? `${fmtMoney(c.pack_cost_per_person)}/kişi` : 'tanımsız'}</Pill></span>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {list.map((i) => {
                  const ing = (ings.data ?? []).find((x) => x.id === i.ingredient_id);
                  return <li key={i.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{ing?.name ?? '—'}</span>
                    <span className="tc-num text-ink-3">{(i.qty_per_person ?? i.qty_per_container)} {ing?.stock_unit}{s.pack_mode === 'kap_basi' ? '/kap' : '/kişi'}</span>
                    {canEdit && <button type="button" className="text-ink-3 hover:text-stop" aria-label="Kalemi kaldır" onClick={() => del.mutate({ id: i.id }, { onError: toast.error })}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </li>;
                })}
                {list.length === 0 && <li className="text-ink-3">Kalem yok.</li>}
              </ul>
              {(c?.unpriced_count ?? 0) > 0 && <div className="mt-1 text-[11px] text-wait">{c?.unpriced_count} kalemin fiyatı yok</div>}
              {canEdit && (
                <div className="mt-2 flex gap-1.5">
                  <select className="tc-input !py-1 text-xs" value={f[s.code]?.ing ?? ''} onChange={(e) => setF({ ...f, [s.code]: { ing: e.target.value, qty: f[s.code]?.qty ?? '1' } })} aria-label="Ambalaj kalemi">
                    <option value="">Kalem seç…</option>
                    {packIngs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input className="tc-input tc-num !w-16 !py-1 text-xs" inputMode="decimal" value={f[s.code]?.qty ?? ''} onChange={(e) => setF({ ...f, [s.code]: { ing: f[s.code]?.ing ?? '', qty: e.target.value } })} aria-label="Miktar" placeholder="1" />
                  <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => add(s.code, s.pack_mode)} aria-label="Ekle" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
