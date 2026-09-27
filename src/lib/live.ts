import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEMO, supabase } from './supabase';

/**
 * Canlı ekran: verilen tablolarda bir kayıt değişince ilgili sorguları tazeler (Supabase Realtime; RLS burada da geçerli).
 * Kanal adı her bileşen için benzersizdir — aynı adla ikinci abonelik "subscribe() sonrası callback" hatası verir.
 */
export function useLiveTables(tables: string[], queryKeys: unknown[][] = []) {
  const qc = useQueryClient();
  const sig = tables.join(',');
  useEffect(() => {
    if (DEMO || tables.length === 0) return;
    let ch = supabase.channel(`canli:${sig}:${Math.random().toString(36).slice(2)}`);
    for (const table of tables) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void qc.invalidateQueries({ queryKey: ['t', table] });
        for (const k of queryKeys) void qc.invalidateQueries({ queryKey: k });
      });
    }
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, sig]);
}
