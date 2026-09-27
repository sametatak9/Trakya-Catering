import { useState } from 'react';
import { CAL_MEAL_LABELS, slotCost, slotKey, type CalMeal, type ChipFlag, type DishIndex, type Plan } from './rules';

export interface DragState { key: string; index: number }

export interface CellHandlers {
  readOnly: boolean;
  onAdd: (key: string, anchor: DOMRect) => void;
  onRemove: (key: string, i: number) => void;
  onDrop: (to: string, copy: boolean) => void;
  onDragStart: (d: DragState) => void;
  onSelectChip: (key: string, i: number) => void;
  onSelectSlot: (key: string) => void;
  selectedChip: string | null;          // 'key|i'
  targetSlot: string | null;
}

/** Tek öğün bandı: başlık (öğün adı · kişi başı gıda maliyeti · +), yemek çipleri; sürükle-bırak hedefi */
export function MealBand({ day, meal, plan, flags, index, h }: {
  day: string; meal: CalMeal; plan: Plan; flags: Map<string, ChipFlag>; index: DishIndex; h: CellHandlers;
}) {
  const key = slotKey(day, meal);
  const arr = plan[key] ?? [];
  const [over, setOver] = useState(false);
  const { cost, missing } = slotCost(arr, index);
  return (
    <div className={`mc-meal m-${meal} ${over ? 'drop' : ''} ${h.targetSlot === key ? 'target' : ''}`}
      onDragOver={(e) => { if (h.readOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = e.altKey || e.ctrlKey ? 'copy' : 'move'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!h.readOnly) h.onDrop(key, e.altKey || e.ctrlKey || e.metaKey); }}
      onClick={(e) => { if (e.target === e.currentTarget) h.onSelectSlot(key); }}>
      <div className="mc-mh" onClick={() => h.onSelectSlot(key)}>
        {CAL_MEAL_LABELS[meal]}
        {arr.length > 0 && <span className="mc-mc" title={missing ? `${missing} yemeğin maliyeti yok` : 'Kişi başı gıda maliyeti'}>{cost.toFixed(0)} ₺{missing ? '*' : ''}</span>}
        {!h.readOnly && <button type="button" className="mc-add" aria-label={`${day} ${CAL_MEAL_LABELS[meal]} yemek ekle`}
          onClick={(e) => { e.stopPropagation(); h.onAdd(key, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}>+</button>}
      </div>
      {arr.map((d, i) => {
        const f = flags.get(`${key}|${i}`);
        const cls = [f?.repeat && 'rep', f?.banned && 'ban', f?.banned && d.override && 'ok', h.selectedChip === `${key}|${i}` && 'sel'].filter(Boolean).join(' ');
        const why = [...(f?.reasons ?? []), d.override ? `Gerekçe: ${d.override}` : ''].filter(Boolean).join(' · ');
        return (
          <div key={`${d.recipeId}-${i}`} className={`mc-chip ${cls}`} draggable={!h.readOnly} title={`${d.name}${why ? ` — ${why}` : ''}`}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('text/plain', d.name); (e.currentTarget as HTMLElement).classList.add('dragging'); h.onDragStart({ key, index: i }); }}
            onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove('dragging')}
            onClick={() => h.onSelectChip(key, i)}>
            <i className={`k k-${d.course}`} />
            <span className="nm">{d.name}</span>
            {!h.readOnly && <button type="button" className="x" aria-label={`${d.name} kaldır`} onClick={(e) => { e.stopPropagation(); h.onRemove(key, i); }}>×</button>}
          </div>
        );
      })}
    </div>
  );
}
