import { addDays, addMonths, monthKey, monthRange, todayISO } from '@/lib/dates';
import { cx } from './primitives';

export interface Range { from: string; to: string }
export type RangePreset = 'bugun' | 'dun' | 'bu_hafta' | 'bu_ay' | 'gecen_ay' | 'son_30' | 'ozel';

export const PRESET_LABELS: Record<RangePreset, string> = {
  bugun: 'Bugün', dun: 'Dün', bu_hafta: 'Bu hafta', bu_ay: 'Bu ay', gecen_ay: 'Geçen ay', son_30: 'Son 30 gün', ozel: 'Özel',
};

/** Pazartesi başlangıçlı hafta */
export function presetRange(p: Exclude<RangePreset, 'ozel'>, today = todayISO()): Range {
  switch (p) {
    case 'bugun': return { from: today, to: today };
    case 'dun': { const d = addDays(today, -1); return { from: d, to: d }; }
    case 'bu_hafta': {
      const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDays(today, -dow), to: addDays(today, 6 - dow) };
    }
    case 'bu_ay': return monthRange(monthKey(today));
    case 'gecen_ay': return monthRange(addMonths(monthKey(today), -1));
    case 'son_30': return { from: addDays(today, -29), to: today };
  }
}

export function DateRange({ value, preset, onChange, presets = ['bugun', 'bu_hafta', 'bu_ay', 'gecen_ay', 'ozel'] }: {
  value: Range; preset: RangePreset; onChange: (r: Range, p: RangePreset) => void; presets?: RangePreset[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex gap-1 p-1 rounded-2xl bg-surface-2 ring-1 ring-line overflow-x-auto tc-scroll">
        {presets.map((p) => (
          <button key={p} type="button"
            onClick={() => onChange(p === 'ozel' ? value : presetRange(p), p)}
            className={cx('px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap',
              preset === p ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-ink-3 hover:text-ink')}>
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {preset === 'ozel' && (
        <div className="flex items-center gap-1.5">
          <input type="date" className="tc-input !w-auto !py-1.5 tc-num" value={value.from} aria-label="Başlangıç"
            onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to }, 'ozel')} />
          <span className="text-ink-3">–</span>
          <input type="date" className="tc-input !w-auto !py-1.5 tc-num" value={value.to} aria-label="Bitiş"
            onChange={(e) => e.target.value && onChange({ from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value }, 'ozel')} />
        </div>
      )}
    </div>
  );
}
