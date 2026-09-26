import type { ReactNode } from 'react';
import { HoloSeal, LogoLockup } from '@/ui/Logo';
import { useCompany } from '@/features/settings/api';
import { useMember } from '@/app/session';

/** A4 rapor sayfası: logolu antet, holografik mühür, alt bilgi. Hem ekranda önizleme hem yazdırma için. */
export function ReportFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const company = useCompany().data;
  const member = useMember();
  const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'long', timeStyle: 'short' });
  const addr = [company?.address, company?.city].filter(Boolean).join(', ');
  const tax = [company?.tax_office, company?.tax_no ? `VKN ${company.tax_no}` : null].filter(Boolean).join(' · ');
  return (
    <article className="tc-report-page mx-auto relative">
      {/* Antet */}
      <header className="flex items-start justify-between gap-6 pb-4" style={{ borderBottom: '3px solid #B4432A' }}>
        <div style={{ color: '#221F1B' }}>
          <LogoLockup size={44} />
          <div className="mt-2 text-[10px] leading-relaxed" style={{ color: '#4A443C' }}>
            <div className="font-semibold">{company?.legal_name ?? 'Trakya Catering'}</div>
            {addr && <div>{addr}</div>}
            {tax && <div>{tax}</div>}
            {[company?.phone, company?.email, company?.website].filter(Boolean).join(' · ')}
          </div>
        </div>
        <HoloSeal size={84} />
      </header>
      <div className="h-[3px] -mt-[3px]" style={{ background: 'linear-gradient(90deg, #B4432A 0 38%, #E9A822 38% 100%)' }} />

      <div className="flex items-end justify-between mt-5 mb-4">
        <div>
          <h1 className="font-display text-[22px] font-bold" style={{ color: '#221F1B' }}>{title}</h1>
          {subtitle && <div className="text-[12px] mt-0.5" style={{ color: '#857B6D' }}>{subtitle}</div>}
        </div>
        <div className="text-right text-[10px]" style={{ color: '#857B6D' }}>
          <div>Düzenleme: {now}</div>
          <div>Hazırlayan: {member.fullName}</div>
        </div>
      </div>

      <div className="text-[12px]" style={{ color: '#221F1B' }}>{children}</div>

      <footer className="absolute left-[14mm] right-[14mm] bottom-[8mm] flex justify-between items-end text-[9px]" style={{ color: '#857B6D' }}>
        <span>{company?.report_footer ?? 'Trakya Catering ERP'}</span>
        <span className="flex gap-10">
          <span className="border-t pt-1 w-32 text-center" style={{ borderColor: '#D8CDBA' }}>Hazırlayan</span>
          <span className="border-t pt-1 w-32 text-center" style={{ borderColor: '#D8CDBA' }}>Onaylayan</span>
        </span>
      </footer>
    </article>
  );
}

/** Rapor içi özet kutuları */
export function ReportStats({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="grid gap-2 mb-5" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map((s) => (
        <div key={s.label} className="rounded-lg px-3 py-2" style={{ background: '#FBF8F2', border: '1px solid #EAE3D6' }}>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: '#857B6D' }}>{s.label}</div>
          <div className="text-[15px] font-bold tc-num">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="font-display text-[13px] font-bold mb-1.5" style={{ color: '#B4432A' }}>{title}</h2>
      {children}
    </section>
  );
}
