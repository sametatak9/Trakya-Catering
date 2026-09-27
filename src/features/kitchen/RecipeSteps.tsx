import { useState } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useDeleteRow, useRows, useSaveRow } from '@/lib/crud';
import { STATIONS } from '@/lib/domain';
import { Button, Panel, Pill } from '@/ui/primitives';
import { NumInput } from '@/ui/NumCell';
import { useToast } from '@/ui/toast';

/** Yapılış adımları: istasyon, süre, sıcaklık, kritik kontrol noktası. Üretim iş emrine olduğu gibi basılır. */
export function RecipeSteps({ recipeId, canEdit }: { recipeId: string; canEdit: boolean }) {
  const toast = useToast();
  const steps = useRows('recipe_steps', { key: [recipeId], order: 'sort', filter: (q) => q.eq('recipe_id', recipeId) });
  const save = useSaveRow('recipe_steps');
  const del = useDeleteRow('recipe_steps');
  const [f, setF] = useState({ station: 'pisirme', body: '', minutes: null as number | null, temp: null as number | null, ccp: false });
  const list = steps.data ?? [];

  const add = async () => {
    if (!f.body.trim()) return toast.error('Adımı yazın');
    try {
      await save.mutateAsync({ row: { recipe_id: recipeId, sort: (list.at(-1)?.sort ?? 0) + 1, station: f.station, body: f.body.trim(), minutes: f.minutes, temp_c: f.temp, ccp: f.ccp } });
      setF({ ...f, body: '', minutes: null, temp: null, ccp: false });
    } catch (e) { toast.error(e); }
  };

  return (
    <Panel title="Yapılış adımları" subtitle="İş emrine basılır; kritik kontrol noktasında (KKN) sıcaklık ölçülür">
      {list.length === 0 ? <p className="text-sm text-ink-3">Henüz adım yok.</p> : (
        <ol className="space-y-2">
          {list.map((s, i) => (
            <li key={s.id} className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2">
              <span className="w-6 h-6 shrink-0 rounded-full bg-brand text-on-brand grid place-items-center text-xs font-bold">{i + 1}</span>
              <span className="flex-1 min-w-0 text-sm">
                <span className="text-ink">{s.body}</span>
                <span className="block text-[11px] text-ink-3">{STATIONS[s.station]}{s.minutes != null ? ` · ${s.minutes} dk` : ''}{s.temp_c != null ? ` · ${s.temp_c} °C` : ''}</span>
              </span>
              {s.ccp && <Pill tone="stop"><AlertTriangle className="w-3 h-3" /> KKN</Pill>}
              {canEdit && <button type="button" className="p-1 text-ink-3 hover:text-stop" aria-label="Adımı sil"
                onClick={async () => { try { await del.mutateAsync({ id: s.id }); } catch (e) { toast.error(e); } }}><Trash2 className="w-4 h-4" /></button>}
            </li>
          ))}
        </ol>
      )}
      {canEdit && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <select className="tc-input col-span-2 sm:col-span-1" value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} aria-label="İstasyon">
            {Object.entries(STATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="tc-input col-span-2 sm:col-span-2" value={f.body} placeholder="ör. Soğanı kavur" onChange={(e) => setF({ ...f, body: e.target.value })} aria-label="Adım" />
          <NumInput value={f.minutes} onValue={(v) => setF({ ...f, minutes: v })} placeholder="dk" aria-label="Süre (dk)" />
          <NumInput value={f.temp} onValue={(v) => setF({ ...f, temp: v })} placeholder="°C" aria-label="Sıcaklık" />
          <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
            <label className="flex items-center gap-1 text-xs text-ink-2"><input type="checkbox" checked={f.ccp} onChange={(e) => setF({ ...f, ccp: e.target.checked })} /> KKN</label>
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={add} loading={save.isPending}>Ekle</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
