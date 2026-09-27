import { DEMO, setRequestErrorHandler, supabase } from './supabase';

type Kind = 'ekran' | 'pencere' | 'soz' | 'istek' | 'hata';

// İstemci tarafı sınır: dakikada 10, aynı mesaj 1 dakikada bir kez (sunucu ayrıca dakikada 20 ile sınırlar)
const sent: number[] = [];
const seen = new Map<string, number>();

/** Hata merkezine kayıt düşer; kullanıcının işini asla bozmaz. Kişisel veri sunucuda maskelenir. */
export function reportError(kind: Kind, err: unknown, context?: Record<string, unknown>) {
  if (DEMO) return;
  try {
    const e = err as { message?: string; stack?: string; code?: string } | null;
    const message = String(e?.message ?? err ?? '').slice(0, 1000);
    if (!message) return;
    const now = Date.now();
    while (sent.length && now - sent[0] > 60_000) sent.shift();
    const key = `${kind}:${message.slice(0, 200)}`;
    if (sent.length >= 10 || now - (seen.get(key) ?? 0) < 60_000) return;
    sent.push(now); seen.set(key, now);
    void supabase.rpc('log_client_error', {
      p: {
        kind, message, stack: e?.stack?.slice(0, 4000) ?? null,
        route: `${location.pathname}${location.hash}`.slice(0, 300), user_agent: navigator.userAgent.slice(0, 300),
        context: { ...(context ?? {}), ...(e?.code ? { code: e.code } : {}) },
      },
    }).then(() => undefined, () => undefined);
  } catch { /* yok say */ }
}

let installed = false;
/** Yakalanmayan pencere hatalarını ve reddedilen sözleri kaydeder. */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  setRequestErrorHandler((err) => reportError('istek', err));
  window.addEventListener('error', (ev) => reportError('pencere', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportError('soz', ev.reason));
}
