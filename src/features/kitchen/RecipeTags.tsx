import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tag, X } from 'lucide-react';
import { supabase, unwrap } from '@/lib/supabase';
import { useRows } from '@/lib/crud';
import { Panel } from '@/ui/primitives';
import { useToast } from '@/ui/toast';

/** Sık kullanılan yemek etiketleri (müşteri kuralları ve menü önerisi bunları okur) */
export const DISH_TAGS: Record<string, string> = {
  kirmizi_et: 'Kırmızı et', tavuk: 'Tavuk', balik: 'Balık', sakatat: 'Sakatat', bakliyat: 'Bakliyat', patlican: 'Patlıcan',
  kizartma: 'Kızartma', hamur: 'Hamur işi', sebze: 'Sebze', tatli: 'Tatlı', vegan: 'Vegan', vejetaryen: 'Vejetaryen',
  glutensiz: 'Glutensiz', acili: 'Acılı', domuz_yok: 'Helal', sut_urunu: 'Süt ürünü',
};
export const tagLabel = (t: string) => DISH_TAGS[t] ?? t.replace(/_/g, ' ');

/** Reçete etiketleri (EK-1 / Not 3): "patlıcan yok", "cuma balık yok" gibi müşteri kuralları bu etiketlerle çalışır. */
export function RecipeTags({ recipeId, canEdit }: { recipeId: string; canEdit: boolean }) {
  const toast = useToast();
  const qc = useQueryClient();
  const rows = useRows('recipe_tags', { key: [recipeId], filter: (q) => q.eq('recipe_id', recipeId) });
  const [custom, setCustom] = useState('');
  const have = new Set((rows.data ?? []).map((r) => r.tag));
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['t', 'recipe_tags'] })]);
  const toggle = async (tag: string) => {
    try {
      if (have.has(tag)) unwrap(await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId).eq('tag', tag).select('tag'));
      else unwrap(await supabase.from('recipe_tags').insert({ recipe_id: recipeId, tag }).select('tag'));
      await refresh();
    } catch (e) { toast.error(e); }
  };
  const addCustom = async () => {
    const t = custom.trim().toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (t.length < 2) return toast.error('Etiket en az 2 harf olmalı');
    setCustom('');
    if (!have.has(t)) await toggle(t);
  };
  const all = [...new Set([...Object.keys(DISH_TAGS), ...have])];
  return (
    <Panel className="mt-4" title={<span className="inline-flex items-center gap-2"><Tag className="h-4 w-4 text-brand" />Yemek etiketleri</span>}
      subtitle="Müşteri kuralları (ör. patlıcan yok, cuma balık yok) ve aylık menü önerisi bu etiketleri kullanır">
      <div className="flex flex-wrap gap-1.5">
        {all.map((t) => (
          <button key={t} type="button" disabled={!canEdit} onClick={() => toggle(t)} aria-pressed={have.has(t)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${have.has(t) ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-3 hover:border-line-strong'} disabled:cursor-default`}>
            {tagLabel(t)}{have.has(t) && canEdit && <X className="h-3 w-3" />}
          </button>
        ))}
      </div>
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <input className="tc-input !py-1.5 max-w-[220px]" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Başka etiket (ör. mantar)" aria-label="Yeni etiket"
            onKeyDown={(e) => { if (e.key === 'Enter') void addCustom(); }} />
          <button type="button" className="rounded-xl border border-line px-3 text-sm font-semibold hover:border-line-strong" onClick={() => void addCustom()}>Ekle</button>
        </div>
      )}
    </Panel>
  );
}
