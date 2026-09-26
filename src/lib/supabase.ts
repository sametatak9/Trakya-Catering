import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Demo modu (VITE_DEMO=1): müşteriye gösterilecek tıklanabilir tanıtım sürümü.
 * Supabase'e hiç bağlanmaz; istekleri tarayıcı içindeki demo sunucusu yanıtlar (src/demo).
 * Yalnız ayrı derlemeyle açılır (npm run build:demo); gerçek sürümde bu kod yüklenmez.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';
// Gerçek sürümde uydurma veri gösterilmez: daha önce demo açmış tarayıcıların hatırladığı ayar temizlenir.
if (!DEMO) { try { localStorage.removeItem('tc_mode'); localStorage.removeItem('tc_demo_db'); localStorage.removeItem('tc-demo-auth'); } catch { /* yok say */ } }

const url = DEMO ? 'https://demo.trakyacatering.test' : (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = DEMO ? 'demo' : (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** Ortam değişkenleri eksikse uygulama sahte veriye düşmez; kurulum ekranı gösterilir. */
export const supabaseConfigured = Boolean(url && key);

const demoFetch: typeof fetch = async (input, init) => (await import('@/demo/server')).demoFetch(input, init);

export const supabase = createClient<Database>(url || 'https://invalid.local', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: !DEMO, ...(DEMO ? { storageKey: 'tc-demo-auth' } : {}) },
  ...(DEMO ? { global: { fetch: demoFetch } } : {}),
});

/** Supabase hatasını kullanıcıya gösterilebilir Türkçe mesaja çevirir. */
export function describeError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return 'Bilinmeyen hata';
  switch (e.code) {
    case '42501':
    case 'PGRST116': return 'Bu işlem için yetkiniz yok ya da kayıt bulunamadı.';
    case '23505': return 'Aynı isim/kodla bir kayıt zaten var.';
    case '23503': return 'Bu kayıt başka kayıtlarda kullanıldığı için silinemez.';
    case '23514': return 'Girilen değer kurallara uymuyor (ör. negatif miktar, %100 fire).';
    default: return e.message || 'Beklenmeyen hata';
  }
}

/** { data, error } sonucunu açar; hata varsa fırlatır (react-query onError'a düşer). */
export function unwrap<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error;
  return res.data as NonNullable<R['data']>;
}
