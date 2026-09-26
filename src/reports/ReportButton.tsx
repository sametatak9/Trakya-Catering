import { useEffect, useState, type ReactNode } from 'react';
import { FileSpreadsheet, FileText, MessageCircle, Printer, Share2, X } from 'lucide-react';
import { Button } from '@/ui/primitives';
import { downloadCsv, type Cell } from './csv';
import { ReportFrame } from './ReportFrame';
import { buildSummaryText, whatsappUrl, type SummaryLine } from './share';

export interface ReportSpec {
  title: string;
  subtitle?: string;
  /** Rapor gövdesi (tablolar) */
  body: () => ReactNode;
  /** WhatsApp / paylaşım için kısa özet */
  summary?: SummaryLine[];
  /** Excel (CSV) dışa aktarımı */
  table?: { header: string[]; rows: Cell[][]; filename: string };
  /** WhatsApp alıcı telefonu (ör. müşteri) */
  phone?: string | null;
}

/** Her sekmede kullanılan "Rapor" butonu: önizleme → Yazdır/PDF · Excel · WhatsApp · Paylaş */
export function ReportButton({ spec, label = 'Rapor', size = 'md', disabled }: {
  spec: ReportSpec | (() => ReportSpec); label?: string; size?: 'sm' | 'md'; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="holo" size={size} icon={<FileText className="w-4 h-4" />} onClick={() => setOpen(true)} disabled={disabled}>{label}</Button>
      {open && <ReportPreview spec={typeof spec === 'function' ? spec() : spec} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ReportPreview({ spec, onClose }: { spec: ReportSpec; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevTitle = document.title;
    document.title = `${spec.title}${spec.subtitle ? ` — ${spec.subtitle}` : ''}`;   // PDF dosya adı
    return () => { window.removeEventListener('keydown', onKey); document.title = prevTitle; };
  }, [onClose, spec.title, spec.subtitle]);

  const text = buildSummaryText(spec.title, spec.subtitle ?? '', spec.summary ?? [], 'Trakya Catering');
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink/60 backdrop-blur-sm">
      <div className="tc-no-print flex flex-wrap items-center gap-2 px-4 py-3 bg-card border-b border-line">
        <div className="font-semibold text-ink mr-auto truncate">{spec.title}</div>
        <Button variant="holo" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Yazdır / PDF</Button>
        {spec.table && (
          <Button icon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={() => downloadCsv(spec.table!.filename, spec.table!.header, spec.table!.rows)}>Excel</Button>
        )}
        {spec.summary && (
          <a href={whatsappUrl(text, spec.phone)} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold bg-[#25D366] text-white hover:brightness-95">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        )}
        {spec.summary && canShare && (
          <Button icon={<Share2 className="w-4 h-4" />} onClick={() => void navigator.share({ title: spec.title, text }).catch(() => undefined)}>Paylaş</Button>
        )}
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-ink-3 hover:bg-surface-2" aria-label="Kapat"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="tc-print-root">
          <div className="tc-holo-in overflow-hidden w-fit max-w-full mx-auto"><ReportFrame title={spec.title} subtitle={spec.subtitle}>{spec.body()}</ReportFrame></div>
        </div>
      </div>
      <p className="tc-no-print text-center text-[11px] text-white/80 pb-2">PDF için “Yazdır / PDF” → hedef olarak “PDF olarak kaydet”i seçin.</p>
    </div>
  );
}
