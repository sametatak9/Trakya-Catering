import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { addDays, addMonths, dayLabel, monthLabel, todayISO } from '@/lib/dates';
import { fmtMoney, fmtNum } from '@/lib/format';
import { cx } from './primitives';

/** Gün seçici: ◀ Bugün ▶ + takvim */
export function DateNav({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const today = todayISO();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={() => onChange(addDays(value, -1))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink" aria-label="Önceki gün">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <input type="date" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className="tc-input !w-auto !py-2 tc-num" aria-label="Tarih" />
      <button type="button" onClick={() => onChange(addDays(value, 1))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink" aria-label="Sonraki gün">
        <ChevronRight className="w-4 h-4" />
      </button>
      {value !== today && (
        <button type="button" onClick={() => onChange(today)} className="px-3 py-2 rounded-xl text-xs font-semibold text-brand hover:bg-brand-soft">Bugün</button>
      )}
      <span className="text-sm text-ink-3 ml-1 hidden sm:inline">{dayLabel(value)}</span>
    </div>
  );
}

export function MonthNav({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(addMonths(value, -1))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink" aria-label="Önceki ay">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="min-w-[132px] text-center text-sm font-semibold text-ink">{monthLabel(value)}</div>
      <button type="button" onClick={() => onChange(addMonths(value, 1))} className="p-2 rounded-xl ring-1 ring-line bg-card text-ink-2 hover:text-ink" aria-label="Sonraki ay">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Artış / azalış rozeti. goodWhen: gider için 'down' (azalış iyi), gelir için 'up'.
 */
export function Delta({ pct, delta, goodWhen, money = true, className = '' }: {
  pct: number | null; delta: number; goodWhen: 'up' | 'down'; money?: boolean; className?: string;
}) {
  if (delta === 0) {
    return <span className={cx('inline-flex items-center gap-1 text-[11px] font-semibold text-ink-3', className)}><Minus className="w-3 h-3" />değişim yok</span>;
  }
  const up = delta > 0;
  const good = (up && goodWhen === 'up') || (!up && goodWhen === 'down');
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx('inline-flex items-center gap-0.5 text-[11px] font-semibold tc-num', good ? 'text-ok' : 'text-stop', className)}>
      <Icon className="w-3.5 h-3.5" />
      {pct !== null ? `%${fmtNum(Math.abs(pct), 0)}` : money ? fmtMoney(Math.abs(delta)) : fmtNum(Math.abs(delta))}
    </span>
  );
}

/** Mini sütun grafiği (son n dönem). Son sütun vurgulu. */
export function SparkBars({ series, className = '', tone = 'brand', labels }: {
  series: number[]; className?: string; tone?: 'brand' | 'ok' | 'accent'; labels?: string[];
}) {
  const max = Math.max(...series, 1);
  const color = tone === 'ok' ? 'bg-ok' : tone === 'accent' ? 'bg-accent' : 'bg-brand';
  return (
    <div className={cx('flex items-end gap-1 h-10', className)} aria-hidden="true">
      {series.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={labels ? `${labels[i]}: ${fmtMoney(v)}` : undefined}>
          <div className={cx('w-full rounded-t-[3px] min-h-[2px]', i === series.length - 1 ? color : 'bg-line-strong')}
            style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

/** Basit ilerleme çubuğu (pay / oran gösterimi) */
export function Meter({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'accent' | 'ok' | 'stop' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = { brand: 'bg-brand', accent: 'bg-accent', ok: 'bg-ok', stop: 'bg-stop' }[tone];
  return (
    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
      <div className={cx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Yönlendirme ipucu: boş/eksik durumda kullanıcıya ne yapacağını söyler */
export function Hint({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl bg-accent-soft/70 ring-1 ring-accent/30 px-4 py-3 text-sm text-ink-2">
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
