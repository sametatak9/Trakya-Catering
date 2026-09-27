import { QueryClient } from '@tanstack/react-query';

/** Uygulamanın tek sorgu önbelleği. Çıkışta tamamen temizlenir (başka kullanıcı eski veriyi görmesin). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

/** Kullanıcıya özel yerel durum: çıkışta silinir. Tema gibi cihaz ayarları kalır. */
const USER_KEY_PREFIXES = ['tc_user:', 'tc_filter:', 'tc_draft:'];

export function clearUserState() {
  queryClient.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && USER_KEY_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
    sessionStorage.clear();
  } catch { /* depolama kapalı olabilir */ }
}
