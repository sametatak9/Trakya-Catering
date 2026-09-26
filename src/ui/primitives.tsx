import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ReportPreview, type ReportSpec } from '@/reports/ReportButton';
import { AlertTriangle, FileSearch, Inbox, Loader2, X } from 'lucide-react';
import { fmtMoney, fmtQty } from '@/lib/format';

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Button
type BtnVariant = 'primary' | 'accent' | 'ghost' | 'subtle' | 'danger' | 'holo';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong shadow-sm',
  accent: 'bg-accent text-ink hover:bg-accent-strong hover:text-white shadow-sm',
  ghost: 'bg-transparent text-ink-2 ring-1 ring-line-strong hover:bg-surface-2 hover:text-ink',
  subtle: 'bg-surface-2 text-ink-2 hover:bg-line hover:text-ink',
  danger: 'bg-stop-soft text-stop hover:bg-stop hover:text-white',
  holo: 'tc-holo',
};
export function Button({
  children, variant = 'ghost', size = 'md', className = '', loading = false, icon, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        BTN[variant], className,
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Pill
export type Tone = 'ok' | 'wait' | 'stop' | 'info' | 'brand' | 'accent' | 'idle';
const TONES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  wait: 'bg-wait-soft text-wait',
  stop: 'bg-stop-soft text-stop',
  info: 'bg-info-soft text-info',
  brand: 'bg-brand-soft text-brand',
  accent: 'bg-accent-soft text-accent-strong',
  idle: 'bg-surface-2 text-ink-3',
};
export function Pill({ tone = 'idle', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', TONES[tone], className)}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- Panel
export function Panel({ title, subtitle, action, children, className = '', pad = true }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={cx('tc-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-line">
          <div className="min-w-0">
            {title && <h3 className="text-base font-semibold text-ink truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
        </header>
      )}
      <div className={cx(pad && 'p-4 sm:p-5')}>{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------- ModuleHero
export interface HeroStat {
  label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warn' | 'good';
  /** Verilirse kart tıklanabilir olur ve rakamın kaynağını rapor penceresinde gösterir */
  source?: () => ReportSpec;
}

/** Sayı kartı: tıklanınca rakamın hangi kayıtlardan geldiğini logolu rapor penceresinde açar */
export function StatCard({ s }: { s: HeroStat }) {
  const [open, setOpen] = useState(false);
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold text-ink-3">{s.label}</div>
        {s.source && <FileSearch className="w-3.5 h-3.5 text-ink-3 group-hover:text-brand shrink-0" aria-hidden />}
      </div>
      <div className={cx('tc-num text-xl sm:text-2xl font-bold mt-1 break-words',
        s.tone === 'warn' ? 'text-wait' : s.tone === 'good' ? 'text-ok' : 'text-ink')}>{s.value}</div>
      {s.hint && <div className="text-[11px] text-ink-3 mt-0.5 leading-snug">{s.hint}</div>}
    </>
  );
  if (!s.source) return <div className="tc-card px-4 py-3 min-w-0">{body}</div>;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Kaynağını göster"
        className="group tc-card px-4 py-3 min-w-0 text-left transition hover:-translate-y-0.5 hover:ring-2 hover:ring-brand/30 focus-visible:ring-2">
        {body}
      </button>
      {open && <ReportPreview spec={s.source()} onClose={() => setOpen(false)} />}
    </>
  );
}
export function ModuleHero({ kicker, title, description, actions, stats }: {
  kicker?: string; title: string; description?: ReactNode; actions?: ReactNode; stats?: HeroStat[];
}) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker && <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand mb-1.5">{kicker}</div>}
          <h1 className="text-2xl sm:text-[28px] font-bold text-ink leading-tight">{title}</h1>
          {description && <p className="text-sm text-ink-3 mt-1.5 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="tc-harvest-rule w-16 mt-4" />
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-5">
          {stats.map((s) => <StatCard key={s.label} s={s} />)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Field
export function Field({ label, hint, error, children, className = '' }: {
  label: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-xs font-semibold text-ink-2 mb-1.5">{label}</span>
      {children}
      {error ? <span className="block text-[11px] text-stop mt-1">{error}</span>
        : hint ? <span className="block text-[11px] text-ink-3 mt-1">{hint}</span> : null}
    </label>
  );
}

// ---------------------------------------------------------------- Tabs
export function Tabs<T extends string>({ value, onChange, items, className = '' }: {
  value: T; onChange: (v: T) => void; items: Array<{ id: T; label: string; count?: number }>; className?: string;
}) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto tc-scroll p-1 rounded-2xl bg-surface-2 ring-1 ring-line w-full sm:w-fit', className)}>
      {items.map((it) => (
        <button key={it.id} type="button" onClick={() => onChange(it.id)}
          className={cx('px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition',
            value === it.id ? 'bg-card text-ink shadow-sm ring-1 ring-line' : 'text-ink-3 hover:text-ink')}>
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 tc-num text-ink-3">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- States
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-strong grid place-items-center mb-3">
        {icon ?? <Inbox className="w-5 h-5" />}
      </div>
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      {children && <p className="text-sm text-ink-3 mt-1 max-w-md">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-3">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-stop-soft text-stop px-3 py-2.5 text-sm">
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Numbers
export function Money({ value, precise = false, className = '' }: { value: number | null | undefined; precise?: boolean; className?: string }) {
  return <span className={cx('tc-num', className)}>{fmtMoney(value, precise)}</span>;
}
export function Qty({ value, unit, className = '' }: { value: number | null | undefined; unit: string | null | undefined; className?: string }) {
  return <span className={cx('tc-num', className)}>{fmtQty(value, unit)}</span>;
}

// ---------------------------------------------------------------- Drawer (sağdan açılan form paneli)
export function Drawer({ open, onClose, title, subtitle, children, footer, wide = false }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Kapat" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-modal="true"
        className={cx('tc-holo-slide overflow-hidden h-full w-full bg-surface shadow-2xl flex flex-col', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line bg-card">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink truncate">{title}</h2>
            {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink" aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto tc-scroll px-5 py-5">{children}</div>
        {footer && <footer className="px-5 py-3.5 border-t border-line bg-card flex justify-end gap-2">{footer}</footer>}
      </aside>
    </div>
  );
}
