/* eslint-disable @typescript-eslint/no-explicit-any */
// Yeni modüller için ortak veri kancaları. Her ekran kendi tablosunu okur/yazar; RLS yetkiyi veritabanında denetler.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database, Tables } from './database.types';
import { supabase, unwrap } from './supabase';

export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Tables<T>;

type Filter = (q: any) => any;

/** Tablo listesi. `key` filtreyi tanımlayan değerlerdir (tarih aralığı vb.); tablo adı otomatik eklenir. */
export function useRows<T extends TableName>(table: T, opts: {
  key?: unknown[]; select?: string; order?: string; ascending?: boolean; filter?: Filter; enabled?: boolean; refetchInterval?: number;
} = {}) {
  return useQuery({
    queryKey: ['t', table, ...(opts.key ?? [])],
    enabled: opts.enabled ?? true,
    refetchInterval: opts.refetchInterval,
    queryFn: async () => {
      let q: any = supabase.from(table as any).select(opts.select ?? '*');
      if (opts.filter) q = opts.filter(q);
      if (opts.order) q = q.order(opts.order, { ascending: opts.ascending ?? true });
      return unwrap(await q) as unknown as Row<T>[];
    },
  });
}

/** Ekle/güncelle. `also`: ayrıca tazelenecek sorgu önekleri (ör. 'finance' — tetikleyiciyle gider oluşuyorsa). */
export function useSaveRow<T extends TableName>(table: T, also: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, row, idColumn = 'id' }: { id?: string | null; row: Record<string, unknown>; idColumn?: string }) => {
      const t: any = supabase.from(table as any);
      if (id) return unwrap(await t.update(row).eq(idColumn, id).select().single()) as unknown as Row<T>;
      return unwrap(await t.insert(row).select().single()) as unknown as Row<T>;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['t', table] }), ...also.map((k) => qc.invalidateQueries({ queryKey: [k] }))]),
  });
}

/** Toplu ekleme (içe aktarma, yoklama, irsaliye satırları…) — upsert için onConflict verin */
export function useInsertRows<T extends TableName>(table: T, also: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, onConflict }: { rows: Record<string, unknown>[]; onConflict?: string }) => {
      if (rows.length === 0) return 0;
      const t: any = supabase.from(table as any);
      const res = onConflict ? await t.upsert(rows, { onConflict }).select('*') : await t.insert(rows).select('*');
      return (unwrap(res) as unknown[]).length;
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['t', table] }), ...also.map((k) => qc.invalidateQueries({ queryKey: [k] }))]),
  });
}

export function useDeleteRow<T extends TableName>(table: T, also: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idColumn = 'id' }: { id: string; idColumn?: string }) => {
      const rows = unwrap(await (supabase.from(table as any) as any).delete().eq(idColumn, id).select(idColumn)) as unknown[];
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['t', table] }), ...also.map((k) => qc.invalidateQueries({ queryKey: [k] }))]),
  });
}
