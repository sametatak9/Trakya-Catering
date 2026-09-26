import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type Customer = Tables<'customers'>;
export type MealOrder = Tables<'meal_orders'>;

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['customers'] }),
    qc.invalidateQueries({ queryKey: ['orders'] }),
    qc.invalidateQueries({ queryKey: ['finance'] }),        // teslim → gelir kaydı
    qc.invalidateQueries({ queryKey: ['production'] }),
  ]);
}

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => unwrap(await supabase.from('customers').select('*').order('name')),
  });
}

export function useSaveCustomer() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'customers'> }) => {
      if (id) return unwrap(await supabase.from('customers').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('customers').insert(draft).select('id').single()).id;
    },
    onSuccess: inv,
  });
}

/** Tarih aralığındaki siparişler (dahil) */
export function useOrders(from: string, to: string = from) {
  return useQuery({
    queryKey: ['orders', from, to],
    queryFn: async () => unwrap(await supabase.from('meal_orders').select('*')
      .gte('service_date', from).lte('service_date', to).order('created_at')),
  });
}

export function useSaveOrder() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string | null; draft: TablesInsert<'meal_orders'> | TablesUpdate<'meal_orders'> }) => {
      if (id) return unwrap(await supabase.from('meal_orders').update(draft).eq('id', id).select('id').single()).id;
      return unwrap(await supabase.from('meal_orders').insert(draft as TablesInsert<'meal_orders'>).select('id').single()).id;
    },
    onSuccess: inv,
  });
}

export function useBulkOrders() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (rows: TablesInsert<'meal_orders'>[]) => {
      if (rows.length === 0) return 0;
      return unwrap(await supabase.from('meal_orders').insert(rows).select('id')).length;
    },
    onSuccess: inv,
  });
}

export function useUpdateOrders() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (items: Array<{ id: string; patch: TablesUpdate<'meal_orders'> }>) => {
      for (const it of items) unwrap(await supabase.from('meal_orders').update(it.patch).eq('id', it.id).select('id').single());
      return items.length;
    },
    onSuccess: inv,
  });
}

export function useDeleteOrder() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('meal_orders').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}

/** Kişi sayısı: teslim edildiyse teslim adedi, yoksa sipariş adedi */
export const orderPeople = (o: Pick<MealOrder, 'delivered_qty' | 'ordered_qty'>) => o.delivered_qty ?? o.ordered_qty;
