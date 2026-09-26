import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { describeError } from '@/lib/supabase';

interface ToastItem { id: number; kind: 'ok' | 'error'; text: string }
interface ToastApi { ok: (text: string) => void; error: (err: unknown) => void }

const ToastContext = createContext<ToastApi>({ ok: () => undefined, error: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  const api: ToastApi = {
    ok: useCallback((t: string) => push('ok', t), [push]),
    error: useCallback((e: unknown) => push('error', typeof e === 'string' ? e : describeError(e)), [push]),
  };
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} role="status"
            className="tc-holo-in overflow-hidden pointer-events-auto flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl bg-ink text-surface sm:max-w-sm">
            {t.kind === 'ok'
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-accent shrink-0" />
              : <AlertTriangle className="w-4 h-4 mt-0.5 text-brand shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
