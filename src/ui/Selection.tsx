import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from './primitives';

/** Listelerde çoklu seçim. Liste değişince görünmeyen seçimler düşer. */
export function useSelection(visibleIds: string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const key = visibleIds.join('|');
  useEffect(() => {
    setSel((cur) => {
      const vis = new Set(key ? key.split('|') : []);
      const next = new Set([...cur].filter((id) => vis.has(id)));
      return next.size === cur.size ? cur : next;
    });
  }, [key]);
  return useMemo(() => ({
    selected: sel,
    ids: [...sel],
    count: sel.size,
    has: (id: string) => sel.has(id),
    toggle: (id: string) => setSel((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    allChecked: visibleIds.length > 0 && visibleIds.every((id) => sel.has(id)),
    someChecked: sel.size > 0 && !visibleIds.every((id) => sel.has(id)),
    toggleAll: () => setSel((cur) => (visibleIds.length > 0 && visibleIds.every((id) => cur.has(id)) ? new Set() : new Set(visibleIds))),
    clear: () => setSel(new Set()),
  }), [sel, key]);
}

export function SelectBox({ checked, indeterminate = false, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <input type="checkbox" aria-label={label} checked={checked} onChange={onChange}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded accent-[var(--tc-brand)] cursor-pointer align-middle" />
  );
}

/** Seçim varken ekranın altında beliren toplu işlem çubuğu (hologram açılış) */
export function BulkBar({ count, onClear, children, noun = 'kayıt' }: { count: number; onClear: () => void; children: ReactNode; noun?: string }) {
  if (count === 0) return null;
  return (
    <div className="tc-no-print fixed bottom-16 left-1/2 -translate-x-1/2 lg:left-[calc(50%+132px)] z-40 w-[calc(100%-24px)] sm:w-auto">
      <div className={cx('tc-holo-in overflow-hidden flex flex-wrap items-center gap-2 rounded-2xl bg-card ring-1 ring-line shadow-2xl px-3 py-2.5')}>
        <span className="inline-flex items-center gap-2 pr-1 text-sm font-bold text-ink">
          <span className="min-w-7 h-7 px-1.5 rounded-lg tc-holo grid place-items-center tc-num text-[13px]">{count}</span>
          {noun} seçildi
        </span>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <button type="button" onClick={onClear} className="ml-auto p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2" aria-label="Seçimi temizle"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
