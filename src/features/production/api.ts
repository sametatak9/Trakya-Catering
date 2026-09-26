import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type ProductionLog = Tables<'production_logs'>;

export function useProduction(from: string, to: string = from) {
  return useQuery({
    queryKey: ['production', from, to],
    queryFn: async () => unwrap(await supabase.from('production_logs').select('*')
      .gte('prod_date', from).lte('prod_date', to).order('created_at')),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['production'] });
}

export function usePlanFromOrders() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ date, meal }: { date: string; meal: string }) =>
      unwrap(await supabase.rpc('plan_production_from_orders', { p_date: date, p_meal: meal })),
    onSuccess: inv,
  });
}

export function useRefreshCosts() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (date: string) => unwrap(await supabase.rpc('refresh_production_costs', { p_date: date })),
    onSuccess: inv,
  });
}

export function useAddProduction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (row: { prod_date: string; meal: string; recipe_id: string; portions: number }) =>
      unwrap(await supabase.from('production_logs').upsert({ ...row, source: 'manuel' }, { onConflict: 'prod_date,meal,recipe_id' }).select('id').single()),
    onSuccess: inv,
  });
}

export function useUpdateProduction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, portions }: { id: string; portions: number }) =>
      unwrap(await supabase.from('production_logs').update({ portions, source: 'manuel' }).eq('id', id).select('id').single()),
    onSuccess: inv,
  });
}

export function useDeleteProduction() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const rows = unwrap(await supabase.from('production_logs').delete().eq('id', id).select('id'));
      if (rows.length === 0) throw { code: '42501' };
    },
    onSuccess: inv,
  });
}
