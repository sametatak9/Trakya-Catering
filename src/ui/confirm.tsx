import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from './primitives';

// Uygulama içi onay penceresi (tarayıcının confirm() kutusu yerine).
// Her yerden çağrılabilir: `if (!(await askConfirm('Silinsin mi?'))) return;`

interface Pending { message: string; resolve: (ok: boolean) => void }
let open: ((p: Pending) => void) | null = null;

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (open) open({ message, resolve });
    else resolve(window.confirm(message));
  });
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => { open = setP; return () => { open = null; }; }, []);
  useEffect(() => {
    if (!p) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { p.resolve(false); setP(null); }
      if (e.key === 'Enter') { p.resolve(true); setP(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);
  if (!p) return null;
  const done = (ok: boolean) => { p.resolve(ok); setP(null); };
  const danger = /sil|kaldır|sıfırla/i.test(p.message);
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button type="button" aria-label="Vazgeç" className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => done(false)} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="tc-confirm-text"
        className="tc-holo-in overflow-hidden w-full max-w-sm rounded-2xl bg-card ring-1 ring-line shadow-2xl p-5">
        <div className="flex gap-3">
          <span className={`w-10 h-10 shrink-0 rounded-xl grid place-items-center ${danger ? 'bg-stop-soft text-stop' : 'bg-accent-soft text-accent-strong'}`}>
            <AlertTriangle className="w-5 h-5" />
          </span>
          <p id="tc-confirm-text" className="text-[15px] leading-snug text-ink pt-1.5">{p.message}</p>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button onClick={() => done(false)}>Vazgeç</Button>
          <Button variant={danger ? 'danger' : 'holo'} onClick={() => done(true)} autoFocus>{danger ? 'Evet, sil' : 'Evet'}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
