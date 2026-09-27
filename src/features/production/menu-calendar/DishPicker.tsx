import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chipFlags, type CalCourse, type CustomerRule, type DishIndex } from './rules';

const COURSE_SHORT: Record<CalCourse, string> = {
  corba: 'çorba', ana: 'ana', yardimci: 'yardımcı', salata: 'salata', meze: 'meze', tatli: 'tatlı', icecek: 'içecek', ekmek: 'ekmek', kahvalti: 'kahvaltı',
};

/**
 * Hızlı yemek seçici (maketteki "+" açılır penceresi). Ad ve etiketle arar; müşteri yasağına takılan yemek kırmızı yazılır,
 * seçilirse gerekçe istenir (gerekçesiz yayınlanamaz).
 */
export function DishPicker({ anchor, slot, index, rules, onPick, onClose }: {
  anchor: DOMRect; slot: string; index: DishIndex; rules: CustomerRule[];
  onPick: (recipeId: string, override: string | null) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => {
    const nq = q.trim().toLocaleLowerCase('tr');
    return [...index.entries()]
      .filter(([, d]) => !nq || d.name.toLocaleLowerCase('tr').includes(nq) || d.tags.some((t) => t.includes(nq)))
      .sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'))
      .slice(0, 40)
      .map(([id, d]) => {
        const f = chipFlags({ [slot]: [{ recipeId: id, name: d.name, course: d.course }] }, index, rules).get(`${slot}|0`);
        return { id, d, banned: !!f?.banned, why: f?.reasons.join(', ') ?? '' };
      });
  }, [q, index, rules, slot]);

  useEffect(() => {
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const choose = (i: number) => {
    const it = list[i]; if (!it) return;
    if (it.banned) { setPending(it.id); return; }
    onPick(it.id, null);
  };
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - 312));
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 340);

  return createPortal(
    <div ref={ref} className="mc-pop" style={{ left, top }} role="dialog" aria-label="Yemek seç">
      {pending ? (
        <div className="p-1 space-y-2">
          <div className="text-sm"><b className="text-ink">{index.get(pending)?.name}</b> müşteri kuralına takılıyor:
            <div className="text-xs text-[var(--tc-stop)] mt-1">{list.find((x) => x.id === pending)?.why}</div></div>
          <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Gerekçe (ör. müşteri bu hafta onayladı)" aria-label="Gerekçe"
            onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim().length >= 3) onPick(pending, reason.trim()); }} />
          <div className="flex gap-2 justify-end">
            <button type="button" className="tc-btn-ghost text-sm px-3 py-1.5 rounded-lg" onClick={() => setPending(null)}>Vazgeç</button>
            <button type="button" disabled={reason.trim().length < 3} className="text-sm px-3 py-1.5 rounded-lg bg-[var(--tc-brand)] text-white disabled:opacity-40"
              onClick={() => onPick(pending, reason.trim())}>Gerekçeyle ekle</button>
          </div>
        </div>
      ) : (<>
        <input autoFocus value={q} placeholder="Yemek ara… (ör. mercimek)" autoComplete="off" aria-label="Yemek ara"
          onChange={(e) => { setQ(e.target.value); setHl(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, list.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); choose(hl); }
          }} />
        <ul>
          {list.length === 0 && <li className="px-2 py-3 text-xs text-ink-3">Eşleşen yemek yok. Reçeteler ekranından yeni yemek ekleyin.</li>}
          {list.map((it, i) => (
            <li key={it.id} className={it.banned ? 'warn' : ''}>
              <button type="button" className={i === hl ? 'hl' : ''} onMouseEnter={() => setHl(i)} onClick={() => choose(i)}>
                <i className={`k k-${it.d.course}`} style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block' }} />
                <span className="truncate">{it.d.name}</span>
                <small>{it.banned ? 'müşteri istemiyor' : `${COURSE_SHORT[it.d.course]}${it.d.cost != null ? ` · ${it.d.cost.toFixed(0)} ₺` : ''}`}</small>
              </button>
            </li>
          ))}
        </ul>
      </>)}
    </div>,
    document.body,
  );
}
